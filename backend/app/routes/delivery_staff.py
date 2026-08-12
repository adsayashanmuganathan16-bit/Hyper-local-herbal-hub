from app.utils.time import utc_now
from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect

from app.database import get_db
from app.financial.delivery_schemas import (
    DeliveryAction, DeliveryAssignment, DeliveryLocationUpdate, DeliveryStaffCreate, DeliveryStaffUpdate,
)
from app.middleware.auth_middleware import decode_token, get_current_user, require_admin, require_delivery_staff
from app.services.delivery_realtime import delivery_connections
from app.utils.helpers import generate_otp, hash_password, serialize_doc


router = APIRouter(tags=["Delivery Staff"])


async def notify(db, user_id, title, message, link):
    from app.services.notification_realtime import create_notification
    await create_notification(db, user_id, title, message, link, "delivery")


async def seller_ids_for_order(db, order):
    product_ids = [ObjectId(item["medicine_id"]) for item in order.get("items", [])
                   if ObjectId.is_valid(item.get("medicine_id", ""))]
    rows = await db.medicines.find({"_id": {"$in": product_ids}}, {"seller_id": 1}).to_list(length=None)
    return {row.get("seller_id") for row in rows if row.get("seller_id")}


async def can_track_order(db, order, user):
    if not order:
        return False
    if user.get("role") in {"admin", "delivery_staff", "delivery_partner"} or str(order["user_id"]) == user["_id"]:
        return True
    return user.get("role") == "seller" and user["_id"] in await seller_ids_for_order(db, order)


@router.post("/api/delivery-staff")
async def create_staff(data: DeliveryStaffCreate, _=Depends(require_admin)):
    db = get_db()
    if await db.users.find_one({"$or": [{"email": str(data.email)}, {"phone": data.phone}]}):
        raise HTTPException(409, "Email or phone is already registered")
    now = utc_now()
    user = {"name": data.name, "email": str(data.email), "phone": data.phone,
            "password": hash_password(data.password), "role": "delivery_staff", "is_active": True,
            "email_verified": True, "profile_image": data.profile_photo, "created_at": now, "updated_at": now}
    result = await db.users.insert_one(user)
    profile = {"user_id": str(result.inserted_id), "name": data.name, "email": str(data.email),
               "phone": data.phone, "vehicle_type": data.vehicle_type.value, "nic": data.nic,
               "profile_photo": data.profile_photo, "status": "Available", "is_active": True,
               "current_latitude": None, "current_longitude": None,
               "created_at": now, "updated_at": now}
    inserted = await db.delivery_staff.insert_one(profile)
    return serialize_doc({**profile, "_id": inserted.inserted_id})


@router.get("/api/delivery-staff")
async def list_staff(status: str | None = Query(None), _=Depends(require_admin)):
    query = {"is_active": True}
    if status:
        query["status"] = status
    rows = await get_db().delivery_staff.find(query).sort("name", 1).to_list(length=None)
    return {"items": [serialize_doc(row) for row in rows], "total": len(rows)}


@router.get("/api/delivery-staff/live")
async def live_staff(_=Depends(require_admin)):
    db = get_db()
    staff = await db.delivery_staff.find({"is_active": True}).to_list(length=None)
    locations = await db.delivery_locations.find({}).to_list(length=None)
    by_staff = {row["staff_id"]: serialize_doc(row) for row in locations}
    return {"items": [{**serialize_doc(row), "location": by_staff.get(str(row["_id"]))} for row in staff]}


@router.get("/api/delivery-staff/history")
async def delivery_history(order_id: str | None = None, _=Depends(require_admin)):
    query = {"event": {"$ne": "location"}}
    if order_id:
        query["order_id"] = order_id
    rows = await get_db().delivery_history.find(query).sort("created_at", -1).limit(500).to_list(length=None)
    return {"items": [serialize_doc(row) for row in rows], "total": len(rows)}


@router.put("/api/delivery-staff/{staff_id}")
async def update_staff(staff_id: str, data: DeliveryStaffUpdate, _=Depends(require_admin)):
    db = get_db()
    update = {key: (value.value if hasattr(value, "value") else value)
              for key, value in data.model_dump(exclude_none=True).items()}
    update["updated_at"] = utc_now()
    row = await db.delivery_staff.find_one_and_update({"_id": ObjectId(staff_id)}, {"$set": update})
    if not row:
        raise HTTPException(404, "Delivery staff member not found")
    user_update = {key: update[key] for key in ("name", "phone") if key in update}
    if "profile_photo" in update:
        user_update["profile_image"] = update["profile_photo"]
    if user_update:
        await db.users.update_one({"_id": ObjectId(row["user_id"])}, {"$set": user_update})
    return {"message": "Delivery staff updated"}


