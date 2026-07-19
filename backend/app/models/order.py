from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class OrderStatusEnum(str, Enum):
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


class OrderCreate(BaseModel):
    items: List[OrderItem]
    address: dict
    payment_method: PaymentMethodEnum = PaymentMethodEnum.COD
    prescription_id: Optional[str] = None
    notes: Optional[str] = None


class OrderInDB(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    items: List[OrderItem]
    total_amount: float
    discount: float = 0.0
    delivery_charge: float = 0.0
    final_amount: float
    address: dict
    payment_method: PaymentMethodEnum
    payment_status: PaymentStatusEnum = PaymentStatusEnum.PENDING
    payment_id: Optional[str] = None
    status: OrderStatusEnum = OrderStatusEnum.PLACED
    prescription_id: Optional[str] = None
    notes: Optional[str] = None
    invoice_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}