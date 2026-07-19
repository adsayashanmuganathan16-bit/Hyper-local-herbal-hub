from datetime import datetime

from fastapi import (
    APIRouter,
    HTTPException,
    status,
    Depends,
    File,
    UploadFile
)

from app.database import get_db

from app.models.user import (
    UserCreate,
    UserLogin,
    UserUpdate
)

from app.utils.helpers import (
    hash_password,
    verify_password,
    serialize_doc
)

from app.middleware.auth_middleware import (
    create_access_token,
    get_current_user
)

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


    # Default fields
    user_doc["is_active"] = True
    user_doc["address"] = None
    user_doc["profile_image"] = None
    user_doc["created_at"] = datetime.utcnow()
    user_doc["updated_at"] = datetime.utcnow()


    result = await db.users.insert_one(
        user_doc
    )


    token = create_access_token(
        {
            "sub": str(result.inserted_id),
            "role": user_data.role.value
        }
    )


    return {

        "message": "Account created successfully",

        "access_token": token,

        "user": {

            "id": str(result.inserted_id),

            "name": user_data.name,

            "email": user_data.email,

            "phone": user_data.phone,

            "role": user_data.role.value

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


    return {

        "message": "Login successful",

        "access_token": token,

        "token_type": "bearer",

        "user": {

            "id": str(user["_id"]),

            "name": user["name"],

            "email": user["email"],

            "phone": user["phone"],

            "role": user["role"]

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


    await db.users.update_one(

        {
            "_id": current_user["_id"]
        },

        {
            "$set": update_data
        }

    )


    updated_user = await db.users.find_one(
        {
            "_id": current_user["_id"]
        }
    )


    return {

        "message": "Profile updated",

        "user": serialize_doc(
            updated_user
        )

    }