# Seller Payments and Payouts (MongoDB)

The payout ledger uses the existing MongoDB database. PostgreSQL and Docker are not required.

## Local services

The web application uses MongoDB Atlas through `MONGODB_URI`. Celery requires a locally installed Redis service:

```bash
sudo apt-get install redis-server
sudo systemctl enable --now redis-server
redis-cli ping
```

The final command should return `PONG`.

## Configuration

Copy values from `backend/.env.example` into `backend/.env`. Configure at least:

```env
MONGODB_URI=mongodb+srv://...
SECRET_KEY=a-long-random-secret
REDIS_URL=redis://localhost:6379/0
DATA_ENCRYPTION_KEY=<fernet-key>
DEFAULT_COMMISSION_PERCENT=10.00
PAYOUT_MODE=manual
PAYMENT_PROVIDER=payhere
PAYHERE_MERCHANT_ID=...
PAYHERE_MERCHANT_SECRET=...
PAYHERE_SANDBOX=true
PAYHERE_NOTIFY_URL=https://public-test-domain/api/webhooks/payhere
```

Generate the encryption key once and keep it safe:

```bash
cd backend
./.venv/bin/python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Changing this key later prevents existing NIC and bank account values from being decrypted.

PayHere cannot call a localhost webhook. For sandbox testing, expose port 8000 through a secure public tunnel and use its HTTPS URL as `PAYHERE_NOTIFY_URL`.

## Run without Docker

Use three terminals:

```bash
cd backend
./.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

```bash
cd backend
./.venv/bin/celery -A app.tasks.celery_app.celery_app worker --loglevel=INFO
```

```bash
cd backend
./.venv/bin/celery -A app.tasks.celery_app.celery_app beat --loglevel=INFO
```

For the React application, create `frontend/.env`:

```env
REACT_APP_USE_REAL_API=true
REACT_APP_API_URL=http://localhost:8000
```

Then run `npm start` from `frontend/`.

## Manual payout flow

1. A seller completes `/seller/payment-setup`.
2. An admin approves the seller at `/admin/sellers`.
3. A PayHere webhook verifies an LKR payment and creates one payout per seller allocation.
4. Celery changes `PENDING` payouts to `READY_FOR_MANUAL_TRANSFER`.
5. The admin transfers funds using internet banking and records the reference at `/admin/payouts`.
6. The payout becomes `PAID`, an attempt and audit record are stored, and the seller is notified.

Automatic payout providers implement `PayoutService`. Until a licensed provider API is configured, manual bank transfer remains the safe default.
