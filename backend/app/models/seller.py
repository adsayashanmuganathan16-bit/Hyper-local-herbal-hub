from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


class SellerProfile(BaseModel):
    """Additional marketplace information attached to a seller user."""

    user_id: str
    store_name: str = Field(..., min_length=2, max_length=120)
    description: Optional[str] = Field(default=None, max_length=1000)
    business_registration_number: Optional[str] = None
    address: Optional[dict] = None
    is_approved: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SellerUpdate(BaseModel):
    store_name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    description: Optional[str] = Field(default=None, max_length=1000)
    business_registration_number: Optional[str] = None
    address: Optional[dict] = None
