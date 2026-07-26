import asyncio
import base64
import pytest
from bson import ObjectId
from fastapi import HTTPException

from app.routes import auth
from app.services.profile_image_service import has_valid_image_signature


PNG_IMAGE = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk"
    "+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


class UpdateResult:
    matched_count = 1


class Users:
    def __init__(self, user):
        self.user = user
        self.update = None

    async def update_one(self, query, update):
        self.update = (query, update)
        self.user.update(update["$set"])
        return UpdateResult()

    async def find_one(self, query):
        return self.user


class Database:
    def __init__(self, user):
        self.users = Users(user)


class ImageUpload:
    filename = "avatar.jpg"

    def __init__(self, content: bytes, content_type: str):
        self.content = content
        self.content_type = content_type

    async def read(self, size: int):
        return self.content[:size]

    async def close(self):
        return None


def make_upload(content: bytes, content_type: str) -> ImageUpload:
    return ImageUpload(content, content_type)


def test_image_signature_validation_rejects_spoofed_content():
    assert has_valid_image_signature(b"\xff\xd8\xffdata", "image/jpeg")
    assert not has_valid_image_signature(b"not-an-image", "image/jpeg")


def test_profile_image_upload_updates_and_sanitizes_user(monkeypatch):
    user_id = ObjectId()
    user = {
        "_id": user_id,
        "name": "User",
        "password": "must-not-leak",
        "profile_image": None,
    }
    database = Database(user)
    monkeypatch.setattr(auth, "get_db", lambda: database)

    async def save_image(data, content_type):
        assert data == PNG_IMAGE
        assert content_type == "image/png"
        return "http://localhost:8000/uploads/profile-images/avatar.png"

    monkeypatch.setattr(auth, "save_profile_image", save_image)
    response = asyncio.run(
        auth.upload_profile_image(
            make_upload(PNG_IMAGE, "image/png"),
            {"_id": str(user_id)},
        )
    )

    assert response["user"]["profile_image"].endswith("avatar.png")
    assert "password" not in response["user"]


def test_profile_image_upload_rejects_unsupported_type():
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            auth.upload_profile_image(
                make_upload(b"GIF89a", "image/gif"),
                {"_id": str(ObjectId())},
            )
        )
    assert error.value.status_code == 415


def test_profile_image_upload_rejects_truncated_image():
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            auth.upload_profile_image(
                make_upload(b"\x89PNG\r\n\x1a\nnot-complete", "image/png"),
                {"_id": str(ObjectId())},
            )
        )
    assert error.value.status_code == 400
