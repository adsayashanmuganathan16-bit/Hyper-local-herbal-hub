#!/usr/bin/env python3
"""Repair payout math and remove duplicate order/seller payout records."""

import asyncio
import sys
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
load_dotenv(BACKEND / ".env", override=True)

from app.config import settings  # noqa: E402
from app.utils.time import utc_now  # noqa: E402

MONEY = Decimal("0.01")


def money(value) -> Decimal:
    return Decimal(str(value or "0")).quantize(MONEY, rounding=ROUND_HALF_UP)


async def repair() -> None:
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    try:
        database = client[settings.DB_NAME]
        payouts = await database.payouts.find({}).sort("created_at", -1).to_list(length=None)
        groups = defaultdict(list)
        for payout in payouts:
            groups[(payout.get("order_id"), payout.get("seller_id"))].append(payout)

        removed = 0
        repaired = 0
        for (order_id, seller_id), rows in groups.items():
            # Keep the latest record, while merging settlement evidence from
            # the most recent PAID duplicate before deleting older rows.
            rows.sort(
                key=lambda row: row.get("updated_at") or row.get("created_at"),
                reverse=True,
            )
            payout, duplicates = rows[0], rows[1:]
            paid_rows = [
                row for row in rows
                if row.get("payout_status", row.get("status")) == "PAID"
            ]
            payout_status = "PAID" if paid_rows else payout.get(
                "payout_status", payout.get("status", "PENDING")
            )
            paid_source = paid_rows[0] if paid_rows else payout
            if duplicates:
                result = await database.payouts.delete_many({
                    "_id": {"$in": [row["_id"] for row in duplicates]},
                })
                removed += result.deleted_count

            allocation = await database.seller_order_allocations.find_one({
                "order_id": order_id,
                "seller_id": seller_id,
            })
            payment = await database.payments.find_one({"order_id": order_id})
            merchandise = money(
                (allocation or {}).get(
                    "merchandise_amount",
                    (allocation or payout).get("gross_amount"),
                )
            )
            delivery = money((allocation or payout).get("delivery_amount"))
            gross = money(merchandise + delivery)
            commission_rate = Decimal(
                str((allocation or payout).get("commission_rate", "0"))
            )
            commission = money(gross * commission_rate / Decimal("100"))
            net = money(gross - commission)
            transaction_id = (payment or {}).get("transaction_id")
            await database.payouts.update_one(
                {"_id": payout["_id"]},
                {"$set": {
                    "merchandise_amount": str(merchandise),
                    "delivery_amount": str(delivery),
                    "gross_amount": str(gross),
                    "commission_amount": str(commission),
                    "commission_rate": str(commission_rate),
                    "net_amount": str(net),
                    "commission_status": "EARNED",
                    "status": payout_status,
                    "payout_status": payout_status,
                    "paid_at": paid_source.get("paid_at"),
                    "paid_by": paid_source.get("paid_by"),
                    "transaction_reference": paid_source.get("transaction_reference"),
                    "payment_status": (payment or {}).get("status", "PAID"),
                    "payment_transaction_id": transaction_id,
                    "stripe_checkout_session_id": (
                        transaction_id
                        if str(transaction_id or "").startswith("cs_")
                        else None
                    ),
                    "updated_at": utc_now(),
                }},
            )
            repaired += 1

        print(f"repaired payout records: {repaired}")
        print(f"removed duplicate records: {removed}")

        migrated_sellers = 0
        sellers = await database.sellers.find({}).to_list(length=None)
        for seller in sellers:
            seller_id = str(seller["_id"])
            bank = await database.seller_bank_accounts.find_one({"seller_id": seller_id})
            verified = bool(bank and bank.get("verified"))
            verification_status = "VERIFIED" if verified else "PENDING"
            verification_fields = {
                "verification_status": verification_status,
                "verified_at": seller.get("verified_at") if verified else None,
                "verified_by": seller.get("verified_by") if verified else None,
                "updated_at": utc_now(),
            }
            await database.sellers.update_one(
                {"_id": seller["_id"]}, {"$set": verification_fields}
            )
            if bank:
                await database.seller_bank_accounts.update_one(
                    {"_id": bank["_id"]},
                    {"$set": {
                        "verification_status": verification_status,
                        "verified_at": bank.get("verified_at") if verified else None,
                        "verified_by": bank.get("verified_by") if verified else None,
                        "updated_at": utc_now(),
                    }},
                )
            migrated_sellers += 1
        print(f"migrated seller verification records: {migrated_sellers}")
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(repair())
