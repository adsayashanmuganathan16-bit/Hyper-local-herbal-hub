import asyncio

import pytest
from fastapi import HTTPException

from app.middleware.auth_middleware import require_admin, require_customer, require_seller
from app.models.user import UserCreate
from app.routes.auth import PUBLIC_REGISTRATION_ROLES


def run(awaitable):
    return asyncio.run(awaitable)


def test_only_customer_and_seller_can_register_publicly():
    assert PUBLIC_REGISTRATION_ROLES == {"customer", "seller"}
    assert "admin" not in PUBLIC_REGISTRATION_ROLES


def test_seller_registration_requires_store_fields():
    with pytest.raises(ValueError):
        UserCreate(name="Owner", email="owner@example.com", phone="0771234567", password="secret12", role="seller")
    seller = UserCreate(name="Owner", owner_name="Owner", store_name="Store", store_address="Kilinochchi Town",
                        email="owner@example.com", phone="0771234567", password="secret12", role="seller")
    assert seller.role.value == "seller"


def test_role_dependencies_return_403_for_wrong_role():
    assert run(require_admin({"role": "admin"}))["role"] == "admin"
    assert run(require_seller({"role": "seller"}))["role"] == "seller"
    assert run(require_customer({"role": "customer"}))["role"] == "customer"
    for dependency, user in ((require_admin, {"role": "seller"}), (require_seller, {"role": "customer"}),
                             (require_customer, {"role": "admin"})):
        with pytest.raises(HTTPException) as error:
            run(dependency(user))
        assert error.value.status_code == 403
