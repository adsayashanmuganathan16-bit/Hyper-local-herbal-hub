from bson import ObjectId


async def reserve_inventory(db, items: list[dict]) -> None:
    """Atomically reduce stock for every item, rolling back partial reserves."""
    reserved = []
    for item in items:
        quantity = int(item["quantity"])
        result = await db.medicines.update_one(
            {
                "_id": ObjectId(item["medicine_id"]),
                "is_active": True,
                "stock": {"$gte": quantity},
            },
            {"$inc": {"stock": -quantity}},
        )
        if not result.modified_count:
            await release_inventory(db, reserved)
            raise ValueError(f"Insufficient stock for {item['name']}")
        reserved.append(item)


async def release_inventory(db, items: list[dict]) -> None:
    """Return previously reserved quantities to their products."""
    for item in items:
        await db.medicines.update_one(
            {"_id": ObjectId(item["medicine_id"])},
            {"$inc": {"stock": int(item["quantity"])}},
        )
