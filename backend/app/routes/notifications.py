from app.utils.time import utc_now
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from bson import ObjectId
from datetime import datetime, timezone
import asyncio
from app.database import get_db
from app.middleware.auth_middleware import get_current_user, decode_token
from app.services.notification_realtime import notification_connections
from app.utils.helpers import serialize_doc, paginate

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


def _as_utc(value: datetime) -> datetime:
    """Normalize MongoDB's sometimes-naive UTC datetimes for safe comparison."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


@router.get("/")
async def get_notifications(
    page: int = Query(1, ge=1),
    unread_only: bool = Query(False),
    current_user: dict = Depends(get_current_user),
):
    """Get current user's notifications."""
    db = get_db()
    query = {"user_id": current_user["_id"]}
    if unread_only:
        query["is_read"] = False

    cursor = db.notifications.find(query).sort([("created_at", -1)])
    notifications = await cursor.to_list(length=None)
    result = paginate(notifications, page, 20)
    result["items"] = [serialize_doc(n) for n in result["items"]]

    # Add unread count
    unread_count = await db.notifications.count_documents({"user_id": current_user["_id"], "is_read": False})
    result["unread_count"] = unread_count

    return result


@router.put("/{notification_id}/read")
async def mark_as_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Mark a notification as read."""
    db = get_db()
    from bson import ObjectId

    await db.notifications.update_one(
        {"_id": ObjectId(notification_id), "user_id": current_user["_id"]},
        {"$set": {"is_read": True}},
    )
    return {"message": "Notification marked as read"}


@router.put("/read-all")
async def mark_all_as_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read."""
    db = get_db()
    await db.notifications.update_many(
        {"user_id": current_user["_id"], "is_read": False},
        {"$set": {"is_read": True}},
    )
    return {"message": "All notifications marked as read"}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete one notification owned by the signed-in user."""
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(status_code=404, detail="Notification not found")
    result = await get_db().notifications.delete_one({
        "_id": ObjectId(notification_id),
        "user_id": current_user["_id"],
    })
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification deleted"}


@router.delete("/")
async def delete_all_notifications(current_user: dict = Depends(get_current_user)):
    """Delete all notifications owned by the signed-in user."""
    result = await get_db().notifications.delete_many({"user_id": current_user["_id"]})
    return {"message": "Notifications cleared", "deleted_count": result.deleted_count}


@router.websocket("/ws")
async def notification_socket(socket: WebSocket):
    connected_at = utc_now()
    token = socket.query_params.get("token")
    try:
        payload = decode_token(token or "")
        user = await get_db().users.find_one({"_id": ObjectId(payload["sub"]), "is_active": True})
    except Exception:
        user = None
    if not user:
        await socket.close(code=4401); return
    user_id = str(user["_id"])
    await socket.accept()
    last_seen = connected_at
    try:
        while True:
            try:
                await asyncio.wait_for(socket.receive_text(), timeout=1.0)
            except asyncio.TimeoutError:
                rows = await get_db().notifications.find({"user_id": user_id, "created_at": {"$gt": last_seen}}).sort("created_at", 1).to_list(length=100)
                for row in rows:
                    created_at = _as_utc(row.get("created_at", utc_now()))
                    await socket.send_json({"type": "notification.created", "notification": {
                        **serialize_doc(row), "created_at": created_at.isoformat()}})
                    if created_at > last_seen:
                        last_seen = created_at
    except WebSocketDisconnect:
        return
