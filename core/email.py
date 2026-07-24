import asyncio
import logging
import smtplib
from email.message import EmailMessage
from email.utils import formataddr

from core.config import settings

logger = logging.getLogger(__name__)


class EmailDeliveryError(Exception):
    """Raised when SMTP delivery fails."""


async def send_verification_email(email: str, code: str) -> None:
    """Send the account verification code via SMTP."""
    await asyncio.to_thread(_send_verification_email_sync, email, code)


async def send_password_reset_email(email: str, reset_link: str) -> None:
    """Send a password reset link via SMTP."""
    await asyncio.to_thread(_send_password_reset_email_sync, email, reset_link)


async def send_job_application_email(
    recipient_email: str,
    subject: str,
    context: str,
    cv_bytes: bytes,
    cv_filename: str,
) -> None:
    """Send job application email with CV attachment via SMTP."""
    await asyncio.to_thread(
        _send_job_application_email_sync,
        recipient_email,
        subject,
        context,
        cv_bytes,
        cv_filename,
    )


def _send_verification_email_sync(email: str, code: str) -> None:
    if not settings.SMTP_HOST:
        logger.warning("SMTP is not configured; verification email was not sent")
        return

    from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USERNAME
    if not from_email:
        raise EmailDeliveryError("SMTP_FROM_EMAIL or SMTP_USERNAME must be set")

    message = EmailMessage()
    message["Subject"] = "Verify your Job Easy account"
    message["From"] = formataddr((settings.SMTP_FROM_NAME, from_email))
    message["To"] = email
    message.set_content(
        "\n".join(
            [
                "Welcome to Job Easy.",
                "",
                f"Your verification code is: {code}",
                "",
                "If you did not request this account, you can ignore this email.",
            ]
        )
    )

    try:
        if settings.SMTP_USE_SSL:
            server = smtplib.SMTP_SSL(
                settings.SMTP_HOST, settings.SMTP_PORT, timeout=10
            )
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)

        with server:
            if settings.SMTP_USE_TLS and not settings.SMTP_USE_SSL:
                server.starttls()
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(message)
    except smtplib.SMTPException as exc:
        raise EmailDeliveryError("Could not send verification email") from exc
    except OSError as exc:
        raise EmailDeliveryError("Could not connect to SMTP server") from exc


def _send_password_reset_email_sync(email: str, reset_link: str) -> None:
    if not settings.SMTP_HOST:
        logger.warning("SMTP is not configured; password reset email was not sent")
        return

    from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USERNAME
    if not from_email:
        raise EmailDeliveryError("SMTP_FROM_EMAIL or SMTP_USERNAME must be set")

    message = EmailMessage()
    message["Subject"] = "Reset your Job Easy password"
    message["From"] = formataddr((settings.SMTP_FROM_NAME, from_email))
    message["To"] = email
    message.set_content(
        "\n".join(
            [
                "We received a request to reset your Job Easy password.",
                "",
                f"Reset your password here: {reset_link}",
                "",
                "This link expires soon. If you did not request this, you can ignore this email.",
            ]
        )
    )

    try:
        if settings.SMTP_USE_SSL:
            server = smtplib.SMTP_SSL(
                settings.SMTP_HOST, settings.SMTP_PORT, timeout=10
            )
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)

        with server:
            if settings.SMTP_USE_TLS and not settings.SMTP_USE_SSL:
                server.starttls()
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(message)
    except smtplib.SMTPException as exc:
        raise EmailDeliveryError("Could not send password reset email") from exc
    except OSError as exc:
        raise EmailDeliveryError("Could not connect to SMTP server") from exc


def _send_job_application_email_sync(
    recipient_email: str,
    subject: str,
    context: str,
    cv_bytes: bytes,
    cv_filename: str,
) -> None:
    if not settings.SMTP_HOST:
        logger.warning("SMTP is not configured; job application email was not sent")
        return

    from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USERNAME
    if not from_email:
        raise EmailDeliveryError("SMTP_FROM_EMAIL or SMTP_USERNAME must be set")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = formataddr((settings.SMTP_FROM_NAME, from_email))
    message["To"] = recipient_email
    message.set_content(context)

    html_content = context.replace("\r\n", "\n").replace("\n", "<br>")
    html_body = f"""\
<html>
  <body style="font-family: sans-serif; font-size: 14px; line-height: 1.5;">
    {html_content}
  </body>
</html>
"""
    message.add_alternative(html_body, subtype="html")

    message.add_attachment(
        cv_bytes,
        maintype="application",
        subtype="pdf",
        filename=cv_filename,
    )

    try:
        if settings.SMTP_USE_SSL:
            server = smtplib.SMTP_SSL(
                settings.SMTP_HOST, settings.SMTP_PORT, timeout=10
            )
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)

        with server:
            if settings.SMTP_USE_TLS and not settings.SMTP_USE_SSL:
                server.starttls()
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(message)
    except smtplib.SMTPException as exc:
        raise EmailDeliveryError("Could not send job application email") from exc
    except OSError as exc:
        raise EmailDeliveryError("Could not connect to SMTP server") from exc
