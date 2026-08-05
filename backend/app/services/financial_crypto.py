import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings


def _cipher() -> Fernet:
    key = settings.DATA_ENCRYPTION_KEY.strip()
    if not key or key == "your_fernet_encryption_key":
        # Keeps local development usable; production must set a dedicated key.
        key = base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode()).digest()).decode()
    try:
        return Fernet(key.encode())
    except ValueError as exc:
        raise RuntimeError(
            "DATA_ENCRYPTION_KEY must be a valid Fernet key; generate one with "
            "`python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"`"
        ) from exc


def encrypt_sensitive(value: str) -> str:
    return _cipher().encrypt(value.encode()).decode()


def decrypt_sensitive(value: str) -> str:
    try:
        return _cipher().decrypt(value.encode()).decode()
    except InvalidToken as exc:
        raise RuntimeError("Unable to decrypt protected seller data") from exc
