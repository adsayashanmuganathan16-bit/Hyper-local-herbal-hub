from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

import stripe

from app.config import settings
from app.services.commission_service import money
from app.services.payment_gateway_service import PaymentGateway


@dataclass(frozen=True)
class VerifiedStripeEvent:
    order_id: str
    transaction_id: str
    amount: Decimal
    currency: str
    status_code: str
    payment_intent_id: str | None = None
    event_id: str | None = None


class StripeGateway(PaymentGateway):
    """Stripe-hosted Checkout for one-time LKR card payments."""

    @staticmethod
    def _minor_units(amount: Decimal) -> int:
        return int((money(amount) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))

    def create_payment_request(self, order_id: str, amount: Decimal, customer: dict) -> dict:
        if not settings.STRIPE_SECRET_KEY:
            raise RuntimeError("Stripe secret key is not configured")

        formatted_amount = money(amount)
        session = stripe.checkout.Session.create(
            api_key=settings.STRIPE_SECRET_KEY,
            mode="payment",
            customer_email=str(customer.get("email") or "").strip() or None,
            client_reference_id=str(order_id),
            metadata={"order_id": str(order_id)},
            payment_intent_data={"metadata": {"order_id": str(order_id)}},
            line_items=[{
                "price_data": {
                    "currency": "lkr",
                    "product_data": {"name": f"Herbal Hub order {order_id}"},
                    "unit_amount": self._minor_units(formatted_amount),
                },
                "quantity": 1,
            }],
            success_url=settings.STRIPE_SUCCESS_URL.format(
                order_id=order_id,
                CHECKOUT_SESSION_ID="{CHECKOUT_SESSION_ID}",
            ),
            cancel_url=settings.STRIPE_CANCEL_URL.format(order_id=order_id),
        )
        if not session.id or not session.url:
            raise RuntimeError("Stripe did not return a Checkout Session URL")
        return {
            "provider": "stripe",
            "checkout_url": session.url,
            "transaction_id": session.id,
            "order_id": str(order_id),
            "amount": f"{formatted_amount:.2f}",
            "currency": "LKR",
        }

    def verify_webhook(self, payload: dict) -> VerifiedStripeEvent:
        event_type = str(payload.get("type") or "")
        if event_type not in {
            "checkout.session.completed",
            "checkout.session.async_payment_succeeded",
            "checkout.session.async_payment_failed",
            "checkout.session.expired",
        }:
            raise ValueError("Unsupported Stripe event type")

        session = (payload.get("data") or {}).get("object") or {}
        metadata = session.get("metadata") or {}
        order_id = metadata.get("order_id") or session.get("client_reference_id")
        session_id = session.get("id")
        amount_total = session.get("amount_total")
        currency = str(session.get("currency") or "").upper()
        if not order_id or not session_id or amount_total is None:
            raise ValueError("Stripe Checkout Session is missing required payment fields")
        if currency != "LKR":
            raise ValueError("Only LKR payments are accepted")

        paid = event_type in {
            "checkout.session.completed",
            "checkout.session.async_payment_succeeded",
        } and session.get("payment_status") == "paid"
        if paid:
            status_code = "1"
        elif event_type == "checkout.session.expired":
            status_code = "CANCELLED"
        elif event_type == "checkout.session.async_payment_failed":
            status_code = "FAILED"
        else:
            # A completed Checkout Session can still be awaiting an
            # asynchronous payment method. Only Stripe's paid state is final.
            status_code = "PENDING"
        return VerifiedStripeEvent(
            order_id=str(order_id),
            transaction_id=str(session_id),
            amount=money(Decimal(str(amount_total)) / 100),
            currency=currency,
            status_code=status_code,
            payment_intent_id=str(session["payment_intent"]) if session.get("payment_intent") else None,
            event_id=str(payload["id"]) if payload.get("id") else None,
        )

    def retrieve_checkout_session(self, session_id: str) -> VerifiedStripeEvent:
        """Retrieve a Checkout Session directly for secure return-page recovery."""
        if not settings.STRIPE_SECRET_KEY:
            raise RuntimeError("Stripe secret key is not configured")
        if not session_id.startswith("cs_"):
            raise ValueError("Invalid Stripe Checkout Session")
        session = stripe.checkout.Session.retrieve(
            session_id,
            api_key=settings.STRIPE_SECRET_KEY,
        )
        data = (
            session.to_dict_recursive()
            if hasattr(session, "to_dict_recursive")
            else dict(session)
        )
        if data.get("payment_status") == "paid":
            event_type = "checkout.session.completed"
        elif data.get("status") == "expired":
            event_type = "checkout.session.expired"
        else:
            event_type = "checkout.session.completed"
        return self.verify_webhook({
            "type": event_type,
            "data": {"object": data},
        })


stripe_gateway = StripeGateway()
