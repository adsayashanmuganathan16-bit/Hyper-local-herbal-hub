# AWS deployment without Docker

This guide deploys Herbal Hub directly on one Ubuntu 24.04 EC2 instance:

- Nginx serves the compiled React frontend on port `80`.
- systemd runs FastAPI through Uvicorn on private port `8000`.
- Nginx proxies API, upload, and WebSocket requests to FastAPI.
- An AWS Application Load Balancer (ALB) terminates HTTPS.
- MongoDB Atlas stores application data.
- A private S3 bucket stores images using the EC2 IAM role.

## 1. AWS resources

Create these resources before configuring the server:

1. An Ubuntu 24.04 EC2 instance.
2. A private S3 bucket with public access blocked.
3. An EC2 IAM role with least-privilege access to that bucket, attached to the
   instance. Do not store permanent AWS keys on EC2.
4. An ALB target group using HTTP port `80` and health path `/health`.
5. An HTTPS ALB listener using an ACM certificate.
6. A Route 53 alias from the application domain to the ALB.
7. A MongoDB Atlas production database and least-privilege database user.

Security groups:

- ALB: allow inbound `443` from the internet. Optionally redirect `80` to
  `443`.
- EC2: allow inbound `80` only from the ALB security group and `22` only from
  a trusted administrator IP. Never expose `8000` or `27017`.
- Atlas: allow the EC2 egress IP, not `0.0.0.0/0`.

## 2. Install server packages

Connect to EC2 and run:

```bash
sudo apt update
sudo apt install -y git nginx python3 python3-venv python3-pip curl
```

Install Node.js 20 from NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## 3. Clone and install the application

```bash
sudo mkdir -p /var/www/herbal
sudo chown ubuntu:www-data /var/www/herbal
git clone https://github.com/adsayashanmuganathan16-bit/Hyper-local-herbal-hub.git /var/www/herbal
cd /var/www/herbal
```

Install the backend:

```bash
cd /var/www/herbal/backend
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt
cp .env.example .env
chmod 600 .env
mkdir -p uploads/profile-images
```

Install and build the frontend:

```bash
cd /var/www/herbal/frontend
cp .env.example .env.production
npm ci
npm run build
```

## 4. Configure production environment

Edit `/var/www/herbal/backend/.env` and set at least:

```env
ENVIRONMENT=production
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/herbal_hub
DB_NAME=herbal_hub
SECRET_KEY=<output-of-openssl-rand-hex-32>

FRONTEND_URL=https://app.example.com
BACKEND_PUBLIC_URL=https://app.example.com
ALLOWED_ORIGINS=https://app.example.com

PROFILE_IMAGE_STORAGE=s3
AWS_REGION=ap-south-1
S3_BUCKET_NAME=<private-s3-bucket>
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SUCCESS_URL=https://app.example.com/orders/{order_id}?payment=success&session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=https://app.example.com/orders/{order_id}?payment=cancelled

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<sender-address>
SMTP_PASSWORD=<provider-app-password>
```

Replace `app.example.com` with the real domain. Configure other enabled
services such as Google, Geoapify, PlantNet, Gemini, admin seeding, and data
encryption. Never commit `.env` files.

Edit `/var/www/herbal/frontend/.env.production`:

```env
REACT_APP_API_URL=
REACT_APP_GOOGLE_CLIENT_ID=<google-web-client-id>
REACT_APP_GEOAPIFY_API_KEY=<domain-restricted-browser-key>
```

An empty `REACT_APP_API_URL` makes the browser use the same HTTPS domain and
Nginx proxy. Frontend environment variables are public because React embeds
them during the build; restrict provider keys by domain.

After changing frontend values, rebuild with `npm run build`.

## 5. Install systemd and Nginx configuration

```bash
sudo cp /var/www/herbal/deploy/herbal-backend.service /etc/systemd/system/
sudo cp /var/www/herbal/deploy/herbal-nginx.conf /etc/nginx/sites-available/herbal
sudo ln -sfn /etc/nginx/sites-available/herbal /etc/nginx/sites-enabled/herbal
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable --now herbal-backend
sudo systemctl restart nginx
```

Verify the deployment:

```bash
systemctl status herbal-backend --no-pager
curl --fail http://127.0.0.1:8000/health
curl --fail http://127.0.0.1/health
```

View logs:

```bash
journalctl -u herbal-backend -f
sudo tail -f /var/log/nginx/error.log
```

## 6. External provider settings

- Google OAuth: authorize `https://app.example.com` as a JavaScript origin.
- Stripe: set the webhook to
  `https://app.example.com/api/webhooks/stripe`.
- S3: keep the bucket private; the backend creates presigned image URLs.
- MongoDB Atlas: require TLS and use a dedicated application user.

## Updating

```bash
cd /var/www/herbal
git pull --ff-only

backend/.venv/bin/pip install -r backend/requirements.txt
cd frontend && npm ci && npm run build

sudo systemctl restart herbal-backend
sudo nginx -t && sudo systemctl reload nginx
```

Check `/health`, login, uploads, checkout, Stripe webhooks, and WebSockets after
each deployment. Record the deployed Git commit for rollback. Never run demo
seed or data-clearing scripts against production.
