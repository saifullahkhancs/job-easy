import asyncio
import logging
from email.utils import formataddr

import resend
from resend import Attachment

from core.config import settings

logger = logging.getLogger(__name__)


class EmailDeliveryError(Exception):
    """Raised when SMTP delivery fails."""


def _send_email_sync(
    to_email: str,
    subject: str,
    html_content: str,
    from_name: str,
    from_email: str,
    attachment_bytes: bytes | None = None,
    attachment_filename: str | None = None,
) -> None:
    """Synchronous helper to send email via Resend API."""
    if not settings.RESEND_API_KEY:
        logger.error("Resend API key is not configured (expected in SMTP_PASSWORD env var).")
        raise EmailDeliveryError("Email service is not configured.")

    resend.api_key = settings.RESEND_API_KEY

    attachments = []
    if attachment_bytes and attachment_filename:
        # Resend Python SDK expects attachment content as list of ints (bytes -> list)
        # Passing raw bytes causes: TypeError: Object of type bytes is not JSON serializable
        # Official example: {"content": list(f), "filename": "invoice.pdf"}
        # See https://resend.com/docs/dashboard/emails/attachments
        try:
            # Prefer list of ints for compatibility with resend SDK
            content_list = list(attachment_bytes)
        except Exception:
            # Fallback: base64 or raw if conversion fails
            content_list = attachment_bytes

        # Use dict form which is documented and avoids Attachment class quirks
        attachments.append({
            "filename": attachment_filename,
            "content": content_list,
        })

    try:
        params = {
            "from": formataddr((from_name, from_email)),
            "to": [to_email],
            "subject": subject,
            "html": html_content,
            "attachments": attachments,
        }
        resend.Emails.send(params)
        logger.info(f"Email sent successfully to {to_email} via Resend.")
    except Exception as e:
        logger.error(f"Failed to send email to {to_email} via Resend: {e}", exc_info=True)
        raise EmailDeliveryError(f"Could not send email: {e}") from e


async def send_verification_email(email: str, code: str) -> None:
    """Send the account verification code via SMTP."""
    html_content = f"""
    <p>Welcome to Job Easy.</p>
    <p>Your verification code is: <strong>{code}</strong></p>
    <p>If you did not request this account, you can ignore this email.</p>
    """
    await asyncio.to_thread(
        _send_email_sync,
        to_email=email,
        subject="Verify your Job Easy account",
        html_content=html_content,
        from_name=settings.EMAIL_FROM_NAME,
        from_email=settings.EMAIL_FROM,
    )


async def send_password_reset_email(email: str, reset_link: str) -> None:
    """Send a password reset link via SMTP."""
    html_content = f"""
    <p>We received a request to reset your Job Easy password.</p>
    <p>Reset your password here: <a href="{reset_link}">{reset_link}</a></p>
    <p>This link expires soon. If you did not request this, you can ignore this email.</p>
    """
    await asyncio.to_thread(
        _send_email_sync,
        to_email=email,
        subject="Reset your Job Easy password",
        html_content=html_content,
        from_name=settings.EMAIL_FROM_NAME,
        from_email=settings.EMAIL_FROM,
    )


async def send_job_application_email(
    recipient_email: str,
    subject: str,
    sender_email: str,
    sender_name: str,
    context: str,  # Renamed from html_content to match caller
    cv_bytes: bytes,
    cv_filename: str,
) -> None:
    """Send job application email with CV attachment via SMTP."""
    await asyncio.to_thread(
        _send_email_sync,
        to_email=recipient_email,
        subject=subject,
        html_content=context,
        from_name=sender_name,
        from_email=sender_email,
        attachment_bytes=cv_bytes,
        attachment_filename=cv_filename,
    )
