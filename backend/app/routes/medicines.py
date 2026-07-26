from app.utils.time import utc_now
from fastapi import APIRouter, HTTPException, Query, Depends, UploadFile, File
from typing import Optional, List
from datetime import datetime
from app.database import get_db
from app.models.medicine import MedicineCreate, MedicineUpdate, CategoryEnum
from app.middleware.auth_middleware import require_product_manager
from app.services.s3_service import s3_service
from app.utils.helpers import serialize_doc, paginate

router = APIRouter(prefix="/api/medicines", tags=["Medicines"])


async def with_seller_locations(db, medicines):
    seller_ids = list({str(row.get("seller_id")) for row in medicines if row.get("seller_id")})
    sellers = await db.sellers.find({"user_id": {"$in": seller_ids}}, {"user_id": 1, "store_name": 1,
        "business_name": 1, "address": 1, "latitude": 1, "longitude": 1}).to_list(length=None)
    by_user = {row["user_id"]: row for row in sellers}
    for medicine in medicines:
        seller = by_user.get(str(medicine.get("seller_id")))
        if seller:
            medicine["seller"] = {"name": seller.get("store_name", seller.get("business_name")),
                "address": seller.get("address"), "latitude": seller.get("latitude"), "longitude": seller.get("longitude")}
    return medicines


@router.get("/")
async def search_medicines(
    q: Optional[str] = Query(None, description="Search by name, description, tags"),
    category: Optional[CategoryEnum] = Query(None),
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    available_only: bool = Query(False),
    requires_prescription: Optional[bool] = Query(None),
    sort_by: str = Query("relevance", regex="^(relevance|price_low|price_high|rating|newest)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
):
    """Search and filter medicines with pagination."""
    db = get_db()
    query = {"is_active": True}

    # Text search
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"tags": {"$regex": q, "$options": "i"}},
            {"manufacturer": {"$regex": q, "$options": "i"}},
        ]

    # Category filter
    if category:
        query["category"] = category.value

    # Price filter
    if min_price is not None or max_price is not None:
        price_query = {}
        if min_price is not None:
            price_query["$gte"] = min_price
        if max_price is not None:
            price_query["$lte"] = max_price
        query["price"] = price_query

    # Availability filter
    if available_only:
        query["stock"] = {"$gt": 0}

    # Prescription filter
    if requires_prescription is not None:
        query["requires_prescription"] = requires_prescription

    # Sort
    sort_mapping = {
        "price_low": [("price", 1)],
        "price_high": [("price", -1)],
        "rating": [("average_rating", -1)],
        "newest": [("created_at", -1)],
        "relevance": [("average_rating", -1), ("review_count", -1)],
    }
    sort = sort_mapping.get(sort_by, sort_mapping["relevance"])

    cursor = db.medicines.find(query).sort(sort)
    medicines = await cursor.to_list(length=None)
    result = paginate(medicines, page, page_size)
    await with_seller_locations(db, result["items"])

    # Serialize
    result["items"] = [serialize_doc(m) for m in result["items"]]

    return result


@router.get("/categories")
async def get_categories():
    """Get all available medicine categories."""
    categories = [
        {"value": cat.value, "label": cat.value.replace("_", " ").title()}
        for cat in CategoryEnum
    ]
    return categories


@router.get("/{medicine_id}")
async def get_medicine(medicine_id: str):
    """Get a single medicine by ID."""
    db = get_db()
    from bson import ObjectId
    medicine = await db.medicines.find_one({"_id": ObjectId(medicine_id)})
    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found")
    await with_seller_locations(db, [medicine])
    return serialize_doc(medicine)


@router.post("/", status_code=201)
async def create_medicine(
    medicine_data: MedicineCreate,
    current_user: dict = Depends(require_product_manager),
):
    """Create a medicine as an admin or seller."""
    db = get_db()
    doc = medicine_data.model_dump()
    if current_user.get("role") == "seller":
        doc["seller_id"] = current_user["_id"]
        doc["seller_name"] = current_user.get("business_name") or current_user.get("name")
    doc["average_rating"] = 0.0
    doc["review_count"] = 0
    doc["is_active"] = True
    doc["created_at"] = utc_now()
    doc["updated_at"] = utc_now()

    result = await db.medicines.insert_one(doc)
    return {"message": "Medicine created", "id": str(result.inserted_id)}


@router.put("/{medicine_id}")
async def update_medicine(
    medicine_id: str,
    medicine_data: MedicineUpdate,
    current_user: dict = Depends(require_product_manager),
):
    """Update a medicine (admin only)."""
    db = get_db()
    from bson import ObjectId

    update_fields = {k: v for k, v in medicine_data.model_dump().items() if v is not None}
    update_fields["updated_at"] = utc_now()

    query = {"_id": ObjectId(medicine_id)}
    if current_user.get("role") == "seller":
        query["seller_id"] = current_user["_id"]
    result = await db.medicines.update_one(query, {"$set": update_fields})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Medicine not found")
    return {"message": "Medicine updated"}


@router.delete("/{medicine_id}")
async def delete_medicine(
    medicine_id: str,
    current_user: dict = Depends(require_product_manager),
):
    """Soft delete a medicine (admin only)."""
    db = get_db()
    from bson import ObjectId

    query = {"_id": ObjectId(medicine_id)}
    if current_user.get("role") == "seller":
        query["seller_id"] = current_user["_id"]
    result = await db.medicines.update_one(query, {"$set": {"is_active": False, "updated_at": utc_now()}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Medicine not found")
    return {"message": "Medicine deleted"}


@router.post("/{medicine_id}/images")
async def upload_medicine_images(
    medicine_id: str,
    files: List[UploadFile] = File(...),
    current_user: dict = Depends(require_product_manager),
):
    """Upload medicine images to S3."""
    db = get_db()
    from bson import ObjectId

    image_urls = []
    for file in files:
        content = await file.read()
        url = await s3_service.upload_image(content, "medicines", file.content_type)
        image_urls.append(url)

    query = {"_id": ObjectId(medicine_id)}
    if current_user.get("role") == "seller":
        query["seller_id"] = current_user["_id"]
    result = await db.medicines.update_one(query, {"$push": {"images": {"$each": image_urls}}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Medicine not found")
    return {"message": f"{len(image_urls)} images uploaded", "urls": image_urls}


@router.get("/featured/list")
async def get_featured_medicines():
    """Get featured/highly-rated medicines for homepage."""
    db = get_db()
    cursor = db.medicines.find(
        {"is_active": True, "stock": {"$gt": 0}, "average_rating": {"$gte": 4.0}}
    ).sort([("average_rating", -1)]).limit(8)
    medicines = await cursor.to_list(length=None)
    await with_seller_locations(db, medicines)
    return [serialize_doc(m) for m in medicines]
