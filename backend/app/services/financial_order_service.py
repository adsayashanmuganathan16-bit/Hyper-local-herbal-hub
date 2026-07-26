from app.utils.time import utc_now
from datetime import datetime
from decimal import Decimal

from app.config import settings
from app.services.commission_service import calculate_commission, current_commission_rate, money


async def create_financial_order(db, order_id: str, customer_id: str, total_amount, seller_gross_by_user_id: dict[str, Decimal]):
    """Persist immutable multi-seller allocations in MongoDB."""
    if not seller_gross_by_user_id:
        raise ValueError("The order does not contain products assigned to approved sellers")
    if await db.financial_orders.find_one({"order_id": order_id}):
        raise ValueError("Financial order already exists")

    raw_total = sum((money(value) for value in seller_gross_by_user_id.values()), Decimal("0"))
    final_total = money(total_amount)
    if raw_total <= 0:
        raise ValueError("Seller allocation total must be positive")

    user_ids = list(seller_gross_by_user_id)
    sellers = await db.sellers.find({"user_id": {"$in": user_ids}, "approval_status": "APPROVED"}).to_list(length=None)
    by_user = {seller["user_id"]: seller for seller in sellers}
    if missing := set(user_ids).difference(by_user):
        raise ValueError("Every product seller must have an approved financial profile")

    # Seller gross is the merchandise value only. Delivery fees and other
    # customer-facing charges belong to the platform and must not inflate
    # seller earnings or commission.
    allocated = {user_id: money(value) for user_id, value in seller_gross_by_user_id.items()}
    rate, now = await current_commission_rate(db), utc_now()

    await db.financial_orders.insert_one({
        "order_id": order_id, "customer_id": customer_id, "total_amount": str(final_total),
        "merchandise_amount": str(raw_total),
        "currency": "LKR", "payment_status": "PENDING", "order_status": "PLACED",
        "created_at": now, "updated_at": now,
    })
    allocations = []
    for user_id, gross in allocated.items():
        commission, net = calculate_commission(gross, rate)
        allocations.append({
            "order_id": order_id, "seller_id": str(by_user[user_id]["_id"]), "seller_user_id": user_id,
            "gross_amount": str(gross), "commission_rate": str(rate),
            "commission_amount": str(commission), "net_amount": str(net), "created_at": now,
        })
    try:
        result = await db.seller_order_allocations.insert_many(allocations)
        await db.payments.insert_one({
            # Do not store transaction_id until the gateway/COD settlement
            # provides one. A unique MongoDB index treats an explicit null as
            # a value and would reject the next pending payment.
            "order_id": order_id, "payment_gateway": settings.PAYMENT_PROVIDER,
            "amount": str(final_total), "currency": "LKR", "status": "PENDING",
            "webhook_payload_hash": None, "paid_at": None, "created_at": now, "updated_at": now,
        })
    except Exception:
        await db.financial_orders.delete_one({"order_id": order_id})
        await db.seller_order_allocations.delete_many({"order_id": order_id})
        raise
    return {"order_id": order_id, "total_amount": str(final_total), "allocations": len(allocations)}


async def create_payouts_for_paid_order(db, order_id: str, now=None) -> list[dict]:
    """Create one immutable payout per allocation; safe to call repeatedly."""
    now = now or utc_now()
    allocations = await db.seller_order_allocations.find({"order_id": order_id}).to_list(length=None)
    for allocation in allocations:
        bank = await db.seller_bank_accounts.find_one({"seller_id": allocation["seller_id"]})
        await db.payouts.update_one(
            {"allocation_id": str(allocation["_id"])},
            {"$setOnInsert": {
                "seller_id": allocation["seller_id"], "seller_user_id": allocation["seller_user_id"],
                "order_id": order_id, "allocation_id": str(allocation["_id"]),
                "bank_account_id": str(bank["_id"]) if bank else None,
                "gross_amount": allocation["gross_amount"], "commission_rate": allocation["commission_rate"],
                "commission_amount": allocation["commission_amount"], "net_amount": allocation["net_amount"],
                "status": "PENDING", "payout_mode": "manual", "provider": "manual_bank_transfer",
                "transaction_reference": None, "failure_reason": None, "retry_count": 0,
                "created_at": now, "updated_at": now, "paid_at": None,
            }}, upsert=True,
        )
    return allocations
