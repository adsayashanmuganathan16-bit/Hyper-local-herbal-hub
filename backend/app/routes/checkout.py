from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timedelta
from app.database import get_db
from app.models.order import OrderCreate, OrderStatusEnum, PaymentStatusEnum
from app.middleware.auth_middleware import get_current_user
from app.utils.helpers import calculate_order_amounts, serialize_doc
from app.services.payment_service import payment_service
from app.services.email_service import email_service

router = APIRouter(prefix="/api/checkout", tags=["Checkout & Payment"])


@router.post("/create-order")
async def create_order(order_data: OrderCreate, current_user: dict = Depends(get_current_user)):
    """Create a new order from cart items."""
    db = get_db()

    # Validate prescription items
    prescription_items = [item for item in order_data.items if hasattr(item, 'requires_prescription')]
    if prescription_items and not order_data.prescription_id:
        raise HTTPException(
            status_code=400,
            detail="Prescription required for some items in your cart. Please upload a prescription first.",
        )

    # Verify prescription if provided
    if order_data.prescription_id:
        from bson import ObjectId
        prescription = await db.prescriptions.find_one({"_id": ObjectId(order_data.prescription_id)})
        if not prescription or prescription["status"] != "approved":
            raise HTTPException(status_code=400, detail="Prescription not approved yet")

    # Calculate amounts
    delivery_charge = 0.0 if order_data.payment_method == "cod" and sum(i["quantity"] for i in order_data.items) >= 500 else 49.0
    amounts = calculate_order_amounts(order_data.items, delivery_charge)

    # Handle payment
    payment_id = None
    if order_data.payment_method != "cod":
        try:
            payment_result = await payment_service.create_payment_intent(
                amounts["final_amount"],
                metadata={"user_id": current_user["_id"]},
            )
            payment_id = payment_result["payment_intent_id"]
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Payment initialization failed: {e}")

    # Create order document
    order_doc = {
        "user_id": current_user["_id"],
        "items": [item.model_dump() if hasattr(item, 'model_dump') else item for item in order_data.items],
        "total_amount": amounts["total_amount"],
        "discount": amounts["discount"],
        "delivery_charge": amounts["delivery_charge"],
        "final_amount": amounts["final_amount"],
        "address": order_data.address,
        "payment_method": order_data.payment_method.value,
        "payment_status": PaymentStatusEnum.PENDING.value if order_data.payment_method != "cod" else PaymentStatusEnum.COMPLETED.value,
        "payment_id": payment_id,
        "status": OrderStatusEnum.PLACED.value,
        "prescription_id": order_data.prescription_id,
        "notes": order_data.notes,
        "invoice_url": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    result = await db.orders.insert_one(order_doc)

    # Generate invoice
    invoice = await payment_service.generate_invoice({**order_doc, "id": str(result.inserted_id)})
    await db.orders.update_one({"_id": result.inserted_id}, {"$set": {"invoice_url": f"/api/orders/{result.inserted_id}/invoice"}})

    # Clear cart
    await db.carts.delete_one({"user_id": current_user["_id"]})

    # Create delivery record
    from app.utils.helpers import generate_otp
    await db.deliveries.insert_one({
        "order_id": str(result.inserted_id),
        "delivery_partner_id": None,
        "status": "assigned",
        "current_location": None,
        "estimated_delivery": datetime.utcnow() + timedelta(hours=48),
        "actual_delivery": None,
        "otp": generate_otp(4),
        "notes": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    })

    # Send confirmation email (fire and forget)
    await email_service.send_order_confirmation(current_user["email"], str(result.inserted_id), amounts["final_amount"])

    # Create notification
    await db.notifications.insert_one({
        "user_id": current_user["_id"],
        "type": "order",
        "title": "Order Placed",
        "message": f"Your order #{str(result.inserted_id)[:8]} has been placed successfully!",
        "is_read": False,
        "link": f"/orders/{result.inserted_id}",
        "created_at": datetime.utcnow(),
    })

    response = {
        "message": "Order placed successfully",
        "order_id": str(result.inserted_id),
        "final_amount": amounts["final_amount"],
    }

    if payment_id:
        response["payment_client_secret"] = payment_result.get("client_secret")
        response["payment_intent_id"] = payment_id

    return response


@router.post("/verify-payment/{order_id}")
async def verify_payment(order_id: str, body: dict, current_user: dict = Depends(get_current_user)):
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
                {"$set": {"payment_status": "completed", "updated_at": datetime.utcnow()}},
            )
            return {"message": "Payment verified successfully"}
        else:
            await db.orders.update_one(
                {"_id": ObjectId(order_id)},
                {"$set": {"payment_status": "failed", "updated_at": datetime.utcnow()}},
            )
            raise HTTPException(status_code=400, detail="Payment not completed")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Payment verification failed: {e}")
