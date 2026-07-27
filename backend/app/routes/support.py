from html import escape
from typing import Literal

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field

from app.database import get_db
from app.middleware.auth_middleware import decode_token, require_admin
from app.services.email_service import email_service
from app.utils.helpers import paginate, serialize_doc
from app.utils.time import utc_now

router = APIRouter(prefix="/api/support", tags=["Customer Support"])
optional_security = HTTPBearer(auto_error=False)


class SupportMessageCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    message: str = Field(min_length=5, max_length=5000)


class SupportReplyCreate(BaseModel):
    message: str = Field(min_length=2, max_length=5000)


class SupportStatusUpdate(BaseModel):
    status: Literal["open", "resolved"]


async def optional_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_security),
) -> dict | None:
    if not credentials:
        return None
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") == "refresh" or not ObjectId.is_valid(payload.get("sub", "")):
            return None
        user = await get_db().users.find_one({"_id": ObjectId(payload["sub"])})
        if not user or not user.get("is_active", True):
            return None
        user["_id"] = str(user["_id"])
        return user
    except HTTPException:
        return None


@router.post("/messages", status_code=status.HTTP_201_CREATED)
async def create_support_message(
    data: SupportMessageCreate,
    current_user: dict | None = Depends(optional_current_user),
):
    now = utc_now()
    document = {
        "name": data.name.strip(),
        "email": str(data.email).strip().lower(),
        "message": data.message.strip(),
        "user_id": current_user["_id"] if current_user else None,
        "sender_role": current_user.get("role", "guest") if current_user else "guest",
        "status": "open",
        "replies": [],
        "created_at": now,
        "updated_at": now,
    }
    result = await get_db().support_messages.insert_one(document)
    return {
        "id": str(result.inserted_id),
        "status": "open",
        "message": "Your message has been sent to the Herbal Hub support team.",
    }


@router.get("/admin/messages")
async def list_support_messages(
    message_status: Literal["all", "open", "resolved"] = Query("all", alias="status"),
    q: str | None = Query(None, max_length=200),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(require_admin),
):
    query: dict = {}
    if message_status != "all":
        query["status"] = message_status
    if q:
        search = q.strip()
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"message": {"$regex": search, "$options": "i"}},
        ]
    rows = await get_db().support_messages.find(query).sort([("created_at", -1)]).to_list(length=None)
    result = paginate(rows, page, page_size)
    result["items"] = [serialize_doc(row) for row in result["items"]]
    return result


@router.post("/admin/messages/{message_id}/reply")
async def reply_to_support_message(
    message_id: str,
    data: SupportReplyCreate,
    current_user: dict = Depends(require_admin),
):
    if not ObjectId.is_valid(message_id):
        raise HTTPException(status_code=404, detail="Support message not found")
    db = get_db()
    support_message = await db.support_messages.find_one({"_id": ObjectId(message_id)})
    if not support_message:
        raise HTTPException(status_code=404, detail="Support message not found")

    reply_text = data.message.strip()
    safe_name = escape(support_message["name"])
    safe_reply = escape(reply_text).replace("\n", "<br>")
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#263b32">
      <div style="background:#0B5D3B;color:white;padding:22px;border-radius:10px 10px 0 0">
        <h2 style="margin:0">Hyper-Local Herbal Hub Support</h2>
      </div>
      <div style="padding:24px;border:1px solid #d8e7dc;border-top:0;border-radius:0 0 10px 10px">
        <p>Hello {safe_name},</p>
        <p>{safe_reply}</p>
        <p style="margin-top:24px;color:#537064">Regards,<br>Hyper-Local Herbal Hub Support Team</p>
      </div>
    </div>
    """
    email_sent = await email_service.send_email(
        support_message["email"],
        "Reply from Hyper-Local Herbal Hub Support",
        html,
    )
    now = utc_now()
    reply = {
        "message": reply_text,
        "replied_by": current_user["_id"],
        "replied_by_name": current_user.get("name", "Administrator"),
        "email_sent": email_sent,
        "created_at": now,
    }
    await db.support_messages.update_one(
        {"_id": support_message["_id"]},
        {
            "$push": {"replies": reply},
            "$set": {"status": "resolved", "updated_at": now, "resolved_at": now},
        },
    )
    return {
        "message": "Reply saved and message marked as resolved.",
        "email_sent": email_sent,
        "reply": reply,
    }


@router.put("/admin/messages/{message_id}/status")
async def update_support_message_status(
    message_id: str,
    data: SupportStatusUpdate,
    current_user: dict = Depends(require_admin),
):
    if not ObjectId.is_valid(message_id):
        raise HTTPException(status_code=404, detail="Support message not found")
    now = utc_now()
    fields = {"status": data.status, "updated_at": now}
    if data.status == "resolved":
        fields["resolved_at"] = now
    else:
        fields["resolved_at"] = None
    result = await get_db().support_messages.update_one(
        {"_id": ObjectId(message_id)}, {"$set": fields}
    )
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Support message not found")
    return {"message": f"Message marked as {data.status}.", "status": data.status}
