from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime, timezone
from enum import Enum


class PrescriptionStatusEnum(str, Enum):
    UPLOADED = "uploaded"
    VERIFYING = "verifying"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class PrescriptionInDB(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str = Field(alias="_id")
    user_id: str
    image_url: str
    file_name: str
    status: PrescriptionStatusEnum = PrescriptionStatusEnum.UPLOADED
    verified_by: Optional[str] = None
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    verified_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
