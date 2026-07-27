import hashlib
from decimal import Decimal

import pytest

from app.config import settings
from app.services.payhere_service import PayHereGateway


def signed_payload():
    payload = {"merchant_id": "1210000", "order_id": "order-1", "payment_id": "pay-1",
               "payhere_amount": "10000.00", "payhere_currency": "LKR", "status_code": "2"}
    secret_hash = hashlib.md5(b"secret").hexdigest().upper()
    raw = "".join([payload["merchant_id"], payload["order_id"], payload["payhere_amount"],
                   payload["payhere_currency"], payload["status_code"], secret_hash])
    payload["md5sig"] = hashlib.md5(raw.encode()).hexdigest().upper()
    return payload


def test_valid_payhere_signature(monkeypatch):
    monkeypatch.setattr(settings, "PAYHERE_MERCHANT_ID", "1210000")
    monkeypatch.setattr(settings, "PAYHERE_MERCHANT_SECRET", "secret")
    event = PayHereGateway().verify_webhook(signed_payload())
    assert event.amount == Decimal("10000.00")
    assert event.currency == "LKR"


def test_invalid_payhere_signature(monkeypatch):
    monkeypatch.setattr(settings, "PAYHERE_MERCHANT_ID", "1210000")
    monkeypatch.setattr(settings, "PAYHERE_MERCHANT_SECRET", "secret")
    payload = signed_payload()
    payload["md5sig"] = "invalid"
    with pytest.raises(ValueError, match="signature"):
        PayHereGateway().verify_webhook(payload)


def test_checkout_hash_and_required_fields(monkeypatch):
    monkeypatch.setattr(settings, "PAYHERE_MERCHANT_ID", "1210000")
    monkeypatch.setattr(settings, "PAYHERE_MERCHANT_SECRET", "secret")
    request = PayHereGateway().create_payment_request(
        "order-1",
        Decimal("10000"),
        {
            "first_name": "Test",
            "email": "test@example.com",
            "phone": "0771234567",
            "address": "1 Test Road",
            "city": "Colombo",
        },
    )
    formatted = "10000.00"
    secret_hash = hashlib.md5(b"secret").hexdigest().upper()
    expected = hashlib.md5(f"1210000order-1{formatted}LKR{secret_hash}".encode()).hexdigest().upper()
    assert request["hash"] == expected
    assert request["amount"] == formatted
    assert request["currency"] == "LKR"
    assert request["merchant_id"] == "1210000"
    assert request["order_id"] == "order-1"
    for field in ("first_name", "last_name", "email", "phone", "address", "city", "country"):
        assert request[field]
