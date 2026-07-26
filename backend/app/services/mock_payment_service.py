import logging
import secrets
from dataclasses import dataclass
from decimal import Decimal
from urllib.parse import quote

from app.config import settings
from app.services.commission_service import money
from app.services.payment_gateway_service import PaymentGateway


logger = logging.getLogger(__name__)

ACCEPTED_DEMO_CARDS = frozenset({
    "4111111111111111",
    "4242424242424242",
    "5555555555554444",
})


@dataclass(frozen=True)
class VerifiedMockPaymentEvent:
    order_id: str
    transaction_id: str
    amount: Decimal
    currency: str
    status_code: str


class MockPaymentGateway(PaymentGateway):
    """Development-only gateway. It never stores or logs card details."""

    def create_payment_request(self, order_id: str, amount: Decimal, customer: dict) -> dict:
        return {
            "provider": "mock",
            "checkout_url": f"{settings.FRONTEND_URL.rstrip('/')}/demo-payment?order_id={quote(str(order_id))}",
            "order_id": str(order_id),
            "amount": f"{money(amount):.2f}",
            "currency": "LKR",
            "merchant_name": settings.MOCK_PAYMENT_MERCHANT_NAME,
        }

    def verify_webhook(self, payload: dict) -> VerifiedMockPaymentEvent:
        required = {"order_id", "transaction_id", "amount", "currency", "status"}
        if missing := required.difference(payload):
            raise ValueError(f"Missing mock payment fields: {', '.join(sorted(missing))}")
        if payload["currency"] != "LKR" or payload["status"] not in {"SUCCESS", "FAILED"}:
            raise ValueError("Invalid mock payment result")
        return VerifiedMockPaymentEvent(
            order_id=str(payload["order_id"]),
            transaction_id=str(payload["transaction_id"]),
            amount=money(payload["amount"]),
            currency="LKR",
            status_code="1" if payload["status"] == "SUCCESS" else "0",
        )

    def process_demo_payment(self, order_id: str, amount: Decimal, card_number: str) -> VerifiedMockPaymentEvent:
        normalized = "".join(character for character in str(card_number) if character.isdigit())
        successful = normalized in ACCEPTED_DEMO_CARDS
        transaction_id = f"MOCK-{secrets.token_hex(8).upper()}"
        logger.info("Mock payment %s for order %s transaction %s",
                    "succeeded" if successful else "failed", order_id, transaction_id)
        return self.verify_webhook({
            "order_id": str(order_id),
            "transaction_id": transaction_id,
            "amount": f"{money(amount):.2f}",
            "currency": "LKR",
            "status": "SUCCESS" if successful else "FAILED",
        })


mock_payment_gateway = MockPaymentGateway()
