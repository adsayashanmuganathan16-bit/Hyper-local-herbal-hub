import asyncio

from app.services import email_service as email_service_module


class FakeSMTP:
    instances = []

    def __init__(self, host, port):
        self.host = host
        self.port = port
        self.login_args = None
        self.sendmail_args = None
        self.__class__.instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def starttls(self):
        pass

    def login(self, username, password):
        self.login_args = (username, password)

    def sendmail(self, sender, recipient, message):
        self.sendmail_args = (sender, recipient, message)


def test_gmail_app_password_display_spaces_are_removed(monkeypatch):
    FakeSMTP.instances.clear()
    monkeypatch.setattr(email_service_module.smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(email_service_module.settings, "SMTP_HOST", "smtp.gmail.com")
    monkeypatch.setattr(email_service_module.settings, "SMTP_PORT", 587)
    monkeypatch.setattr(email_service_module.settings, "SMTP_USER", " sender@example.com ")
    monkeypatch.setattr(
        email_service_module.settings,
        "SMTP_PASSWORD",
        "abcd efgh ijkl mnop",
    )

    sent = asyncio.run(
        email_service_module.email_service.send_email(
            "recipient@example.com", "Reset password", "<p>Reset</p>"
        )
    )

    assert sent is True
    smtp = FakeSMTP.instances[0]
    assert smtp.login_args == ("sender@example.com", "abcdefghijklmnop")
    assert smtp.sendmail_args[0:2] == (
        "sender@example.com",
        "recipient@example.com",
    )
