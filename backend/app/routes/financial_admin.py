from app.utils.time import utc_now
import csv
import io
import secrets
from datetime import datetime

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse, HTMLResponse
from pymongo import ReturnDocument

from app.database import get_db
from app.financial.schemas import CommissionUpdate, ManualPayoutCompletion, PayoutStatusUpdate
from app.middleware.auth_middleware import require_admin
from app.utils.helpers import serialize_doc
from app.services.financial_crypto import decrypt_sensitive

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
    db = get_db()
    rows = await db.sellers.find({}, {"nic_encrypted": 0}).sort("created_at", -1).to_list(length=None)
    result = []
    for row in rows:
        bank = await db.seller_bank_accounts.find_one({"seller_id": str(row["_id"])})
        item = serialize_doc(row)
        item["verification_status"] = row.get(
            "verification_status",
            "VERIFIED" if bank and bank.get("verified") else "PENDING",
        )
        item["bank_account"] = None if not bank else {
            "bank_name": bank["bank_name"], "branch": bank["branch"],
            "account_holder_name": bank["account_holder_name"],
            "account_number": decrypt_sensitive(bank["account_number_encrypted"]),
        }
        result.append(item)
    return result


@router.post("/sellers/{seller_id}/{decision}")
async def decide_seller(seller_id: str, decision: str, request: Request, user=Depends(require_admin)):
    if decision not in {"approve", "reject", "request-changes"}:
        raise HTTPException(422, "Decision must be approve, reject, or request-changes")
    db, now = get_db(), utc_now()
    verification_status = {
        "approve": "VERIFIED",
        "reject": "REJECTED",
        "request-changes": "CHANGES_REQUESTED",
    }[decision]
    approval_status = {
        "approve": "APPROVED",
        "reject": "REJECTED",
        "request-changes": "PENDING",
    }[decision]
    seller_fields = {
        "approval_status": approval_status,
        "verification_status": verification_status,
        "updated_at": now,
        "verified_at": now if decision == "approve" else None,
        "verified_by": user["_id"] if decision == "approve" else None,
    }
    result = await db.sellers.update_one({"_id": oid(seller_id)}, {"$set": seller_fields})
    if not result.matched_count:
        raise HTTPException(404, "Seller not found")
    await db.seller_bank_accounts.update_one({"seller_id": seller_id}, {"$set": {
        "verified": decision == "approve",
        "verification_status": verification_status,
        "verified_at": now if decision == "approve" else None,
        "verified_by": user["_id"] if decision == "approve" else None,
        "updated_at": now,
    }})
    if decision == "approve":
        from app.services.financial_order_service import create_payouts_for_paid_order
        allocations = await db.seller_order_allocations.find(
            {"seller_id": seller_id}, {"order_id": 1}
        ).to_list(length=None)
        for order_id in {row["order_id"] for row in allocations}:
            payment = await db.payments.find_one({"order_id": order_id, "status": "PAID"})
            if payment:
                await create_payouts_for_paid_order(
                    db, order_id, now, payment_reference=payment.get("transaction_id")
                )
    from app.services.financial_notification_service import create_financial_notification
    seller = await db.sellers.find_one({"_id": oid(seller_id)})
    if seller:
        notification_copy = {
            "approve": (
                "Seller payment details verified",
                "Your bank details are verified and your account is eligible for payouts.",
            ),
            "reject": (
                "Seller payment details rejected",
                "Your bank details were rejected. Please review and resubmit them.",
            ),
            "request-changes": (
                "Changes requested for payment details",
                "An administrator requested changes to your bank details. Please update and resubmit them.",
            ),
        }[decision]
        await create_financial_notification(
            seller["user_id"], notification_copy[0], notification_copy[1], "/seller/earnings"
        )
    await audit(db, user, f"seller.{decision}", "seller", seller_id, request)
    return {"id": seller_id, "approval_status": approval_status,
            "verification_status": verification_status}


@router.get("/payments")
async def payments(_=Depends(require_admin)):
    return [serialize_doc(row) for row in await get_db().payments.find().sort("created_at", -1).to_list(length=None)]


