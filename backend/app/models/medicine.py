from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum


class CategoryEnum(str, Enum):
    AYURVEDIC = "Ayurvedic"
    UNANI = "Unani"
    SIDDHA = "Siddha"
    HOMEOPATHIC = "Homeopathic"
    HERBAL_SUPPLEMENTS = "Herbal Supplements"
    HERBAL_SKINCARE = "Herbal Skincare"
    HERBAL_HAIRCARE = "Herbal Haircare"
    HERBAL_FOOD = "Herbal Food & Beverages"
    ESSENTIAL_OILS = "Essential Oils"
    HERBAL_FIRST_AID = "Herbal First Aid"


class MedicineCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str
    category: CategoryEnum
    price: float = Field(..., gt=0)
    discount_price: Optional[float] = Field(None, gt=0)
    stock: int = Field(..., ge=0)
    weight_grams: int = Field(..., gt=0, le=2000)
    requires_prescription: bool = False
    manufacturer: str
    ingredients: List[str] = []
    dosage: Optional[str] = None
    benefits: List[str] = []
    side_effects: List[str] = []
    images: List[str] = []
    tags: List[str] = []


class MedicineUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[CategoryEnum] = None
    price: Optional[float] = Field(None, gt=0)
    discount_price: Optional[float] = None
    stock: Optional[int] = Field(None, ge=0)
    weight_grams: Optional[int] = Field(None, gt=0, le=2000)
    requires_prescription: Optional[bool] = None
    manufacturer: Optional[str] = None
    ingredients: Optional[List[str]] = None
    dosage: Optional[str] = None
    benefits: Optional[List[str]] = None
    side_effects: Optional[List[str]] = None
    images: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    is_active: Optional[bool] = None


class MedicineInDB(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str = Field(alias="_id")
    name: str
    description: str
    category: CategoryEnum
    price: float
    discount_price: Optional[float] = None
    stock: int
    weight_grams: int = Field(gt=0, le=2000)
    requires_prescription: bool = False
    manufacturer: str
    seller_id: Optional[str] = None
    seller_name: Optional[str] = None
    ingredients: List[str] = []
    dosage: Optional[str] = None
    benefits: List[str] = []
    side_effects: List[str] = []
    images: List[str] = []
    tags: List[str] = []
    average_rating: float = 0.0
    review_count: int = 0
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
