from app.utils.time import utc_now
from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, EmailStr
from pymongo.errors import DuplicateKeyError

from app.database import get_db
from app.middleware.auth_middleware import require_admin
from app.utils.helpers import paginate, serialize_doc

router = APIRouter(prefix="/api/newsletter", tags=["Newsletter"])


class NewsletterSubscription(BaseModel):
    email: EmailStr


@router.post("/subscribe", status_code=status.HTTP_201_CREATED)
async def subscribe(data: NewsletterSubscription):
    """Subscribe an email address to the Herbal Hub newsletter."""
    db = get_db()
    email = str(data.email).strip().lower()
    now = utc_now()
    try:
        await db.newsletter_subscribers.insert_one({
            "email": email,
            "status": "active",
            "source": "website_footer",
            "subscribed_at": now,
            "updated_at": now,
        })
        return {"message": "Thank you for subscribing!", "subscribed": True}
    except DuplicateKeyError:
        return {"message": "This email is already subscribed", "subscribed": False}


@router.get("/admin/subscribers")
async def list_subscribers(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    q: str | None = Query(None, max_length=200),
    current_user: dict = Depends(require_admin),
):
    """List newsletter subscribers. Admin access only."""
    db = get_db()
    query = {"status": "active"}
    if q:
        query["email"] = {"$regex": q.strip(), "$options": "i"}
    rows = await db.newsletter_subscribers.find(query).sort([("subscribed_at", -1)]).to_list(length=None)
    result = paginate(rows, page, page_size)
    result["items"] = [serialize_doc(row) for row in result["items"]]
    return result
