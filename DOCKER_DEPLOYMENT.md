# Docker deployment

This deployment runs the React application behind Nginx, the FastAPI API,
MongoDB, Redis, a Celery worker, and the Celery scheduler. Only Nginx is exposed
to the public network. MongoDB, Redis, and FastAPI remain on the private Compose
network.

## Requirements

- Docker Engine 24 or newer
- Docker Compose v2
- An Amazon S3 bucket
- Stripe API and webhook credentials
- A domain name and an HTTPS reverse proxy for a public production deployment

## 1. Configure the backend

Create the backend configuration if it does not exist:

```bash
cp backend/.env.example backend/.env
```

At minimum, replace the following values in `backend/.env`:

```env
SECRET_KEY=<long-random-secret>
DATA_ENCRYPTION_KEY=<stable-fernet-key>
ENVIRONMENT=production
MONGODB_URI=mongodb://herbal:<mongo-password>@mongo:27017/herbal_hub?authSource=admin
MONGO_INITDB_ROOT_USERNAME=herbal
MONGO_INITDB_ROOT_PASSWORD=<same-mongo-password>
REDIS_URL=redis://redis:6379/0
ADMIN_EMAIL=<administrator-email>
ADMIN_PASSWORD=<strong-password-at-least-10-characters>

FRONTEND_URL=https://your-domain.example
BACKEND_PUBLIC_URL=https://your-domain.example
ALLOWED_ORIGINS=https://your-domain.example

S3_BUCKET_NAME=<private-s3-bucket>
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=<aws-key-or-empty-when-using-an-iam-role>
AWS_SECRET_ACCESS_KEY=<aws-secret-or-empty-when-using-an-iam-role>

PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SUCCESS_URL=https://your-domain.example/orders/{order_id}?payment=success&session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=https://your-domain.example/orders/{order_id}?payment=cancelled
```

The MongoDB password in `MONGODB_URI` and `MONGO_INITDB_ROOT_PASSWORD` must be
identical. URL-encode it in `MONGODB_URI` if it contains reserved URL symbols.

Generate secrets with:

```bash
openssl rand -hex 32
docker compose run --rm --no-deps backend python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Use the first value as `SECRET_KEY` and the second as `DATA_ENCRYPTION_KEY`.

## 2. Build and start

```bash
docker compose config
docker compose build
docker compose up -d
docker compose ps
```

Open `http://SERVER_IP:8080`. Check service logs with:

```bash
docker compose logs -f frontend backend worker beat
```

## 3. Stripe webhook

Configure the Stripe webhook endpoint as:

```text
https://your-domain.example/api/webhooks/stripe
```

Subscribe to the Stripe events documented in `backend/README.md`.

## Updating

```bash
git pull
docker compose build
docker compose up -d --remove-orphans
```

Compose preserves MongoDB and Redis data in named volumes.

## Backups and removal

Stopping containers keeps all data:

```bash
docker compose down
```

Back up MongoDB before an upgrade or migration:

```bash
docker compose exec mongo sh -c 'mongodump --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive=/data/db/herbal-backup.archive'
```

Do not run `docker compose down --volumes` in production unless you intentionally
want to permanently delete the MongoDB and Redis volumes.

## HTTPS

The included Nginx container serves HTTP. For public production use, place it
behind an HTTPS load balancer, Cloudflare proxy, Caddy, Traefik, or a host-level
Nginx/Certbot installation. Forward public traffic to host port 8080 and preserve
the `Host`, `X-Forwarded-For`, and `X-Forwarded-Proto` headers.
