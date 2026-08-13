from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime, timezone
from enum import Enum


class DeliveryStatusEnum(str, Enum):
    ASSIGNED = "assigned"
    PICKED_UP = "picked_up"
    IN_TRANSIT = "in_transit"
    NEAR_LOCATION = "near_location"
    DELIVERED = "delivered"
    FAILED = "failed"


class DeliveryInDB(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str = Field(alias="_id")
    order_id: str
    status: DeliveryStatusEnum = DeliveryStatusEnum.ASSIGNED
    current_location: Optional[dict] = None
    estimated_delivery: Optional[datetime] = None
    actual_delivery: Optional[datetime] = None
    otp: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
