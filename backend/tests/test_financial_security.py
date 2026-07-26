import pytest

from app.config import settings
from app.services.financial_crypto import decrypt_sensitive, encrypt_sensitive
from app.services.onepay_service import OnePayGateway
from app.services.payhere_service import PayHereGateway


def test_sensitive_values_are_encrypted(monkeypatch):
    monkeypatch.setattr(settings, "DATA_ENCRYPTION_KEY", "")
    encrypted = encrypt_sensitive("199012345678")
    assert encrypted != "199012345678"
    assert decrypt_sensitive(encrypted) == "199012345678"


def test_onepay_fails_closed_until_configured(monkeypatch):
    monkeypatch.setattr(settings, "ONEPAY_APP_ID", "")
    monkeypatch.setattr(settings, "ONEPAY_APP_TOKEN", "")
    monkeypatch.setattr(settings, "ONEPAY_HASH_SALT", "")
    with pytest.raises(RuntimeError, match="App ID and Hash Salt"):
        OnePayGateway().create_payment_request("order", 100, {})


def test_payhere_rejects_non_lkr(monkeypatch):
    monkeypatch.setattr(settings, "PAYHERE_MERCHANT_ID", "merchant")
    monkeypatch.setattr(settings, "PAYHERE_MERCHANT_SECRET", "secret")
    gateway = PayHereGateway()
    payload = {"merchant_id": "merchant", "order_id": "order", "payment_id": "payment",
               "payhere_amount": "10.00", "payhere_currency": "USD", "status_code": "2"}
    import hashlib
    secret_hash = hashlib.md5(b"secret").hexdigest().upper()
    raw = "".join([payload["merchant_id"], payload["order_id"], payload["payhere_amount"],
                   payload["payhere_currency"], payload["status_code"], secret_hash])
    payload["md5sig"] = hashlib.md5(raw.encode()).hexdigest().upper()
    with pytest.raises(ValueError, match="LKR"):
        gateway.verify_webhook(payload)
