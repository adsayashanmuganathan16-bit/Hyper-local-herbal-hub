import logging
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from PIL import Image, UnidentifiedImageError

from app.config import BACKEND_DIR, settings
from app.services.s3_service import s3_service


logger = logging.getLogger(__name__)

IMAGE_SIGNATURES = {
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/webp": (b"RIFF",),
}
IMAGE_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
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
    """Persist a profile image and return its public URL."""
    if settings.PROFILE_IMAGE_STORAGE == "s3":
        try:
            return await s3_service.upload_image(data, "profile-images", content_type)
        except Exception as exc:
            logger.exception("Profile image upload to S3 failed")
            raise ProfileImageStorageError("Unable to store the profile image.") from exc

    upload_dir = Path(settings.PROFILE_IMAGE_UPLOAD_DIR)
    if not upload_dir.is_absolute():
        upload_dir = BACKEND_DIR / upload_dir
    try:
        upload_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{uuid4().hex}{IMAGE_EXTENSIONS[content_type]}"
        target = upload_dir / filename
        target.write_bytes(data)
        return f"{settings.BACKEND_PUBLIC_URL}/uploads/profile-images/{filename}"
    except OSError as exc:
        logger.exception("Local profile image storage failed")
        raise ProfileImageStorageError("Unable to store the profile image.") from exc
