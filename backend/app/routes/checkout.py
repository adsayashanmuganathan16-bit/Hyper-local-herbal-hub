from app.utils.time import utc_now
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timedelta
from app.database import get_db
from app.models.order import OrderCreate, OrderStatusEnum, PaymentStatusEnum
from app.middleware.auth_middleware import require_customer
from app.utils.helpers import calculate_order_amounts, get_product_image, serialize_doc
from app.services.payment_service import payment_service
from app.services.email_service import email_service
from app.config import settings
from app.services.service_area_service import validate_service_coordinates, distance_km
from app.services.postal_shipping_service import calculate_parcel_weight, calculate_shipping_fee

router = APIRouter(prefix="/api/checkout", tags=["Checkout & Payment"])


@router.post("/create-order")
async def create_order(order_data: OrderCreate, current_user: dict = Depends(require_customer)):
    """Create a new order from cart items."""
    db = get_db()

    if not order_data.items:
        raise HTTPException(status_code=400, detail="Your cart is empty")

    # Serviceability is enforced server-side before any order/payment records
    # are created. The frontend check is only an early usability check.
    customer_location = await validate_service_coordinates(db, order_data.customer_latitude, order_data.customer_longitude)

    # Prices, stock, prescription requirements and seller ownership are always
    # read from the database. Never trust checkout totals submitted by a client.
    from bson import ObjectId
    from bson.errors import InvalidId
    validated_items = []
    seller_amounts = {}
    for requested in order_data.items:
        try:
            medicine = await db.medicines.find_one({"_id": ObjectId(requested.medicine_id), "is_active": True})
        except (InvalidId, TypeError):
            medicine = None
        if not medicine:
            raise HTTPException(status_code=400, detail=f"{requested.name} is no longer available")
        if requested.quantity < 1 or medicine.get("stock", 0) < requested.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {medicine['name']}")
        seller_id = medicine.get("seller_id")
        if not seller_id:
            raise HTTPException(status_code=400, detail=f"{medicine['name']} is not assigned to a seller")
        unit_price = medicine.get("discount_price") or medicine["price"]
        item = {"medicine_id": str(medicine["_id"]), "name": medicine["name"],
                "price": unit_price, "quantity": requested.quantity,
                "weight_grams": int(medicine.get("weight_grams", 100)),
                "image": get_product_image(medicine),
                "requires_prescription": medicine.get("requires_prescription", False)}
        validated_items.append(item)
        seller_key = str(seller_id)
        seller_amounts[seller_key] = seller_amounts.get(seller_key, 0) + unit_price * requested.quantity

    # Resolve the nearest eligible seller per product. Existing marketplace
    # orders can contain multiple sellers, so requiring one store to stock the
    # whole cart incorrectly rejects valid carts.
    requested_by_name = {item["name"]: item for item in validated_items}
    stock_rows = await db.medicines.find({"name": {"$in": list(requested_by_name)}, "is_active": True}).to_list(length=None)
    candidate_seller_ids = list({str(row["seller_id"]) for row in stock_rows if row.get("seller_id")})
    seller_profiles = await db.sellers.find({"user_id": {"$in": candidate_seller_ids}, "approval_status": "APPROVED",
        "service_area_id": customer_location["service_area_id"], "latitude": {"$ne": None},
        "longitude": {"$ne": None}}).to_list(length=None)
    profiles = {seller["user_id"]: seller for seller in seller_profiles}
    candidates_by_name = {}
    for medicine in stock_rows:
        requested = requested_by_name[medicine["name"]]
        seller_id = str(medicine.get("seller_id", ""))
        if seller_id in profiles and medicine.get("stock", 0) >= requested["quantity"]:
            candidates_by_name.setdefault(medicine["name"], []).append(medicine)
    validated_items, seller_amounts, selected_profiles = [], {}, {}
    for name, requested in requested_by_name.items():
        candidates = candidates_by_name.get(name, [])
        if not candidates:
            raise HTTPException(409, f"No nearby seller currently has enough stock of {name}")
        medicine = min(candidates, key=lambda row: distance_km(customer_location["latitude"], customer_location["longitude"],
            profiles[str(row["seller_id"])]["latitude"], profiles[str(row["seller_id"])]["longitude"]))
        seller_id = str(medicine["seller_id"])
        selected_profiles[seller_id] = profiles[seller_id]
        unit_price = medicine.get("discount_price") or medicine["price"]
        validated_items.append({"medicine_id": str(medicine["_id"]), "name": name, "price": unit_price,
            "quantity": requested["quantity"], "image": get_product_image(medicine),
            "weight_grams": int(medicine.get("weight_grams", 100)),
            "requires_prescription": medicine.get("requires_prescription", False)})
        seller_amounts[seller_id] = seller_amounts.get(seller_id, 0) + unit_price * requested["quantity"]
    selected_seller = min(selected_profiles.values(), key=lambda seller: distance_km(customer_location["latitude"],
        customer_location["longitude"], seller["latitude"], seller["longitude"]))

    prescription_items = [item for item in validated_items if item["requires_prescription"]]
    if prescription_items and not order_data.prescription_id:
        raise HTTPException(
            status_code=400,
            detail="Prescription required for some items in your cart. Please upload a prescription first.",
        )

    # Verify prescription if provided
    if order_data.prescription_id:
        try:
            prescription = await db.prescriptions.find_one({"_id": ObjectId(order_data.prescription_id), "user_id": current_user["_id"]})
        except (InvalidId, TypeError):
            prescription = None
        if not prescription or prescription["status"] != "approved":
            raise HTTPException(status_code=400, detail="Prescription not approved yet")

    # Calculate amounts
    try:
        parcel_weight = calculate_parcel_weight(validated_items)
        shipping_fee = float(calculate_shipping_fee(parcel_weight))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    amounts = calculate_order_amounts(validated_items, shipping_fee)

    is_online_payment = order_data.payment_method.value != "cod"
    # The UI may call this option "online", "card", or retain a provider value
    # from an older cached build. Every explicit non-COD selection must use the
    # currently configured gateway; only an explicit `cod` value enters COD.
    effective_payment_method = settings.PAYMENT_PROVIDER if is_online_payment else "cod"

    # Create order document
    order_doc = {
        "user_id": current_user["_id"],
        "items": validated_items,
        "total_amount": amounts["total_amount"],
        "discount": amounts["discount"],
        "delivery_charge": amounts["delivery_charge"],
        "parcel_weight": parcel_weight,
        "shipping_fee": shipping_fee,
        "final_amount": amounts["final_amount"],
        "address": order_data.address,
        "customer_address": order_data.customer_address or order_data.address,
        "customer_latitude": customer_location["latitude"],
        "customer_longitude": customer_location["longitude"],
        "landmark": order_data.landmark,
        "delivery_note": order_data.delivery_note,
        "customer_location": {"latitude": customer_location["latitude"], "longitude": customer_location["longitude"],
                              "formatted": customer_location.get("address", {}).get("formatted", "")},
        "seller_location": {"latitude": selected_seller["latitude"], "longitude": selected_seller["longitude"],
                            "label": selected_seller.get("store_name", selected_seller.get("business_name"))},
        "service_area_id": customer_location["service_area_id"],
        "seller_id": selected_seller["user_id"],
        "seller_ids": list(selected_profiles),
        "seller_locations": [{"seller_id": seller["user_id"], "latitude": seller["latitude"],
            "longitude": seller["longitude"], "label": seller.get("store_name", seller.get("business_name"))}
            for seller in selected_profiles.values()],
        "payment_method": effective_payment_method,
        "payment_status": PaymentStatusEnum.PENDING.value,
        "payment_id": None,
        "status": OrderStatusEnum.PLACED.value,
        "courier_service": None,
        "tracking_number": None,
        "shipping_date": None,
        "delivery_status": "pending",
        "last_status_updated": utc_now(),
        "customer_confirmed_received": False,
        "customer_received_at": None,
        "customer_reported_not_received": False,
        "not_received_reported_at": None,
        "prescription_id": order_data.prescription_id,
        "notes": order_data.notes,
        "invoice_url": None,
        "created_at": utc_now(),
        "updated_at": utc_now(),
    }

    result = await db.orders.insert_one(order_doc)
    from app.services.seller_fulfillment_service import create_seller_fulfillments
    await create_seller_fulfillments(db, str(result.inserted_id), order_doc, seller_amounts,
                                     payment_ready=not is_online_payment)

    payment_request = None
    if is_online_payment:
        try:
            from app.services.financial_order_service import create_financial_order
            from app.services.payment_gateway_service import get_payment_gateway

            delivery_allocations = (
                {selected_seller["user_id"]: amounts["delivery_charge"]}
                if amounts["delivery_charge"] > 0 else {}
            )
            await create_financial_order(
                db, str(result.inserted_id), current_user["_id"],
                amounts["final_amount"], seller_amounts, delivery_allocations,
            )
            name_parts = order_data.address.get("name", current_user.get("name", "Customer")).split(maxsplit=1)
            payment_gateway = get_payment_gateway(settings.PAYMENT_PROVIDER)
            payment_request = payment_gateway.create_payment_request(str(result.inserted_id), amounts["final_amount"], {
                "first_name": name_parts[0], "last_name": name_parts[1] if len(name_parts) > 1 else "",
                "email": current_user["email"], "phone": order_data.address.get("phone", current_user.get("phone", "")),
                "address": " ".join(filter(None, [order_data.address.get("address_line1"), order_data.address.get("address_line2")])),
                "city": order_data.address.get("city", ""),
            })
            if payment_request.get("transaction_id"):
                await db.payments.update_one(
                    {"order_id": str(result.inserted_id)},
                    {"$set": {"payment_gateway": settings.PAYMENT_PROVIDER,
                              "transaction_id": payment_request["transaction_id"],
                              "updated_at": utc_now()}},
                )
        except Exception as exc:
            await db.orders.delete_one({"_id": result.inserted_id})
            await db.financial_orders.delete_one({"order_id": str(result.inserted_id)})
            await db.seller_order_allocations.delete_many({"order_id": str(result.inserted_id)})
            await db.payments.delete_one({"order_id": str(result.inserted_id)})
            await db.seller_fulfillments.delete_many({"order_id": str(result.inserted_id)})
            raise HTTPException(status_code=400, detail=f"Payment initialization failed: {exc}") from exc
    else:
        try:
            from app.services.financial_order_service import create_financial_order
            delivery_allocations = (
                {selected_seller["user_id"]: amounts["delivery_charge"]}
                if amounts["delivery_charge"] > 0 else {}
            )
            await create_financial_order(
                db, str(result.inserted_id), current_user["_id"],
                amounts["final_amount"], seller_amounts, delivery_allocations,
            )
            await db.payments.update_one(
                {"order_id": str(result.inserted_id)},
                {"$set": {"payment_gateway": "cod", "status": "PENDING", "updated_at": utc_now()}},
            )
        except Exception as exc:
            await db.orders.delete_one({"_id": result.inserted_id})
            await db.financial_orders.delete_one({"order_id": str(result.inserted_id)})
            await db.seller_order_allocations.delete_many({"order_id": str(result.inserted_id)})
            await db.payments.delete_one({"order_id": str(result.inserted_id)})
            await db.seller_fulfillments.delete_many({"order_id": str(result.inserted_id)})
            raise HTTPException(status_code=400, detail=f"Order accounting failed: {exc}") from exc

    # Generate invoice
    invoice = await payment_service.generate_invoice({**order_doc, "id": str(result.inserted_id)})
    await db.orders.update_one({"_id": result.inserted_id}, {"$set": {"invoice_url": f"/api/orders/{result.inserted_id}/invoice"}})

    # Clear cart
    await db.carts.delete_one({"user_id": current_user["_id"]})

    # COD orders can enter fulfilment immediately. Online orders remain hidden
    # from fulfilment and have no delivery record until payment is verified.
    if not is_online_payment:
        from app.utils.helpers import generate_otp
        from app.services.notification_realtime import create_notification, notify_admins
        await db.deliveries.insert_one({
            "order_id": str(result.inserted_id), "delivery_partner_id": None, "status": "assigned",
            "current_location": None, "estimated_delivery": utc_now() + timedelta(hours=48),
            "actual_delivery": None, "otp": generate_otp(4), "notes": None,
            "created_at": utc_now(), "updated_at": utc_now(),
        })
        await email_service.send_order_confirmation(current_user["email"], str(result.inserted_id), amounts["final_amount"])
        await create_notification(db, current_user["_id"], "Order placed",
            f"Your order #{str(result.inserted_id)[:8]} has been placed successfully!", f"/orders/{result.inserted_id}")
        for seller_user_id in seller_amounts:
            await create_notification(db, seller_user_id, "New customer order",
                f"New COD order #{str(result.inserted_id)[:8]} is ready for preparation.", "/seller/orders")
        await notify_admins(db, "New marketplace order",
            f"COD order #{str(result.inserted_id)[:8]} was placed across {len(seller_amounts)} seller(s).", "/admin/orders")

    response = {
        "message": "Order placed successfully",
        "order_id": str(result.inserted_id),
        "final_amount": amounts["final_amount"],
        "parcel_weight": parcel_weight,
        "shipping_fee": shipping_fee,
    }

    if payment_request:
        response["payment_request"] = payment_request

    return response


@router.post("/verify-payment/{order_id}")
async def verify_payment(order_id: str, body: dict, current_user: dict = Depends(require_customer)):
    """Verify payment after client-side confirmation."""
    db = get_db()
    from bson import ObjectId

    order = await db.orders.find_one({"_id": ObjectId(order_id), "user_id": current_user["_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    try:
        payment_status = await payment_service.confirm_payment(order["payment_id"])
        if payment_status["status"] == "succeeded":
            await db.orders.update_one(
                {"_id": ObjectId(order_id)},
                {"$set": {"payment_status": "completed", "updated_at": utc_now()}},
            )
            return {"message": "Payment verified successfully"}
        else:
            await db.orders.update_one(
                {"_id": ObjectId(order_id)},
                {"$set": {"payment_status": "failed", "updated_at": utc_now()}},
            )
            raise HTTPException(status_code=400, detail="Payment not completed")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Payment verification failed: {e}")