@router.put("/api/delivery-staff/{staff_id}/active")
async def set_staff_active(staff_id: str, body: dict, _=Depends(require_admin)):
    db = get_db()
    active = bool(body.get("is_active"))
    row = await db.delivery_staff.find_one_and_update(
        {"_id": ObjectId(staff_id)}, {"$set": {"is_active": active,
        "status": "Available" if active else "Offline", "updated_at": utc_now()}}
    )
    if not row:
        raise HTTPException(404, "Delivery staff member not found")
    await db.users.update_one({"_id": ObjectId(row["user_id"])}, {"$set": {"is_active": active}})
    return {"message": "Delivery staff activated" if active else "Delivery staff deactivated"}


@router.delete("/api/delivery-staff/{staff_id}")
async def delete_staff(staff_id: str, _=Depends(require_admin)):
    db = get_db()
    row = await db.delivery_staff.find_one({"_id": ObjectId(staff_id)})
    if not row:
        raise HTTPException(404, "Delivery staff member not found")
    if row.get("status") == "Busy":
        raise HTTPException(409, "Busy delivery staff cannot be deleted")
    await db.delivery_staff.delete_one({"_id": ObjectId(staff_id)})
    await db.users.update_one({"_id": ObjectId(row["user_id"])}, {"$set": {"is_active": False}})
    return {"message": "Delivery staff deleted"}


@router.post("/api/delivery-staff/assign")
async def assign_staff(data: DeliveryAssignment, _=Depends(require_admin)):
    db = get_db()
    staff = await db.delivery_staff.find_one({"_id": ObjectId(data.staff_id), "is_active": True, "status": "Available"})
    order = await db.orders.find_one({"_id": ObjectId(data.order_id), "status": "ready_for_pickup"})
    if not staff:
        raise HTTPException(409, "Delivery staff member is not available")
    if not order:
        raise HTTPException(409, "Order is not ready for pickup")
    now = utc_now()
    await db.deliveries.update_one({"order_id": data.order_id}, {"$set": {
        "delivery_partner_id": staff["user_id"], "delivery_staff_id": data.staff_id,
        "status": "assigned", "updated_at": now}, "$setOnInsert": {
        "order_id": data.order_id, "otp": generate_otp(4), "created_at": now}}, upsert=True)
    await db.delivery_staff.update_one({"_id": staff["_id"]}, {"$set": {"status": "Busy", "updated_at": now}})
    await db.orders.update_one({"_id": order["_id"]}, {"$set": {"status": "delivery_assigned", "updated_at": now}})
    await db.delivery_history.insert_one({"order_id": data.order_id, "staff_id": data.staff_id,
                                          "event": "assigned", "created_at": now})
    await notify(db, order["user_id"], "Delivery staff assigned",
                 f"{staff['name']} was assigned to order #{data.order_id[:8]}.", f"/orders/{data.order_id}")
    await notify(db, staff["user_id"], "New delivery assigned",
                 f"Order #{data.order_id[:8]} is ready for pickup.", "/delivery-staff")
    for seller_id in await seller_ids_for_order(db, order):
        await notify(db, seller_id, "Delivery assigned",
                     f"{staff['name']} was assigned to order #{data.order_id[:8]}.", "/seller/orders")
    await delivery_connections.broadcast(data.order_id, {"type": "delivery.assigned", "order_id": data.order_id,
                                                          "staff": {"id": data.staff_id, "name": staff["name"]}})
    return {"message": "Delivery staff assigned"}


@router.get("/api/delivery-staff/me/orders")
async def assigned_orders(user=Depends(require_delivery_staff)):
    db = get_db()
    deliveries = await db.deliveries.find({"delivery_partner_id": user["_id"]}).sort("updated_at", -1).to_list(length=None)
    result = []
    for delivery in deliveries:
        order = await db.orders.find_one({"_id": ObjectId(delivery["order_id"])})
        if order:
            result.append({"delivery": serialize_doc(delivery), "order": serialize_doc(order)})
    return {"items": result}


