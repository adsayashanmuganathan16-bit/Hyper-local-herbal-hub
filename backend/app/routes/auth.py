from app.utils.time import utc_now
from datetime import datetime, timedelta, timezone
import logging

from bson import ObjectId

from fastapi import (
    APIRouter,
    HTTPException,
    status,
    Depends,
    File,
    UploadFile
)

from app.config import settings

from app.database import get_db

from app.models.user import (
    UserCreate,
    UserLogin,
    UserUpdate,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    ChangePasswordRequest,
    VerifyEmailRequest,
    RefreshTokenRequest,
    GoogleLoginRequest,
)

from app.utils.helpers import (
    hash_password,
    verify_password,
    serialize_doc,
    generate_secure_token
)

from app.middleware.auth_middleware import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user
)

from app.services.email_service import email_service
from app.services.s3_service import s3_service
from app.services.profile_image_service import (
    IMAGE_SIGNATURES,
    ProfileImageStorageError,
    has_valid_image_signature,
    is_decodable_image,
    save_profile_image,
)
from app.financial.schemas import BankAccountUpdate
from app.services.financial_crypto import decrypt_sensitive, encrypt_sensitive


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)
logger = logging.getLogger(__name__)
PUBLIC_REGISTRATION_ROLES = {"customer", "seller"}


def google_verification_error_detail(error: Exception) -> str:
    """Turn Google's token errors into safe, actionable client messages."""
    message = str(error).lower()
    if "audience" in message:
        return "Google client ID mismatch. Restart both apps and verify their Google client IDs match."
    if "expired" in message:
        return "The Google sign-in response expired. Please try signing in again."
    if "too early" in message or "clock" in message:
        return "Google sign-in failed because the server clock is incorrect."
    if "issuer" in message:
        return "Google returned a token from an unexpected issuer. Please try again."
    return "Google sign-in could not be verified. Please try again."


def serialize_user(user: dict) -> dict:
    """Serialize a user and make a private S3 profile image browser-readable."""
    serialized = serialize_doc(user)
    if serialized and serialized.get("profile_image"):
        serialized["profile_image"] = s3_service.display_url(
            serialized["profile_image"]
        )
    return serialized


def authentication_response(user: dict, *, onboarding_required: bool = False) -> dict:
    """Return the application's access tokens and safe user profile."""
    user_id = str(user["_id"])
    role = user["role"]
    profile = serialize_user(user)
    profile.pop("password", None)
    profile.pop("verification_token", None)
    profile.pop("verification_token_expires", None)
    profile["id"] = user_id
    profile["onboarding_required"] = onboarding_required
    return {
        "access_token": create_access_token({"sub": user_id, "role": role}),
        "refresh_token": create_refresh_token({"sub": user_id, "role": role}),
        "token_type": "bearer",
        "user": profile,
    }


def bank_account_view(bank: dict | None, reveal: bool = False) -> dict | None:
    if not bank:
        return None
    return {
        "bank_name": bank["bank_name"],
        "branch": bank["branch"],
        "account_holder_name": bank["account_holder_name"],
        "account_number": decrypt_sensitive(bank["account_number_encrypted"])
        if reveal else f"****{bank['account_number_last4']}",
    }


@router.get("/profile/bank-account")
async def get_user_bank_account(current_user=Depends(get_current_user)):
    if current_user.get("role") not in {"customer", "admin"}:
        raise HTTPException(403, "Use seller payment settings for seller bank details")
    bank = await get_db().user_bank_accounts.find_one({"user_id": current_user["_id"]})
    return {"bank_account": bank_account_view(bank)}


