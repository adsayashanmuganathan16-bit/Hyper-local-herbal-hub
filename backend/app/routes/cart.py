from app.utils.time import utc_now
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from app.database import get_db
from app.middleware.auth_middleware import require_customer
from app.utils.helpers import calculate_cart_totals, serialize_doc
from bson import ObjectId
from bson.errors import InvalidId

router = APIRouter(prefix="/api/cart", tags=["Shopping Cart"])


@router.get("/")
async def get_cart(current_user: dict = Depends(require_customer)):
    """Get current user's cart."""
    db = get_db()
    cart = await db.carts.find_one({"user_id": current_user["_id"]})
    if not cart:
        return {"items": [], "total_items": 0, "total_amount": 0.0}
    cart_changed = False
    for item in cart.get("items", []):
        medicine = await db.medicines.find_one({"_id": ObjectId(item["medicine_id"])}) if ObjectId.is_valid(item.get("medicine_id", "")) else None
        seller = await db.sellers.find_one({"user_id": str((medicine or {}).get("seller_id"))}) if medicine else None
        if medicine:
            weight_grams = int(medicine.get("weight_grams", 100))
            if item.get("weight_grams") != weight_grams:
                item["weight_grams"] = weight_grams
                cart_changed = True
            item["seller_id"] = str(medicine.get("seller_id"))
            item["seller_name"] = (seller or {}).get("store_name", (seller or {}).get("business_name", medicine.get("seller_name", "Seller")))
            item["seller_location"] = {"latitude": (seller or {}).get("latitude"), "longitude": (seller or {}).get("longitude"), "address": (seller or {}).get("address")}
    if cart_changed:
        await db.carts.update_one(
            {"_id": cart["_id"]},
            {"$set": {"items": cart["items"], "updated_at": utc_now()}},
        )
    return serialize_doc(cart)


@router.post("/add")
async def add_to_cart(
    body: dict,  # { medicine_id, name, price, discount_price?, quantity, image?, requires_prescription? }
    current_user: dict = Depends(require_customer),
):
    """Add an item to the cart or update quantity if exists."""
    db = get_db()
    medicine_id = body.get("medicine_id")
    quantity = body.get("quantity", 1)
    if not medicine_id or not isinstance(quantity, int) or quantity < 1:
        raise HTTPException(status_code=422, detail="A valid product and quantity are required")
    try:
        medicine = await db.medicines.find_one({"_id": ObjectId(medicine_id), "is_active": True})
    except (InvalidId, TypeError):
        medicine = None
    if not medicine:
        raise HTTPException(status_code=404, detail="Product not found or unavailable")

    unit_price = medicine.get("discount_price") or medicine["price"]
    seller = await db.sellers.find_one({"user_id": str(medicine.get("seller_id"))}) if medicine.get("seller_id") else None
    cart_item = {
        "medicine_id": str(medicine["_id"]), "name": medicine["name"],
        "price": medicine["price"], "discount_price": medicine.get("discount_price"),
        "quantity": quantity,
        "image": medicine.get("images", [None])[0] if medicine.get("images") else None,
        "requires_prescription": medicine.get("requires_prescription", False),
        "weight_grams": int(medicine.get("weight_grams", 100)),
        "seller_id": str(medicine.get("seller_id")),
        "seller_name": (seller or {}).get("store_name", (seller or {}).get("business_name", medicine.get("seller_name", "Seller"))),
        "seller_location": {"latitude": (seller or {}).get("latitude"), "longitude": (seller or {}).get("longitude"),
                            "address": (seller or {}).get("address")},
    }

    cart = await db.carts.find_one({"user_id": current_user["_id"]})

    if cart:
        # Check if item already in cart
        existing_item = None
        for item in cart["items"]:
            if item["medicine_id"] == medicine_id:
                existing_item = item
                break

        if existing_item:
            if existing_item["quantity"] + quantity > medicine.get("stock", 0):
                raise HTTPException(status_code=400, detail=f"Only {medicine.get('stock', 0)} items are available")
            # Update quantity
            await db.carts.update_one(
                {"user_id": current_user["_id"], "items.medicine_id": medicine_id},
                {"$inc": {"items.$.quantity": quantity}, "$set": {"updated_at": utc_now()}},
            )
        else:
            if quantity > medicine.get("stock", 0):
                raise HTTPException(status_code=400, detail=f"Only {medicine.get('stock', 0)} items are available")
            await db.carts.update_one(
                {"user_id": current_user["_id"]},
                {"$push": {"items": cart_item}, "$set": {"updated_at": utc_now()}},
            )
    else:
        # Create new cart
        if quantity > medicine.get("stock", 0):
            raise HTTPException(status_code=400, detail=f"Only {medicine.get('stock', 0)} items are available")
        await db.carts.insert_one({
            "user_id": current_user["_id"],
            "items": [cart_item],
            "total_items": quantity,
            "total_amount": unit_price * quantity,
            "updated_at": utc_now(),
        })
        return {"message": "Item added to cart"}

    # Recalculate totals
    cart = await db.carts.find_one({"user_id": current_user["_id"]})
    totals = calculate_cart_totals(cart["items"])
    await db.carts.update_one(
        {"user_id": current_user["_id"]},
        {"$set": {"total_items": totals["total_items"], "total_amount": totals["total_amount"]}},
    )

    return {"message": "Cart updated", "totals": totals}


