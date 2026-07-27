from app.utils.time import utc_now
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Query
from datetime import datetime, timedelta
from app.database import get_db
from app.middleware.auth_middleware import require_customer, require_admin
from app.services.s3_service import s3_service
from app.utils.helpers import serialize_doc, paginate

router = APIRouter(prefix="/api/prescriptions", tags=["Prescription Management"])


@router.post("/upload")
async def upload_prescription(
    file: UploadFile = File(...),
    notes: str = None,
    current_user: dict = Depends(require_customer),
):
    """Upload a prescription image."""
    db = get_db()

    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP, and PDF files allowed")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=400, detail="File size must be under 10MB")

    # Upload to S3
    image_url = await s3_service.upload_image(content, "prescriptions", file.content_type)

    # Save to DB
    doc = {
        "user_id": current_user["_id"],
        "image_url": image_url,
        "file_name": file.filename,
        "status": "uploaded",
        "verified_by": None,
        "rejection_reason": None,
        "notes": notes,
        "created_at": utc_now(),
        "verified_at": None,
        "expires_at": utc_now() + timedelta(days=90),
    }

    result = await db.prescriptions.insert_one(doc)

    return {"message": "Prescription uploaded", "id": str(result.inserted_id), "image_url": image_url}


@router.get("/")
async def get_my_prescriptions(
    page: int = Query(1, ge=1),
    current_user: dict = Depends(require_customer),
):
    """Get current user's prescriptions."""
    db = get_db()
    cursor = db.prescriptions.find({"user_id": current_user["_id"]}).sort([("created_at", -1)])
    prescriptions = await cursor.to_list(length=None)
    result = paginate(prescriptions, page, 10)
    result["items"] = [serialize_doc(p) for p in result["items"]]
    return result


@router.get("/{prescription_id}")
async def get_prescription(prescription_id: str, current_user: dict = Depends(require_customer)):
    """Get a specific prescription."""
    db = get_db()
    from bson import ObjectId

    prescription = await db.prescriptions.find_one({"_id": ObjectId(prescription_id), "user_id": current_user["_id"]})
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")
    return serialize_doc(prescription)


# Admin endpoints
@router.get("/admin/all")
async def get_all_prescriptions(
    status: str = Query(None),
    page: int = Query(1, ge=1),
    current_user: dict = Depends(require_admin),
):
    """Get all prescriptions (admin only)."""
    db = get_db()
    query = {}
    if status:
        query["status"] = status

    cursor = db.prescriptions.find(query).sort([("created_at", -1)])
    prescriptions = await cursor.to_list(length=None)
    result = paginate(prescriptions, page, 20)
    result["items"] = [serialize_doc(p) for p in result["items"]]
    return result


@router.put("/admin/{prescription_id}/verify")
async def verify_prescription(
    prescription_id: str,
    body: dict,  # { status: "approved"|"rejected", rejection_reason? }
    current_user: dict = Depends(require_admin),
):
    """Verify or reject a prescription (admin only)."""
    db = get_db()
    from bson import ObjectId

    new_status = body.get("status")
    if new_status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")

    update = {
        "status": new_status,
        "verified_by": current_user["_id"],
        "verified_at": utc_now(),
        "updated_at": utc_now(),
    }
    if new_status == "rejected" and body.get("rejection_reason"):
        update["rejection_reason"] = body["rejection_reason"]

    result = await db.prescriptions.update_one({"_id": ObjectId(prescription_id)}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Prescription not found")

    # Notify user
    prescription = await db.prescriptions.find_one({"_id": ObjectId(prescription_id)})
    if prescription:
        await db.notifications.insert_one({
            "user_id": prescription["user_id"],
            "type": "prescription",
            "title": f"Prescription {new_status.title()}",
            "message": f"Your prescription has been {new_status}." + (f" Reason: {body.get('rejection_reason', '')}" if new_status == "rejected" else ""),
            "is_read": False,
            "link": "/prescriptions",
            "created_at": utc_now(),
        })

        # Send email
        from app.services.email_service import email_service
        user = await db.users.find_one({"_id": prescription["user_id"]})
        if user:
            await email_service.send_prescription_status(
                user["email"], new_status, body.get("rejection_reason")
            )

    return {"message": f"Prescription {new_status}"}