@router.put("/profile/bank-account")
async def update_user_bank_account(data: BankAccountUpdate, current_user=Depends(get_current_user)):
    if current_user.get("role") not in {"customer", "admin"}:
        raise HTTPException(403, "Use seller payment settings for seller bank details")
    now = utc_now()
    bank = {
        "user_id": current_user["_id"], "bank_name": data.bank_name, "branch": data.branch,
        "account_holder_name": data.account_holder_name,
        "account_number_encrypted": encrypt_sensitive(data.account_number),
        "account_number_last4": data.account_number[-4:], "updated_at": now,
    }
    await get_db().user_bank_accounts.update_one(
        {"user_id": current_user["_id"]},
        {"$set": bank, "$setOnInsert": {"created_at": now}}, upsert=True,
    )
    return {"message": "Bank account saved securely", "bank_account": bank_account_view(bank)}


async def seller_onboarding_required(db, user: dict) -> bool:
    """A seller cannot use seller tools until the required business profile exists."""
    if user.get("role") != "seller":
        return False
    seller = await db.sellers.find_one({"user_id": str(user["_id"])})
    return not bool(
        seller
        and seller.get("business_name")
        and seller.get("phone")
        and seller.get("address")
        and seller.get("nic_encrypted")
    )


@router.post("/google")
async def google_login(payload: GoogleLoginRequest):
    """Verify a Google ID token and sign in or create a public-role account.

    Admin Google sign-in is limited to an existing admin email; it can never
    create or promote an account.
    """
    if payload.role.value not in {*PUBLIC_REGISTRATION_ROLES, "admin"}:
        raise HTTPException(status_code=403, detail="This role cannot use Google sign-in")
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured")

    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token
        from starlette.concurrency import run_in_threadpool

        google_identity = await run_in_threadpool(
            id_token.verify_oauth2_token,
            payload.credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except ImportError as exc:
        logger.exception("Google sign-in dependency is unavailable")
        raise HTTPException(status_code=503, detail="Google sign-in is unavailable on the server") from exc
    except ValueError as exc:
        logger.warning("Google ID token verification failed: %s", exc)
        raise HTTPException(
            status_code=401,
            detail=google_verification_error_detail(exc),
        ) from exc
    except Exception as exc:
        # Certificate retrieval and other transport failures should not be
        # presented as an invalid account or credential.
        logger.exception("Google ID token verification service failed")
        raise HTTPException(
            status_code=503,
            detail="Could not contact Google to verify sign-in. Please try again shortly.",
        ) from exc

    google_sub = str(google_identity.get("sub", "")).strip()
    email = str(google_identity.get("email", "")).strip().lower()
    if not google_sub or not email or not google_identity.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google did not provide a verified email address")

    db = get_db()
    user = await db.users.find_one({"$or": [{"google_sub": google_sub}, {"email": email}]})
    if user:
        if user.get("role") != payload.role.value:
            raise HTTPException(
                status_code=409,
                detail=f"This account is registered as {user.get('role', 'another role')}. Choose that role to continue.",
            )
        if not user.get("is_active", True):
            raise HTTPException(status_code=403, detail="Account is deactivated")
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"google_sub": google_sub, "email_verified": True, "updated_at": utc_now()}},
        )
        user.update({"google_sub": google_sub, "email_verified": True})
    else:
        if payload.role.value == "admin":
            raise HTTPException(
                status_code=403,
                detail="This Google account is not registered as an administrator",
            )
        now = utc_now()
        user = {
            "name": str(google_identity.get("name") or email.split("@", 1)[0]).strip(),
            "email": email,
            "password": None,
            "role": payload.role.value,
            "google_sub": google_sub,
            "profile_image": google_identity.get("picture"),
            "address": None,
            "is_active": True,
            "email_verified": True,
            "created_at": now,
            "updated_at": now,
        }
        result = await db.users.insert_one(user)
        user["_id"] = result.inserted_id
        if payload.role.value == "seller":
            await db.sellers.insert_one({
                "user_id": str(result.inserted_id),
                "name": user["name"],
                "email": email,
                "phone": "",
                "business_name": "",
                "store_name": "",
                "address": None,
                "approval_status": "PENDING",
                "verification_status": "PENDING",
                "created_at": now,
                "updated_at": now,
            })

    onboarding_required = await seller_onboarding_required(db, user)
    return authentication_response(user, onboarding_required=onboarding_required)


# =========================
# REGISTER
# =========================

