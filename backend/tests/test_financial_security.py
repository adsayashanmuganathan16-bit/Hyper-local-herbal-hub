import pytest

from app.config import settings
from app.services.financial_crypto import decrypt_sensitive, encrypt_sensitive
from app.routes.auth import bank_account_view


def test_sensitive_values_are_encrypted(monkeypatch):
    monkeypatch.setattr(settings, "DATA_ENCRYPTION_KEY", "")
    encrypted = encrypt_sensitive("199012345678")
    assert encrypted != "199012345678"
    assert decrypt_sensitive(encrypted) == "199012345678"


def test_placeholder_encryption_key_uses_local_fallback(monkeypatch):
    monkeypatch.setattr(settings, "DATA_ENCRYPTION_KEY", "your_fernet_encryption_key")
    encrypted = encrypt_sensitive("1234567890")
    assert encrypted != "1234567890"
    assert decrypt_sensitive(encrypted) == "1234567890"


def test_customer_bank_account_view_never_exposes_full_number(monkeypatch):
    monkeypatch.setattr(settings, "DATA_ENCRYPTION_KEY", "")
    encrypted = encrypt_sensitive("1234567890")
    view = bank_account_view({
        "bank_name": "Test Bank",
        "branch": "Main",
        "account_holder_name": "Customer",
        "account_number_encrypted": encrypted,
        "account_number_last4": "7890",
    })
    assert view["account_number"] == "****7890"
    assert "1234567890" not in str(view)


def test_invalid_encryption_key_has_actionable_error(monkeypatch):
    monkeypatch.setattr(settings, "DATA_ENCRYPTION_KEY", "not-a-fernet-key")
    with pytest.raises(RuntimeError, match="valid Fernet key"):
        encrypt_sensitive("1234567890")
