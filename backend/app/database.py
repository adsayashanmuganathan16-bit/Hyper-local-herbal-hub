from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

client: AsyncIOMotorClient = None


async def connect_db():
    """Initialize MongoDB connection."""
    global client
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    # Create indexes on startup
    db = client[settings.DB_NAME]
    await db.users.create_index("email", unique=True)
    await db.users.create_index("phone", unique=True)
    await db.users.create_index("reset_token", sparse=True)
    await db.users.create_index("verification_token", sparse=True)
    await db.medicines.create_index("name")
    await db.medicines.create_index("category")
    await db.medicines.create_index([("price", 1)])
    await db.orders.create_index("user_id")
    await db.orders.create_index("status")
    await db.prescriptions.create_index("user_id")
    await db.reviews.create_index("medicine_id")
    await db.reviews.create_index([("rating", -1)])
    print("✅ Connected to MongoDB Atlas")


async def disconnect_db():
    """Close MongoDB connection."""
    global client
    if client:
        client.close()
        print("❌ Disconnected from MongoDB")


def get_db():
    """Get database instance."""
    return client[settings.DB_NAME]