from app.utils.time import utc_now
from fastapi import APIRouter, HTTPException, Query, Depends
from datetime import datetime
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError
from bson import ObjectId
import logging
from html import escape
from app.database import get_db
from app.middleware.auth_middleware import get_current_user, require_customer, require_admin
from app.utils.helpers import serialize_doc, paginate
from app.services.postal_shipping_service import (
    ORDER_STATUS_BY_POSTAL_STATUS,
    POSTAL_STATUS_TRANSITIONS,
    validate_postal_transition,
)

router = APIRouter(prefix="/api/orders", tags=["Order Management"])
logger = logging.getLogger(__name__)


class ShippingDetailsUpdate(BaseModel):
    courier_service: str = Field(default="Sri Lanka Post", min_length=2, max_length=120)
    tracking_number: str = Field(min_length=3, max_length=120, pattern=r"^[A-Za-z0-9][A-Za-z0-9\-/ ]+$")
    shipping_date: datetime


class PostalStatusUpdate(BaseModel):
    status: str


async def seller_ids_for_order(db, order: dict) -> set[str]:
    """Resolve seller user IDs for both current and legacy orders."""
    seller_ids = {
        str(value) for value in order.get("seller_ids", [])
        if value
    }
    if order.get("seller_id"):
        seller_ids.add(str(order["seller_id"]))
    if seller_ids:
        return seller_ids
    product_ids = [
        ObjectId(item["medicine_id"]) for item in order.get("items", [])
        if ObjectId.is_valid(item.get("medicine_id", ""))
    ]
    if product_ids:
        products = await db.medicines.find(
            {"_id": {"$in": product_ids}},
            {"seller_id": 1},
        ).to_list(length=None)
        seller_ids.update(str(row["seller_id"]) for row in products if row.get("seller_id"))
    return seller_ids


async def require_order_shipping_manager(db, order: dict | None, user: dict) -> None:
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if user.get("role") == "admin":
        return
    if user.get("role") != "seller":
        raise HTTPException(status_code=403, detail="Seller or admin access required")
    product_ids = [
        item.get("medicine_id") for item in order.get("items", [])
        if item.get("medicine_id")
    ]
    seller_product = await db.medicines.find_one({
        "_id": {"$in": [
            ObjectId(value) for value in product_ids if ObjectId.is_valid(value)
        ]},
        "seller_id": user["_id"],
    })
    if not seller_product:
        raise HTTPException(status_code=403, detail="This order does not contain products from your store")


async def notify_postal_status(db, order: dict, order_id: str, postal_status: str) -> None:
    from app.services.notification_realtime import create_notification
    title = "Parcel delivered" if postal_status == "delivered" else "Postal delivery updated"
    message = (
        f"Your Sri Lanka Post parcel for order #{order_id[:8]} has been delivered."
        if postal_status == "delivered"
        else f"Order #{order_id[:8]} is now {postal_status.replace('_', ' ').title()}."
    )
    await create_notification(
        db,
        order["user_id"],
        title,
        message,
        f"/orders/{order_id}",
        "delivery",
    )
    if postal_status == "delivered":
        customer = await db.users.find_one({"_id": ObjectId(order["user_id"])})
        if customer and customer.get("email"):
            from app.services.email_service import email_service
            await email_service.send_email(
                customer["email"],
                f"Order #{order_id[:8]} delivered",
                f"""
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
                  <div style="background:#0B5D3B;color:white;padding:20px;border-radius:10px 10px 0 0">
                    <h2 style="margin:0">Your parcel has been delivered</h2>
                  </div>
                  <div style="padding:22px;border:1px solid #d8e7dc;border-top:0">
                    <p>Hello {escape(customer.get("name", "Customer"))},</p>
                    <p>Your Sri Lanka Post parcel for order
                       <strong>#{order_id[:8].upper()}</strong> has been marked as delivered.</p>
                    <p>If you have not received it, please contact Hyper-Local Herbal Hub support.</p>
                  </div>
                </div>
                """,
            )


@router.get("/")
async def get_my_orders(
    status: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(require_customer),
):
    """Get current user's orders with optional status filter."""
    db = get_db()
    query = {"user_id": current_user["_id"]}
    if status:
        query["status"] = status

    cursor = db.orders.find(query).sort([("created_at", -1)])
    orders = await cursor.to_list(length=None)
    for order in orders:
        order["fulfillments"] = await db.seller_fulfillments.find({"order_id": str(order["_id"]),
            "status": {"$ne": "awaiting_payment"}}).to_list(length=None)
    result = paginate(orders, page, page_size)
    result["items"] = [serialize_doc(o) for o in result["items"]]
    return result


