import hashlib
import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request
from pymongo import ReturnDocument

from app.database import get_db
from app.financial.schemas import FinancialOrderCreate, MockCardPayment, PaymentCustomer
from app.middleware.auth_middleware import get_current_user
from app.middleware.rate_limit import payment_request_limit, payment_webhook_limit
from app.services.commission_service import money
from app.services.financial_order_service import create_financial_order
from app.services.payhere_service import payhere_gateway
from app.services.onepay_service import OnePayError, onepay_gateway
from app.services.mock_payment_service import mock_payment_gateway
from app.services.stripe_service import stripe_gateway
from app.services.payment_gateway_service import get_payment_gateway
from app.config import settings

router = APIRouter(tags=["Payments"])


@router.post("/api/payments/orders")
async def prepare_order(data: FinancialOrderCreate, user=Depends(get_current_user)):
    if money(sum(data.seller_amounts.values(), Decimal("0"))) != money(data.total_amount):
        raise HTTPException(422, "Seller allocations must equal the order total")
    db = get_db()
    sellers = await db.sellers.find({"_id": {"$in": [ObjectId(value) for value in data.seller_amounts]},
                                     "approval_status": "APPROVED"}).to_list(length=None)
    if len(sellers) != len(data.seller_amounts):
        raise HTTPException(422, "Every seller must exist and be approved")
    by_id = {str(seller["_id"]): seller["user_id"] for seller in sellers}
    amounts_by_user = {by_id[seller_id]: amount for seller_id, amount in data.seller_amounts.items()}
    try:
        result = await create_financial_order(db, data.order_id, user["_id"], data.total_amount, amounts_by_user)
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    return {**result, "currency": "LKR"}


@router.post("/api/payments/orders/{order_id}/request")
async def payment_request(order_id: str, customer: PaymentCustomer, user=Depends(get_current_user), _=Depends(payment_request_limit)):
    db = get_db()
    order = await db.financial_orders.find_one({"order_id": order_id, "customer_id": user["_id"]})
    if not order:
        raise HTTPException(404, "Order not found")
    if order["payment_status"] == "PAID":
        raise HTTPException(409, "Order is already paid")
    try:
        result = get_payment_gateway(settings.PAYMENT_PROVIDER).create_payment_request(
            order_id, Decimal(order["total_amount"]), customer.model_dump(mode="json")
        )
        if result.get("transaction_id"):
            await db.payments.update_one(
                {"order_id": order_id},
                {"$set": {"payment_gateway": settings.PAYMENT_PROVIDER,
                          "transaction_id": result["transaction_id"], "updated_at": datetime.now(timezone.utc)}},
            )
        return result
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(503, str(exc)) from exc


