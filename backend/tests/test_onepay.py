import asyncio
import hashlib
from decimal import Decimal
from types import SimpleNamespace

import httpx

from app.config import settings
from app.routes.financial_payments import _record_verified_payment
from app.services.onepay_service import OnePayGateway, VerifiedOnePayEvent


def configure(monkeypatch):
    monkeypatch.setattr(settings, "ONEPAY_APP_ID", "APP-123")
    monkeypatch.setattr(settings, "ONEPAY_APP_TOKEN", "TOKEN-123")
    monkeypatch.setattr(settings, "ONEPAY_HASH_SALT", "SALT-123")
    monkeypatch.setattr(settings, "ONEPAY_RETURN_URL", "https://shop.example.com/orders")
    monkeypatch.setattr(settings, "ONEPAY_API_BASE_URL", "https://api.onepay.lk")


def gateway_with(handler):
    return OnePayGateway(httpx.Client(transport=httpx.MockTransport(handler)))


def test_payment_request_generation(monkeypatch):
    configure(monkeypatch)
    captured = {}

    def handler(request):
        captured.update(__import__("json").loads(request.content))
        assert request.headers["Authorization"] == "TOKEN-123"
        return httpx.Response(200, json={"status": 200, "data": {
            "ipg_transaction_id": "TX-1", "gateway": {"redirect_url": "https://payment.onepay.lk/TX-1"}
        }})

    result = gateway_with(handler).create_payment_request("ORDER-1", Decimal("100"), {
        "first_name": "Test", "last_name": "Customer", "email": "test@example.com", "phone": "0771234567"
    })
    expected = hashlib.sha256(b"APP-123LKR100.00SALT-123").hexdigest()
    assert captured["hash"] == expected
    assert captured["amount"] == "100.00"
    assert captured["reference"] == "ORDER-1"
    assert captured["additionalData"] == "ORDER-1"
    assert captured["customer_phone_number"] == "+94771234567"
    assert result["transaction_id"] == "TX-1"
    assert result["checkout_url"] == "https://payment.onepay.lk/TX-1"


def callback_gateway(monkeypatch, paid):
    configure(monkeypatch)

    def handler(request):
        assert request.url.path == "/v3/transaction/status/"
        return httpx.Response(200, json={
            "status": paid, "ipg_transaction_id": "TX-1", "amount": "100.00", "currency": "LKR"
        })

    return gateway_with(handler)


def test_webhook_verification_successful_payment(monkeypatch):
    event = callback_gateway(monkeypatch, True).verify_webhook({
        "transaction_id": "TX-1", "status": 1, "status_message": "SUCCESS", "additional_data": "ORDER-1"
    })
    assert event.status_code == "1"
    assert event.order_id == "ORDER-1"
    assert event.amount == Decimal("100.00")


def test_webhook_verification_failed_payment(monkeypatch):
    event = callback_gateway(monkeypatch, False).verify_webhook({
        "transaction_id": "TX-1", "status": 0, "status_message": "FAILED", "additional_data": "ORDER-1"
    })
    assert event.status_code == "0"


class FindOnlyCollection:
    def __init__(self, value):
        self.value = value

    async def find_one(self, query):
        return self.value


class DuplicateDb:
    def __init__(self):
        self.payments = FindOnlyCollection({
            "_id": "payment-1", "order_id": "ORDER-1", "transaction_id": "TX-1",
            "amount": "100.00", "currency": "LKR", "status": "PAID",
        })
        self.financial_orders = FindOnlyCollection({
            "order_id": "ORDER-1", "customer_id": "customer-1", "currency": "LKR"
        })


def test_duplicate_webhook_protection():
    event = VerifiedOnePayEvent("ORDER-1", "TX-1", Decimal("100.00"), "LKR", "1")
    request = SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"))
    result = asyncio.run(_record_verified_payment(
        DuplicateDb(), event, {"transaction_id": "TX-1"}, request, "PAID"
    ))
    assert result == {"status": "already_processed"}


class MutableCollection:
    def __init__(self, value=None):
        self.value = value
        self.inserted = []

    async def find_one(self, query):
        return self.value

    async def find_one_and_update(self, query, update, return_document=None):
        self.value.update(update["$set"])
        return self.value

    async def update_one(self, query, update, upsert=False):
        if self.value is None:
            self.value = {}
        self.value.update(update.get("$set", update.get("$setOnInsert", {})))

    async def insert_one(self, value):
        self.inserted.append(value)


class ProcessingDb:
    def __init__(self):
        self.payments = MutableCollection({
            "_id": "payment-1", "order_id": "ORDER-1", "transaction_id": "TX-1",
            "payment_gateway": "onepay", "amount": "100.00", "currency": "LKR", "status": "PENDING",
        })
        self.financial_orders = MutableCollection({
            "order_id": "ORDER-1", "customer_id": "customer-1", "currency": "LKR", "payment_status": "PENDING"
        })
        self.audit_logs = MutableCollection()
        self.deliveries = MutableCollection()


def test_failed_payment_updates_ledger():
    db = ProcessingDb()
    event = VerifiedOnePayEvent("ORDER-1", "TX-1", Decimal("100.00"), "LKR", "0")
    request = SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"))
    result = asyncio.run(_record_verified_payment(db, event, {"transaction_id": "TX-1"}, request, "FAILED"))
    assert result == {"status": "FAILED"}
    assert db.payments.value["status"] == "FAILED"
    assert db.financial_orders.value["payment_status"] == "FAILED"
    assert db.audit_logs.inserted[0]["action"] == "payment.failed"


def test_successful_payment_creates_payouts_and_notifications(monkeypatch):
    db = ProcessingDb()
    calls = []

    async def payouts(_db, order_id, now, payment_reference=None):
        calls.append(("payouts", order_id))
        return [{"seller_user_id": "seller-1"}]

    async def paid(order_id, transaction_id):
        calls.append(("paid", order_id, transaction_id))

    async def notify(user_id, title, message, link="/seller/earnings"):
        calls.append(("notify", user_id, title))

    async def notify_admins(_db, title, message, link):
        calls.append(("notify_admins", title, message, link))

    monkeypatch.setattr("app.services.financial_order_service.create_payouts_for_paid_order", payouts)
    monkeypatch.setattr("app.services.financial_notification_service.mark_marketplace_order_paid", paid)
    monkeypatch.setattr("app.services.financial_notification_service.create_financial_notification", notify)
    monkeypatch.setattr("app.services.notification_realtime.notify_admins", notify_admins)
    event = VerifiedOnePayEvent("ORDER-1", "TX-1", Decimal("100.00"), "LKR", "1")
    request = SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"))
    result = asyncio.run(_record_verified_payment(db, event, {"transaction_id": "TX-1"}, request, "PAID"))
    assert result == {"status": "PAID"}
    assert db.payments.value["status"] == "PAID"
    assert db.financial_orders.value["payment_status"] == "PAID"
    assert ("payouts", "ORDER-1") in calls
    assert ("paid", "ORDER-1", "TX-1") in calls
    assert any(call[:2] == ("notify", "seller-1") for call in calls)
    assert any(call[:2] == ("notify_admins", "Marketplace commission received") for call in calls)