@router.post("/api/delivery-staff/deliveries/{delivery_id}/action")
async def delivery_action(delivery_id: str, data: DeliveryAction, user=Depends(require_delivery_staff)):
    db = get_db()
    delivery = await db.deliveries.find_one({"_id": ObjectId(delivery_id), "delivery_partner_id": user["_id"]})
    if not delivery:
        raise HTTPException(404, "Assigned delivery not found")
    transitions = {"accept": ("pickup_accepted", "pickup_accepted"), "picked_up": ("picked_up", "picked_up"),
                   "start": ("on_the_way", "on_the_way"), "near": ("near_location", "on_the_way"),
                   "complete": ("delivered", "delivered")}
    now = utc_now()
    if data.action == "reject":
        await db.deliveries.update_one({"_id": delivery["_id"]}, {"$set": {
            "delivery_partner_id": None, "delivery_staff_id": None, "status": "pending_assignment", "updated_at": now}})
        await db.delivery_staff.update_one({"user_id": user["_id"]}, {"$set": {"status": "Available", "updated_at": now}})
        event_status, order_status = "rejected", "ready_for_pickup"
    elif data.action in transitions:
        event_status, order_status = transitions[data.action]
        await db.deliveries.update_one({"_id": delivery["_id"]}, {"$set": {"status": event_status, "updated_at": now,
            **({"actual_delivery": now} if data.action == "complete" else {})}})
        if data.action == "complete":
            await db.delivery_staff.update_one({"user_id": user["_id"]}, {"$set": {"status": "Available", "updated_at": now}})
    else:
        raise HTTPException(400, "Invalid delivery action")
    await db.orders.update_one({"_id": ObjectId(delivery["order_id"])}, {"$set": {"status": order_status, "updated_at": now}})
    await db.delivery_history.insert_one({"order_id": delivery["order_id"], "staff_id": delivery.get("delivery_staff_id"),
                                          "event": event_status, "reason": data.reason, "created_at": now})
    order = await db.orders.find_one({"_id": ObjectId(delivery["order_id"])})
    titles = {"start": "Delivery started", "near": "Near your location", "complete": "Order delivered"}
    if data.action == "picked_up":
        await notify(db, order["user_id"], "Order picked up",
                     f"Order #{delivery['order_id'][:8]} was picked up.", f"/orders/{delivery['order_id']}")
    if data.action in titles:
        await notify(db, order["user_id"], titles[data.action],
                     f"Order #{delivery['order_id'][:8]}: {titles[data.action]}.", f"/orders/{delivery['order_id']}")
    if data.action == "complete":
        from app.services.financial_order_service import finalize_delivered_order_earnings
        await finalize_delivered_order_earnings(db, delivery["order_id"], now)
        for seller_id in await seller_ids_for_order(db, order):
            await notify(db, seller_id, "Order delivered",
                         f"Order #{delivery['order_id'][:8]} was delivered.", "/seller/orders")
        admins = await db.users.find({"role": "admin", "is_active": True}, {"_id": 1}).to_list(length=None)
        for admin in admins:
            await notify(db, str(admin["_id"]), "Delivery completed",
                         f"Order #{delivery['order_id'][:8]} was delivered.", "/admin/delivery-staff")
    await delivery_connections.broadcast(delivery["order_id"], {"type": "delivery.status", "order_id": delivery["order_id"],
                                                                 "status": event_status})
    return {"status": event_status}


