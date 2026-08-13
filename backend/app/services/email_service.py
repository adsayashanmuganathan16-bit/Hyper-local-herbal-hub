import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings


logger = logging.getLogger(__name__)


class EmailService:
    """SMTP email service for notifications."""

    async def send_email(self, to_email: str, subject: str, html_body: str) -> bool:
        """Send an HTML email."""
        placeholder_values = {
            "",
            "your_smtp_username",
            "your_smtp_password",
            "your_email@gmail.com",
            "change-me",
        }
        smtp_user = settings.SMTP_USER.strip()
        smtp_password = settings.SMTP_PASSWORD.strip()

        # Google displays 16-character app passwords in four groups. Users
        # commonly paste those display spaces into .env, but SMTP auth expects
        # the underlying 16-character value.
        if settings.SMTP_HOST.strip().lower() == "smtp.gmail.com":
            smtp_password = smtp_password.replace(" ", "")

        if (
            smtp_user.lower() in placeholder_values
            or smtp_password.lower() in placeholder_values
        ):
            return False
        try:
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = smtp_user
            message["To"] = to_email
            message.attach(MIMEText(html_body, "html"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.sendmail(smtp_user, to_email, message.as_string())
            return True
        except Exception:
            logger.exception("SMTP email delivery failed")
            return False

    async def send_order_confirmation(self, to_email: str, order_id: str, amount: float) -> bool:
        """Send order confirmation email."""
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #2d6a4f; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h2>🌿 Herbal Hub - Order Confirmed</h2>
            </div>
            <div style="padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
                <p>Dear Customer,</p>
                <p>Your order <strong>#{order_id}</strong> has been placed successfully!</p>
                <p><strong>Total Amount:</strong> Rs. {amount:,.2f} LKR</p>
                <p>We'll notify you when your order is shipped.</p>
                <p style="color: #2d6a4f; margin-top: 20px;">Pure Herbs, Pure Life 🌱</p>
            </div>
        </div>
        """
        return await self.send_email(to_email, f"Order Confirmed - #{order_id}", html)

    async def send_verification_email(self, to_email: str, name: str, token: str) -> bool:
        """Send an email-verification link after registration."""
        link = f"{settings.FRONTEND_URL}/verify-email?token={token}"
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #2d6a4f; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h2>🌿 Verify your Herbal Hub email</h2>
            </div>
            <div style="padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
                <p>Hi {name},</p>
                <p>Thanks for signing up! Please confirm your email address to activate all features.</p>
                <p style="text-align: center; margin: 28px 0;">
                    <a href="{link}" style="background: #2d6a4f; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Verify Email</a>
                </p>
                <p style="color: #666; font-size: 13px;">Or paste this link into your browser:<br>{link}</p>
                <p style="color: #666; font-size: 13px;">This link expires in {settings.EMAIL_VERIFICATION_EXPIRE_HOURS} hours.</p>
            </div>
        </div>
        """
        return await self.send_email(to_email, "Verify your Herbal Hub email", html)

    async def send_password_reset_email(self, to_email: str, name: str, token: str) -> bool:
        """Send a password-reset link."""
        link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #2d6a4f; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h2>🌿 Reset your Herbal Hub password</h2>
            </div>
            <div style="padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
                <p>Hi {name},</p>
                <p>We received a request to reset your password. Click below to choose a new one.</p>
                <p style="text-align: center; margin: 28px 0;">
                    <a href="{link}" style="background: #2d6a4f; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Reset Password</a>
                </p>
                <p style="color: #666; font-size: 13px;">Or paste this link into your browser:<br>{link}</p>
                <p style="color: #666; font-size: 13px;">This link expires in {settings.RESET_TOKEN_EXPIRE_MINUTES} minutes. If you didn't request this, you can ignore this email.</p>
            </div>
        </div>
        """
        return await self.send_email(to_email, "Reset your Herbal Hub password", html)

    async def send_prescription_status(self, to_email: str, status: str, reason: str = None) -> bool:
        """Send prescription verification status email."""
        color = "#2d6a4f" if status == "approved" else "#d32f2f"
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: {color}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h2>🌿 Prescription {status.title()}</h2>
            </div>
            <div style="padding: 20px; border: 1px solid #ddd; border-top: none;">
                <p>Your prescription has been <strong style="color: {color};">{status}</strong>.</p>
                {"<p><strong>Reason:</strong> " + reason + "</p>" if reason else ""}
            </div>
        </div>
        """
        return await self.send_email(to_email, f"Prescription {status.title()}", html)

    async def send_financial_notification(self, to_email: str, title: str, message: str) -> bool:
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #2d6a4f; color: white; padding: 20px; text-align: center;">
                <h2>🌿 {title}</h2>
            </div>
            <div style="padding: 20px; border: 1px solid #ddd; border-top: none;">
                <p>{message}</p>
                <p><a href="{settings.FRONTEND_URL}/seller/earnings">View seller earnings and payouts</a></p>
            </div>
        </div>
        """
        return await self.send_email(to_email, f"Herbal Hub - {title}", html)


email_service = EmailService()
