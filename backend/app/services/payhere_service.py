import hashlib
import hmac
import json
import logging
from dataclasses import dataclass
from decimal import Decimal

from app.config import settings
from app.services.commission_service import money
from app.services.payment_gateway_service import PaymentGateway


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class VerifiedPaymentEvent:
    order_id: str
    transaction_id: str
    amount: Decimal
    currency: str
    status_code: str


class PayHereGateway(PaymentGateway):
    @staticmethod
    def _secret_hash() -> str:
        return hashlib.md5(settings.PAYHERE_MERCHANT_SECRET.encode()).hexdigest().upper()

    def checkout_hash(self, order_id: str, amount: Decimal, currency: str = "LKR") -> str:
        formatted = f"{money(amount):.2f}"
        raw = f"{settings.PAYHERE_MERCHANT_ID}{order_id}{formatted}{currency}{self._secret_hash()}"
        return hashlib.md5(raw.encode()).hexdigest().upper()

    def create_payment_request(self, order_id: str, amount: Decimal, customer: dict) -> dict:
        if not settings.PAYHERE_MERCHANT_ID or not settings.PAYHERE_MERCHANT_SECRET:
            raise RuntimeError("PayHere merchant credentials are not configured")
        formatted = f"{money(amount):.2f}"
        customer_fields = {
            "first_name": str(customer.get("first_name") or "Customer").strip(),
            "last_name": str(customer.get("last_name") or "Customer").strip(),
            "email": str(customer.get("email") or "").strip(),
            "phone": str(customer.get("phone") or "").strip(),
            "address": str(customer.get("address") or "").strip(),
            "city": str(customer.get("city") or "").strip(),
            "country": str(customer.get("country") or "Sri Lanka").strip(),
        }
        missing = [name for name, value in customer_fields.items() if not value]
        if missing:
            raise ValueError(f"Missing PayHere customer fields: {', '.join(missing)}")
        payload = {
            "checkout_url": "https://sandbox.payhere.lk/pay/checkout" if settings.PAYHERE_SANDBOX else "https://www.payhere.lk/pay/checkout",
            "merchant_id": settings.PAYHERE_MERCHANT_ID,
            "return_url": settings.PAYHERE_RETURN_URL,
            "cancel_url": settings.PAYHERE_CANCEL_URL,
            "notify_url": settings.PAYHERE_NOTIFY_URL,
            "order_id": order_id,
            "items": f"Herbal Hub order {order_id}",
            "currency": "LKR",
            "amount": formatted,
            "hash": self.checkout_hash(order_id, amount),
            **customer_fields,
        }
        logger.warning("PayHere checkout payload (merchant secret excluded): %s", json.dumps(payload, sort_keys=True))
        return payload

    def verify_webhook(self, payload: dict) -> VerifiedPaymentEvent:
        required = {"merchant_id", "order_id", "payment_id", "payhere_amount", "payhere_currency", "status_code", "md5sig"}
        if missing := required.difference(payload):
            raise ValueError(f"Missing PayHere fields: {', '.join(sorted(missing))}")
        raw = (
            f"{payload['merchant_id']}{payload['order_id']}{payload['payhere_amount']}"
            f"{payload['payhere_currency']}{payload['status_code']}{self._secret_hash()}"
        )
        expected = hashlib.md5(raw.encode()).hexdigest().upper()
        if payload["merchant_id"] != settings.PAYHERE_MERCHANT_ID or not hmac.compare_digest(expected, payload["md5sig"].upper()):
            raise ValueError("Invalid PayHere signature")
        if payload["payhere_currency"] != "LKR":
            raise ValueError("Only LKR payments are accepted")
        return VerifiedPaymentEvent(
            order_id=payload["order_id"], transaction_id=payload["payment_id"],
            amount=money(payload["payhere_amount"]), currency="LKR", status_code=payload["status_code"],
        )


payhere_gateway = PayHereGateway()
