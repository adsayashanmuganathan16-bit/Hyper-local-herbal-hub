from datetime import datetime, timedelta, timezone
from bson import ObjectId
from bson.errors import InvalidId
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import settings
from app.database import get_db

security = HTTPBearer()


def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.JWT_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict, expires_delta: timedelta = None) -> str:
    """Create a long-lived JWT refresh token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS))
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT, raising 401 on failure or expiry."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    if payload.get("sub") is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return payload


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Verify a JWT access token and return its payload."""
    payload = decode_token(credentials.credentials)
    if payload.get("type") == "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return payload


async def get_current_user(payload: dict = Depends(verify_token)) -> dict:
    """Get current user from database using token payload."""
    db = get_db()
    try:
        user_id = ObjectId(payload["sub"])
    except (InvalidId, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = await db.users.find_one({"_id": user_id})
    if not user or not user.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    user["_id"] = str(user["_id"])
    return user


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Require admin role."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user

async def require_seller(current_user: dict = Depends(get_current_user)) -> dict:
    """Require an active seller account."""
    if current_user.get("role") != "seller":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Seller access required")
    return current_user


async def require_customer(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "customer":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Customer access required")
    return current_user


async def require_product_manager(current_user: dict = Depends(get_current_user)) -> dict:
    """Allow admins and sellers to manage products."""
    if current_user.get("role") not in ("admin", "seller"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Product management access required")
    if current_user.get("role") == "seller":
        seller = await get_db().sellers.find_one({"user_id": current_user["_id"]})
        if not seller or seller.get("approval_status") != "APPROVED":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Seller approval is required")
    return current_user
