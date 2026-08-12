from app.utils.time import utc_now
from fastapi import APIRouter, HTTPException, Query, Depends
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
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

    # Sri Lankan calendar-day boundary converted to UTC for MongoDB querying.
    colombo = ZoneInfo("Asia/Colombo")
    local_now = datetime.now(colombo)
    today = local_now.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc).replace(tzinfo=None)
    todays_orders = await db.orders.count_documents({"created_at": {"$gte": today}})

    payouts = await db.payouts.find({}).to_list(length=None)
    pending_payouts = sum(float(p.get("net_amount", 0)) for p in payouts if p.get("status") != "PAID")
    completed_payouts = sum(float(p.get("net_amount", 0)) for p in payouts if p.get("status") == "PAID")
    total_commission = sum(float(p.get("commission_amount", 0)) for p in payouts)
    delivery_pipeline = [{"$match": {"payment_status": "completed"}}, {"$group": {"_id": None, "total": {"$sum": "$delivery_charge"}}}]
    delivery_result = await db.orders.aggregate(delivery_pipeline).to_list(length=1)

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
        "pending_payouts": round(pending_payouts, 2),
        "completed_payouts": round(completed_payouts, 2),
        "total_commission": round(total_commission, 2),
        "delivery_charges": round(delivery_result[0]["total"], 2) if delivery_result else 0,
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
    # Removed accounts stay out of the active administration list. Their order
    # and payment records remain available for audit/accounting purposes.
    query = {"removed_at": {"$exists": False}}
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
    from app.services.financial_crypto import decrypt_sensitive
    visible_items = []
    for row in result["items"]:
        item = serialize_doc(row)
        user_id = str(row["_id"])
        if row.get("role") == "seller":
            seller = await db.sellers.find_one({"user_id": user_id}, {"_id": 1})
            bank = await db.seller_bank_accounts.find_one(
                {"seller_id": str(seller["_id"])}
            ) if seller else None
        else:
            bank = await db.user_bank_accounts.find_one({"user_id": user_id})
        item["bank_account"] = None if not bank else {
            "bank_name": bank["bank_name"], "branch": bank["branch"],
            "account_holder_name": bank["account_holder_name"],
            "account_number": decrypt_sensitive(bank["account_number_encrypted"]),
        }
        visible_items.append(item)
    result["items"] = visible_items
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
        {"$set": {"is_active": new_status, "updated_at": utc_now()}},
    )
    return {"message": f"User {'activated' if new_status else 'deactivated'}"}


@router.delete("/users/{user_id}")
async def remove_user(user_id: str, current_user: dict = Depends(require_admin)):
    """Soft-remove a customer or seller while preserving orders and financial records."""
    from bson import ObjectId
    if not ObjectId.is_valid(user_id):
        raise HTTPException(404, "User not found")
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(404, "User not found")
    if user.get("role") == "admin" or str(user["_id"]) == current_user["_id"]:
        raise HTTPException(403, "Admin accounts cannot be removed here")
    now = utc_now()
    # Preserve the user id for historical orders while releasing their email
    # and phone so the person can register again with a different role.
    removed_email = f"removed+{user['_id']}@deleted.herbalhub.invalid"
    await db.users.update_one({"_id": user["_id"]}, {
        "$set": {"email": removed_email, "is_active": False, "removed_at": now,
                 "removed_by": current_user["_id"], "updated_at": now},
        "$unset": {"phone": "", "google_sub": ""},
    })
    # Bank details are not accounting records and should not survive account removal.
    await db.user_bank_accounts.delete_one({"user_id": user_id})
    if user.get("role") == "seller":
        await db.sellers.update_one({"user_id": user_id}, {"$set": {"approval_status": "REJECTED", "updated_at": now}})
    return {"message": "User deleted successfully"}
