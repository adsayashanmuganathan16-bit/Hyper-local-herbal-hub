from app.utils.time import utc_now
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, HttpUrl

from app.database import get_db
from app.middleware.auth_middleware import require_seller
from app.utils.helpers import serialize_doc, serialize_medicine

router = APIRouter(prefix="/api/seller", tags=["Seller"])


class CourierDispatch(BaseModel):
    courier_company: str = Field(min_length=2, max_length=120)
    tracking_number: str = Field(min_length=2, max_length=120)
    tracking_url: HttpUrl | None = None
    estimated_delivery: datetime | None = None


@router.get("/products")
async def seller_products(q: Optional[str] = Query(None), current_user: dict = Depends(require_seller)):
    query = {"seller_id": current_user["_id"], "is_active": True}
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    products = await get_db().medicines.find(query).sort("created_at", -1).to_list(length=None)
    return {"items": [serialize_medicine(p) for p in products], "total": len(products)}


async def _seller_orders(db, seller_id: str):
    product_ids = [str(p["_id"]) async for p in db.medicines.find({"seller_id": seller_id}, {"_id": 1})]
    orders = await db.orders.find({
        "items.medicine_id": {"$in": product_ids},
        "deleted_by_sellers": {"$ne": seller_id},
    }).sort("created_at", -1).to_list(length=None)
    for order in orders:
        order["items"] = [item for item in order.get("items", []) if item.get("medicine_id") in product_ids]
        order["fulfillment"] = await db.seller_fulfillments.find_one({"order_id": str(order["_id"]), "seller_user_id": seller_id})
        payment = await db.payments.find_one(
            {"order_id": str(order["_id"])},
            {"transaction_id": 1, "stripe_payment_intent_id": 1, "status": 1, "paid_at": 1},
        )
        order["payment"] = payment
        customer = await db.users.find_one({"_id": ObjectId(order["user_id"])}, {"name": 1, "phone": 1}) if ObjectId.is_valid(order.get("user_id", "")) else None
        order["customer"] = {"name": (customer or {}).get("name"), "phone": (customer or {}).get("phone")}
    return orders


@router.get("/orders")
async def seller_orders(current_user: dict = Depends(require_seller)):
    orders = await _seller_orders(get_db(), current_user["_id"])
    return {"items": [serialize_doc(o) for o in orders], "total": len(orders)}


@router.delete("/orders/{order_id}")
async def delete_seller_order(order_id: str, current_user: dict = Depends(require_seller)):
    """Remove an eligible order from this seller's workspace without deleting marketplace accounting."""
    if not ObjectId.is_valid(order_id):
        raise HTTPException(404, "Order not found")
    db = get_db()
    product_ids = [
        str(product["_id"])
        async for product in db.medicines.find({"seller_id": current_user["_id"]}, {"_id": 1})
    ]
    order = await db.orders.find_one({
        "_id": ObjectId(order_id),
        "items.medicine_id": {"$in": product_ids},
        "deleted_by_sellers": {"$ne": current_user["_id"]},
    })
    if not order:
        raise HTTPException(404, "Order not found")
    fulfillment = await db.seller_fulfillments.find_one({
        "order_id": order_id,
        "seller_user_id": current_user["_id"],
    })
    payment_status = str(order.get("payment_status") or "pending").lower()
    order_status = str(order.get("status") or "pending").lower()
    delivery_status = str(
        (fulfillment or {}).get("status") or order.get("delivery_status") or order_status
    ).lower()
    protected_payment = payment_status in {"paid", "completed"}
    protected_fulfillment = delivery_status in {
        "processing", "ready_to_dispatch", "packed", "shipped",
        "dispatched", "in_transit", "delivered",
    } or order_status in {"processing", "preparing", "packed", "shipped", "delivered"}
    eligible = (
        order_status == "cancelled"
        or payment_status == "failed"
        or (payment_status == "pending" and delivery_status in {"pending", "awaiting_payment", "cancelled"})
    )
    if protected_payment or protected_fulfillment or not eligible:
        raise HTTPException(409, "Delivered or paid orders cannot be deleted.")
    now = utc_now()
    await db.orders.update_one(
        {"_id": order["_id"]},
        {"$addToSet": {"deleted_by_sellers": current_user["_id"]}, "$set": {"updated_at": now}},
    )
    await db.audit_logs.insert_one({
        "actor_user_id": current_user["_id"],
        "action": "seller.order_removed",
        "entity_type": "order",
        "entity_id": order_id,
        "details": {"payment_status": payment_status, "delivery_status": delivery_status},
        "created_at": now,
    })
    return {"message": "Order deleted successfully."}


