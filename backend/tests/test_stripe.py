from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.config import settings
from app.services.payment_gateway_service import get_payment_gateway
from app.services.stripe_service import StripeGateway


def test_stripe_provider_uses_gateway():
    assert isinstance(get_payment_gateway("stripe"), StripeGateway)


def test_stripe_checkout_session(monkeypatch):
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_test_example")
    monkeypatch.setattr(
        settings,
        "STRIPE_SUCCESS_URL",
        "http://localhost:3000/orders/{order_id}?session_id={CHECKOUT_SESSION_ID}",
    )
    monkeypatch.setattr(settings, "STRIPE_CANCEL_URL", "http://localhost:3000/orders/{order_id}?payment=cancelled")
    captured = {}

    def create(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(id="cs_test_123", url="https://checkout.stripe.com/c/pay/cs_test_123")

    monkeypatch.setattr("stripe.checkout.Session.create", create)
    result = StripeGateway().create_payment_request("ORDER-1", Decimal("1250.50"), {"email": "buyer@example.com"})

    assert result["transaction_id"] == "cs_test_123"
    assert captured["line_items"][0]["price_data"]["unit_amount"] == 125050
    assert captured["line_items"][0]["price_data"]["currency"] == "lkr"
    assert captured["metadata"]["order_id"] == "ORDER-1"
    assert "{CHECKOUT_SESSION_ID}" in captured["success_url"]


@pytest.mark.parametrize(
    ("event_type", "payment_status", "status_code"),
    [
        ("checkout.session.completed", "paid", "1"),
        ("checkout.session.completed", "unpaid", "PENDING"),
        ("checkout.session.async_payment_failed", "unpaid", "FAILED"),
        ("checkout.session.expired", "unpaid", "CANCELLED"),
    ],
)
def test_stripe_event_verification(event_type, payment_status, status_code):
    event = StripeGateway().verify_webhook({
        "type": event_type,
        "data": {"object": {
            "id": "cs_test_123",
            "metadata": {"order_id": "ORDER-1"},
            "amount_total": 125050,
            "currency": "lkr",
            "payment_status": payment_status,
        }},
    })

    assert event.order_id == "ORDER-1"
    assert event.transaction_id == "cs_test_123"
    assert event.amount == Decimal("1250.50")
    assert event.status_code == status_code


def test_stripe_event_retains_payment_intent_and_event_ids():
    event = StripeGateway().verify_webhook({
        "id": "evt_test_123",
        "type": "checkout.session.completed",
        "data": {"object": {
            "id": "cs_test_123",
            "payment_intent": "pi_test_123",
            "metadata": {"order_id": "ORDER-1"},
            "amount_total": 10000,
            "currency": "lkr",
            "payment_status": "paid",
        }},
    })
    assert event.payment_intent_id == "pi_test_123"
    assert event.event_id == "evt_test_123"


def test_stripe_checkout_session_recovery(monkeypatch):
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_test_example")

    class Session:
        def to_dict_recursive(self):
            return {
                "id": "cs_test_123",
                "payment_intent": "pi_test_123",
                "metadata": {"order_id": "ORDER-1"},
                "amount_total": 10000,
                "currency": "lkr",
                "payment_status": "paid",
                "status": "complete",
            }

    monkeypatch.setattr("stripe.checkout.Session.retrieve", lambda *args, **kwargs: Session())
    event = StripeGateway().retrieve_checkout_session("cs_test_123")

    assert event.order_id == "ORDER-1"
    assert event.transaction_id == "cs_test_123"
    assert event.payment_intent_id == "pi_test_123"
    assert event.status_code == "1"
