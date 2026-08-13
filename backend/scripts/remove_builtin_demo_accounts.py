

import asyncio

from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings


DEMO_EMAILS = {"seller@herbalhub.com", "customer@herbalhub.com"}


async def main() -> None:
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    try:
        db = client[settings.DB_NAME]
        users = await db.users.find(
            {"email": {"$in": sorted(DEMO_EMAILS)}},
            {"email": 1, "role": 1},
        ).to_list(length=None)
        if not users:
            print("No built-in demo customer or seller accounts found.")
            return

        for user in users:
            user_id = str(user["_id"])
            seller = await db.sellers.find_one({"user_id": user_id}, {"_id": 1})
            if seller:
                await db.seller_bank_accounts.delete_many({"seller_id": str(seller["_id"])})
                await db.sellers.delete_one({"_id": seller["_id"]})
            await db.user_bank_accounts.delete_many({"user_id": user_id})
            await db.users.delete_one({"_id": user["_id"]})
            print(f"Removed {user['role']} demo account: {user['email']}")
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