async def _record_verified_payment(db, event, payload: dict, request: Request, status: str):
    payment = await db.payments.find_one({"order_id": event.order_id})
    order = await db.financial_orders.find_one({"order_id": event.order_id})
    if not payment or not order:
        raise HTTPException(404, "Order not found")
    if payment.get("transaction_id") and payment["transaction_id"] != event.transaction_id and payment["status"] != "FAILED":
        raise HTTPException(409, "Transaction does not belong to this order")
    if money(payment["amount"]) != event.amount or order["currency"] != event.currency:
        raise HTTPException(400, "Payment amount or currency mismatch")
    if payment["status"] == "PAID":
        if payment.get("transaction_id") != event.transaction_id:
            raise HTTPException(409, "Order already paid by another transaction")
        return {"status": "already_processed"}
    event_id = getattr(event, "event_id", None)
    if event_id and payment.get("stripe_event_id") == event_id:
        return {"status": "already_processed"}

    now = datetime.now(timezone.utc)
    payload_hash = hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str).encode()
    ).hexdigest()
    update_fields = {
        "transaction_id": event.transaction_id,
        "status": status,
        "payment_status": status,
        "amount": f"{event.amount:.2f}",
        "webhook_payload_hash": payload_hash,
        "paid_at": now if status == "PAID" else None,
        "payment_timestamp": now if status == "PAID" else None,
        "updated_at": now,
    }
    if getattr(event, "payment_intent_id", None):
        update_fields["stripe_payment_intent_id"] = event.payment_intent_id
    if event_id:
        update_fields["stripe_event_id"] = event_id
    claim_filter = {"order_id": event.order_id, "status": {"$ne": "PAID"}}
    if event_id:
        # This condition makes claiming a Stripe event atomic. A retry of a
        # failed/cancelled event cannot create another audit entry or repeat
        # downstream work, while a later event for the same Session can still
        # move the payment to its next valid state.
        claim_filter["stripe_event_id"] = {"$ne": event_id}
    try:
        claimed = await db.payments.find_one_and_update(
            claim_filter,
            {"$set": update_fields}, return_document=ReturnDocument.AFTER,
        )
    except Exception as exc:
        if await db.payments.find_one({"transaction_id": event.transaction_id, "order_id": {"$ne": event.order_id}}):
            raise HTTPException(409, "Transaction has already been used") from exc
        raise
    if not claimed:
        return {"status": "already_processed"}

    await db.financial_orders.update_one({"order_id": event.order_id},
                                         {"$set": {"payment_status": status, "updated_at": now}})
    await db.audit_logs.insert_one({"actor_user_id": None, "action": f"payment.{status.lower()}",
                                    "entity_type": "payment", "entity_id": str(claimed["_id"]),
                                    "details": {"order_id": event.order_id, "payload_hash": payload_hash,
                                                "gateway": claimed.get("payment_gateway")},
                                    "ip_address": request.client.host if request.client else None, "created_at": now})
    if status != "PAID":
        return {"status": status}

    from app.services.financial_order_service import create_payouts_for_paid_order
    # This is intentionally a no-op until delivery. The same idempotent
    # finalizer is called by every delivery completion path.
    allocations = await create_payouts_for_paid_order(
        db,
        event.order_id,
        now,
        payment_reference=event.transaction_id,
    )
    from app.utils.helpers import generate_otp
    await db.deliveries.update_one(
        {"order_id": event.order_id},
        {"$setOnInsert": {
            "order_id": event.order_id, "delivery_partner_id": None, "status": "assigned",
            "current_location": None, "estimated_delivery": now + timedelta(hours=48),
            "actual_delivery": None, "otp": generate_otp(4), "notes": None,
            "created_at": now, "updated_at": now,
        }},
        upsert=True,
    )
    from app.services.financial_notification_service import create_financial_notification, mark_marketplace_order_paid
    from app.services.notification_realtime import notify_admins
    await mark_marketplace_order_paid(event.order_id, event.transaction_id)
    from app.services.seller_fulfillment_service import activate_seller_fulfillments
    await activate_seller_fulfillments(db, event.order_id)
    await create_financial_notification(order["customer_id"], "Payment received",
                                        f"Payment for order #{event.order_id[:8]} was verified.", f"/orders/{event.order_id}")
    if not allocations:
        allocations = await db.seller_order_allocations.find(
            {"order_id": event.order_id}
        ).to_list(length=None)
    for allocation in allocations:
        seller_user_id = allocation["seller_user_id"]
        await create_financial_notification(seller_user_id, "New paid customer order",
                                            f"Order #{event.order_id[:8]} is paid and ready for preparation.", "/seller/orders")
    return {"status": "PAID"}


@router.post("/api/webhooks/payhere")
async def payhere_webhook(request: Request, _=Depends(payment_webhook_limit)):
    db, payload = get_db(), dict(await request.form())
    try:
        event = payhere_gateway.verify_webhook(payload)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    status_map = {"2": "PAID", "0": "PENDING", "-1": "FAILED", "-2": "FAILED", "-3": "CHARGEDBACK"}
    return await _record_verified_payment(db, event, payload, request, status_map.get(event.status_code, "FAILED"))


@router.post("/api/webhooks/onepay")
async def onepay_webhook(request: Request, _=Depends(payment_webhook_limit)):
    db = get_db()
    try:
        payload = await request.json()
        if not isinstance(payload, dict):
            raise ValueError("OnePay callback must be a JSON object")
        event = onepay_gateway.verify_webhook(payload)
    except (ValueError, OnePayError) as exc:
        raise HTTPException(400, str(exc)) from exc
    payment = await db.payments.find_one({"transaction_id": event.transaction_id})
    if not payment or payment["order_id"] != event.order_id:
        raise HTTPException(404, "OnePay transaction was not found")
    status = "PAID" if event.status_code == "1" else "FAILED"
    return await _record_verified_payment(db, event, payload, request, status)


