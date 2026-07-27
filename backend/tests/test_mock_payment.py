from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.config import settings
from app.models.order import OrderCreate
from app.services.mock_payment_service import ACCEPTED_DEMO_CARDS, MockPaymentGateway
from app.services.payment_gateway_service import get_payment_gateway


@pytest.mark.parametrize("card_number", sorted(ACCEPTED_DEMO_CARDS))
def test_successful_demo_cards(card_number):
    event = MockPaymentGateway().process_demo_payment("ORDER-1", Decimal("1250.00"), card_number)
    assert event.status_code == "1"
    assert event.order_id == "ORDER-1"
    assert event.amount == Decimal("1250.00")
    assert event.currency == "LKR"
    assert event.transaction_id.startswith("MOCK-")


def test_failed_demo_card():
    event = MockPaymentGateway().process_demo_payment("ORDER-1", Decimal("1250.00"), "4000000000000000")
    assert event.status_code == "0"


def test_mock_checkout_request(monkeypatch):
    monkeypatch.setattr(settings, "FRONTEND_URL", "http://localhost:3000")
    monkeypatch.setattr(settings, "MOCK_PAYMENT_MERCHANT_NAME", "Herbal Hub")
    request = MockPaymentGateway().create_payment_request("ORDER 1", Decimal("99.9"), {})
    assert request == {
        "provider": "mock",
        "checkout_url": "http://localhost:3000/demo-payment?order_id=ORDER%201",
        "order_id": "ORDER 1",
        "amount": "99.90",
        "currency": "LKR",
        "merchant_name": "Herbal Hub",
    }


def test_mock_provider_uses_gateway(monkeypatch):
    monkeypatch.setattr(settings, "PAYMENT_PROVIDER", "mock")
    assert isinstance(get_payment_gateway(settings.PAYMENT_PROVIDER), MockPaymentGateway)


def test_mock_transactions_are_unique():
    gateway = MockPaymentGateway()
    first = gateway.process_demo_payment("ORDER-1", 100, "4111111111111111")
    second = gateway.process_demo_payment("ORDER-2", 100, "4111111111111111")
    assert first.transaction_id != second.transaction_id


def test_checkout_requires_explicit_payment_method():
    with pytest.raises(ValidationError):
        OrderCreate(items=[], address={})