@router.get("/{order_id}")
async def get_order(order_id: str, current_user: dict = Depends(require_customer)):
    """Get a specific order by ID."""
    db = get_db()
    from bson import ObjectId

    order = await db.orders.find_one({"_id": ObjectId(order_id), "user_id": current_user["_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Get delivery info
    delivery = await db.deliveries.find_one({"order_id": order_id})
    result = serialize_doc(order)
    fulfillments = await db.seller_fulfillments.find({"order_id": order_id,
        "status": {"$ne": "awaiting_payment"}}).to_list(length=None)
    result["fulfillments"] = [serialize_doc(row) for row in fulfillments]
    if delivery:
        result["delivery"] = serialize_doc(delivery)

    return result


@router.get("/{order_id}/postal-tracking")
async def get_postal_tracking(order_id: str, current_user: dict = Depends(get_current_user)):
    """Return manual postal tracking fields to the customer, seller, or admin."""
    from bson import ObjectId
    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=404, detail="Order not found")
    db = get_db()
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if current_user.get("role") == "customer":
        if order.get("user_id") != current_user["_id"]:
            raise HTTPException(status_code=403, detail="Tracking access denied")
    else:
        await require_order_shipping_manager(db, order, current_user)
    return {
        "order_id": order_id,
        "parcel_weight": order.get("parcel_weight", 0),
        "shipping_fee": order.get("shipping_fee", order.get("delivery_charge", 0)),
        "courier_service": order.get("courier_service"),
        "tracking_number": order.get("tracking_number"),
        "shipping_date": order.get("shipping_date"),
        "delivery_status": order.get("delivery_status", "pending"),
        "last_status_updated": order.get("last_status_updated") or order.get("updated_at"),
    }


@router.put("/{order_id}/confirm-received")
async def confirm_order_received(
    order_id: str,
    current_user: dict = Depends(require_customer),
):
    """Let the customer acknowledge delivery and notify every relevant seller."""
    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=404, detail="Order not found")
    db = get_db()
    order = await db.orders.find_one({
        "_id": ObjectId(order_id),
        "user_id": current_user["_id"],
    })
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("status") != "delivered" and order.get("delivery_status") != "delivered":
        raise HTTPException(
            status_code=409,
            detail="You can confirm receipt only after the parcel is marked delivered",
        )
    if order.get("customer_confirmed_received"):
        return {
            "message": "Parcel receipt was already confirmed",
            "customer_confirmed_received": True,
            "customer_received_at": order.get("customer_received_at"),
        }

    now = utc_now()
    result = await db.orders.update_one(
        {
            "_id": order["_id"],
            "customer_confirmed_received": {"$ne": True},
        },
        {"$set": {
            "customer_confirmed_received": True,
            "customer_received_at": now,
            "customer_reported_not_received": False,
            "updated_at": now,
        }},
    )
    if result.modified_count:
        from app.services.notification_realtime import create_notification
        customer_name = current_user.get("name", "The customer")
        for seller_id in await seller_ids_for_order(db, order):
            await create_notification(
                db,
                seller_id,
                "Customer confirmed parcel receipt",
                f"{customer_name} confirmed receiving order #{order_id[:8].upper()}.",
                "/seller/orders",
                "delivery",
            )
        logger.info("Customer %s confirmed receipt of order %s", current_user["_id"], order_id)

    return {
        "message": "Receipt confirmed. The seller has been notified.",
        "customer_confirmed_received": True,
        "customer_received_at": now,
    }


@router.put("/{order_id}/report-not-received")
async def report_order_not_received(
    order_id: str,
    current_user: dict = Depends(require_customer),
):
    """Let only the order's customer report a delivered-but-missing parcel."""
    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=404, detail="Order not found")
    db = get_db()
    order = await db.orders.find_one({
        "_id": ObjectId(order_id),
        "user_id": current_user["_id"],
    })
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("status") != "delivered" and order.get("delivery_status") != "delivered":
        raise HTTPException(
            status_code=409,
            detail="This can be reported only after the parcel is marked delivered",
        )
    if order.get("customer_confirmed_received"):
        raise HTTPException(
            status_code=409,
            detail="This parcel has already been confirmed as received",
        )
    if order.get("customer_reported_not_received"):
        return {
            "message": "The missing parcel was already reported",
            "customer_reported_not_received": True,
            "not_received_reported_at": order.get("not_received_reported_at"),
        }

    now = utc_now()
    result = await db.orders.update_one(
        {
            "_id": order["_id"],
            "customer_confirmed_received": {"$ne": True},
            "customer_reported_not_received": {"$ne": True},
        },
        {"$set": {
            "customer_reported_not_received": True,
            "not_received_reported_at": now,
            "updated_at": now,
        }},
    )
    if result.modified_count:
        from app.services.notification_realtime import create_notification, notify_admins
        customer_name = current_user.get("name", "The customer")
        message = (
            f"{customer_name} reported that order #{order_id[:8].upper()} "
            "was marked delivered but has not arrived."
        )
        for seller_id in await seller_ids_for_order(db, order):
            await create_notification(
                db, seller_id, "Customer reported parcel not received",
                message, "/seller/orders", "delivery",
            )
        await notify_admins(
            db,
            "Parcel reported not received",
            message,
            "/admin/orders",
        )
        logger.warning("Customer %s reported order %s not received", current_user["_id"], order_id)

    return {
        "message": "The seller and support team have been informed.",
        "customer_reported_not_received": True,
        "not_received_reported_at": now,
    }


