from datetime import datetime, timedelta
from passlib.context import CryptContext
import random
import secrets
import string

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def generate_otp(length: int = 4) -> str:
    """Generate a numeric OTP."""
    return "".join(random.choices(string.digits, k=length))


def generate_secure_token(nbytes: int = 32) -> str:
    """Generate a URL-safe random token for password reset / email verification."""
    return secrets.token_urlsafe(nbytes)


def calculate_cart_totals(items: list) -> dict:
    """Calculate cart total items and amount."""
    total_items = sum(item["quantity"] for item in items)
    total_amount = sum(
        (item.get("discount_price") or item["price"]) * item["quantity"]
        for item in items
    )
    return {"total_items": total_items, "total_amount": round(total_amount, 2)}


def calculate_order_amounts(items: list, delivery_charge: float = 0, discount: float = 0) -> dict:
    """Calculate final order amounts."""
    total = sum(item["price"] * item["quantity"] for item in items)
    final = max(0, total - discount + delivery_charge)
    return {
        "total_amount": round(total, 2),
        "discount": round(discount, 2),
        "delivery_charge": round(delivery_charge, 2),
        "final_amount": round(final, 2),
    }


def serialize_doc(doc: dict) -> dict:
    """Convert MongoDB document to JSON-serializable dict."""
    if not doc:
        return None
    serialized = {}
    for key, value in doc.items():
        if key == "_id":
            serialized["id"] = str(value)
        elif isinstance(value, datetime):
            serialized[key] = value.isoformat()
        elif isinstance(value, list):
            serialized[key] = [serialize_doc(item) if isinstance(item, dict) else item for item in value]
        elif isinstance(value, dict):
            serialized[key] = serialize_doc(value)
        else:
            serialized[key] = value
    return serialized


def paginate(data: list, page: int, page_size: int) -> dict:
    """Paginate a list of items."""
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "items": data[start:end],
        "total": len(data),
        "page": page,
        "page_size": page_size,
        "total_pages": (len(data) + page_size - 1) // page_size,
    }