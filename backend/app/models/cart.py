from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import datetime, timezone


class CartItem(BaseModel):
    medicine_id: str
    name: str
    price: float
    discount_price: Optional[float] = None
    quantity: int = Field(..., ge=1)
    image: Optional[str] = None
    requires_prescription: bool = False


class CartInDB(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str = Field(alias="_id")
    user_id: str
    items: List[CartItem] = []
    total_items: int = 0
    total_amount: float = 0.0
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
