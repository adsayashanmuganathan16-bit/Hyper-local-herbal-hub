# Herbal Hub Backend

FastAPI API for Herbal Hub. It provides authentication, marketplace products,
carts, checkout, orders, prescriptions, seller operations, delivery tracking,
reviews, notifications, administration, plant identification, payments, and
payouts.

## Directory structure

```text
backend/
├── app/
│   ├── financial/     # Financial request/response schemas
│   ├── middleware/    # Authentication and rate limiting
│   ├── models/        # Pydantic domain models
│   ├── routes/        # FastAPI route modules
│   ├── services/      # Business logic and provider integrations
│   ├── tasks/         # Celery worker and scheduled jobs
│   ├── utils/         # Shared helpers
│   ├── config.py      # Environment-backed settings
│   ├── database.py    # MongoDB lifecycle and indexes
│   └── main.py        # FastAPI application entry point
├── docs/              # Backend-specific documentation
├── scripts/           # Maintenance and database scripts
├── tests/             # Pytest suite
├── .env               # Local configuration (ignored by Git)
├── .env.example       # Safe configuration template
├── pytest.ini         # Backend test discovery/import configuration
└── requirements.txt
```

## Requirements

- Python 3.12+
- MongoDB or MongoDB Atlas
- Redis only when running Celery payouts/rate limiting

## Setup

Run commands from `backend/`:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
[ -f .env ] || cp .env.example .env
```

Edit `.env` before starting the API. For local development, the minimum useful
configuration is:

```env
MONGODB_URI=mongodb://localhost:27017/herbal_hub
DB_NAME=herbal_hub
SECRET_KEY=<long-random-value>
ADMIN_EMAIL=herbalhub468@gmail.com
ADMIN_PASSWORD=<strong-administrator-password>
FRONTEND_URL=http://localhost:3000
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=<stripe-secret-key>
STRIPE_WEBHOOK_SECRET=<stripe-webhook-secret>
PLANTNET_API_KEY=<your-plantnet-api-key>
GEMINI_API_KEY=<your-google-ai-studio-api-key>
```

### Google sign-in

Create a Google OAuth 2.0 **Web application** client and add
`http://localhost:3000` as an authorized JavaScript origin. Use the same web
client ID in both configuration files:

```env
# backend/.env
GOOGLE_CLIENT_ID=<web-client-id>.apps.googleusercontent.com

# frontend/.env
REACT_APP_GOOGLE_CLIENT_ID=<web-client-id>.apps.googleusercontent.com
```

Restart both servers after changing these values. Google sign-in is hidden
until the frontend client ID is configured. New users choose Customer or
Seller before signing in; new sellers continue to business and payment setup.

Generate secrets with:

```bash
openssl rand -hex 32
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Use the first value for `SECRET_KEY` and the second for
`DATA_ENCRYPTION_KEY`. Keep the encryption key stable because changing it
prevents existing encrypted seller data from being decrypted.

## Start the backend

From the repository root, set up and start the backend with:

```bash
cd /home/uki/Music/herbal/backend

source .venv/bin/activate

pip install -r requirements.txt

[ -f .env ] || cp .env.example .env

uvicorn app.main:app --reload --host 127.0.0.1 --port 8000



Edit `.env` with the required configuration before running the final command.
The guarded copy leaves an existing `.env` untouched. A plain
`cp .env.example .env` overwrites configured values, so it should only be used
when intentionally resetting the file.
After the initial setup, start the backend with:

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Available locally:

- API: `http://127.0.0.1:8000`
- OpenAPI UI: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/health`

The API allows the configured `FRONTEND_URL`, `http://localhost:3000`, and
`http://127.0.0.1:3000` during local development.

## Seed demo data

The seed script writes repeatable demo data to the configured database. Review
the target `MONGODB_URI` and `DB_NAME` first because it replaces documents that
were created by previous seed runs.

From the repository root:

```bash
backend/.venv/bin/python backend/scripts/seed_database.py
```

The API also creates the three UI demo accounts on startup when they do not
already exist.

## Tests

```bash
./.venv/bin/pytest -q
```

Some tests use environment overrides. Keep `.env` local and never commit it.

## Configuration notes

- Stripe is the only online checkout provider; cash on delivery remains available.
- S3 is required for persisted profile, product, and prescription images.
  SMTP, Twilio, Geoapify, Redis, and Celery are optional for their corresponding
  features. On AWS, an EC2/ECS IAM role can provide S3 credentials.
- `PLANTNET_API_KEY` enables `POST /api/plants/identify`; the key remains on
  the backend and is never sent to the browser.
- `GEMINI_API_KEY` enriches PlantNet results with schema-validated English and
  Tamil descriptions, medicinal-use context, and precautions. When Gemini is
  unavailable, the endpoint safely falls back to its built-in bilingual text.
- Payment webhook URLs must be public HTTPS endpoints when testing external
  payment providers; localhost cannot receive provider callbacks.
- Stripe uses a hosted Checkout page, so card details never pass through this
  application. To enable it, set:

  ```env
  PAYMENT_PROVIDER=stripe
  STRIPE_SECRET_KEY=sk_test_...
  STRIPE_WEBHOOK_SECRET=whsec_...
  STRIPE_SUCCESS_URL=http://localhost:3000/orders/{order_id}?payment=success&session_id={CHECKOUT_SESSION_ID}
  STRIPE_CANCEL_URL=http://localhost:3000/orders/{order_id}?payment=cancelled
  ```

  In Stripe Workbench, create an event destination for
  `https://your-api.example/api/webhooks/stripe` and subscribe to
  `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed`, and `checkout.session.expired`.
  For local testing, run:

  ```bash
  stripe listen --forward-to localhost:8000/api/webhooks/stripe
  ```

  Copy the CLI's `whsec_...` signing secret into `STRIPE_WEBHOOK_SECRET`, then
  restart the API. Keep using Stripe test keys until the full webhook flow has
  been verified.
- `backend/.env` is ignored by Git. Use `.env.example` to document variables
  without committing credentials.

See [Seller Payments and Payouts](docs/PAYOUT_SYSTEM.md) for the financial
worker and manual-payout flow.
