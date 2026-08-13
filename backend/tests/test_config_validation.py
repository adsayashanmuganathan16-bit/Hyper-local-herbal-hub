import pytest

from app.config import settings


def test_stripe_requires_api_and_webhook_secrets(monkeypatch):
    monkeypatch.setattr(settings, "PAYMENT_PROVIDER", "stripe")
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_test_example")
    monkeypatch.setattr(settings, "STRIPE_WEBHOOK_SECRET", "")
    with pytest.raises(RuntimeError, match="STRIPE_WEBHOOK_SECRET"):
        settings.validate_payment_configuration()


def test_stripe_rejects_invalid_secret_formats(monkeypatch):
    monkeypatch.setattr(settings, "PAYMENT_PROVIDER", "stripe")
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "pk_test_not_a_secret")
    monkeypatch.setattr(settings, "STRIPE_WEBHOOK_SECRET", "whsec_example")
    with pytest.raises(RuntimeError, match="STRIPE_SECRET_KEY"):
        settings.validate_payment_configuration()


def test_unsupported_payment_provider_is_rejected(monkeypatch):
    monkeypatch.setattr(settings, "PAYMENT_PROVIDER", "unknown")
    with pytest.raises(RuntimeError, match="PAYMENT_PROVIDER"):
        settings.validate_payment_configuration()


def test_admin_credentials_must_be_configured_together(monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_EMAIL", "admin@example.invalid")
    monkeypatch.setattr(settings, "ADMIN_PASSWORD", "")
    with pytest.raises(RuntimeError, match="configured together"):
        settings.validate_admin_configuration()


def test_admin_password_requires_minimum_length(monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_EMAIL", "admin@example.invalid")
    monkeypatch.setattr(settings, "ADMIN_PASSWORD", "shortpass")
    with pytest.raises(RuntimeError, match="at least 10"):
        settings.validate_admin_configuration()


def test_admin_password_accepts_ten_characters(monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_EMAIL", "admin@example.invalid")
    monkeypatch.setattr(settings, "ADMIN_PASSWORD", "Admin@2006")
    settings.validate_admin_configuration()


def test_s3_accepts_iam_role_credentials(monkeypatch):
    monkeypatch.setattr(settings, "PROFILE_IMAGE_STORAGE", "s3")
    monkeypatch.setattr(settings, "S3_BUCKET_NAME", "herbal-production-images")
    monkeypatch.setattr(settings, "AWS_ACCESS_KEY_ID", "")
    monkeypatch.setattr(settings, "AWS_SECRET_ACCESS_KEY", "")
    settings.validate_storage_configuration()


def test_s3_rejects_partial_static_credentials(monkeypatch):
    monkeypatch.setattr(settings, "PROFILE_IMAGE_STORAGE", "s3")
    monkeypatch.setattr(settings, "S3_BUCKET_NAME", "herbal-production-images")
    monkeypatch.setattr(settings, "AWS_ACCESS_KEY_ID", "access-key-only")
    monkeypatch.setattr(settings, "AWS_SECRET_ACCESS_KEY", "")
    with pytest.raises(RuntimeError, match="both AWS_ACCESS_KEY_ID"):
        settings.validate_storage_configuration()
