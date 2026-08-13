import asyncio
from types import SimpleNamespace

import pytest
from bson import ObjectId

from app.services.inventory_service import reserve_inventory


class FakeMedicines:
    def __init__(self, results):
        self.results = list(results)
        self.updates = []

    async def update_one(self, query, update):
        self.updates.append((query, update))
        return SimpleNamespace(modified_count=self.results.pop(0))


def item(name, quantity=2):
    return {"medicine_id": str(ObjectId()), "name": name, "quantity": quantity}


def test_inventory_is_decremented_atomically():
    medicines = FakeMedicines([1, 1])
    products = [item("Moringa", 2), item("Turmeric", 3)]

    asyncio.run(reserve_inventory(SimpleNamespace(medicines=medicines), products))

    assert medicines.updates[0][0]["stock"] == {"$gte": 2}
    assert medicines.updates[0][1] == {"$inc": {"stock": -2}}
    assert medicines.updates[1][1] == {"$inc": {"stock": -3}}


def test_partial_inventory_reservation_is_rolled_back():
    medicines = FakeMedicines([1, 0, 1])
    products = [item("Moringa", 2), item("Turmeric", 3)]

    with pytest.raises(ValueError, match="Insufficient stock for Turmeric"):
        asyncio.run(reserve_inventory(SimpleNamespace(medicines=medicines), products))

    assert medicines.updates[2][1] == {"$inc": {"stock": 2}}
