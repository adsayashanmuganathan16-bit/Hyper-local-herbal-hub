from app.utils.time import utc_now
import csv
import io
from datetime import datetime

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse, HTMLResponse
from pymongo import ReturnDocument

from app.database import get_db
from app.financial.schemas import CommissionUpdate, ManualPayoutCompletion
from app.middleware.auth_middleware import require_admin
from app.utils.helpers import serialize_doc

router = APIRouter(prefix="/api/financial/admin", tags=["Financial Admin"])


def oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except InvalidId as exc:
        raise HTTPException(404, "Record not found") from exc


async def audit(db, user: dict, action: str, entity: str, entity_id: str, request: Request, details=None):
    await db.audit_logs.insert_one({"actor_user_id": user["_id"], "action": action,
                                    "entity_type": entity, "entity_id": entity_id,
                                    "details": details or {},
                                    "ip_address": request.client.host if request.client else None,
                                    "created_at": utc_now()})


@router.get("/sellers")
async def sellers(_=Depends(require_admin)):
    rows = await get_db().sellers.find({}, {"nic_encrypted": 0}).sort("created_at", -1).to_list(length=None)
    return [serialize_doc(row) for row in rows]


@router.post("/sellers/{seller_id}/{decision}")
async def decide_seller(seller_id: str, decision: str, request: Request, user=Depends(require_admin)):
    if decision not in {"approve", "reject"}:
        raise HTTPException(422, "Decision must be approve or reject")
    db, status = get_db(), "APPROVED" if decision == "approve" else "REJECTED"
    result = await db.sellers.update_one({"_id": oid(seller_id)},
                                         {"$set": {"approval_status": status, "updated_at": utc_now()}})
    if not result.matched_count:
        raise HTTPException(404, "Seller not found")
    await db.seller_bank_accounts.update_one({"seller_id": seller_id},
                                             {"$set": {"verified": decision == "approve", "updated_at": utc_now()}})
    await audit(db, user, f"seller.{decision}", "seller", seller_id, request)
    return {"id": seller_id, "approval_status": status}


@router.get("/payments")
async def payments(_=Depends(require_admin)):
    return [serialize_doc(row) for row in await get_db().payments.find().sort("created_at", -1).to_list(length=None)]


@router.get("/payouts")
async def payouts(status: str | None = None, _=Depends(require_admin)):
    query = {"status": status.upper()} if status else {}
    db = get_db()
    rows = await db.payouts.find(query).sort("created_at", -1).to_list(length=None)
    seller_ids = [ObjectId(row["seller_id"]) for row in rows if ObjectId.is_valid(row.get("seller_id", ""))]
    sellers_by_id = {str(row["_id"]): row for row in await db.sellers.find({"_id": {"$in": seller_ids}}).to_list(length=None)}
    result = []
    for row in rows:
        seller = sellers_by_id.get(row.get("seller_id"), {})
        item = serialize_doc(row)
        item["seller_name"] = seller.get("name")
        item["business_name"] = seller.get("business_name")
        result.append(item)
    return result


@router.get("/commission")
async def get_commission(_=Depends(require_admin)):
    from app.services.commission_service import current_commission_rate
    percentage = await current_commission_rate(get_db())
    return {"percentage": str(percentage)}


@router.put("/commission")
async def update_commission(data: CommissionUpdate, request: Request, user=Depends(require_admin)):
    db, now = get_db(), utc_now()
    result = await db.commission_settings.insert_one({"percentage": str(data.percentage),
                                                       "created_by": user["_id"], "effective_from": now, "created_at": now})
    await audit(db, user, "commission.updated", "commission_setting", str(result.inserted_id), request,
                {"percentage": str(data.percentage)})
    return {"percentage": str(data.percentage), "effective_from": now}


@router.post("/payouts/{payout_id}/mark-paid")
async def mark_paid(payout_id: str, data: ManualPayoutCompletion, request: Request, user=Depends(require_admin)):
    db, now = get_db(), utc_now()
    payout = await db.payouts.find_one_and_update(
        {"_id": oid(payout_id), "status": {"$in": ["PENDING", "READY_FOR_MANUAL_TRANSFER"]}},
        {"$set": {"status": "PAID", "transaction_reference": data.transaction_reference,
                  "paid_at": now, "updated_at": now}}, return_document=ReturnDocument.AFTER,
    )
    if not payout:
        existing = await db.payouts.find_one({"_id": oid(payout_id)})
        if not existing:
            raise HTTPException(404, "Payout not found")
        raise HTTPException(409, f"Cannot pay payout in {existing['status']} state")
    attempt = payout.get("retry_count", 0) + 1
    await db.payout_attempts.update_one({"payout_id": payout_id, "attempt_number": attempt},
        {"$setOnInsert": {"provider": "manual_bank_transfer", "status": "PAID",
                          "request_reference": data.transaction_reference, "failure_reason": None,
                          "created_at": now}}, upsert=True)
    await audit(db, user, "payout.marked_paid", "payout", payout_id, request,
                {"reference": data.transaction_reference})
    from app.services.financial_notification_service import create_financial_notification
    await create_financial_notification(payout["seller_user_id"], "Payout completed",
                                        f"Your payout of LKR {float(payout['net_amount']):,.2f} was transferred. Reference: {data.transaction_reference}")
    return serialize_doc(payout)


@router.post("/payouts/{payout_id}/retry")
async def retry_payout(payout_id: str, request: Request, user=Depends(require_admin)):
    db = get_db()
    payout = await db.payouts.find_one_and_update(
        {"_id": oid(payout_id), "status": "FAILED", "retry_count": {"$lt": 3}},
        {"$set": {"status": "PENDING", "failure_reason": None, "updated_at": utc_now()}}, return_document=ReturnDocument.AFTER)
    if not payout:
        raise HTTPException(409, "Only failed payouts with fewer than three attempts can be retried")
    await audit(db, user, "payout.retry", "payout", payout_id, request)
    return serialize_doc(payout)


@router.get("/reports/payouts.csv")
async def payout_report(_=Depends(require_admin)):
    rows = await get_db().payouts.find().sort("created_at", -1).to_list(length=None)
    output, writer = io.StringIO(), None
    writer = csv.writer(output)
    writer.writerow(["Payout ID", "Seller ID", "Gross LKR", "Commission LKR", "Net LKR", "Status", "Reference", "Created", "Paid"])
    for row in rows:
        writer.writerow([str(row["_id"]), row["seller_id"], row["gross_amount"], row["commission_amount"],
                         row["net_amount"], row["status"], row.get("transaction_reference") or "",
                         row["created_at"].isoformat(), row["paid_at"].isoformat() if row.get("paid_at") else ""])
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=payouts.csv"})


@router.get("/payouts/{payout_id}/receipt", response_class=HTMLResponse)
async def admin_payout_receipt(payout_id: str, _=Depends(require_admin)):
    db = get_db()
    payout = await db.payouts.find_one({"_id": oid(payout_id)})
    if not payout:
        raise HTTPException(404, "Payout receipt not found")
    from app.services.receipt_service import payout_receipt_context, render_payout_receipt
    return HTMLResponse(render_payout_receipt(await payout_receipt_context(db, payout)))