@router.get("/payouts")
async def payouts(status: str | None = None, _=Depends(require_admin)):
    allowed = {"PENDING", "PROCESSING", "PAID", "READY_FOR_MANUAL_TRANSFER", "FAILED"}
    normalized = status.upper() if status else None
    if normalized and normalized not in allowed:
        raise HTTPException(422, "Invalid payout status filter")
    query = {"status": normalized} if normalized else {}
    db = get_db()
    rows = await db.payouts.find(query).sort("created_at", -1).to_list(length=None)
    seller_ids = [ObjectId(row["seller_id"]) for row in rows if ObjectId.is_valid(row.get("seller_id", ""))]
    sellers_by_id = {str(row["_id"]): row for row in await db.sellers.find({"_id": {"$in": seller_ids}}).to_list(length=None)}
    order_ids = list({row["order_id"] for row in rows})
    payments_by_order = {
        row["order_id"]: row
        for row in await db.payments.find(
            {"order_id": {"$in": order_ids}},
            {"order_id": 1, "status": 1},
        ).to_list(length=None)
    }
    result = []
    for row in rows:
        seller = sellers_by_id.get(row.get("seller_id"), {})
        item = serialize_doc(row)
        item["seller_name"] = seller.get("name")
        item["business_name"] = seller.get("business_name")
        item["payment_status"] = payments_by_order.get(row["order_id"], {}).get(
            "status",
            row.get("payment_status", "UNKNOWN"),
        )
        item["payout_status"] = row.get("payout_status", row["status"])
        result.append(item)
    return result


@router.get("/payouts/{payout_id}")
async def payout_detail(payout_id: str, _=Depends(require_admin)):
    payout = await get_db().payouts.find_one({"_id": oid(payout_id)})
    if not payout:
        raise HTTPException(404, "Payout not found")
    return serialize_doc(payout)


async def generated_payout_reference(db) -> str:
    for _ in range(10):
        reference = f"PAY-{secrets.token_hex(4).upper()}"
        if not await db.payouts.find_one({"payout_reference": reference}, {"_id": 1}):
            return reference
    raise HTTPException(503, "Unable to generate a unique payout reference")


async def transition_payout(db, payout_id: str, target: str, user: dict) -> dict:
    payout_oid = oid(payout_id)
    existing = await db.payouts.find_one({"_id": payout_oid})
    if not existing:
        raise HTTPException(404, "Payout not found")
    current = existing.get("payout_status", existing.get("status", "PENDING")).upper()
    allowed = {
        "PENDING": {"PROCESSING", "PAID"},
        "READY_FOR_MANUAL_TRANSFER": {"PROCESSING", "PAID"},
        "PROCESSING": {"PAID"},
    }
    if target not in allowed.get(current, set()):
        if current == "PAID":
            raise HTTPException(409, "Payout has already been paid")
        raise HTTPException(409, f"Cannot change payout from {current} to {target}")
    now = utc_now()
    fields = {"status": target, "payout_status": target, "updated_at": now}
    if target == "PAID":
        fields.update({
            "transaction_reference": await generated_payout_reference(db),
            "paid_at": now,
            "paid_by": user["_id"],
        })
        fields["payout_reference"] = fields["transaction_reference"]
    payout = await db.payouts.find_one_and_update(
        {"_id": payout_oid, "status": current},
        {"$set": fields},
        return_document=ReturnDocument.AFTER,
    )
    if not payout:
        raise HTTPException(409, "Payout status changed; refresh and try again")
    return payout


@router.patch("/payouts/{payout_id}/status")
async def update_payout_status(
    payout_id: str,
    data: PayoutStatusUpdate,
    request: Request,
    user=Depends(require_admin),
):
    db, target = get_db(), data.status.upper()
    payout = await transition_payout(db, payout_id, target, user)
    await audit(db, user, f"payout.{target.lower()}", "payout", payout_id, request,
                {"reference": payout.get("transaction_reference")})
    if target == "PAID":
        await db.payout_attempts.update_one(
            {"payout_id": payout_id, "attempt_number": payout.get("retry_count", 0) + 1},
            {"$setOnInsert": {"provider": "manual_bank_transfer", "status": "PAID",
                              "request_reference": payout["transaction_reference"],
                              "failure_reason": None, "created_at": payout["paid_at"]}},
            upsert=True,
        )
        from app.services.financial_notification_service import create_financial_notification
        await create_financial_notification(
            payout["seller_user_id"], "Payout completed",
            f"Your payout of LKR {float(payout['net_amount']):,.2f} was confirmed. "
            f"Reference: {payout['transaction_reference']}",
        )
    return serialize_doc(payout)


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
        {"$set": {"status": "PAID", "payout_status": "PAID",
                  "transaction_reference": data.transaction_reference,
                  "paid_at": now, "paid_by": user["_id"], "updated_at": now}},
        return_document=ReturnDocument.AFTER,
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
        {"$set": {"status": "PENDING", "payout_status": "PENDING",
                  "failure_reason": None, "updated_at": utc_now()}}, return_document=ReturnDocument.AFTER)
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
