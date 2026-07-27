from enum import Enum

from pydantic import BaseModel, EmailStr, Field


class VehicleType(str, Enum):
    BIKE = "Bike"
    THREE_WHEELER = "Three Wheeler"
    VAN = "Van"


class StaffStatus(str, Enum):
    AVAILABLE = "Available"
    BUSY = "Busy"
    OFFLINE = "Offline"


class DeliveryStaffCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(min_length=10, max_length=15)
    password: str = Field(min_length=6, max_length=128)
    vehicle_type: VehicleType
    nic: str = Field(min_length=10, max_length=12)
    profile_photo: str | None = None


class DeliveryStaffUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    phone: str | None = Field(default=None, min_length=10, max_length=15)
    vehicle_type: VehicleType | None = None
    nic: str | None = Field(default=None, min_length=10, max_length=12)
    profile_photo: str | None = None
    status: StaffStatus | None = None


class DeliveryAssignment(BaseModel):
    order_id: str
    staff_id: str


class DeliveryLocationUpdate(BaseModel):
    order_id: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy: float | None = Field(default=None, ge=0)
    heading: float | None = Field(default=None, ge=0, le=360)
    speed: float | None = Field(default=None, ge=0)


class DeliveryAction(BaseModel):
    action: str
    reason: str | None = None
