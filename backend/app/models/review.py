from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime, timezone


class ReviewCreate(BaseModel):
    medicine_id: str
    order_id: str
    rating: int = Field(..., ge=1, le=5)
    title: Optional[str] = None
    comment: str = Field(..., min_length=5)


class ReviewInDB(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str = Field(alias="_id")
    user_id: str
    user_name: str
    medicine_id: str
    order_id: str
    rating: int
    title: Optional[str] = None
    comment: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
