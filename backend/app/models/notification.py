from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class NotificationTypeEnum(str, Enum):
    ORDER = "order"
    DELIVERY = "delivery"
    PRESCRIPTION = "prescription"
    PROMOTION = "promotion"
    SYSTEM = "system"


class NotificationInDB(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    type: NotificationTypeEnum
    title: str
    message: str
    is_read: bool = False
    link: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}