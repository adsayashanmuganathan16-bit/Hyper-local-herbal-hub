import asyncio
from decimal import Decimal

from bson import ObjectId

from app.services.commission_service import calculate_commission
from app.services.financial_order_service import (
    create_payouts_for_paid_order,
    payout_amounts,
)


def test_ten_percent_commission():
    commission, net = calculate_commission(Decimal("10000"), Decimal("10"))
    assert commission == Decimal("1000.00")
    assert net == Decimal("9000.00")


def test_money_rounding_is_half_up():
    commission, net = calculate_commission(Decimal("10.05"), Decimal("10"))
    assert commission == Decimal("1.01")
    assert commission + net == Decimal("10.05")


def test_payout_net_is_gross_minus_commission():
    merchandise, delivery, gross, commission, net = payout_amounts({
        "merchandise_amount": "1000.00",
        "gross_amount": "1150.00",
        "delivery_amount": "150.00",
        "commission_rate": "10",
        "commission_amount": "100.00",
    })
    assert merchandise == Decimal("1000.00")
    assert delivery == Decimal("150.00")
    assert gross == Decimal("1150.00")
    assert commission == Decimal("115.00")
    assert net == Decimal("1035.00")
    assert net == gross - commission


def test_legacy_allocation_is_normalized_to_total_gross():
    _, _, gross, commission, net = payout_amounts({
        "gross_amount": "1000.00",
        "delivery_amount": "150.00",
        "commission_rate": "10",
        "commission_amount": "100.00",
    })
    assert gross == Decimal("1150.00")
    assert commission == Decimal("115.00")
    assert net == Decimal("1035.00")


SELLER_ID = str(ObjectId())


class AllocationCursor:
    async def to_list(self, length=None):
        return [{
            "_id": "allocation-1",
            "order_id": "ORDER-1",
            "seller_id": SELLER_ID,
            "seller_user_id": "seller-user-1",
            "merchandise_amount": "1000.00",
            "gross_amount": "1150.00",
            "delivery_amount": "150.00",
            "commission_rate": "10",
            "commission_amount": "100.00",
            "net_amount": "1050.00",
        }]


class AllocationCollection:
    def find(self, query):
        return AllocationCursor()


class BankCollection:
    async def find_one(self, query):
        return {"_id": ObjectId(), "seller_id": SELLER_ID, "verified": True}


class SellerCollection:
    async def find_one(self, query):
        return {"_id": ObjectId(SELLER_ID), "verification_status": "VERIFIED"}


class PaymentCollection:
    async def find_one(self, query):
        return {"order_id": "ORDER-1", "status": "PAID", "transaction_id": "cs_test_123"}


class PayoutCollection:
    def __init__(self):
        self.updates = []

    async def find_one(self, query):
        return None

    async def update_one(self, query, update, upsert=False):
        self.updates.append((query, update, upsert))


class PayoutDb:
    def __init__(self):
        self.seller_order_allocations = AllocationCollection()
        self.seller_bank_accounts = BankCollection()
        self.sellers = SellerCollection()
        self.payments = PaymentCollection()
        self.payouts = PayoutCollection()


def test_payout_upsert_is_idempotent_by_order_and_seller():
    db = PayoutDb()
    asyncio.run(create_payouts_for_paid_order(
        db,
        "ORDER-1",
        payment_reference="cs_test_123",
    ))
    asyncio.run(create_payouts_for_paid_order(
        db,
        "ORDER-1",
        payment_reference="cs_test_123",
    ))

    assert len(db.payouts.updates) == 2
    for query, update, upsert in db.payouts.updates:
        assert query == {"order_id": "ORDER-1", "seller_id": SELLER_ID}
        assert upsert is True
        assert update["$set"]["gross_amount"] == "1150.00"
        assert update["$set"]["commission_amount"] == "115.00"
        assert update["$set"]["net_amount"] == "1035.00"
        assert update["$set"]["stripe_checkout_session_id"] == "cs_test_123"
        assert "status" not in update["$set"]
