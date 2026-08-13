from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum


class UserRole(str, Enum):
    CUSTOMER = "customer"
    ADMIN = "admin"
    SELLER = "seller"


class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=15)
    password: str = Field(..., min_length=6)
    role: UserRole = UserRole.CUSTOMER
    store_name: Optional[str] = Field(default=None, min_length=2, max_length=180)
    owner_name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    store_address: Optional[str] = Field(default=None, min_length=5, max_length=500)

    @model_validator(mode="after")
    def seller_fields(self):
        if self.role == UserRole.SELLER and not all((self.store_name, self.owner_name, self.store_address)):
            raise ValueError("Store name, owner name and store address are required for sellers")
        return self


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class GoogleLoginRequest(BaseModel):
    credential: str = Field(..., min_length=100)
    role: UserRole


class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[dict] = None
    profile_image: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)


class VerifyEmailRequest(BaseModel):
    token: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class UserInDB(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str = Field(alias="_id")
    name: str
    email: str
    phone: str
    role: UserRole = UserRole.CUSTOMER
    address: Optional[dict] = None
    profile_image: Optional[str] = None
    is_active: bool = True
    email_verified: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
