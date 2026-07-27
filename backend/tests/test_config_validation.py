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


def test_unsupported_payment_provider_is_rejected(monkeypatch):
    monkeypatch.setattr(settings, "PAYMENT_PROVIDER", "unknown")
    with pytest.raises(RuntimeError, match="PAYMENT_PROVIDER"):
        settings.validate_payment_configuration()
