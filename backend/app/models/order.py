from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum


class OrderStatusEnum(str, Enum):
    PREPARING = "preparing"
    READY_FOR_PICKUP = "ready_for_pickup"
    DELIVERY_ASSIGNED = "delivery_assigned"
    PICKUP_ACCEPTED = "pickup_accepted"
    PICKED_UP = "picked_up"
    ON_THE_WAY = "on_the_way"
    PLACED = "placed"
    CONFIRMED = "confirmed"
    PACKED = "packed"
    SHIPPED = "shipped"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    RETURNED = "returned"


class PaymentStatusEnum(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"


class PaymentMethodEnum(str, Enum):
    STRIPE = "stripe"
    PAYHERE = "payhere"
    ONEPAY = "onepay"
    MOCK = "mock"
    CARD = "card"
    UPI = "upi"
    COD = "cod"
    NET_BANKING = "net_banking"


class OrderItem(BaseModel):
    medicine_id: str
    name: str
    price: float
    quantity: int
    image: Optional[str] = None
    weight_grams: Optional[int] = Field(default=None, gt=0)


class OrderCreate(BaseModel):
    items: List[OrderItem]
    address: dict
    payment_method: PaymentMethodEnum
    prescription_id: Optional[str] = None
    notes: Optional[str] = None
    customer_latitude: float = Field(ge=-90, le=90)
    customer_longitude: float = Field(ge=-180, le=180)
    customer_address: Optional[dict] = None
    landmark: Optional[str] = Field(default=None, max_length=250)
    delivery_note: Optional[str] = Field(default=None, max_length=500)

    @field_validator("payment_method")
    @classmethod
    def validate_checkout_payment(cls, value: PaymentMethodEnum):
        if value not in {PaymentMethodEnum.STRIPE, PaymentMethodEnum.COD}:
            raise ValueError("Choose Stripe or Cash on Delivery")
        return value

    @field_validator("address")
    @classmethod
    def validate_delivery_address(cls, value: dict):
        required = ("name", "phone", "address_line1", "city", "state", "pincode")
        cleaned = {key: str(item).strip() for key, item in value.items() if item is not None}
        missing = [key for key in required if len(cleaned.get(key, "")) < 2]
        if missing:
            raise ValueError(f"Missing delivery details: {', '.join(missing)}")
        phone = cleaned["phone"].replace(" ", "").replace("-", "")
        if phone.startswith("+94"):
            phone = "0" + phone[3:]
        elif phone.startswith("94"):
            phone = "0" + phone[2:]
        if len(phone) != 10 or not phone.isdigit() or not phone.startswith("0"):
            raise ValueError("Enter a valid Sri Lankan phone number")
        if len(cleaned["pincode"]) != 5 or not cleaned["pincode"].isdigit():
            raise ValueError("Enter a valid 5-digit Sri Lankan postal code")
        cleaned["phone"] = phone
        return cleaned


class OrderInDB(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str = Field(alias="_id")
    user_id: str
    items: List[OrderItem]
    total_amount: float
    discount: float = 0.0
    delivery_charge: float = 0.0
    parcel_weight: int = Field(default=0, ge=0)
    shipping_fee: float = Field(default=0.0, ge=0)
    courier_service: Optional[str] = None
    tracking_number: Optional[str] = None
    shipping_date: Optional[datetime] = None
    delivery_status: str = "pending"
    last_status_updated: Optional[datetime] = None
    customer_confirmed_received: bool = False
    customer_received_at: Optional[datetime] = None
    customer_reported_not_received: bool = False
    not_received_reported_at: Optional[datetime] = None
    final_amount: float
    address: dict
    payment_method: PaymentMethodEnum
    payment_status: PaymentStatusEnum = PaymentStatusEnum.PENDING
    payment_id: Optional[str] = None
    status: OrderStatusEnum = OrderStatusEnum.PLACED
    prescription_id: Optional[str] = None
    notes: Optional[str] = None
    invoice_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
