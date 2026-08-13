import os
from pathlib import Path

from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BACKEND_DIR / ".env"
load_dotenv(dotenv_path=ENV_FILE)


def _required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(
            f"Missing required environment variable {name}. "
            "Copy backend/.env.example to backend/.env and configure it."
        )
    return value


def _integer(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer.") from exc


def _number(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError as exc:
        raise RuntimeError(f"{name} must be a number.") from exc


class Settings:
    """Validated application settings loaded from backend/.env."""

    MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/herbal_hub")
    DB_NAME = os.getenv("DB_NAME", "herbal_hub")

    SECRET_KEY = _required("SECRET_KEY")
    JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_EXPIRE_MINUTES = _integer("JWT_EXPIRE_MINUTES", 1440)
    JWT_REFRESH_EXPIRE_DAYS = _integer("JWT_REFRESH_EXPIRE_DAYS", 7)
    RESET_TOKEN_EXPIRE_MINUTES = _integer("RESET_TOKEN_EXPIRE_MINUTES", 5)
    EMAIL_VERIFICATION_EXPIRE_HOURS = _integer("EMAIL_VERIFICATION_EXPIRE_HOURS", 24)
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "").strip().lower()
    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")

    AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
    S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "")
    PROFILE_IMAGE_STORAGE = os.getenv("PROFILE_IMAGE_STORAGE", "local").lower()
    PROFILE_IMAGE_UPLOAD_DIR = os.getenv("PROFILE_IMAGE_UPLOAD_DIR", "uploads/profile-images")
    PROFILE_IMAGE_MAX_BYTES = _integer("PROFILE_IMAGE_MAX_BYTES", 5 * 1024 * 1024)

    STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
    STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
    SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = _integer("SMTP_PORT", 587)
    SMTP_USER = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "")

    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
    BACKEND_PUBLIC_URL = os.getenv("BACKEND_PUBLIC_URL", "http://localhost:8000").rstrip("/")
    GEOAPIFY_API_KEY = os.getenv("GEOAPIFY_API_KEY", "")
    INITIAL_SERVICE_AREA_NAME = os.getenv("INITIAL_SERVICE_AREA_NAME", "Kilinochchi District")
    INITIAL_SERVICE_AREA_ALIASES = [
        value.strip()
        for value in os.getenv(
            "INITIAL_SERVICE_AREA_ALIASES", "Kilinochchi District,Kilinochchi"
        ).split(",")
        if value.strip()
    ]
    SERVICE_AREA_REJECTION_MESSAGE = os.getenv(
        "SERVICE_AREA_REJECTION_MESSAGE",
        "Sorry, we currently deliver only within Kilinochchi District.",
    )
    INITIAL_SERVICE_AREA_LATITUDE = _number("INITIAL_SERVICE_AREA_LATITUDE", 9.3803)
    INITIAL_SERVICE_AREA_LONGITUDE = _number("INITIAL_SERVICE_AREA_LONGITUDE", 80.3770)

    PLANTNET_API_KEY = os.getenv("PLANTNET_API_KEY", "")
    PLANTNET_API_URL = os.getenv(
        "PLANTNET_API_URL", "https://my-api.plantnet.org/v2/identify/all"
    )
    PLANTNET_TIMEOUT_SECONDS = _number("PLANTNET_TIMEOUT_SECONDS", 30)
    PLANTNET_MIN_CONFIDENCE = _number("PLANTNET_MIN_CONFIDENCE", 0.20)

    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
    GEMINI_API_BASE_URL = os.getenv(
        "GEMINI_API_BASE_URL", "https://generativelanguage.googleapis.com/v1beta"
    )
    GEMINI_TIMEOUT_SECONDS = _number("GEMINI_TIMEOUT_SECONDS", 60)

    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    DATA_ENCRYPTION_KEY = os.getenv("DATA_ENCRYPTION_KEY", "")
    DEFAULT_COMMISSION_PERCENT = os.getenv("DEFAULT_COMMISSION_PERCENT", "10.00")
    PAYOUT_MODE = os.getenv("PAYOUT_MODE", "manual")
    # Development/demo convenience only. Production must leave this disabled.
    AUTO_VERIFY_SELLERS = os.getenv("AUTO_VERIFY_SELLERS", "false").lower() == "true"

    STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
    STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    STRIPE_SUCCESS_URL = os.getenv(
        "STRIPE_SUCCESS_URL",
        "http://localhost:3000/orders/{order_id}?payment=success&session_id={CHECKOUT_SESSION_ID}",
    )
    STRIPE_CANCEL_URL = os.getenv(
        "STRIPE_CANCEL_URL",
        "http://localhost:3000/orders/{order_id}?payment=cancelled",
    )
    PAYMENT_PROVIDER = os.getenv("PAYMENT_PROVIDER", "stripe").strip().lower()

    def validate_payment_configuration(self) -> None:
        supported = {"stripe"}
        if self.PAYMENT_PROVIDER not in supported:
            raise RuntimeError(
                f"PAYMENT_PROVIDER must be one of: {', '.join(sorted(supported))}."
            )
        required = {
            "stripe": {
                "STRIPE_SECRET_KEY": self.STRIPE_SECRET_KEY,
                "STRIPE_WEBHOOK_SECRET": self.STRIPE_WEBHOOK_SECRET,
            },
        }.get(self.PAYMENT_PROVIDER, {})
        missing = [name for name, value in required.items() if not value.strip()]
        if missing:
            raise RuntimeError(
                f"PAYMENT_PROVIDER={self.PAYMENT_PROVIDER} requires: {', '.join(missing)}."
            )
        if self.PAYMENT_PROVIDER == "stripe":
            if not self.STRIPE_SECRET_KEY.startswith(("sk_test_", "sk_live_")):
                raise RuntimeError("STRIPE_SECRET_KEY must be a Stripe secret key (sk_test_ or sk_live_).")
            if not self.STRIPE_WEBHOOK_SECRET.startswith("whsec_"):
                raise RuntimeError("STRIPE_WEBHOOK_SECRET must be a Stripe endpoint secret (whsec_).")
            if "{order_id}" not in self.STRIPE_SUCCESS_URL or "{CHECKOUT_SESSION_ID}" not in self.STRIPE_SUCCESS_URL:
                raise RuntimeError("STRIPE_SUCCESS_URL must contain {order_id} and {CHECKOUT_SESSION_ID}.")
            if "{order_id}" not in self.STRIPE_CANCEL_URL:
                raise RuntimeError("STRIPE_CANCEL_URL must contain {order_id}.")

    def validate_admin_configuration(self) -> None:
        if bool(self.ADMIN_EMAIL) != bool(self.ADMIN_PASSWORD):
            raise RuntimeError("ADMIN_EMAIL and ADMIN_PASSWORD must be configured together.")
        if self.ADMIN_EMAIL and ("@" not in self.ADMIN_EMAIL or len(self.ADMIN_PASSWORD) < 10):
            raise RuntimeError("Configure a valid ADMIN_EMAIL and an ADMIN_PASSWORD of at least 10 characters.")

    def validate_storage_configuration(self) -> None:
        if self.PROFILE_IMAGE_STORAGE not in {"local", "s3"}:
            raise RuntimeError("PROFILE_IMAGE_STORAGE must be either local or s3.")
        if self.PROFILE_IMAGE_STORAGE == "s3":
            required = {
                "AWS_ACCESS_KEY_ID": self.AWS_ACCESS_KEY_ID,
                "AWS_SECRET_ACCESS_KEY": self.AWS_SECRET_ACCESS_KEY,
                "S3_BUCKET_NAME": self.S3_BUCKET_NAME,
            }
            missing = [name for name, value in required.items() if not value.strip()]
            if missing:
                raise RuntimeError(
                    f"PROFILE_IMAGE_STORAGE=s3 requires: {', '.join(missing)}."
                )


settings = Settings()
