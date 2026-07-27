from app.utils.time import utc_now
from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.database import get_db
from app.middleware.auth_middleware import require_admin
from app.services.service_area_service import validate_service_address, validate_service_coordinates
from app.utils.helpers import serialize_doc

router = APIRouter(prefix="/api/service-areas", tags=["Service Areas"])


class AddressValidation(BaseModel):
    address_line1: str
    address_line2: str | None = None
    city: str
    state: str
    pincode: str


class ServiceAreaInput(BaseModel):
    name: str = Field(min_length=2)
    accepted_names: list[str] = Field(min_length=1)
    bbox: list[float] | None = None
    polygon: list[list[float]] | None = None
    is_active: bool = True


class CoordinateValidation(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


@router.post("/validate")
async def validate_address(data: AddressValidation):
    return await validate_service_address(get_db(), data.model_dump())


@router.post("/validate-location")
async def validate_location(data: CoordinateValidation):
    return await validate_service_coordinates(get_db(), data.latitude, data.longitude)


@router.get("/active")
async def active_area():
    row = await get_db().service_areas.find_one({"is_active": True})
    if not row:
        raise HTTPException(404, "No delivery service area is active")
    return {"id": str(row["_id"]), "name": row["name"], "center_latitude": row.get("center_latitude"),
            "center_longitude": row.get("center_longitude")}


@router.get("")
async def list_areas(_=Depends(require_admin)):
    rows = await get_db().service_areas.find({}).sort("name", 1).to_list(length=None)
    return {"items": [serialize_doc(row) for row in rows]}


@router.post("")
async def create_area(data: ServiceAreaInput, _=Depends(require_admin)):
    doc = {**data.model_dump(), "created_at": utc_now(), "updated_at": utc_now()}
    result = await get_db().service_areas.insert_one(doc)
    return serialize_doc({**doc, "_id": result.inserted_id})


@router.put("/{area_id}")
async def update_area(area_id: str, data: ServiceAreaInput, _=Depends(require_admin)):
    result = await get_db().service_areas.update_one({"_id": ObjectId(area_id)}, {"$set": {
        **data.model_dump(), "updated_at": utc_now()}})
    if not result.matched_count:
        raise HTTPException(404, "Service area not found")
    return {"message": "Service area updated"}
