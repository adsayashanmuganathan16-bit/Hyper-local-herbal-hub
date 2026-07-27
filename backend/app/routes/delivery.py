from app.utils.time import utc_now
from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime
from app.database import get_db
from app.middleware.auth_middleware import get_current_user, require_delivery_partner
from app.utils.helpers import serialize_doc

router = APIRouter(prefix="/api/delivery", tags=["Delivery Management"])


@router.get("/my-deliveries")
async def get_my_deliveries(
    status: str = Query(None),
    current_user: dict = Depends(require_delivery_partner),
):
    """Get deliveries assigned to current delivery partner."""
    db = get_db()
    query = {"delivery_partner_id": current_user["_id"]}
    if status:
        query["status"] = status

    cursor = db.deliveries.find(query).sort([("created_at", -1)])
    deliveries = await cursor.to_list(length=None)
    return [serialize_doc(d) for d in deliveries]


@router.put("/{delivery_id}/update-status")
async def update_delivery_status(
    delivery_id: str,
    body: dict,  # { status, current_location?, notes? }
    current_user: dict = Depends(require_delivery_partner),
):
    """Update delivery status and location."""
    db = get_db()
    from bson import ObjectId

    valid_statuses = ["assigned", "picked_up", "in_transit", "near_location", "delivered", "failed"]
    new_status = body.get("status")
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")

    update = {
        "status": new_status,
        "updated_at": utc_now(),
    }
    if body.get("current_location"):
        update["current_location"] = body["current_location"]
    if body.get("notes"):
        update["notes"] = body["notes"]
    if new_status == "delivered":
        update["actual_delivery"] = utc_now()

    result = await db.deliveries.update_one(
        {"_id": ObjectId(delivery_id), "delivery_partner_id": current_user["_id"]},
        {"$set": update},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Delivery not found")

    # Update order status
    delivery = await db.deliveries.find_one({"_id": ObjectId(delivery_id)})
    if delivery and new_status == "delivered":
        await db.orders.update_one(
            {"_id": delivery["order_id"]},
            {"$set": {"status": "delivered", "updated_at": utc_now()}},
        )
        # Notify user
        order = await db.orders.find_one({"_id": delivery["order_id"]})
        if order:
            await db.notifications.insert_one({
                "user_id": order["user_id"],
                "type": "delivery",
                "title": "Order Delivered",
                "message": f"Your order #{delivery['order_id'][:8]} has been delivered!",
                "is_read": False,
                "link": f"/orders/{delivery['order_id']}",
                "created_at": utc_now(),
            })

    return {"message": f"Delivery status updated to {new_status}"}


@router.get("/track/{order_id}")
async def track_delivery(order_id: str, current_user: dict = Depends(get_current_user)):
    """Track delivery status for an order (customer view)."""
    db = get_db()

    order = await db.orders.find_one({"_id": order_id, "user_id": current_user["_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    delivery = await db.deliveries.find_one({"order_id": order_id})
    if not delivery:
        return {"order_id": order_id, "status": "pending_assignment"}

    result = serialize_doc(delivery)
    # Don't expose OTP to customer
    result.pop("otp", None)
    return result


# Admin: Assign delivery partner
@router.put("/admin/{delivery_id}/assign")
async def assign_delivery_partner(
    delivery_id: str,
    body: dict,  # { delivery_partner_id }
    current_user: dict = Depends(require_delivery_partner),
):
    """Assign a delivery partner to a delivery."""
    db = get_db()
    from bson import ObjectId

    await db.deliveries.update_one(
        {"_id": ObjectId(delivery_id)},
        {"$set": {"delivery_partner_id": body["delivery_partner_id"], "updated_at": utc_now()}},
    )
    return {"message": "Delivery partner assigned"}