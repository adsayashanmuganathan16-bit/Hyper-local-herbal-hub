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
    delivery_partner_id: Optional[str] = None
    status: DeliveryStatusEnum = DeliveryStatusEnum.ASSIGNED
    current_location: Optional[dict] = None
    estimated_delivery: Optional[datetime] = None
    actual_delivery: Optional[datetime] = None
    otp: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CourierLocationInDB(BaseModel):
    """Latest GPS point for a courier's assigned order."""
    model_config = ConfigDict(populate_by_name=True)
    id: str = Field(alias="_id")
    courier_user_id: str
    delivery_staff_id: str
    order_id: str
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    heading: Optional[float] = None
    speed: Optional[float] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
