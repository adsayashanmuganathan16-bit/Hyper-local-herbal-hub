import logging

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.config import settings
from app.models.plant import PlantIdentificationResponse
from app.services.gemini_service import (
    GeminiEnrichmentError,
    generate_bilingual_plant_content,
)
from app.services.plantnet_service import (
    PlantNetConfigurationError,
    PlantNetIdentificationError,
    identify_plant,
)

router = APIRouter(prefix="/api/plants", tags=["Plant Identification"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png"}
MAX_IMAGE_SIZE = 10 * 1024 * 1024
logger = logging.getLogger(__name__)
IDENTIFICATION_FAILURE = (
    "Unable to identify this plant accurately.\n"
    "Please upload a clearer image.\n\n"
    "மன்னிக்கவும், இந்த தாவரத்தை துல்லியமாக அடையாளம் காண முடியவில்லை.\n"
    "தயவுசெய்து தெளிவான படத்தை பதிவேற்றவும்."
)


@router.post("/identify", response_model=PlantIdentificationResponse)
async def identify_uploaded_plant(
    image: UploadFile = File(..., description="JPEG or PNG image of one plant"),
):
    """Validate and forward a plant image to Pl@ntNet without storing it."""
    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only JPEG and PNG plant images are supported.",
        )

    # Read one extra byte so oversized uploads can be rejected deterministically.
    contents = await image.read(MAX_IMAGE_SIZE + 1)
    await image.close()
    if not contents:
        raise HTTPException(status_code=400, detail="The uploaded image is empty.")
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="The image must be 10 MB or smaller.",
        )

    try:
        result = await identify_plant(
            image=contents,
            filename=image.filename or "plant.jpg",
            content_type=image.content_type,
        )
        confidence = float(result["confidence"].rstrip("%")) / 100
        if confidence < settings.PLANTNET_MIN_CONFIDENCE:
            raise PlantNetIdentificationError(IDENTIFICATION_FAILURE)
        try:
            # Gemini receives taxonomy text only; the image is sent exclusively
            # to Pl@ntNet and is never forwarded to the language model.
            enrichment = await generate_bilingual_plant_content(
                common_name=result["common_name"],
            )
            tamil_name = enrichment.pop("common_name_tamil", "")
            result.update(enrichment)
            if tamil_name:
                result["common_name_tamil"] = tamil_name
        except GeminiEnrichmentError as exc:
            logger.exception("Gemini plant enrichment failed")
            raise HTTPException(
                status_code=502,
                detail="Plant information generation is temporarily unavailable.",
            ) from exc
        return result
    except PlantNetConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except PlantNetIdentificationError as exc:
        logger.info("Plant identification was inconclusive: %s", exc)
        raise HTTPException(status_code=422, detail=IDENTIFICATION_FAILURE) from exc
