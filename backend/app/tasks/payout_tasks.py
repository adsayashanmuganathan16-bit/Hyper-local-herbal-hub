from app.utils.time import utc_now
import asyncio
from datetime import datetime

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
from celery.exceptions import Retry

from app.config import settings
from app.services.payout_service import get_payout_service
from app.tasks.celery_app import celery_app


async def _process(payout_id: str) -> str:
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db, now = client[settings.DB_NAME], utc_now()
    try:
        payout = await db.payouts.find_one_and_update(
            {"_id": ObjectId(payout_id), "status": "PENDING", "retry_count": {"$lt": 3}},
            {"$set": {"status": "PROCESSING", "payout_status": "PROCESSING",
                      "updated_at": now}},
            return_document=ReturnDocument.AFTER,
        )
        if not payout:
            return "skipped"
        service = get_payout_service(settings.PAYOUT_MODE)
        try:
            result = await service.create_payout(payout)
        except Exception as exc:
            result = None
            error = str(exc)
        else:
            error = result.error
        attempt = payout.get("retry_count", 0) + 1
        provider_status = result.status if result else "FAILED"
        should_retry = provider_status == "FAILED" and attempt < 3
        status = "PENDING" if should_retry else provider_status
        await db.payouts.update_one({"_id": payout["_id"]}, {"$set": {
            "status": status, "payout_status": status, "failure_reason": error,
            "transaction_reference": result.reference if result else None,
            "retry_count": attempt, "updated_at": utc_now(),
        }})
        await db.payout_attempts.update_one({"payout_id": payout_id, "attempt_number": attempt},
            {"$setOnInsert": {"provider": payout.get("provider", settings.PAYOUT_MODE), "status": provider_status,
                              "request_reference": result.reference if result else None,
                              "failure_reason": error, "created_at": utc_now()}}, upsert=True)
        if should_retry:
            return "RETRY"
        from app.services.financial_notification_service import create_financial_notification
        title = "Payout ready" if status == "READY_FOR_MANUAL_TRANSFER" else "Payout failed"
        message = (f"Your payout of LKR {float(payout['net_amount']):,.2f} is ready for bank transfer."
                   if status == "READY_FOR_MANUAL_TRANSFER" else error or "Payout processing failed after three attempts")
        await create_financial_notification(payout["seller_user_id"], title, message)
        return status
    finally:
        client.close()


@celery_app.task(name="payouts.process_one", bind=True, max_retries=3)
def process_one(self, payout_id: str):
    try:
        result = asyncio.run(_process(payout_id))
        if result == "RETRY":
            raise self.retry(countdown=(2 ** self.request.retries) * 60)
        return result
    except Retry:
        raise
    except Exception as exc:
        raise self.retry(exc=exc, countdown=(2 ** self.request.retries) * 60)


async def _pending_ids() -> list[str]:
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    try:
        rows = await client[settings.DB_NAME].payouts.find(
            {"status": "PENDING", "retry_count": {"$lt": 3}}, {"_id": 1}
        ).limit(100).to_list(length=100)
        return [str(row["_id"]) for row in rows]
    finally:
        client.close()


@celery_app.task(name="payouts.process_pending")
def process_pending():
    ids = asyncio.run(_pending_ids())
    for payout_id in ids:
        process_one.delay(payout_id)
    return len(ids)
