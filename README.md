# Herbal Hub

A full-stack e-commerce platform for herbal medicines, with a FastAPI backend and a React frontend.

## Structure

- `backend/` — FastAPI application (auth, medicines, cart, orders, prescriptions, delivery, admin, notifications, reviews, analytics)
- `frontend/` — React application (pages, components, API clients, context)

## Getting Started

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm start
```