@router.post("/api/webhooks/stripe")
async def stripe_webhook(request: Request, _=Depends(payment_webhook_limit)):
    import stripe

    raw_payload = await request.body()
    signature = request.headers.get("stripe-signature")
    if not signature:
        raise HTTPException(400, "Missing Stripe signature")
    try:
        stripe_event = stripe.Webhook.construct_event(
            raw_payload,
            signature,
            settings.STRIPE_WEBHOOK_SECRET,
        )
        payload = stripe_event.to_dict_recursive()
        event = stripe_gateway.verify_webhook(payload)
    except (ValueError, stripe.error.SignatureVerificationError) as exc:
        raise HTTPException(400, "Invalid Stripe webhook") from exc

    status = {
        "1": "PAID",
        "FAILED": "FAILED",
        "CANCELLED": "CANCELLED",
        "PENDING": "PENDING",
    }.get(event.status_code, "FAILED")
    return await _record_verified_payment(get_db(), event, payload, request, status)


@router.post("/api/payments/stripe/{order_id}/confirm")
async def confirm_stripe_checkout(
    order_id: str,
    body: dict,
    request: Request,
    user=Depends(get_current_user),
    _=Depends(payment_request_limit),
):
    """Recover Stripe confirmation when the webhook has not arrived yet."""
    if settings.PAYMENT_PROVIDER != "stripe":
        raise HTTPException(404, "Stripe payments are disabled")
    session_id = str(body.get("session_id") or "")
    if not session_id:
        raise HTTPException(422, "Stripe Checkout Session is required")

    db = get_db()
    order = await db.financial_orders.find_one({
        "order_id": order_id,
        "customer_id": user["_id"],
    })
    payment = await db.payments.find_one({"order_id": order_id})
    if not order or not payment:
        raise HTTPException(404, "Order not found")
    if payment.get("transaction_id") != session_id:
        raise HTTPException(409, "Stripe Checkout Session does not belong to this order")
    if payment.get("status") == "PAID":
        return {"status": "PAID"}

    try:
        event = stripe_gateway.retrieve_checkout_session(session_id)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(503, "Unable to confirm payment with Stripe") from exc
    if event.order_id != order_id or event.transaction_id != session_id:
        raise HTTPException(409, "Stripe Checkout Session does not belong to this order")

    status = {
        "1": "PAID",
        "FAILED": "FAILED",
        "CANCELLED": "CANCELLED",
        "PENDING": "PENDING",
    }.get(event.status_code, "FAILED")
    payload = {
        "source": "checkout_return_recovery",
        "order_id": order_id,
        "session_id": session_id,
        "stripe_status": status,
    }
    return await _record_verified_payment(db, event, payload, request, status)


@router.get("/api/payments/mock/{order_id}")
async def mock_payment_details(order_id: str, user=Depends(get_current_user)):
    order = await get_db().financial_orders.find_one({"order_id": order_id, "customer_id": user["_id"]})
    if not order:
        raise HTTPException(404, "Order not found")
    return {
        "merchant_name": settings.MOCK_PAYMENT_MERCHANT_NAME,
        "order_id": order_id,
        "amount": order["total_amount"],
        "currency": order["currency"],
        "payment_status": order["payment_status"],
    }


@router.post("/api/payments/mock/{order_id}/pay")
async def process_mock_payment(order_id: str, card: MockCardPayment, request: Request,
                               user=Depends(get_current_user), _=Depends(payment_request_limit)):
    if settings.PAYMENT_PROVIDER != "mock":
        raise HTTPException(404, "Mock payment gateway is disabled")
    db = get_db()
    order = await db.financial_orders.find_one({"order_id": order_id, "customer_id": user["_id"]})
    payment = await db.payments.find_one({"order_id": order_id})
    if not order or not payment:
        raise HTTPException(404, "Order not found")
    if order.get("order_status") == "CANCELLED" or payment["status"] == "CANCELLED":
        raise HTTPException(409, "Order has been cancelled")
    if payment["status"] == "PAID" or order["payment_status"] == "PAID":
        raise HTTPException(409, "Payment has already been completed")

    event = mock_payment_gateway.process_demo_payment(order_id, Decimal(order["total_amount"]), card.card_number)
    status = "PAID" if event.status_code == "1" else "FAILED"
    audit_payload = {"provider": "mock", "order_id": order_id, "status": status,
                     "transaction_id": event.transaction_id}
    result = await _record_verified_payment(db, event, audit_payload, request, status)
    if status == "FAILED":
        raise HTTPException(400, "Demo payment failed.")
    return {**result, "transaction_id": event.transaction_id, "order_id": order_id}