@router.put("/update/{medicine_id}")
async def update_cart_item(
    medicine_id: str,
    body: dict,  # { quantity }
    current_user: dict = Depends(require_customer),
):
    """Update quantity of a cart item."""
    db = get_db()
    quantity = body.get("quantity", 1)

    if not isinstance(quantity, int):
        raise HTTPException(status_code=422, detail="Quantity must be a whole number")

    if quantity <= 0:
        return await remove_from_cart(medicine_id, current_user)

    try:
        medicine = await db.medicines.find_one({"_id": ObjectId(medicine_id), "is_active": True})
    except (InvalidId, TypeError):
        medicine = None
    if not medicine:
        raise HTTPException(status_code=404, detail="Product not found or unavailable")
    if quantity > medicine.get("stock", 0):
        raise HTTPException(status_code=400, detail=f"Only {medicine.get('stock', 0)} items are available")

    result = await db.carts.update_one(
        {"user_id": current_user["_id"], "items.medicine_id": medicine_id},
        {"$set": {"items.$.quantity": quantity, "updated_at": utc_now()}},
    )
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Cart item not found")

    cart = await db.carts.find_one({"user_id": current_user["_id"]})
    totals = calculate_cart_totals(cart["items"])
    await db.carts.update_one(
        {"user_id": current_user["_id"]},
        {"$set": {"total_items": totals["total_items"], "total_amount": totals["total_amount"]}},
    )

    return {"message": "Cart item updated", "totals": totals}


@router.delete("/remove/{medicine_id}")
async def remove_from_cart(
    medicine_id: str,
    current_user: dict = Depends(require_customer),
):
    """Remove an item from the cart."""
    db = get_db()

    await db.carts.update_one(
        {"user_id": current_user["_id"]},
        {"$pull": {"items": {"medicine_id": medicine_id}}, "$set": {"updated_at": utc_now()}},
    )

    cart = await db.carts.find_one({"user_id": current_user["_id"]})
    totals = calculate_cart_totals(cart["items"]) if cart and cart["items"] else {"total_items": 0, "total_amount": 0.0}
    await db.carts.update_one(
        {"user_id": current_user["_id"]},
        {"$set": {"total_items": totals["total_items"], "total_amount": totals["total_amount"]}},
    )

    return {"message": "Item removed", "totals": totals}


@router.delete("/clear")
async def clear_cart(current_user: dict = Depends(require_customer)):
    """Clear the entire cart."""
    db = get_db()
    await db.carts.delete_one({"user_id": current_user["_id"]})
    return {"message": "Cart cleared"}
