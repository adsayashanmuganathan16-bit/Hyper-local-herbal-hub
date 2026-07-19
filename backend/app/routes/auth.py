from datetime import datetime, timedelta

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
    RefreshTokenRequest
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


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)


# =========================
# REGISTER
# =========================

@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED
)
async def register(user_data: UserCreate):

    db = get_db()

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


    user_doc = user_data.model_dump()


    # Hash password
    user_doc["password"] = hash_password(
        user_data.password
    )


    # Email verification token
    verification_token = generate_secure_token()
    verification_expires = datetime.utcnow() + timedelta(
        hours=settings.EMAIL_VERIFICATION_EXPIRE_HOURS
    )


    # Default fields
    user_doc["is_active"] = True
    user_doc["email_verified"] = False
    user_doc["verification_token"] = verification_token
    user_doc["verification_token_expires"] = verification_expires
    user_doc["address"] = None
    user_doc["profile_image"] = None
    user_doc["created_at"] = datetime.utcnow()
    user_doc["updated_at"] = datetime.utcnow()


    result = await db.users.insert_one(
        user_doc
    )


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

            "name": user_data.name,

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

            "email_verified": user.get("email_verified", False)

        }

    }



# =========================
# GET CURRENT USER
# =========================

@router.get("/me")
async def get_profile(
    current_user = Depends(get_current_user)
):

    return {

        "user": current_user

    }



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


    update_data["updated_at"] = datetime.utcnow()


    user_id = ObjectId(current_user["_id"])


    await db.users.update_one(

        {
            "_id": user_id
        },

        {
            "$set": update_data
        }

    )


    updated_user = await db.users.find_one(
        {
            "_id": user_id
        }
    )


    return {

        "message": "Profile updated",

        "user": serialize_doc(
            updated_user
        )

    }


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
            "updated_at": datetime.utcnow()
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
    reset_expires = datetime.utcnow() + timedelta(
        minutes=settings.RESET_TOKEN_EXPIRE_MINUTES
    )

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "reset_token": reset_token,
            "reset_token_expires": reset_expires,
            "updated_at": datetime.utcnow()
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
    if not expires or expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password": hash_password(payload.new_password),
                "updated_at": datetime.utcnow()
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
    if not expires or expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"email_verified": True, "updated_at": datetime.utcnow()},
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
    verification_expires = datetime.utcnow() + timedelta(
        hours=settings.EMAIL_VERIFICATION_EXPIRE_HOURS
    )

    await db.users.update_one(
        {"_id": ObjectId(current_user["_id"])},
        {"$set": {
            "verification_token": verification_token,
            "verification_token_expires": verification_expires,
            "updated_at": datetime.utcnow()
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