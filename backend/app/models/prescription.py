from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class PrescriptionStatusEnum(str, Enum):
    UPLOADED = "uploaded"
    VERIFYING = "verifying"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class PrescriptionInDB(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    image_url: str
    file_name: str
    status: PrescriptionStatusEnum = PrescriptionStatusEnum.UPLOADED
    verified_by: Optional[str] = None
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    verified_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}