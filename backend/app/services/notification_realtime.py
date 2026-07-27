from app.utils.time import utc_now
import asyncio
from collections import defaultdict

from fastapi import WebSocket


class NotificationConnectionManager:
    def __init__(self):
        self.connections = defaultdict(set)
        self.lock = asyncio.Lock()

    async def connect(self, user_id, socket: WebSocket):
        await socket.accept()
        async with self.lock:
            self.connections[str(user_id)].add(socket)

    async def disconnect(self, user_id, socket):
        async with self.lock:
            self.connections[str(user_id)].discard(socket)

    async def broadcast(self, user_id, payload):
        for socket in list(self.connections.get(str(user_id), set())):
            try:
                await socket.send_json(payload)
            except Exception:
                await self.disconnect(user_id, socket)


notification_connections = NotificationConnectionManager()


async def create_notification(db, user_id, title, message, link, notification_type="order"):
    from datetime import datetime
    document = {"user_id": str(user_id), "type": notification_type, "title": title, "message": message,
                "is_read": False, "link": link, "created_at": utc_now()}
    result = await db.notifications.insert_one(document)
    await notification_connections.broadcast(user_id, {"type": "notification.created", "notification": {
        **document, "id": str(result.inserted_id), "created_at": document["created_at"].isoformat()}})
    return result


async def notify_admins(db, title, message, link):
    admins = await db.users.find({"role": "admin", "is_active": {"$ne": False}}, {"_id": 1}).to_list(length=None)
    for admin in admins:
        await create_notification(db, str(admin["_id"]), title, message, link, "admin")
