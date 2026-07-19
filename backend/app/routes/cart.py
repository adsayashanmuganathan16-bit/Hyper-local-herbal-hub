from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from app.database import get_db
from app.middleware.auth_middleware import get_current_user
from app.utils.helpers import calculate_cart_totals, serialize_doc

router = APIRouter(prefix="/api/cart", tags=["Shopping Cart"])


@router.get("/")
async def get_cart(current_user: dict = Depends(get_current_user)):
    """Get current user's cart."""
    db = get_db()
    cart = await db.carts.find_one({"user_id": current_user["_id"]})
    if not cart:
        return {"items": [], "total_items": 0, "total_amount": 0.0}
    return serialize_doc(cart)


@router.post("/add")
async def add_to_cart(
    body: dict,  # { medicine_id, name, price, discount_price?, quantity, image?, requires_prescription? }
    current_user: dict = Depends(get_current_user),
):
    """Add an item to the cart or update quantity if exists."""
    db = get_db()
    medicine_id = body["medicine_id"]
    quantity = body.get("quantity", 1)

    cart = await db.carts.find_one({"user_id": current_user["_id"]})

    if cart:
        # Check if item already in cart
        existing_item = None
        for item in cart["items"]:
            if item["medicine_id"] == medicine_id:
                existing_item = item
                break

        if existing_item:
            # Update quantity
            await db.carts.update_one(
                {"user_id": current_user["_id"], "items.medicine_id": medicine_id},
                {"$inc": {"items.$.quantity": quantity}, "$set": {"updated_at": datetime.utcnow()}},
            )
        else:
            # Add new item
            cart_item = {
                "medicine_id": medicine_id,
                "name": body["name"],
                "price": body["price"],
                "discount_price": body.get("discount_price"),
                "quantity": quantity,
                "image": body.get("image"),
                "requires_prescription": body.get("requires_prescription", False),
            }
            await db.carts.update_one(
                {"user_id": current_user["_id"]},
                {"$push": {"items": cart_item}, "$set": {"updated_at": datetime.utcnow()}},
            )
    else:
        # Create new cart
        cart_item = {
            "medicine_id": medicine_id,
            "name": body["name"],
            "price": body["price"],
            "discount_price": body.get("discount_price"),
            "quantity": quantity,
            "image": body.get("image"),
            "requires_prescription": body.get("requires_prescription", False),
        }
        await db.carts.insert_one({
            "user_id": current_user["_id"],
            "items": [cart_item],
            "total_items": quantity,
            "total_amount": body.get("discount_price", body["price"]) * quantity,
            "updated_at": datetime.utcnow(),
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
    current_user: dict = Depends(get_current_user),
):
    """Update quantity of a cart item."""
    db = get_db()
    quantity = body.get("quantity", 1)

    if quantity <= 0:
        return await remove_from_cart(medicine_id, current_user)

    await db.carts.update_one(
        {"user_id": current_user["_id"], "items.medicine_id": medicine_id},
        {"$set": {"items.$.quantity": quantity, "updated_at": datetime.utcnow()}},
    )

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
    current_user: dict = Depends(get_current_user),
):
    """Remove an item from the cart."""
    db = get_db()

    await db.carts.update_one(
        {"user_id": current_user["_id"]},
        {"$pull": {"items": {"medicine_id": medicine_id}}, "$set": {"updated_at": datetime.utcnow()}},
    )

    cart = await db.carts.find_one({"user_id": current_user["_id"]})
    totals = calculate_cart_totals(cart["items"]) if cart and cart["items"] else {"total_items": 0, "total_amount": 0.0}
    await db.carts.update_one(
        {"user_id": current_user["_id"]},
        {"$set": {"total_items": totals["total_items"], "total_amount": totals["total_amount"]}},
    )

    return {"message": "Item removed", "totals": totals}


@router.delete("/clear")
async def clear_cart(current_user: dict = Depends(get_current_user)):
    """Clear the entire cart."""
    db = get_db()
    await db.carts.delete_one({"user_id": current_user["_id"]})
    return {"message": "Cart cleared"}