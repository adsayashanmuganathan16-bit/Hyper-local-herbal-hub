from app.utils.time import utc_now
from datetime import datetime
from decimal import Decimal

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse

from app.database import get_db
from app.financial.schemas import BankAccountUpdate, SellerAccountRegistration, SellerRegistration
from app.middleware.auth_middleware import require_seller
from app.services.financial_crypto import encrypt_sensitive
from app.utils.helpers import generate_secure_token, hash_password, serialize_doc
from app.middleware.auth_middleware import create_access_token, create_refresh_token
from app.services.email_service import email_service
from app.config import settings
from app.services.service_area_service import validate_service_address
from datetime import timedelta

router = APIRouter(prefix="/api/financial/sellers", tags=["Seller Financials"])


def seller_view(seller: dict, bank: dict | None = None) -> dict:
    verification_status = seller.get(
        "verification_status",
        "VERIFIED" if bank and bank.get("verified") else "PENDING",
    )
    return {
        "id": str(seller["_id"]), "name": seller["name"], "email": seller["email"],
        "phone": seller["phone"], "business_name": seller["business_name"],
        "store_name": seller.get("store_name", seller["business_name"]), "address": seller.get("address"),
        "latitude": seller.get("latitude"), "longitude": seller.get("longitude"),
        "approval_status": seller["approval_status"],
        "verification_status": verification_status,
        "bank_account": None if not bank else {
            "bank_name": bank["bank_name"], "branch": bank["branch"],
            "account_holder_name": bank["account_holder_name"],
            "account_number": f"****{bank['account_number_last4']}",
            "verified": verification_status == "VERIFIED",
            "verification_status": verification_status,
        },
    }


async def current_seller(db, user_id: str) -> dict:
    seller = await db.sellers.find_one({"user_id": user_id})
    if not seller:
        raise HTTPException(404, "Financial seller profile not found")
    return seller


@router.post("/register-account", status_code=201)
async def register_seller_account(data: SellerAccountRegistration):
    db, now = get_db(), utc_now()
    auto_verify = settings.AUTO_VERIFY_SELLERS
    verification_status = "VERIFIED" if auto_verify else "PENDING"
    location = await validate_service_address(db, data.address)
    email = str(data.email).lower()
    if await db.users.find_one({"$or": [{"email": email}, {"phone": data.phone}]}):
        raise HTTPException(409, "Email or phone is already registered")
    token = generate_secure_token()
    user_doc = {"name": data.name, "email": email, "phone": data.phone,
                "password": hash_password(data.password), "role": "seller", "is_active": True,
                "email_verified": False, "business_name": data.business_name, "verification_token": token,
                "verification_token_expires": now + timedelta(hours=settings.EMAIL_VERIFICATION_EXPIRE_HOURS),
                "address": None, "profile_image": None, "created_at": now, "updated_at": now}
    user_result = await db.users.insert_one(user_doc)
    user_id = str(user_result.inserted_id)
    try:
        seller_doc = {"user_id": user_id, "name": data.name, "email": email, "phone": data.phone,
                      "nic_encrypted": encrypt_sensitive(data.nic), "business_name": data.business_name,
                      "store_name": data.business_name, "address": data.address,
                      "latitude": location["latitude"], "longitude": location["longitude"],
                      "service_area_id": location["service_area_id"],
                      "approval_status": "APPROVED" if auto_verify else "PENDING",
                      "verification_status": verification_status,
                      "verified_at": now if auto_verify else None,
                      "verified_by": "AUTO_VERIFY_SELLERS" if auto_verify else None,
                      "created_at": now, "updated_at": now}
        seller_result = await db.sellers.insert_one(seller_doc)
        await db.seller_bank_accounts.insert_one({"seller_id": str(seller_result.inserted_id),
            "bank_name": data.bank_name, "branch": data.branch, "account_holder_name": data.account_holder_name,
            "account_number_encrypted": encrypt_sensitive(data.account_number),
            "account_number_last4": data.account_number[-4:], "verified": auto_verify,
            "verification_status": verification_status,
            "verified_at": now if auto_verify else None,
            "verified_by": "AUTO_VERIFY_SELLERS" if auto_verify else None,
            "created_at": now, "updated_at": now})
    except Exception:
        await db.users.delete_one({"_id": user_result.inserted_id})
        await db.sellers.delete_one({"user_id": user_id})
        raise
    await email_service.send_verification_email(email, data.name, token)
    claims = {"sub": user_id, "role": "seller"}
    return {"message": "Seller application submitted", "access_token": create_access_token(claims),
            "refresh_token": create_refresh_token(claims), "token_type": "bearer",
            "user": {"id": user_id, "name": data.name, "email": email, "phone": data.phone,
                     "role": "seller", "business_name": data.business_name,
                     "email_verified": False,
                     "seller_approval_status": seller_doc["approval_status"],
                     "seller_verification_status": verification_status}}


