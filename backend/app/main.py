from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.database import connect_db, disconnect_db
from app.routes import auth, medicines, cart, checkout, orders, prescriptions, delivery, delivery_staff, admin, notifications, reviews, analytics, seller, financial_admin, financial_payments, financial_sellers, service_areas, newsletter, plants, support

@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.validate_payment_configuration()
    settings.validate_storage_configuration()
    await connect_db()
    try:
        yield
    finally:
        await disconnect_db()


app = FastAPI(
    title="Hyper-Local Herbal Hub API",
    description="Backend API for the Herbal Hub herbal medicine delivery platform",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
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
app.include_router(delivery_staff.router)
app.include_router(admin.router)
app.include_router(seller.router)
app.include_router(notifications.router)
app.include_router(reviews.router)
app.include_router(analytics.router)
app.include_router(financial_sellers.router)
app.include_router(financial_payments.router)
app.include_router(financial_admin.router)
app.include_router(service_areas.router)
app.include_router(newsletter.router)
app.include_router(plants.router)
app.include_router(support.router)


upload_dir = Path(settings.PROFILE_IMAGE_UPLOAD_DIR)
if not upload_dir.is_absolute():
    upload_dir = Path(__file__).resolve().parent.parent / upload_dir
upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads/profile-images", StaticFiles(directory=upload_dir), name="profile-images")


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
