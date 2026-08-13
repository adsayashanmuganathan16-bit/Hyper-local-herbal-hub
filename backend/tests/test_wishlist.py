import asyncio
from types import SimpleNamespace

import pytest
from bson import ObjectId
from fastapi import HTTPException

from app.routes import wishlist


class FakeMedicines:
    async def find_one(self, query):
        return {"_id": query["_id"], "name": "Herbal product", "is_active": True}


class FakeWishlists:
    def __init__(self, count=0, existing=None):
        self.count = count
        self.existing = existing
        self.updated = False

    async def find_one(self, query):
        return self.existing

    async def count_documents(self, query):
        return self.count

    async def update_one(self, query, update, upsert=False):
        self.updated = True


def test_wishlist_rejects_sixth_product(monkeypatch):
    rows = FakeWishlists(count=wishlist.MAX_WISHLIST_ITEMS)
    monkeypatch.setattr(
        wishlist,
        "get_db",
        lambda: SimpleNamespace(medicines=FakeMedicines(), wishlists=rows),
    )

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            wishlist.add_to_wishlist(
                str(ObjectId()),
                user={"_id": str(ObjectId())},
            )
        )

    assert exc_info.value.status_code == 400
    assert "up to 5 products" in exc_info.value.detail
    assert rows.updated is False


def test_existing_wishlist_product_is_idempotent_at_limit(monkeypatch):
    rows = FakeWishlists(count=wishlist.MAX_WISHLIST_ITEMS, existing={"_id": ObjectId()})
    monkeypatch.setattr(
        wishlist,
        "get_db",
        lambda: SimpleNamespace(medicines=FakeMedicines(), wishlists=rows),
    )

    result = asyncio.run(
        wishlist.add_to_wishlist(
            str(ObjectId()),
            user={"_id": str(ObjectId())},
        )
    )

    assert result["message"] == "Product is already saved"
    assert rows.updated is False
