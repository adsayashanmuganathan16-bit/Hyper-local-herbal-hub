import stripe
from app.config import settings

stripe.api_key = settings.STRIPE_SECRET_KEY


class PaymentService:
    """Stripe payment integration service."""

    async def create_payment_intent(self, amount: float, currency: str = "inr", metadata: dict = None) -> dict:
        """Create a Stripe payment intent."""
        try:
            intent = stripe.PaymentIntent.create(
                amount=int(amount * 100),  # Stripe uses smallest currency unit
                currency=currency,
                metadata=metadata or {},
            )
            return {
                "client_secret": intent.client_secret,
                "payment_intent_id": intent.id,
            }
        except stripe.error.StripeError as e:
            raise Exception(f"Payment intent creation failed: {e}")

    async def confirm_payment(self, payment_intent_id: str) -> dict:
        """Confirm payment status."""
        try:
            intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            return {
                "status": intent.status,
                "amount": intent.amount / 100,
            }
        except stripe.error.StripeError as e:
            raise Exception(f"Payment confirmation failed: {e}")

    async def refund_payment(self, payment_intent_id: str) -> dict:
        """Process a refund."""
        try:
            refund = stripe.Refund.create(payment_intent=payment_intent_id)
            return {"status": refund.status, "refund_id": refund.id}
        except stripe.error.StripeError as e:
            raise Exception(f"Refund failed: {e}")

    async def generate_invoice(self, order_data: dict) -> str:
        """Generate invoice data (in production, use a PDF service)."""
        items_text = ""
        for item in order_data.get("items", []):
            items_text += f"{item['name']} x{item['quantity']} - ₹{item['price'] * item['quantity']:.2f}\n"

        invoice = f"""
        ══════════════════════════════════════
           🌿 HERBAL HUB - INVOICE
        ══════════════════════════════════════
        Order ID: {order_data.get('id', 'N/A')}
        Date: {order_data.get('created_at', 'N/A')}
        ────────────────────────────────────
        {items_text}
        ────────────────────────────────────
        Subtotal:    ₹{order_data.get('total_amount', 0):.2f}
        Discount:    -₹{order_data.get('discount', 0):.2f}
        Delivery:    ₹{order_data.get('delivery_charge', 0):.2f}
        ────────────────────────────────────
        TOTAL:       ₹{order_data.get('final_amount', 0):.2f}
        ══════════════════════════════════════
        Thank you for choosing Herbal Hub!
        Pure Herbs, Pure Life 🌱
        """
        return invoice


payment_service = PaymentService()