@router.post("/register", status_code=201)
async def register_seller(data: SellerRegistration, user=Depends(require_seller)):
    db, now = get_db(), utc_now()
    auto_verify = settings.AUTO_VERIFY_SELLERS
    verification_status = "VERIFIED" if auto_verify else "PENDING"
    seller_doc = await db.sellers.find_one({"user_id": user["_id"]})
    location = (
        {
            "latitude": seller_doc["latitude"],
            "longitude": seller_doc["longitude"],
            "service_area_id": seller_doc["service_area_id"],
        }
        if seller_doc
        and seller_doc.get("latitude") is not None
        and seller_doc.get("longitude") is not None
        and seller_doc.get("service_area_id")
        else await validate_service_address(db, data.address)
    )
    seller_update = {"name": data.name, "email": str(data.email).lower(), "phone": data.phone,
                     "nic_encrypted": encrypt_sensitive(data.nic), "business_name": data.business_name,
                     "store_name": data.business_name, "address": data.address,
                     "latitude": location["latitude"], "longitude": location["longitude"],
                     "service_area_id": location["service_area_id"],
                     "approval_status": "APPROVED" if auto_verify else "PENDING",
                     "verification_status": verification_status,
                     "verified_at": now if auto_verify else None,
                     "verified_by": "AUTO_VERIFY_SELLERS" if auto_verify else None,
                     "updated_at": now}
    if seller_doc:
        await db.sellers.update_one({"_id": seller_doc["_id"]}, {"$set": seller_update})
        seller_doc.update(seller_update)
    else:
        seller_doc = {"user_id": user["_id"], **seller_update,
                      "created_at": now}
        result = await db.sellers.insert_one(seller_doc)
        seller_doc["_id"] = result.inserted_id

    bank_doc = {"seller_id": str(seller_doc["_id"]), "bank_name": data.bank_name, "branch": data.branch,
                "account_holder_name": data.account_holder_name,
                "account_number_encrypted": encrypt_sensitive(data.account_number),
                "account_number_last4": data.account_number[-4:], "verified": auto_verify,
                "verification_status": verification_status,
                "verified_at": now if auto_verify else None,
                "verified_by": "AUTO_VERIFY_SELLERS" if auto_verify else None,
                "updated_at": now}
    await db.seller_bank_accounts.update_one(
        {"seller_id": str(seller_doc["_id"])},
        {"$set": bank_doc, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    bank_doc["created_at"] = now
    return {"message": "Seller payment details saved successfully",
            "seller": seller_view(seller_doc, bank_doc)}


@router.get("/me")
async def get_seller_profile(user=Depends(require_seller)):
    db = get_db()
    seller = await current_seller(db, user["_id"])
    bank = await db.seller_bank_accounts.find_one({"seller_id": str(seller["_id"])})
    return seller_view(seller, bank)


@router.put("/me/bank-account")
async def update_bank_account(data: BankAccountUpdate, user=Depends(require_seller)):
    db, now = get_db(), utc_now()
    seller = await current_seller(db, user["_id"])
    auto_verify = settings.AUTO_VERIFY_SELLERS
    verification_status = "VERIFIED" if auto_verify else "PENDING"
    update = {"bank_name": data.bank_name, "branch": data.branch,
              "account_holder_name": data.account_holder_name,
              "account_number_encrypted": encrypt_sensitive(data.account_number),
              "account_number_last4": data.account_number[-4:], "verified": auto_verify,
              "verification_status": verification_status,
              "verified_at": now if auto_verify else None,
              "verified_by": "AUTO_VERIFY_SELLERS" if auto_verify else None,
              "updated_at": now}
    await db.sellers.update_one({"_id": seller["_id"]}, {"$set": {
        "approval_status": "APPROVED" if auto_verify else "PENDING",
        "verification_status": verification_status,
        "verified_at": now if auto_verify else None,
        "verified_by": "AUTO_VERIFY_SELLERS" if auto_verify else None,
        "updated_at": now,
    }})
    await db.seller_bank_accounts.update_one({"seller_id": str(seller["_id"])},
                                             {"$set": update, "$setOnInsert": {"created_at": now}}, upsert=True)
    return {"bank_name": data.bank_name, "branch": data.branch,
            "account_holder_name": data.account_holder_name,
            "account_number": f"****{data.account_number[-4:]}",
            "verified": auto_verify, "verification_status": verification_status}


@router.get("/me/earnings")
async def seller_earnings(user=Depends(require_seller)):
    db = get_db()
    seller = await current_seller(db, user["_id"])
    rows = await db.payouts.find({"seller_id": str(seller["_id"])}).sort("created_at", -1).to_list(length=None)
    total_sales = sum((Decimal(p["gross_amount"]) for p in rows), Decimal("0"))
    commission = sum((Decimal(p["commission_amount"]) for p in rows), Decimal("0"))
    paid = sum((Decimal(p["net_amount"]) for p in rows if p.get("payout_status", p["status"]) == "PAID"), Decimal("0"))
    pending = sum((Decimal(p["net_amount"]) for p in rows if p.get("payout_status", p["status"]) != "PAID"), Decimal("0"))
    order_ids = list({p["order_id"] for p in rows})
    order_object_ids = [ObjectId(value) for value in order_ids if ObjectId.is_valid(value)]
    delivery_charges = sum((Decimal(str(o.get("delivery_charge", 0))) for o in await db.orders.find(
        {"_id": {"$in": order_object_ids}}
    ).to_list(length=None)), Decimal("0"))
    transactions = []
    for payout in rows:
        item = serialize_doc(payout)
        item["payment_status"] = payout.get("payment_status", "PAID")
        item["payout_status"] = payout.get("payout_status", payout["status"])
        transactions.append(item)
    return {"total_sales": str(total_sales), "commission": str(commission),
            "completed_payouts": str(paid), "available_balance": str(pending),
            "pending_payouts": str(pending), "delivery_charges_handled": str(delivery_charges),
            "transactions": transactions}


@router.get("/me/payouts/{payout_id}/receipt", response_class=HTMLResponse)
async def seller_payout_receipt(payout_id: str, user=Depends(require_seller)):
    db = get_db()
    payout = await db.payouts.find_one({"_id": ObjectId(payout_id), "seller_user_id": user["_id"]}) if ObjectId.is_valid(payout_id) else None
    if not payout:
        raise HTTPException(404, "Payout receipt not found")
    from app.services.receipt_service import payout_receipt_context, render_payout_receipt
    return HTMLResponse(render_payout_receipt(await payout_receipt_context(db, payout)))
