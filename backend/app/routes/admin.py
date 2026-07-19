from fastapi import APIRouter, HTTPException, Query, Depends
from datetime import datetime, timedelta
from app.database import get_db
from app.middleware.auth_middleware import require_admin
from app.utils.helpers import serialize_doc, paginate

router = APIRouter(prefix="/api/admin", tags=["Admin Dashboard"])


@router.get("/dashboard")
async def get_dashboard_stats(current_user: dict = Depends(require_admin)):
    """Get admin dashboard statistics."""
    db = get_db()

    total_users = await db.users.count_documents({"role": "customer"})
    total_medicines = await db.medicines.count_documents({"is_active": True})
    total_orders = await db.orders.count_documents({})
    pending_prescriptions = await db.prescriptions.count_documents({"status": "uploaded"})

    # Revenue calculations
    pipeline = [
        {"$match": {"payment_status": "completed"}},
        {"$group": {"_id": None, "total_revenue": {"$sum": "$final_amount"}}},
    ]
    revenue_result = await db.orders.aggregate(pipeline).to_list(length=1)
    total_revenue = revenue_result[0]["total_revenue"] if revenue_result else 0

    # Today's orders
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    todays_orders = await db.orders.count_documents({"created_at": {"$gte": today}})

    # Recent orders
    cursor = db.orders.find().sort([("created_at", -1)]).limit(5)
    recent_orders = [serialize_doc(o) for o in await cursor.to_list(length=None)]

    # Orders by status
    status_pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    orders_by_status = {doc["_id"]: doc["count"] for doc in await db.orders.aggregate(status_pipeline).to_list(length=None)}

    return {
        "total_users": total_users,
        "total_medicines": total_medicines,
        "total_orders": total_orders,
        "total_revenue": round(total_revenue, 2),
        "todays_orders": todays_orders,
        "pending_prescriptions": pending_prescriptions,
        "orders_by_status": orders_by_status,
        "recent_orders": recent_orders,
    }


@router.get("/users")
async def get_all_users(
    role: str = Query(None),
    search: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_admin),
):
    """Get all users with filters (admin only)."""
    db = get_db()
    query = {}
    if role:
        query["role"] = role
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
        ]

    cursor = db.users.find(query).sort([("created_at", -1)])
    users = await cursor.to_list(length=None)
    result = paginate(users, page, page_size)
    result["items"] = [serialize_doc(u) for u in result["items"]]
    return result


@router.put("/users/{user_id}/toggle-active")
async def toggle_user_active(user_id: str, current_user: dict = Depends(require_admin)):
    """Activate or deactivate a user."""
    db = get_db()
    from bson import ObjectId

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_status = not user.get("is_active", True)
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"is_active": new_status, "updated_at": datetime.utcnow()}},
    )
    return {"message": f"User {'activated' if new_status else 'deactivated'}"}