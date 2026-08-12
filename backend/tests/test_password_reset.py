import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from bson import ObjectId
from fastapi import HTTPException

from app.models.user import ResetPasswordRequest
from app.routes import auth


class FakeUsers:
    def __init__(self, user):
        self.user = user
        self.find_query = None
        self.update_query = None
        self.update_document = None

    async def find_one(self, query):
        self.find_query = query
        return self.user

    async def update_one(self, query, document):
        self.update_query = query
        self.update_document = document
        return SimpleNamespace(modified_count=1)


def test_reset_password_checks_expiry_in_database(monkeypatch):
    user_id = ObjectId()
    users = FakeUsers({
        "_id": user_id,
        "reset_token": "valid-token",
        # Simulate PyMongo's default timezone-naive datetime response. The
        # route must not compare this value directly with aware UTC datetimes.
        "reset_token_expires": datetime(2099, 1, 1),
    })
    monkeypatch.setattr(auth, "get_db", lambda: SimpleNamespace(users=users))
    monkeypatch.setattr(auth, "hash_password", lambda value: f"hashed:{value}")

    response = asyncio.run(
        auth.reset_password(
            ResetPasswordRequest(token="valid-token", new_password="new-secret")
        )
    )

    assert response["message"].startswith("Password reset successfully")
    assert users.find_query["reset_token"] == "valid-token"
    assert users.find_query["reset_token_expires"]["$gt"].tzinfo == timezone.utc
    assert users.update_query == {"_id": user_id, "reset_token": "valid-token"}
    assert users.update_document["$unset"] == {
        "reset_token": "",
        "reset_token_expires": "",
    }


def test_reset_password_rejects_missing_or_expired_token(monkeypatch):
    users = FakeUsers(None)
    monkeypatch.setattr(auth, "get_db", lambda: SimpleNamespace(users=users))

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            auth.reset_password(
                ResetPasswordRequest(token="expired-token", new_password="new-secret")
            )
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Invalid or expired reset token"