@router.put("/{order_id}/shipping")
async def update_shipping_details(
    order_id: str,
    data: ShippingDetailsUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Create or edit Sri Lanka Post dispatch details."""
    from bson import ObjectId
    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=404, detail="Order not found")
    db = get_db()
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    await require_order_shipping_manager(db, order, current_user)
    current_status = order.get("delivery_status", "pending")
    if current_status not in {"packed", "shipped", "in_transit"}:
        raise HTTPException(
            status_code=409,
            detail="Shipping details can be added after the order is packed and before delivery.",
        )

    normalized_tracking = " ".join(data.tracking_number.strip().upper().split())
    existing = await db.orders.find_one({
        "tracking_number": normalized_tracking,
        "_id": {"$ne": order["_id"]},
    })
    if existing:
        raise HTTPException(status_code=409, detail="This tracking number is already assigned to another order")

    now = utc_now()
    next_status = "shipped" if current_status == "packed" else current_status
    update = {
        "courier_service": data.courier_service.strip(),
        "tracking_number": normalized_tracking,
        "shipping_date": data.shipping_date,
        "delivery_status": next_status,
        "status": ORDER_STATUS_BY_POSTAL_STATUS[next_status],
        "last_status_updated": now,
        "updated_at": now,
    }
    try:
        await db.orders.update_one({"_id": order["_id"]}, {"$set": update})
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=409,
            detail="This tracking number is already assigned to another order",
        ) from exc
    fulfillment_query = {"order_id": order_id}
    if current_user.get("role") == "seller":
        fulfillment_query["seller_user_id"] = current_user["_id"]
    await db.seller_fulfillments.update_many(
        fulfillment_query,
        {"$set": {
            "status": "dispatched",
            "courier_company": update["courier_service"],
            "tracking_number": normalized_tracking,
            "dispatched_at": data.shipping_date,
            "updated_at": now,
        }},
    )
    if current_status == "packed":
        await notify_postal_status(db, order, order_id, "shipped")
    logger.info(
        "Shipping details updated for order %s by %s %s",
        order_id,
        current_user.get("role"),
        current_user["_id"],
    )
    return {"message": "Shipping details saved", **serialize_doc(update)}


@router.put("/{order_id}/delivery-status")
async def update_postal_delivery_status(
    order_id: str,
    data: PostalStatusUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Move an order through the strict manual postal delivery workflow."""
    from bson import ObjectId
    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=404, detail="Order not found")
    if data.status not in POSTAL_STATUS_TRANSITIONS:
        raise HTTPException(status_code=422, detail="Invalid postal delivery status")
    db = get_db()
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    await require_order_shipping_manager(db, order, current_user)
    current_status = order.get("delivery_status", "pending")
    if current_status == "packed" and data.status == "shipped":
        raise HTTPException(
            status_code=409,
            detail="Add the courier service, tracking number, and shipping date to mark this order shipped.",
        )
    try:
        validate_postal_transition(current_status, data.status)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    now = utc_now()
    update = {
        "delivery_status": data.status,
        "status": ORDER_STATUS_BY_POSTAL_STATUS[data.status],
        "last_status_updated": now,
        "updated_at": now,
    }
    if data.status == "delivered":
        update["delivered_at"] = now
    await db.orders.update_one({"_id": order["_id"]}, {"$set": update})
    await db.deliveries.update_one(
        {"order_id": order_id},
        {"$set": {
            "status": "delivered" if data.status == "delivered" else data.status,
            "updated_at": now,
            **({"actual_delivery": now} if data.status == "delivered" else {}),
        }},
    )

    fulfillment_query = {"order_id": order_id}
    if current_user.get("role") == "seller":
        fulfillment_query["seller_user_id"] = current_user["_id"]
    fulfillment_status = {
        "accepted": "processing",
        "packed": "ready_to_dispatch",
        "in_transit": "dispatched",
        "delivered": "delivered",
    }.get(data.status)
    if fulfillment_status:
        await db.seller_fulfillments.update_many(
            fulfillment_query,
            {"$set": {"status": fulfillment_status, "updated_at": now}},
        )
    if data.status == "delivered" and order.get("payment_method") == "cod":
        await db.orders.update_one(
            {"_id": order["_id"]},
            {"$set": {"payment_status": "completed", "updated_at": now}},
        )
        await db.payments.update_one(
            {"order_id": order_id},
            {"$set": {
                "status": "PAID",
                "transaction_id": f"COD-{order_id}",
                "paid_at": now,
                "updated_at": now,
            }},
        )
        await db.financial_orders.update_one(
            {"order_id": order_id},
            {"$set": {
                "payment_status": "PAID",
                "order_status": "DELIVERED",
                "updated_at": now,
            }},
        )
    if data.status == "delivered":
        from app.services.financial_order_service import finalize_delivered_order_earnings
        await finalize_delivered_order_earnings(db, order_id, now)
    await notify_postal_status(db, order, order_id, data.status)
    logger.info(
        "Postal status changed for order %s: %s -> %s by %s %s",
        order_id,
        current_status,
        data.status,
        current_user.get("role"),
        current_user["_id"],
    )
    return {
        "message": f"Delivery status updated to {data.status.replace('_', ' ')}",
        "delivery_status": data.status,
        "last_status_updated": now,
    }


