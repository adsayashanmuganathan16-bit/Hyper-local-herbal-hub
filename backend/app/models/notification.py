from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime, timezone
from enum import Enum


class NotificationTypeEnum(str, Enum):
    ORDER = "order"
    DELIVERY = "delivery"
    PRESCRIPTION = "prescription"
    PROMOTION = "promotion"
    SYSTEM = "system"


class NotificationInDB(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str = Field(alias="_id")
    user_id: str
    type: NotificationTypeEnum
    title: str
    message: str
    is_read: bool = False
    link: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
