import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from email.utils import formataddr

from core.config import settings

logger = logging.getLogger(__name__)

class EmailDeliveryError(Exception):
    """Raised when SMTP delivery fails."""


class EmailSender:
    def __init__(self):
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_username = settings.SMTP_USERNAME
        self.smtp_password = settings.SMTP_PASSWORD
        self.use_tls = settings.SMTP_USE_TLS
        self.use_ssl = settings.SMTP_USE_SSL

    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        from_name: str,
        from_email: str,
        attachment_bytes: bytes | None = None,
        attachment_filename: str | None = None,
    ) -> None:
        if not all([self.smtp_host, self.smtp_port, self.smtp_username, self.smtp_password]):
            logger.error("SMTP settings are not fully configured.")
            raise EmailDeliveryError("SMTP settings are not configured.")

        msg = MIMEMultipart()
        msg["From"] = formataddr((from_name, from_email))
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(html_content, "html"))

        if attachment_bytes and attachment_filename:
            part = MIMEApplication(attachment_bytes, Name=attachment_filename)
            part["Content-Disposition"] = f'attachment; filename="{attachment_filename}"'
            msg.attach(part)

        try:
            smtp_class = smtplib.SMTP_SSL if self.use_ssl else smtplib.SMTP
            with smtp_class(self.smtp_host, self.smtp_port) as server:
                if self.use_tls and not self.use_ssl:
                    server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                server.send_message(msg)
            logger.info(f"Email successfully sent to {to_email}")
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}", exc_info=True)
            raise EmailDeliveryError("Could not send email") from e


email_sender = EmailSender()


async def send_verification_email(email: str, code: str) -> None:
    """Send the account verification code via SMTP."""
    html_content = f"""
    <p>Welcome to Job Easy.</p>
    <p>Your verification code is: <strong>{code}</strong></p>
    <p>If you did not request this account, you can ignore this email.</p>
    """
    await asyncio.to_thread(
        email_sender.send_email,
        to_email=email,
        subject="Verify your Job Easy account",
        html_content=html_content,
        from_name=settings.SMTP_FROM_NAME,
        from_email=settings.SMTP_FROM_EMAIL,
    )


async def send_password_reset_email(email: str, reset_link: str) -> None:
    """Send a password reset link via SMTP."""
    html_content = f"""
    <p>We received a request to reset your Job Easy password.</p>
    <p>Reset your password here: <a href="{reset_link}">{reset_link}</a></p>
    <p>This link expires soon. If you did not request this, you can ignore this email.</p>
    """
    await asyncio.to_thread(
        email_sender.send_email,
        to_email=email,
        subject="Reset your Job Easy password",
        html_content=html_content,
        from_name=settings.SMTP_FROM_NAME,
        from_email=settings.SMTP_FROM_EMAIL,
    )

async def send_job_application_email(
    recipient_email: str,
    subject: str,
    sender_email: str,
    sender_name: str,
    html_content: str,
    cv_bytes: bytes,
    cv_filename: str,
) -> None:
    """Send job application email with CV attachment via SMTP."""
    # Use platform email for sending, but display user's name
    # Fallback to sender_email if sender_name is not provided
    display_name = sender_name if sender_name else sender_email
    from_email = settings.SMTP_FROM_EMAIL  # Always use platform email
    
    await asyncio.to_thread(
        email_sender.send_email,
        to_email=recipient_email,
        subject=subject,
        html_content=html_content,
        from_name=display_name,
        from_email=from_email,
        attachment_bytes=cv_bytes,
        attachment_filename=cv_filename,
    )
