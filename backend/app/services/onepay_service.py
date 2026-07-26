import hashlib
import json
import logging
from dataclasses import dataclass
from decimal import Decimal
from typing import Any
from urllib.parse import urlparse

import httpx

from app.config import settings
from app.services.commission_service import money
from app.services.payment_gateway_service import PaymentGateway


logger = logging.getLogger(__name__)


class OnePayError(RuntimeError):
    """A safe, actionable OnePay integration error."""


@dataclass(frozen=True)
class VerifiedOnePayEvent:
    order_id: str
    transaction_id: str
    amount: Decimal
    currency: str
    status_code: str


class OnePayGateway(PaymentGateway):
    """OnePay v3 redirection gateway documented at docs.onepay.lk."""

    def __init__(self, client: httpx.Client | None = None):
        self._client = client

    @staticmethod
    def checkout_hash(amount: Decimal | str | int, currency: str = "LKR") -> str:
        formatted = f"{money(amount):.2f}"
        raw = f"{settings.ONEPAY_APP_ID}{currency}{formatted}{settings.ONEPAY_HASH_SALT}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    @staticmethod
    def _phone_e164(value: Any) -> str:
        phone = str(value or "").replace(" ", "").replace("-", "")
        if phone.startswith("0") and len(phone) == 10:
            phone = "+94" + phone[1:]
        elif phone.startswith("94"):
            phone = "+" + phone
        if not phone.startswith("+94") or len(phone) != 12 or not phone[1:].isdigit():
            raise ValueError("OnePay requires a valid Sri Lankan phone number in E.164 format")
        return phone

    @staticmethod
    def _headers() -> dict[str, str]:
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if settings.ONEPAY_APP_TOKEN:
            headers["Authorization"] = settings.ONEPAY_APP_TOKEN
        return headers

    def _post(self, path: str, payload: dict) -> dict:
        url = f"{settings.ONEPAY_API_BASE_URL.rstrip('/')}{path}"
        client = self._client or httpx.Client(timeout=settings.ONEPAY_TIMEOUT_SECONDS)
        close_client = self._client is None
        try:
            response = client.post(url, json=payload, headers=self._headers())
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPStatusError as exc:
            logger.error("OnePay API rejected %s with HTTP %s", path, exc.response.status_code)
            raise OnePayError(f"OnePay API rejected the request (HTTP {exc.response.status_code})") from exc
        except (httpx.HTTPError, ValueError) as exc:
            logger.exception("OnePay API request failed for %s", path)
            raise OnePayError("Unable to communicate with OnePay") from exc
        finally:
            if close_client:
                client.close()
        if not isinstance(data, dict):
            raise OnePayError("OnePay returned an invalid response")
        return data

    def create_payment_request(self, order_id: str, amount: Decimal, customer: dict) -> dict:
        if not settings.ONEPAY_APP_ID or not settings.ONEPAY_HASH_SALT:
            raise OnePayError("OnePay App ID and Hash Salt are not configured")
        redirect = urlparse(settings.ONEPAY_RETURN_URL)
        if redirect.scheme != "https" or not redirect.netloc:
            raise OnePayError("OnePay transaction redirect URL must be a public HTTPS URL")
        formatted = f"{money(amount):.2f}"
        first_name = str(customer.get("first_name") or "Customer").strip()
        last_name = str(customer.get("last_name") or "Customer").strip()
        email = str(customer.get("email") or "").strip()
        if not email:
            raise ValueError("OnePay customer email is required")
        payload = {
            "app_id": settings.ONEPAY_APP_ID,
            "amount": formatted,
            "currency": "LKR",
            "hash": self.checkout_hash(amount),
            "reference": str(order_id),
            "customer_first_name": first_name,
            "customer_last_name": last_name,
            "customer_phone_number": self._phone_e164(customer.get("phone")),
            "customer_email": email,
            "transaction_redirect_url": settings.ONEPAY_RETURN_URL,
            "additionalData": str(order_id),
        }
        logger.info("Creating OnePay checkout: %s", json.dumps({**payload, "hash": "<redacted>"}, sort_keys=True))
        response = self._post("/v3/checkout/link/", payload)
        response_data = response.get("data") or {}
        transaction_id = response_data.get("ipg_transaction_id")
        checkout_url = (response_data.get("gateway") or {}).get("redirect_url")
        if not transaction_id or not checkout_url:
            raise OnePayError("OnePay response is missing the transaction ID or redirect URL")
        logger.info("OnePay checkout created for order %s transaction %s", order_id, transaction_id)
        return {
            "provider": "onepay",
            "checkout_url": checkout_url,
            "transaction_id": transaction_id,
            "order_id": str(order_id),
            "amount": formatted,
            "currency": "LKR",
        }

    def verify_payment(self, transaction_id: str) -> dict:
        if not transaction_id:
            raise ValueError("OnePay transaction ID is required")
        response = self._post("/v3/transaction/status/", {
            "app_id": settings.ONEPAY_APP_ID,
            "onepay_transaction_id": transaction_id,
        })
        data = response.get("data") if isinstance(response.get("data"), dict) else response
        returned_id = data.get("ipg_transaction_id")
        if returned_id != transaction_id:
            raise OnePayError("OnePay status response transaction ID mismatch")
        return data

    def verify_webhook(self, payload: dict) -> VerifiedOnePayEvent:
        required = {"transaction_id", "status", "status_message", "additional_data"}
        if missing := required.difference(payload):
            raise ValueError(f"Missing OnePay callback fields: {', '.join(sorted(missing))}")
        transaction_id = str(payload["transaction_id"])
        verified = self.verify_payment(transaction_id)
        return VerifiedOnePayEvent(
            order_id=str(payload["additional_data"]),
            transaction_id=transaction_id,
            amount=money(verified["amount"]),
            currency=str(verified["currency"]),
            status_code="1" if verified.get("status") is True else "0",
        )


onepay_gateway = OnePayGateway()
