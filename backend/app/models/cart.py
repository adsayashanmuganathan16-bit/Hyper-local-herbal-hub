from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class CartItem(BaseModel):
    medicine_id: str
    name: str
    price: float
    discount_price: Optional[float] = None
    quantity: int = Field(..., ge=1)
    image: Optional[str] = None
    requires_prescription: bool = False


class CartInDB(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    items: List[CartItem] = []
    total_items: int = 0
    total_amount: float = 0.0
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}