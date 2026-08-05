from abc import ABC, abstractmethod
from typing import Any


class PaymentGateway(ABC):
    @abstractmethod
    def create_payment_request(self, order_id: str, amount, customer: dict) -> dict: ...

    @abstractmethod
    def verify_webhook(self, payload: dict) -> Any: ...


def get_payment_gateway(provider: str) -> PaymentGateway:
    if provider.lower() == "payhere":
        from app.services.payhere_service import payhere_gateway
        return payhere_gateway
    if provider.lower() == "onepay":
        from app.services.onepay_service import onepay_gateway
        return onepay_gateway
    if provider.lower() == "mock":
        from app.services.mock_payment_service import mock_payment_gateway
        return mock_payment_gateway
    if provider.lower() == "stripe":
        from app.services.stripe_service import stripe_gateway
        return stripe_gateway
    raise RuntimeError(f"Unsupported payment provider: {provider}")
