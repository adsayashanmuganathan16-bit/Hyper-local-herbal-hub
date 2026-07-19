from fastapi import APIRouter, HTTPException, Query, Depends
from datetime import datetime
from app.database import get_db
from app.middleware.auth_middleware import get_current_user, require_admin
from app.utils.helpers import serialize_doc, paginate

router = APIRouter(prefix="/api/orders", tags=["Order Management"])


@router.get("/")
async def get_my_orders(
    status: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
):
    """Get current user's orders with optional status filter."""
    db = get_db()
    query = {"user_id": current_user["_id"]}
    if status:
        query["status"] = status

    cursor = db.orders.find(query).sort([("created_at", -1)])
    orders = await cursor.to_list(length=None)
    result = paginate(orders, page, page_size)
    result["items"] = [serialize_doc(o) for o in result["items"]]
    return result


@router.get("/{order_id}")
async def get_order(order_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific order by ID."""
    db = get_db()
    from bson import ObjectId

    order = await db.orders.find_one({"_id": ObjectId(order_id), "user_id": current_user["_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Get delivery info
    delivery = await db.deliveries.find_one({"order_id": order_id})
    result = serialize_doc(order)
    if delivery:
        result["delivery"] = serialize_doc(delivery)

    return result


@router.get("/{order_id}/invoice")
async def get_invoice(order_id: str, current_user: dict = Depends(get_current_user)):
    """Get order invoice."""
    db = get_db()
    from bson import ObjectId

    order = await db.orders.find_one({"_id": ObjectId(order_id), "user_id": current_user["_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    from app.services.payment_service import payment_service
    invoice = await payment_service.generate_invoice({**order, "id": order_id})
    return {"invoice": invoice}


@router.put("/{order_id}/cancel")
async def cancel_order(order_id: str, current_user: dict = Depends(get_current_user)):
    """Cancel an order."""
    db = get_db()
    from bson import ObjectId

    order = await db.orders.find_one({"_id": ObjectId(order_id), "user_id": current_user["_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["status"] not in ("placed", "confirmed"):
        raise HTTPException(status_code=400, detail="Order cannot be cancelled at this stage")

    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {"status": "cancelled", "updated_at": datetime.utcnow()}},
    )
    await db.deliveries.update_one(
        {"order_id": order_id},
        {"$set": {"status": "failed", "updated_at": datetime.utcnow()}},
    )

    # Refund if paid online
    if order.get("payment_id") and order["payment_status"] == "completed":
        from app.services.payment_service import payment_service
        await payment_service.refund_payment(order["payment_id"])

    return {"message": "Order cancelled successfully"}


# Admin endpoints
@router.get("/admin/all")
async def get_all_orders(
    status: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_admin),
):
    """Get all orders (admin only)."""
    db = get_db()
    query = {}
    if status:
        query["status"] = status

    cursor = db.orders.find(query).sort([("created_at", -1)])
    orders = await cursor.to_list(length=None)
    result = paginate(orders, page, page_size)
    result["items"] = [serialize_doc(o) for o in result["items"]]
    return result


@router.put("/admin/{order_id}/status")
async def update_order_status(
    order_id: str,
    body: dict,  # { status }
    current_user: dict = Depends(require_admin),
):
    """Update order status (admin only)."""
    db = get_db()
    from bson import ObjectId

    valid_statuses = ["placed", "confirmed", "packed", "shipped", "out_for_delivery", "delivered", "cancelled", "returned"]
    new_status = body.get("status")
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")

    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {"status": new_status, "updated_at": datetime.utcnow()}},
    )

    # Notify user
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if order:
        await db.notifications.insert_one({
            "user_id": order["user_id"],
            "type": "order",
            "title": "Order Updated",
            "message": f"Your order #{order_id[:8]} status changed to {new_status.replace('_', ' ').title()}",
            "is_read": False,
            "link": f"/orders/{order_id}",
            "created_at": datetime.utcnow(),
        })

    return {"message": f"Order status updated to {new_status}"}