from app.utils.time import utc_now
from datetime import datetime


async def create_seller_fulfillments(db, order_id, order, seller_amounts, payment_ready=False):
    now = utc_now()
    locations = {row["seller_id"]: row for row in order.get("seller_locations", [])}
    for seller_user_id, amount in seller_amounts.items():
        product_ids = [str(row["_id"]) for row in await db.medicines.find(
            {"seller_id": seller_user_id}, {"_id": 1}).to_list(length=None)]
        items = [item for item in order.get("items", []) if item.get("medicine_id") in product_ids]
        await db.seller_fulfillments.update_one({"order_id": order_id, "seller_user_id": seller_user_id}, {
            "$setOnInsert": {"order_id": order_id, "seller_user_id": seller_user_id,
                "seller_location": locations.get(seller_user_id), "items": items, "seller_amount": str(amount),
                "status": "processing" if payment_ready else "awaiting_payment", "courier_company": None,
                "tracking_number": None, "tracking_url": None, "estimated_delivery": None,
                "dispatched_at": None, "delivered_at": None, "created_at": now, "updated_at": now}}, upsert=True)


async def activate_seller_fulfillments(db, order_id):
    collection = getattr(db, "seller_fulfillments", None)
    if collection is None:  # Supports isolated payment-ledger test doubles.
        return
    await collection.update_many({"order_id": order_id, "status": "awaiting_payment"},
        {"$set": {"status": "processing", "updated_at": utc_now()}})
