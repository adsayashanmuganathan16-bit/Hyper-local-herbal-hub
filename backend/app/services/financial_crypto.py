import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings


def _cipher() -> Fernet:
    key = settings.DATA_ENCRYPTION_KEY
    if not key:
        # Keeps local development usable; production must set a dedicated key.
        key = base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode()).digest()).decode()
    return Fernet(key.encode())


def encrypt_sensitive(value: str) -> str:
    return _cipher().encrypt(value.encode()).decode()


def decrypt_sensitive(value: str) -> str:
    try:
        return _cipher().decrypt(value.encode()).decode()
    except InvalidToken as exc:
        raise RuntimeError("Unable to decrypt protected seller data") from exc