@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED
)
async def register(user_data: UserCreate):

    db = get_db()

    if user_data.role.value not in PUBLIC_REGISTRATION_ROLES:
        raise HTTPException(status_code=403, detail="Admin registration is not available publicly")

    # Check email
    existing_email = await db.users.find_one(
        {
            "email": user_data.email
        }
    )

    if existing_email:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )


    # Check phone
    existing_phone = await db.users.find_one(
        {
            "phone": user_data.phone
        }
    )

    if existing_phone:
        raise HTTPException(
            status_code=400,
            detail="Phone already registered"
        )


    seller_location = None
    if user_data.role.value == "seller":
        from app.services.service_area_service import validate_service_address
        seller_location = await validate_service_address(db, {"address_line1": user_data.store_address})

    user_doc = user_data.model_dump(exclude={"store_name", "owner_name", "store_address"})
    if user_data.role.value == "seller":
        user_doc.update({"name": user_data.owner_name, "business_name": user_data.store_name,
                         "store_name": user_data.store_name, "address": {"address_line1": user_data.store_address}})


    # Hash password
    user_doc["password"] = hash_password(
        user_data.password
    )


    # Email verification token
    verification_token = generate_secure_token()
    verification_expires = utc_now() + timedelta(
        hours=settings.EMAIL_VERIFICATION_EXPIRE_HOURS
    )


    # Default fields
    user_doc["is_active"] = True
    user_doc["email_verified"] = False
    user_doc["verification_token"] = verification_token
    user_doc["verification_token_expires"] = verification_expires
    user_doc["address"] = user_doc.get("address")
    user_doc["profile_image"] = None
    user_doc["created_at"] = utc_now()
    user_doc["updated_at"] = utc_now()


    result = await db.users.insert_one(
        user_doc
    )

    if user_data.role.value == "seller":
        now = utc_now()
        await db.sellers.insert_one({"user_id": str(result.inserted_id), "name": user_data.owner_name,
            "email": str(user_data.email), "phone": user_data.phone, "business_name": user_data.store_name,
            "store_name": user_data.store_name, "address": {"address_line1": user_data.store_address},
            "latitude": seller_location["latitude"], "longitude": seller_location["longitude"],
            "service_area_id": seller_location["service_area_id"], "approval_status": "PENDING",
            "created_at": now, "updated_at": now})


    # Send verification email (best-effort — never block registration on SMTP)
    await email_service.send_verification_email(
        user_data.email, user_data.name, verification_token
    )


    token = create_access_token(
        {
            "sub": str(result.inserted_id),
            "role": user_data.role.value
        }
    )

    refresh_token = create_refresh_token(
        {
            "sub": str(result.inserted_id),
            "role": user_data.role.value
        }
    )


    return {

        "message": "Account created successfully",

        "access_token": token,

        "refresh_token": refresh_token,

        "token_type": "bearer",

        "user": {

            "id": str(result.inserted_id),

            "name": user_data.owner_name if user_data.role.value == "seller" else user_data.name,

            "email": user_data.email,

            "phone": user_data.phone,

            "role": user_data.role.value,

            "email_verified": False

        }
    }



# =========================
# LOGIN
# =========================

@router.post("/login")
async def login(
    login_data: UserLogin
):

    db = get_db()


    # Find user
    user = await db.users.find_one(
        {
            "email": login_data.email
        }
    )


    if not user:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is inactive")


    # Verify password
    password_valid = verify_password(
        login_data.password,
        user["password"]
    )


    if not password_valid:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )



    token = create_access_token(
        {
            "sub": str(user["_id"]),
            "role": user["role"]
        }
    )

    refresh_token = create_refresh_token(
        {
            "sub": str(user["_id"]),
            "role": user["role"]
        }
    )


    seller_profile = await db.sellers.find_one({"user_id": str(user["_id"])}) if user.get("role") == "seller" else None
    onboarding_required = await seller_onboarding_required(db, user)
    return {

        "message": "Login successful",

        "access_token": token,

        "refresh_token": refresh_token,

        "token_type": "bearer",

        "user": {

            "id": str(user["_id"]),

            "name": user["name"],

            "email": user["email"],

            "phone": user["phone"],

            "role": user["role"],

            "business_name": user.get("business_name"),
            "store_name": user.get("store_name") or (seller_profile or {}).get("store_name") or (seller_profile or {}).get("business_name"),

            "email_verified": user.get("email_verified", False),

            "onboarding_required": onboarding_required

        }

    }



