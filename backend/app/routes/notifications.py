from fastapi import APIRouter, Depends, Query
from datetime import datetime
from app.database import get_db
from app.middleware.auth_middleware import get_current_user
from app.utils.helpers import serialize_doc, paginate

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


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