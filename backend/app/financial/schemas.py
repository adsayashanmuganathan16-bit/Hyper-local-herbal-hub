from decimal import Decimal
from datetime import date

from pydantic import BaseModel, EmailStr, Field, field_validator


class SellerRegistration(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(pattern=r"^\+?94\d{9}$")
    nic: str = Field(min_length=10, max_length=12)
    business_name: str = Field(min_length=2, max_length=180)
    bank_name: str = Field(min_length=2, max_length=120)
    branch: str = Field(min_length=2, max_length=120)
    account_holder_name: str = Field(min_length=2, max_length=180)
    account_number: str = Field(min_length=6, max_length=34)
    address: dict

    @field_validator("address")
    @classmethod
    def validate_address(cls, value):
        required = ("address_line1", "city", "state", "pincode")
        if any(not str(value.get(key, "")).strip() for key in required):
            raise ValueError("Complete seller store address is required")
        return value


class SellerAccountRegistration(SellerRegistration):
    password: str = Field(min_length=8, max_length=128)


class BankAccountUpdate(BaseModel):
    bank_name: str = Field(min_length=2, max_length=120)
    branch: str = Field(min_length=2, max_length=120)
    account_holder_name: str = Field(min_length=2, max_length=180)
    account_number: str = Field(min_length=6, max_length=34)


class CommissionUpdate(BaseModel):
    percentage: Decimal = Field(ge=Decimal("0"), le=Decimal("100"))


class ManualPayoutCompletion(BaseModel):
    transaction_reference: str = Field(min_length=3, max_length=150)


class FinancialOrderCreate(BaseModel):
    order_id: str = Field(min_length=1, max_length=64)
    total_amount: Decimal = Field(gt=0)
    seller_amounts: dict[str, Decimal]

    @field_validator("seller_amounts")
    @classmethod
    def validate_allocations(cls, value: dict[str, Decimal]):
        if not value or any(amount <= 0 for amount in value.values()):
            raise ValueError("Seller allocations must contain positive amounts")
        return value


class PaymentCustomer(BaseModel):
    first_name: str = Field(min_length=1)
    last_name: str = Field(default="Customer", min_length=1)
    email: EmailStr
    phone: str = Field(min_length=1)
    address: str = Field(min_length=1)
    city: str = Field(min_length=1)
    country: str = Field(default="Sri Lanka", min_length=1)


class MockCardPayment(BaseModel):
    card_holder_name: str = Field(min_length=2, max_length=120)
    card_number: str = Field(min_length=13, max_length=23)
    expiry_month: int = Field(ge=1, le=12)
    expiry_year: int = Field(ge=date.today().year, le=date.today().year + 20)
    cvv: str = Field(pattern=r"^\d{3,4}$")

    @field_validator("card_number")
    @classmethod
    def normalize_card_number(cls, value: str):
        normalized = value.replace(" ", "").replace("-", "")
        if not normalized.isdigit():
            raise ValueError("Card number must contain only digits")
        return normalized
