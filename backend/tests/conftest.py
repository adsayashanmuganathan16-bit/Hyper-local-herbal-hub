import os

os.environ.setdefault("SECRET_KEY", "test-only-secret-key-with-at-least-32-characters")
os.environ.setdefault("ADMIN_EMAIL", "admin-test@example.invalid")
os.environ.setdefault("ADMIN_PASSWORD", "test-only-admin-password")
os.environ.setdefault("PAYMENT_PROVIDER", "stripe")
