from app.routes.auth import google_verification_error_detail


def test_google_verification_reports_client_id_mismatch():
    error = ValueError("Token has wrong audience example, expected another-client")

    assert "client ID mismatch" in google_verification_error_detail(error)


def test_google_verification_reports_expired_token():
    assert "expired" in google_verification_error_detail(ValueError("Token expired"))


def test_google_verification_reports_clock_problem():
    error = ValueError("Token used too early. Check that your computer's clock is set correctly.")

    assert "server clock" in google_verification_error_detail(error)


def test_google_verification_uses_safe_generic_fallback():
    detail = google_verification_error_detail(ValueError("sensitive internal detail"))

    assert detail == "Google sign-in could not be verified. Please try again."
    assert "sensitive" not in detail
