from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.database import get_db
from app.middleware.auth_middleware import require_customer
from app.utils.helpers import get_product_image, serialize_doc
from app.utils.time import utc_now

router = APIRouter(prefix="/api/wishlist", tags=["Wishlist"])


def product_view(medicine: dict) -> dict:
    item = serialize_doc(medicine)
    item["image"] = get_product_image(medicine)
    item["image_url"] = item["image"]
    return item


@router.get("/")
async def get_wishlist(user=Depends(require_customer)):
    db = get_db()
    rows = await db.wishlists.find({"user_id": user["_id"]}).sort("created_at", -1).to_list(length=None)
    ids = [ObjectId(row["medicine_id"]) for row in rows if ObjectId.is_valid(row.get("medicine_id", ""))]
    products = await db.medicines.find({"_id": {"$in": ids}, "is_active": True}).to_list(length=None)
    by_id = {str(product["_id"]): product for product in products}
    items = [product_view(by_id[row["medicine_id"]]) for row in rows if row["medicine_id"] in by_id]
    return {"items": items, "total_items": len(items)}


@router.post("/{medicine_id}", status_code=201)
async def add_to_wishlist(medicine_id: str, user=Depends(require_customer)):
    if not ObjectId.is_valid(medicine_id):
        raise HTTPException(404, "Product not found")
    db, now = get_db(), utc_now()
    medicine = await db.medicines.find_one({"_id": ObjectId(medicine_id), "is_active": True})
    if not medicine:
        raise HTTPException(404, "Product not found or unavailable")
    await db.wishlists.update_one(
        {"user_id": user["_id"], "medicine_id": medicine_id},
        {"$setOnInsert": {"user_id": user["_id"], "medicine_id": medicine_id, "created_at": now}},
        upsert=True,
    )
    return {"message": "Product saved to wishlist", "medicine_id": medicine_id}


@router.delete("/{medicine_id}")
async def remove_from_wishlist(medicine_id: str, user=Depends(require_customer)):
    await get_db().wishlists.delete_one({"user_id": user["_id"], "medicine_id": medicine_id})
    return {"message": "Product removed from wishlist", "medicine_id": medicine_id}


@router.delete("/")
async def clear_wishlist(user=Depends(require_customer)):
    await get_db().wishlists.delete_many({"user_id": user["_id"]})
    return {"message": "Wishlist cleared"}