@router.post("/api/courier/location")
@router.post("/api/delivery/location", include_in_schema=False)
async def update_location(data: DeliveryLocationUpdate, user=Depends(require_delivery_staff)):
    """Store a GPS update only when the courier is assigned to the active order."""
    db = get_db()
    delivery = await db.deliveries.find_one({"order_id": data.order_id, "delivery_partner_id": user["_id"],
                                             "status": {"$in": ["pickup_accepted", "picked_up", "on_the_way", "near_location"]}})
    if not delivery:
        raise HTTPException(404, "Active assigned delivery not found")
    staff = await db.delivery_staff.find_one({"user_id": user["_id"]})
    now = utc_now()
    point = {"latitude": data.latitude, "longitude": data.longitude, "accuracy": data.accuracy,
             "heading": data.heading, "speed": data.speed, "updated_at": now}
    await db.delivery_staff.update_one({"_id": staff["_id"]}, {"$set": {
        "current_latitude": data.latitude, "current_longitude": data.longitude, "updated_at": now}})
    courier_point = {
        **point,
        "courier_user_id": user["_id"],
        "delivery_staff_id": str(staff["_id"]),
        "order_id": data.order_id,
    }
    await db.courier_locations.update_one(
        {"courier_user_id": user["_id"]},
        {"$set": courier_point},
        upsert=True,
    )
    # Keep the legacy collection synchronized for existing admin map consumers.
    await db.delivery_locations.update_one({"staff_id": str(staff["_id"])}, {"$set": {
        **point, "staff_id": str(staff["_id"]), "order_id": data.order_id}}, upsert=True)
    await db.deliveries.update_one({"_id": delivery["_id"]}, {"$set": {"current_location": point, "updated_at": now}})
    await db.delivery_history.insert_one({"order_id": data.order_id, "staff_id": str(staff["_id"]),
                                          "event": "location", **point})
    payload = {"type": "delivery.location", "order_id": data.order_id, "staff_id": str(staff["_id"]), **point}
    payload["updated_at"] = now.isoformat()
    await delivery_connections.broadcast(data.order_id, payload)
    return {"status": "updated"}


async def tracking_payload(db, order_id):
    if not ObjectId.is_valid(order_id):
        raise HTTPException(404, "Order not found")
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(404, "Order not found")
    delivery = await db.deliveries.find_one({"order_id": order_id})
    staff = await db.delivery_staff.find_one({"_id": ObjectId(delivery["delivery_staff_id"])}) if delivery and delivery.get("delivery_staff_id") else None
    location = await db.courier_locations.find_one({"order_id": order_id})
    if not location:
        location = await db.delivery_locations.find_one({"order_id": order_id})
    history = await db.delivery_history.find({"order_id": order_id, "event": {"$ne": "location"}}).sort("created_at", 1).to_list(length=None)
    seller_ids = await seller_ids_for_order(db, order)
    seller = await db.sellers.find_one({"user_id": {"$in": list(seller_ids)}}) if seller_ids else None
    seller_user = await db.users.find_one({"_id": ObjectId(next(iter(seller_ids)))}) if seller_ids and ObjectId.is_valid(next(iter(seller_ids))) else None
    return {"order_id": order_id, "status": delivery.get("status") if delivery else "preparing",
            "order_status": order.get("status"), "staff": serialize_doc(staff) if staff else None,
            "courier_location": serialize_doc(location) if location else None,
            "location": serialize_doc(location) if location else None, "customer_location": order.get("customer_location"),
            "seller_location": order.get("seller_location"), "seller_address": (seller or {}).get("address") or (seller_user or {}).get("address"),
            "customer_address": order.get("address"),
            "history": [serialize_doc(row) for row in history]}


@router.get("/api/orders/{order_id}/tracking")
async def order_tracking(order_id: str, user=Depends(get_current_user)):
    db = get_db()
    order = await db.orders.find_one({"_id": ObjectId(order_id)}) if ObjectId.is_valid(order_id) else None
    if not await can_track_order(db, order, user):
        raise HTTPException(403, "Tracking access denied")
    return await tracking_payload(db, order_id)


async def websocket_user(socket: WebSocket):
    token = socket.query_params.get("token")
    if not token:
        return None
    try:
        payload = decode_token(token)
        user = await get_db().users.find_one({"_id": ObjectId(payload["sub"]), "is_active": True})
        return user
    except Exception:
        return None


@router.websocket("/ws/tracking/{order_id}")
async def tracking_socket(socket: WebSocket, order_id: str):
    user = await websocket_user(socket)
    order = await get_db().orders.find_one({"_id": ObjectId(order_id)}) if ObjectId.is_valid(order_id) else None
    if not user or not await can_track_order(get_db(), order, user):
        await socket.close(code=4401); return
    await delivery_connections.connect_order(order_id, socket)
    try:
        await socket.send_json(await tracking_payload(get_db(), order_id))
        while True:
            await socket.receive_text()
    except WebSocketDisconnect:
        await delivery_connections.disconnect(socket)


@router.websocket("/ws/delivery/admin")
async def admin_socket(socket: WebSocket):
    user = await websocket_user(socket)
    if not user or user.get("role") != "admin":
        await socket.close(code=4403); return
    await delivery_connections.connect_admin(socket)
    try:
        while True:
            await socket.receive_text()
    except WebSocketDisconnect:
        await delivery_connections.disconnect(socket)
