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
├── .env               # Safe configuration template
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
cp .env.example .env
```

Edit `.env` before starting the API. For local development, the minimum useful
configuration is:

```env
MONGODB_URI=mongodb://localhost:27017/herbal_hub
DB_NAME=herbal_hub
SECRET_KEY=<long-random-value>
FRONTEND_URL=http://localhost:3000
PAYMENT_PROVIDER=mock
PLANTNET_API_KEY=<your-plantnet-api-key>
GEMINI_API_KEY=<your-google-ai-studio-api-key>
```

Generate secrets with:

```bash
openssl rand -hex 32
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Use the first value for `SECRET_KEY` and the second for
`DATA_ENCRYPTION_KEY`. Keep the encryption key stable because changing it
prevents existing encrypted seller data from being decrypted.

## Run

```bash
./.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
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

- `PAYMENT_PROVIDER=mock` is the safe local default.
- PayHere and OnePay credentials are only required when their provider is
  selected.
- SMTP, AWS, Twilio, Stripe, Geoapify, Redis, and Celery are optional for the
  corresponding features.
- `PLANTNET_API_KEY` enables `POST /api/plants/identify`; the key remains on
  the backend and is never sent to the browser.
- `GEMINI_API_KEY` enriches PlantNet results with schema-validated English and
  Tamil descriptions, medicinal-use context, and precautions. When Gemini is
  unavailable, the endpoint safely falls back to its built-in bilingual text.
- Payment webhook URLs must be public HTTPS endpoints when testing external
  payment providers; localhost cannot receive provider callbacks.
- `backend/.env` is ignored by Git. Use `.env.example` to document variables
  without committing credentials.

See [Seller Payments and Payouts](docs/PAYOUT_SYSTEM.md) for the financial
worker and manual-payout flow.
