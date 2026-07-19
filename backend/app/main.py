from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import connect_db, disconnect_db
from app.routes import auth, medicines, cart, checkout, orders, prescriptions, delivery, admin, notifications, reviews, analytics

app = FastAPI(
    title="Hyper-Local Herbal Hub API",
    description="Backend API for the Herbal Hub herbal medicine delivery platform",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(auth.router)
app.include_router(medicines.router)
app.include_router(cart.router)
app.include_router(checkout.router)
app.include_router(orders.router)
app.include_router(prescriptions.router)
app.include_router(delivery.router)
app.include_router(admin.router)
app.include_router(notifications.router)
app.include_router(reviews.router)
app.include_router(analytics.router)


@app.on_event("startup")
async def startup():
    await connect_db()


@app.on_event("shutdown")
async def shutdown():
    await disconnect_db()


@app.get("/")
async def root():
    return {
        "name": "Hyper-Local Herbal Hub API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}