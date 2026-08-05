import pytest

from app.config import settings


def test_mock_payment_provider_requires_no_gateway_credentials(monkeypatch):
    monkeypatch.setattr(settings, "PAYMENT_PROVIDER", "mock")
    settings.validate_payment_configuration()


def test_onepay_requires_all_credentials(monkeypatch):
    monkeypatch.setattr(settings, "PAYMENT_PROVIDER", "onepay")
    monkeypatch.setattr(settings, "ONEPAY_APP_ID", "")
    monkeypatch.setattr(settings, "ONEPAY_APP_TOKEN", "")
    monkeypatch.setattr(settings, "ONEPAY_HASH_SALT", "")
    with pytest.raises(RuntimeError, match="ONEPAY_APP_ID"):
        settings.validate_payment_configuration()


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
