from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class DeliveryStatusEnum(str, Enum):
    ASSIGNED = "assigned"
    PICKED_UP = "picked_up"
    IN_TRANSIT = "in_transit"
    NEAR_LOCATION = "near_location"
    DELIVERED = "delivered"
    FAILED = "failed"


class DeliveryInDB(BaseModel):
    id: str = Field(alias="_id")
    order_id: str
    delivery_partner_id: Optional[str] = None
    status: DeliveryStatusEnum = DeliveryStatusEnum.ASSIGNED
    current_location: Optional[dict] = None
    estimated_delivery: Optional[datetime] = None
    actual_delivery: Optional[datetime] = None
    otp: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}