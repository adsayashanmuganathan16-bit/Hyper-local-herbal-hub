

import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
load_dotenv(BACKEND / ".env", override=True)

from app.config import settings  # noqa: E402
from app.routes.financial_payments import _record_verified_payment  # noqa: E402
from app.services.stripe_service import stripe_gateway  # noqa: E402


async def reconcile() -> None:
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    try:
        database = client[settings.DB_NAME]
        payments = await database.payments.find({
            "payment_gateway": "stripe",
            "status": {"$ne": "PAID"},
            "transaction_id": {"$regex": "^cs_"},
        }).to_list(length=None)
        print(f"pending Stripe payments: {len(payments)}")
        request = SimpleNamespace(client=SimpleNamespace(host="local-reconciliation"))
        for payment in payments:
            session_id = payment["transaction_id"]
            event = stripe_gateway.retrieve_checkout_session(session_id)
            status = {
                "1": "PAID",
                "FAILED": "FAILED",
                "CANCELLED": "CANCELLED",
                "PENDING": "PENDING",
            }.get(event.status_code, "FAILED")
            if status == "PENDING":
                print(f"{payment['order_id']}: still pending at Stripe")
                continue
            result = await _record_verified_payment(
                database,
                event,
                {
                    "source": "stripe_reconciliation",
                    "order_id": payment["order_id"],
                    "stripe_status": status,
                },
                request,
                status,
            )
            print(f"{payment['order_id']}: {result['status']}")
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(reconcile())