# =========================
# GET CURRENT USER
# =========================

@router.get("/me")
async def get_profile(
    current_user = Depends(get_current_user)
):

    if current_user.get("role") == "seller":
        db = get_db()
        seller = await db.sellers.find_one({"user_id": current_user["_id"]})
        current_user["store_name"] = current_user.get("store_name") or (seller or {}).get("store_name") or (seller or {}).get("business_name")
        current_user["business_name"] = current_user.get("business_name") or (seller or {}).get("business_name")
        current_user["onboarding_required"] = await seller_onboarding_required(db, current_user)
    return {"user": serialize_user(current_user)}



# =========================
# UPDATE PROFILE
# =========================

@router.put("/profile")
async def update_profile(
    user_data: UserUpdate,
    current_user = Depends(get_current_user)
):

    db = get_db()


    update_data = user_data.model_dump(
        exclude_unset=True
    )

    seller_location = None
    if current_user.get("role") == "seller" and update_data.get("address"):
        # A seller's written profile address and map pin are one piece of data.
        # Geocode before saving so the dashboard can never retain stale/default
        # coordinates after an address edit.
        from app.services.service_area_service import validate_service_address
        seller_location = await validate_service_address(db, update_data["address"])


    update_data["updated_at"] = utc_now()


    user_id = ObjectId(current_user["_id"])


    await db.users.update_one(

        {
            "_id": user_id
        },

        {
            "$set": update_data
        }

    )

    if seller_location:
        await db.sellers.update_one(
            {"user_id": current_user["_id"]},
            {"$set": {
                "address": update_data["address"],
                "latitude": seller_location["latitude"],
                "longitude": seller_location["longitude"],
                "service_area_id": seller_location["service_area_id"],
                "updated_at": update_data["updated_at"],
            }},
        )


    updated_user = await db.users.find_one(
        {
            "_id": user_id
        }
    )


    return {

        "message": "Profile updated",

        "user": serialize_user(
            updated_user
        )

    }


@router.post("/upload-profile-image")
async def upload_profile_image(
    image: UploadFile = File(..., description="JPEG, PNG, or WebP profile image"),
    current_user=Depends(get_current_user),
):
    """Validate, persist, and attach a profile image to the authenticated user."""
    content_type = (image.content_type or "").lower()
    if content_type not in IMAGE_SIGNATURES:
        await image.close()
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only JPEG, PNG, and WebP profile images are supported.",
        )

    contents = await image.read(settings.PROFILE_IMAGE_MAX_BYTES + 1)
    await image.close()
    if not contents:
        raise HTTPException(status_code=400, detail="The uploaded image is empty.")
    if len(contents) > settings.PROFILE_IMAGE_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                "The profile image exceeds the "
                f"{settings.PROFILE_IMAGE_MAX_BYTES // (1024 * 1024)} MB limit."
            ),
        )
    if (
        not has_valid_image_signature(contents, content_type)
        or not is_decodable_image(contents, content_type)
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file content is not a valid image.",
        )

    try:
        image_url = await save_profile_image(contents, content_type)
        db = get_db()
        user_id = ObjectId(current_user["_id"])
        result = await db.users.update_one(
            {"_id": user_id},
            {"$set": {"profile_image": image_url, "updated_at": datetime.now(timezone.utc)}},
        )
        if not result.matched_count:
            raise HTTPException(status_code=404, detail="User not found.")
        updated_user = await db.users.find_one({"_id": user_id})
        if not updated_user:
            raise HTTPException(status_code=404, detail="User not found.")
        display_image_url = s3_service.display_url(image_url)
        return {
            "message": "Profile image updated",
            "image_url": display_image_url,
            "user": serialize_user(updated_user),
        }
    except HTTPException:
        raise
    except ProfileImageStorageError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to update the profile image.",
        ) from exc


