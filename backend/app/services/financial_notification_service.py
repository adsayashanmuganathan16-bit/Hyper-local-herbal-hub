from app.utils.time import utc_now
from datetime import datetime

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings


async def create_financial_notification(user_id: str, title: str, message: str, link: str = "/seller/earnings") -> None:
    """Write an in-app notification without relying on the web process's Mongo client."""
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    try:
        db = client[settings.DB_NAME]
        result = await db.notifications.insert_one({
            "user_id": user_id, "type": "payout", "title": title, "message": message,
            "is_read": False, "link": link, "created_at": utc_now(),
        })
        from app.services.notification_realtime import notification_connections
        await notification_connections.broadcast(user_id, {"type": "notification.created", "notification": {
            "id": str(result.inserted_id), "user_id": user_id, "type": "payout", "title": title,
            "message": message, "is_read": False, "link": link, "created_at": utc_now().isoformat()}})
        try:
            user = await db.users.find_one({"_id": ObjectId(user_id)}, {"email": 1})
        except Exception:
            user = None
        if user and user.get("email"):
            from app.services.email_service import email_service
            await email_service.send_financial_notification(user["email"], title, message)
    finally:
        client.close()


async def mark_marketplace_order_paid(order_id: str, transaction_id: str) -> None:
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    try:
        await client[settings.DB_NAME].orders.update_one(
            {"_id": ObjectId(order_id)},
            {"$set": {"payment_status": "completed", "payment_id": transaction_id, "updated_at": utc_now()}},
        )
    finally:
        client.close()
