import logging
from io import BytesIO

from PIL import Image, UnidentifiedImageError

from app.services.s3_service import s3_service


logger = logging.getLogger(__name__)

IMAGE_SIGNATURES = {
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/webp": (b"RIFF",),
}
class ProfileImageStorageError(RuntimeError):
    """Raised when a validated profile image cannot be persisted."""


def has_valid_image_signature(data: bytes, content_type: str) -> bool:
    signatures = IMAGE_SIGNATURES.get(content_type, ())
    if content_type == "image/webp":
        return data.startswith(b"RIFF") and data[8:12] == b"WEBP"
    return any(data.startswith(signature) for signature in signatures)


def is_decodable_image(data: bytes, content_type: str) -> bool:
    """Verify that image bytes decode and match the declared media type."""
    expected_formats = {
        "image/jpeg": "JPEG",
        "image/png": "PNG",
        "image/webp": "WEBP",
    }
    try:
        with Image.open(BytesIO(data)) as image:
            if image.format != expected_formats.get(content_type):
                return False
            image.verify()
        return True
    except (Image.DecompressionBombError, UnidentifiedImageError, OSError, ValueError):
        return False


async def save_profile_image(data: bytes, content_type: str) -> str:
    """Persist a profile image in S3 and return its canonical object URL."""
    try:
        return await s3_service.upload_image(data, "profile-images", content_type)
    except Exception as exc:
        logger.exception("Profile image upload to S3 failed")
        raise ProfileImageStorageError("Unable to store the profile image.") from exc