# =========================
# CHANGE PASSWORD
# =========================

@router.put("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    current_user = Depends(get_current_user)
):

    db = get_db()

    if not verify_password(payload.current_password, current_user["password"]):
        raise HTTPException(
            status_code=400,
            detail="Current password is incorrect"
        )

    if payload.new_password == payload.current_password:
        raise HTTPException(
            status_code=400,
            detail="New password must be different from the current password"
        )

    await db.users.update_one(
        {"_id": ObjectId(current_user["_id"])},
        {"$set": {
            "password": hash_password(payload.new_password),
            "updated_at": utc_now()
        }}
    )

    return {"message": "Password changed successfully"}


# =========================
# FORGOT PASSWORD
# =========================

@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest):

    db = get_db()

    user = await db.users.find_one({"email": payload.email})

    # Always return a generic response to avoid leaking which emails exist.
    generic = {"message": "If an account with that email exists, a reset link has been sent."}

    if not user:
        return generic

    reset_token = generate_secure_token()
    reset_expires = utc_now() + timedelta(
        minutes=settings.RESET_TOKEN_EXPIRE_MINUTES
    )

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "reset_token": reset_token,
            "reset_token_expires": reset_expires,
            "updated_at": utc_now()
        }}
    )

    await email_service.send_password_reset_email(
        user["email"], user.get("name", "there"), reset_token
    )

    return generic


# =========================
# RESET PASSWORD
# =========================

@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest):

    db = get_db()

    user = await db.users.find_one({"reset_token": payload.token})

    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    expires = user.get("reset_token_expires")
    if not expires or expires < utc_now():
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password": hash_password(payload.new_password),
                "updated_at": utc_now()
            },
            "$unset": {"reset_token": "", "reset_token_expires": ""}
        }
    )

    return {"message": "Password reset successfully. You can now log in."}


# =========================
# EMAIL VERIFICATION
# =========================

@router.post("/verify-email")
async def verify_email(payload: VerifyEmailRequest):

    db = get_db()

    user = await db.users.find_one({"verification_token": payload.token})

    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    if user.get("email_verified"):
        return {"message": "Email already verified"}

    expires = user.get("verification_token_expires")
    if not expires or expires < utc_now():
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"email_verified": True, "updated_at": utc_now()},
            "$unset": {"verification_token": "", "verification_token_expires": ""}
        }
    )

    return {"message": "Email verified successfully"}


@router.post("/resend-verification")
async def resend_verification(current_user = Depends(get_current_user)):

    db = get_db()

    if current_user.get("email_verified"):
        return {"message": "Email already verified"}

    verification_token = generate_secure_token()
    verification_expires = utc_now() + timedelta(
        hours=settings.EMAIL_VERIFICATION_EXPIRE_HOURS
    )

    await db.users.update_one(
        {"_id": ObjectId(current_user["_id"])},
        {"$set": {
            "verification_token": verification_token,
            "verification_token_expires": verification_expires,
            "updated_at": utc_now()
        }}
    )

    await email_service.send_verification_email(
        current_user["email"], current_user.get("name", "there"), verification_token
    )

    return {"message": "Verification email sent"}


# =========================
# REFRESH TOKEN
# =========================

@router.post("/refresh")
async def refresh_access_token(payload: RefreshTokenRequest):

    token_data = decode_token(payload.refresh_token)

    if token_data.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    db = get_db()

    try:
        user = await db.users.find_one({"_id": ObjectId(token_data["sub"])})
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    if not user or not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="User not found or inactive")

    new_access = create_access_token({"sub": str(user["_id"]), "role": user["role"]})
    new_refresh = create_refresh_token({"sub": str(user["_id"]), "role": user["role"]})

    return {
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "bearer"
    }
