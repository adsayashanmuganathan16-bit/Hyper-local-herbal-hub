from app.utils.time import utc_now
from fastapi import APIRouter, HTTPException, Query, Depends
from datetime import datetime
from bson import ObjectId
from pymongo.errors import DuplicateKeyError
from app.database import get_db
from app.models.review import ReviewCreate
from app.middleware.auth_middleware import require_admin, require_customer, require_seller
from app.utils.helpers import serialize_doc, paginate

router = APIRouter(prefix="/api/reviews", tags=["Reviews & Ratings"])


@router.post("/")
async def create_review(review_data: ReviewCreate, current_user: dict = Depends(require_customer)):
    """Create a review for a medicine."""
    db = get_db()
    if not ObjectId.is_valid(review_data.order_id) or not ObjectId.is_valid(review_data.medicine_id):
        raise HTTPException(status_code=400, detail="Invalid order or medicine")

    # Check if user already reviewed this medicine for this order
    existing = await db.reviews.find_one({
        "user_id": current_user["_id"],
        "medicine_id": review_data.medicine_id,
        "order_id": review_data.order_id,
    })
    if existing:
        raise HTTPException(status_code=400, detail="You already reviewed this item for this order")

    # Verify the order belongs to user and is delivered
    order = await db.orders.find_one({"_id": ObjectId(review_data.order_id), "user_id": current_user["_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["status"] != "delivered":
        raise HTTPException(status_code=400, detail="Can only review delivered orders")
    if not order.get("customer_confirmed_received"):
        raise HTTPException(
            status_code=400,
            detail="Confirm that you received the parcel before submitting a review",
        )
    if not any(item.get("medicine_id") == review_data.medicine_id for item in order.get("items", [])):
        raise HTTPException(status_code=400, detail="This medicine is not part of the order")

    # Create review
    review_doc = {
        "user_id": current_user["_id"],
        "user_name": current_user["name"],
        "medicine_id": review_data.medicine_id,
        "order_id": review_data.order_id,
        "rating": review_data.rating,
        "title": review_data.title,
        "comment": review_data.comment,
        "created_at": utc_now(),
    }

    try:
        result = await db.reviews.insert_one(review_doc)
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=409,
            detail="You already reviewed this item for this order",
        ) from exc

    # Recalculate medicine average rating
    pipeline = [
        {"$match": {"medicine_id": review_data.medicine_id}},
        {"$group": {
            "_id": None,
            "avg_rating": {"$avg": "$rating"},
            "count": {"$sum": 1},
        }},
    ]
    rating_result = await db.reviews.aggregate(pipeline).to_list(length=1)
    if rating_result:
        await db.medicines.update_one(
            {"_id": ObjectId(review_data.medicine_id)},
            {"$set": {
                "average_rating": round(rating_result[0]["avg_rating"], 1),
                "review_count": rating_result[0]["count"],
                "updated_at": utc_now(),
            }},
        )

    return {"message": "Review submitted", "id": str(result.inserted_id)}


@router.get("/medicine/{medicine_id}")
async def get_medicine_reviews(
    medicine_id: str,
    page: int = Query(1, ge=1),
):
    """Get reviews for a specific medicine."""
    db = get_db()
    cursor = db.reviews.find({"medicine_id": medicine_id}).sort([("created_at", -1)])
    reviews = await cursor.to_list(length=None)
    result = paginate(reviews, page, 10)
    result["items"] = [serialize_doc(r) for r in result["items"]]
    return result


@router.get("/my-reviews")
async def get_my_reviews(
    page: int = Query(1, ge=1),
    current_user: dict = Depends(require_customer),
):
    """Get current user's reviews."""
    db = get_db()
    cursor = db.reviews.find({"user_id": current_user["_id"]}).sort([("created_at", -1)])
    reviews = await cursor.to_list(length=None)
    result = paginate(reviews, page, 10)
    result["items"] = [serialize_doc(r) for r in result["items"]]
    return result


async def _review_page(db, query: dict, page: int, page_size: int):
    reviews = await db.reviews.find(query).sort([("created_at", -1)]).to_list(length=None)
    result = paginate(reviews, page, page_size)
    medicine_ids = {
        ObjectId(row["medicine_id"])
        for row in result["items"]
        if ObjectId.is_valid(row.get("medicine_id", ""))
    }
    medicines = await db.medicines.find(
        {"_id": {"$in": list(medicine_ids)}},
        {"name": 1, "images": 1, "seller_id": 1},
    ).to_list(length=None) if medicine_ids else []
    medicine_map = {str(row["_id"]): row for row in medicines}
    items = []
    for review in result["items"]:
        medicine = medicine_map.get(review.get("medicine_id"), {})
        item = serialize_doc(review)
        item["medicine_name"] = medicine.get("name", "Unknown product")
        item["medicine_image"] = (medicine.get("images") or [None])[0]
        items.append(item)
    result["items"] = items
    return result


@router.get("/admin/all")
async def get_all_reviews(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_admin),
):
    """Allow admins to view all customer reviews."""
    return await _review_page(get_db(), {}, page, page_size)


@router.get("/seller/all")
async def get_seller_reviews(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_seller),
):
    """Allow sellers to view reviews only for products they own."""
    db = get_db()
    product_ids = [
        str(product["_id"])
        async for product in db.medicines.find({"seller_id": current_user["_id"]}, {"_id": 1})
    ]
    return await _review_page(db, {"medicine_id": {"$in": product_ids}}, page, page_size)