@router.get("/customers")
async def seller_customers(include_archived: bool = Query(False), current_user: dict = Depends(require_seller)):
    """List only customers who have purchased products from this seller."""
    db = get_db()
    orders = await _seller_orders(db, current_user["_id"])
    archived_rows = await db.seller_customer_preferences.find(
        {"seller_user_id": current_user["_id"], "archived": True}, {"customer_user_id": 1}
    ).to_list(length=None)
    archived_ids = {row["customer_user_id"] for row in archived_rows}
    summaries = {}
    for order in orders:
        customer_id = str(order.get("user_id", ""))
        if not customer_id or (customer_id in archived_ids and not include_archived):
            continue
        summary = summaries.setdefault(customer_id, {"order_count": 0, "total_spent": 0.0, "last_order_at": None})
        summary["order_count"] += 1
        summary["total_spent"] += sum(float(item.get("price", 0)) * int(item.get("quantity", 0)) for item in order.get("items", []))
        created_at = order.get("created_at")
        if created_at and (not summary["last_order_at"] or created_at > summary["last_order_at"]):
            summary["last_order_at"] = created_at
    customer_ids = [ObjectId(value) for value in summaries if ObjectId.is_valid(value)]
    users = await db.users.find({"_id": {"$in": customer_ids}, "role": "customer"},
                                {"name": 1, "email": 1, "phone": 1, "is_active": 1}).to_list(length=None)
    items = []
    for user in users:
        customer_id = str(user["_id"])
        items.append(serialize_doc({**user, **summaries[customer_id], "archived": customer_id in archived_ids}))
    items.sort(key=lambda row: row.get("last_order_at") or datetime.min, reverse=True)
    return {"items": items, "total": len(items)}


@router.put("/customers/{customer_id}/archive")
async def archive_seller_customer(customer_id: str, current_user: dict = Depends(require_seller)):
    """Remove a customer from this seller's CRM view without deleting platform data."""
    db = get_db()
    orders = await _seller_orders(db, current_user["_id"])
    if not any(str(order.get("user_id")) == customer_id for order in orders):
        raise HTTPException(404, "Customer not found in your orders")
    await db.seller_customer_preferences.update_one(
        {"seller_user_id": current_user["_id"], "customer_user_id": customer_id},
        {"$set": {"archived": True, "updated_at": utc_now()}}, upsert=True,
    )
    return {"message": "Customer removed from your active customer list"}


@router.post("/orders/{order_id}/ready-for-pickup")
async def ready_for_pickup(order_id: str, current_user: dict = Depends(require_seller)):
    db = get_db()
    product_ids = [str(p["_id"]) async for p in db.medicines.find({"seller_id": current_user["_id"]}, {"_id": 1})]
    order = await db.orders.find_one({"_id": ObjectId(order_id), "items.medicine_id": {"$in": product_ids},
                                      "$or": [{"payment_status": "completed"}, {"payment_method": "cod"}],
                                      "status": {"$in": ["placed", "confirmed", "preparing", "packed"]}})
    if not order:
        raise HTTPException(409, "Order cannot be marked ready for pickup")
    now = utc_now()
    result = await db.seller_fulfillments.update_one({"order_id": order_id, "seller_user_id": current_user["_id"],
        "status": {"$in": ["processing", "ready_to_dispatch"]}}, {"$set": {"status": "ready_to_dispatch", "updated_at": now}})
    if not result.matched_count:
        raise HTTPException(409, "This seller parcel is not ready for preparation")
    from app.services.notification_realtime import create_notification
    await create_notification(db, order["user_id"], "Seller accepted order",
        f"Your parcel from this seller for order #{order_id[:8]} is ready for dispatch.", f"/orders/{order_id}", "delivery")
    return {"status": "ready_to_dispatch"}