@router.get("/{order_id}/invoice")
async def get_invoice(order_id: str, current_user: dict = Depends(require_customer)):
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
async def cancel_order(order_id: str, current_user: dict = Depends(require_customer)):
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
        {"$set": {"status": "cancelled", "updated_at": utc_now()}},
    )
    await db.deliveries.update_one(
        {"order_id": order_id},
        {"$set": {"status": "failed", "updated_at": utc_now()}},
    )
    await db.seller_fulfillments.update_many({"order_id": order_id},
        {"$set": {"status": "cancelled", "updated_at": utc_now()}})
    financial_update = {"order_status": "CANCELLED", "updated_at": utc_now()}
    if order.get("payment_status") != "completed":
        financial_update["payment_status"] = "CANCELLED"
    await db.financial_orders.update_one({"order_id": order_id}, {"$set": financial_update})
    if order.get("payment_status") != "completed":
        await db.payments.update_one(
            {"order_id": order_id},
            {"$set": {"status": "CANCELLED", "updated_at": utc_now()}},
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

    status_time = utc_now()
    order_update = {"status": new_status, "updated_at": status_time}
    if new_status == "delivered":
        order_update["delivered_at"] = status_time
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": order_update},
    )
    await db.deliveries.update_one(
        {"order_id": order_id},
        {"$set": {"status": new_status, "updated_at": status_time,
                  **({"actual_delivery": status_time} if new_status == "delivered" else {})}},
    )

    # Notify user
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if order:
        if new_status == "delivered" and order.get("payment_method") == "cod":
            now = utc_now()
            await db.orders.update_one({"_id": ObjectId(order_id)}, {"$set": {"payment_status": "completed", "updated_at": now}})
            await db.payments.update_one({"order_id": order_id}, {"$set": {
                "status": "PAID", "transaction_id": f"COD-{order_id}", "paid_at": now, "updated_at": now,
            }})
            await db.financial_orders.update_one({"order_id": order_id}, {"$set": {"payment_status": "PAID", "order_status": "DELIVERED", "updated_at": now}})
        if new_status == "delivered":
            from app.services.financial_order_service import finalize_delivered_order_earnings
            await finalize_delivered_order_earnings(db, order_id, status_time)
        await db.notifications.insert_one({
            "user_id": order["user_id"],
            "type": "order",
            "title": "Order Updated",
            "message": f"Your order #{order_id[:8]} status changed to {new_status.replace('_', ' ').title()}",
            "is_read": False,
            "link": f"/orders/{order_id}",
            "created_at": utc_now(),
        })

    return {"message": f"Order status updated to {new_status}"}
