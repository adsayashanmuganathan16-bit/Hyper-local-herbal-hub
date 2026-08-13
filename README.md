# Herbal Hub

Herbal Hub is a React frontend with a FastAPI backend.

## Requirements

- Python 3.10 or newer
- Node.js and npm
- MongoDB connection details

## First-time setup

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Add the required database, authentication, Stripe, and other service credentials to `backend/.env`.

### Frontend

```bash
cd frontend
npm install
```

## Start the application

Open two terminals from the project directory.

### Terminal 1: start the backend

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload
```

The backend runs at `http://localhost:8000`. API documentation is available at `http://localhost:8000/docs`.

### Terminal 2: start the frontend

```bash
cd frontend
npm start
```

The frontend opens at `http://localhost:3000`.

## Run tests

```bash
cd backend
source .venv/bin/activate
pytest -q
```

```bash
cd frontend
npm test -- --watchAll=false
```

For detailed backend configuration, see [`backend/README.md`](backend/README.md).

## AWS deployment

The repository includes systemd and Nginx configuration, health checks, and a
direct EC2 deployment guide that does not require Docker. See
[`AWS_DEPLOYMENT.md`](AWS_DEPLOYMENT.md).

## Docker deployment

The repository also includes production-oriented containers for Nginx/React,
FastAPI, MongoDB, Redis, and Celery. See
[`DOCKER_DEPLOYMENT.md`](DOCKER_DEPLOYMENT.md).
