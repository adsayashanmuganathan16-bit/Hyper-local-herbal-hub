import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings


class EmailService:
    """SMTP email service for notifications."""

    async def send_email(self, to_email: str, subject: str, html_body: str) -> bool:
        """Send an HTML email."""
        try:
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = settings.SMTP_USER
            message["To"] = to_email
            message.attach(MIMEText(html_body, "html"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_USER, to_email, message.as_string())
            return True
        except Exception as e:
            print(f"Email send failed: {e}")
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
                <p><strong>Total Amount:</strong> ₹{amount:.2f}</p>
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


email_service = EmailService()