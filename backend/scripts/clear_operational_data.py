

import asyncio
import sys
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
load_dotenv(BACKEND / ".env", override=True)

from app.config import settings  # noqa: E402


COLLECTIONS = (
    "audit_logs",
    "carts",
    "courier_locations",
    "deliveries",
    "delivery_history",
    "delivery_locations",
    "financial_orders",
    "medicines",
    "newsletter_subscribers",
    "notifications",
    "orders",
    "payment_events",
    "payments",
    "payout_attempts",
    "payouts",
    "prescriptions",
    "reviews",
    "seller_bank_accounts",
    "seller_customer_preferences",
    "seller_fulfillments",
    "seller_order_allocations",
    "support_messages",
)


async def clear() -> None:
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    try:
        await client.admin.command("ping")
        database = client[settings.DB_NAME]
        for collection_name in COLLECTIONS:
            result = await database[collection_name].delete_many({})
            print(f"{collection_name}: deleted {result.deleted_count}")
        print("Preserved: users, sellers, categories, service_areas, and configuration")
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(clear())
