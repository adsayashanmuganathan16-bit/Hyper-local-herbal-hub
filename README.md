# Herbal Hub

A full-stack e-commerce platform for herbal medicines, with a FastAPI backend and a React frontend.

## Structure

- `backend/` — FastAPI application (auth, medicines, cart, orders, prescriptions, delivery, admin, notifications, reviews, analytics)
- `frontend/` — React application (pages, components, API clients, context)

## Getting Started

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and set SECRET_KEY plus the integrations you use.
uvicorn app.main:app --reload
```

The backend intentionally refuses to start without `SECRET_KEY`. It also
validates credentials for the selected `PAYMENT_PROVIDER`. Keep
`backend/.env` local; commit only the placeholder-only
`backend/.env.example`.

See [`backend/README.md`](backend/README.md) for configuration, seeding,
testing, payments, and the full backend structure.

### Frontend

```bash
cd frontend
npm install
npm start
```