@router.post("/orders/{order_id}/dispatch")
async def dispatch_order(order_id: str, data: CourierDispatch, current_user: dict = Depends(require_seller)):
    db, now = get_db(), utc_now()
    fulfillment = await db.seller_fulfillments.find_one({"order_id": order_id, "seller_user_id": current_user["_id"],
        "status": {"$in": ["processing", "ready_to_dispatch"]}})
    order = await db.orders.find_one({"_id": ObjectId(order_id)}) if ObjectId.is_valid(order_id) else None
    if not fulfillment or not order:
        raise HTTPException(409, "Seller parcel cannot be dispatched")
    update = {"status": "dispatched", "courier_company": data.courier_company,
        "tracking_number": data.tracking_number, "tracking_url": str(data.tracking_url) if data.tracking_url else None,
        "estimated_delivery": data.estimated_delivery, "dispatched_at": now, "updated_at": now}
    await db.seller_fulfillments.update_one({"_id": fulfillment["_id"]}, {"$set": update})
    from app.services.notification_realtime import create_notification, notify_admins
    await create_notification(db, order["user_id"], "Parcel dispatched",
        f"{data.courier_company} is delivering parcel {data.tracking_number} for order #{order_id[:8]}.",
        f"/orders/{order_id}", "delivery")
    await notify_admins(db, "Seller parcel dispatched",
        f"{data.courier_company} is carrying parcel {data.tracking_number} for order #{order_id[:8]}.", "/admin/orders")
    return update


@router.post("/orders/{order_id}/delivered")
async def seller_parcel_delivered(order_id: str, current_user: dict = Depends(require_seller)):
    db, now = get_db(), utc_now()
    result = await db.seller_fulfillments.update_one({"order_id": order_id, "seller_user_id": current_user["_id"],
        "status": "dispatched"}, {"$set": {"status": "delivered", "delivered_at": now, "updated_at": now}})
    if not result.matched_count:
        raise HTTPException(409, "Only a dispatched parcel can be marked delivered")
    remaining = await db.seller_fulfillments.count_documents({"order_id": order_id, "status": {"$ne": "delivered"}})
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not remaining:
        await db.orders.update_one({"_id": order["_id"]}, {"$set": {"status": "delivered", "updated_at": now}})
    from app.services.notification_realtime import create_notification, notify_admins
    await create_notification(db, order["user_id"], "Parcel delivered",
        f"A seller parcel for order #{order_id[:8]} was delivered.", f"/orders/{order_id}", "delivery")
    await notify_admins(db, "Seller parcel delivered",
        f"A seller parcel for order #{order_id[:8]} was delivered.", "/admin/orders")
    return {"status": "delivered", "order_complete": not remaining}


@router.get("/dashboard")
async def seller_dashboard(current_user: dict = Depends(require_seller)):
    db = get_db()
    seller_id = current_user["_id"]
    seller_profile = await db.sellers.find_one({"user_id": seller_id})
    products = await db.medicines.find({"seller_id": seller_id, "is_active": True}).to_list(length=None)
    orders = await _seller_orders(db, seller_id)
    active_orders = [o for o in orders if o.get("status") != "cancelled"]
    units_sold = sum(item.get("quantity", 0) for order in active_orders for item in order.get("items", []))
    revenue = sum(item.get("price", 0) * item.get("quantity", 0) for order in active_orders for item in order.get("items", []))
    return {
        "company_name": current_user.get("store_name") or current_user.get("business_name") or
                        (seller_profile or {}).get("store_name") or (seller_profile or {}).get("business_name"),
        "total_products": len(products),
        "low_stock_products": sum(1 for p in products if p.get("stock", 0) <= 10),
        "total_orders": len(orders),
        "units_sold": units_sold,
        "total_revenue": revenue,
        "recent_orders": [serialize_doc(o) for o in orders[:6]],
    }
