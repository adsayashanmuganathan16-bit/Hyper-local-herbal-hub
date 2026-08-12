from abc import ABC, abstractmethod
from typing import Any


class PaymentGateway(ABC):
    @abstractmethod
    def create_payment_request(self, order_id: str, amount, customer: dict) -> dict: ...

    @abstractmethod
    def verify_webhook(self, payload: dict) -> Any: ...


def get_payment_gateway(provider: str) -> PaymentGateway:
    if provider.lower() == "stripe":
        from app.services.stripe_service import stripe_gateway
        return stripe_gateway
    raise RuntimeError(f"Unsupported payment provider: {provider}")
