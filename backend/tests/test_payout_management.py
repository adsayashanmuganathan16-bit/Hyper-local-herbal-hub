import asyncio

import pytest
from bson import ObjectId
from fastapi import HTTPException

from app.routes.financial_admin import transition_payout


class Payouts:
    def __init__(self):
        self.row = {
            "_id": ObjectId(),
            "seller_id": str(ObjectId()),
            "seller_user_id": str(ObjectId()),
            "order_id": str(ObjectId()),
            "net_amount": "1400.00",
            "status": "PENDING",
            "payout_status": "PENDING",
            "transaction_reference": None,
        }

    async def find_one(self, query, projection=None):
        if "payout_reference" in query:
            return self.row if self.row.get("payout_reference") == query["payout_reference"] else None
        return self.row if query.get("_id") == self.row["_id"] else None

    async def find_one_and_update(self, query, update, return_document=None):
        if query.get("_id") != self.row["_id"] or query.get("status") != self.row["status"]:
            return None
        self.row.update(update["$set"])
        return dict(self.row)


class Db:
    def __init__(self):
        self.payouts = Payouts()


def test_admin_paid_transition_generates_stable_reference_and_paid_at():
    db = Db()
    payout_id = str(db.payouts.row["_id"])
    paid = asyncio.run(transition_payout(db, payout_id, "PAID", {"_id": "admin-1"}))

    assert paid["status"] == "PAID"
    assert paid["payout_status"] == "PAID"
    assert paid["transaction_reference"].startswith("PAY-")
    assert paid["payout_reference"] == paid["transaction_reference"]
    assert len(paid["transaction_reference"]) == 12
    assert paid["paid_at"] is not None

    with pytest.raises(HTTPException, match="already been paid"):
        asyncio.run(transition_payout(db, payout_id, "PAID", {"_id": "admin-1"}))
    assert db.payouts.row["transaction_reference"] == paid["transaction_reference"]


def test_payout_transition_rejects_invalid_object_id():
    with pytest.raises(HTTPException) as error:
        asyncio.run(transition_payout(Db(), "not-an-object-id", "PAID", {"_id": "admin-1"}))
    assert error.value.status_code == 404
