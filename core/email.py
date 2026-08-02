import asyncio
import html
import logging
import re
from email.utils import formataddr

import resend
from resend import Attachment

from core.config import settings

logger = logging.getLogger(__name__)


def plain_text_to_html(text: str) -> str:
    """Convert plain text to HTML, preserving line breaks and trailing spaces.
    
    - Escapes HTML special characters
    - Converts newlines to <br> tags
    - Preserves trailing spaces using &nbsp;
    - Wraps content in a properly styled HTML structure
    """
    if not text:
        return ""
    
    # Escape HTML special characters first (before adding our own tags)
    escaped = html.escape(text)
    
    # Split into lines to process each one
    lines = escaped.split('\n')
    processed_lines = []
    
    for line in lines:
        # Handle trailing spaces - replace trailing spaces with &nbsp;
        # We need to be careful not to convert spaces that are just normal word spacing
        # We'll convert 1+ trailing spaces on each line
        trailing_match = re.search(r'( +)$', line)
        if trailing_match:
            trailing_spaces = len(trailing_match.group(1))
            line = line[:-trailing_spaces] + '&nbsp;' * trailing_spaces
        
        # Handle leading spaces (indentation)
        leading_match = re.match(r'^( +)', line)
        if leading_match:
            leading_spaces = len(leading_match.group(1))
            line = '&nbsp;' * leading_spaces + line.lstrip()
        
        processed_lines.append(line)
    
    # Join lines with <br> tags (except for double newlines which become paragraph breaks)
    html_content = '<br>\n'.join(processed_lines)
    
    # Wrap in a styled HTML structure
    return f'''<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: 14px;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 20px;
            white-space: pre-wrap;
            word-wrap: break-word;
        }}
        p {{
            margin: 0 0 16px 0;
        }}
    </style>
</head>
<body>
{html_content}
</body>
</html>'''


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
    """Send job application email with CV attachment via SMTP.
    
    The context is converted from plain text to HTML to preserve formatting.
    """
    # Convert plain text context to HTML with preserved formatting
    html_content = plain_text_to_html(context)
    
    await asyncio.to_thread(
        _send_email_sync,
        to_email=recipient_email,
        subject=subject,
        html_content=html_content,
        from_name=sender_name,
        from_email=sender_email,
        attachment_bytes=cv_bytes,
        attachment_filename=cv_filename,
    )


# ---------------------------------------------------------------------------
# Approval workflow notifications
#
# Two directions are covered here:
#   1. customer -> admin : a new access request needs a decision.
#   2. admin -> customer : the decision (approved / rejected) is out.
# Both are best-effort: a delivery failure must never roll back the database
# change that triggered it, so callers use `notify_safe`.
# ---------------------------------------------------------------------------

def _layout(title: str, body: str, cta_label: str | None = None, cta_url: str | None = None) -> str:
    """Wrap notification content in a simple, email-client friendly layout."""
    cta_html = ""
    if cta_label and cta_url:
        cta_html = f"""
        <tr>
          <td style="padding: 8px 0 4px 0;">
            <a href="{html.escape(cta_url, quote=True)}"
               style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;
                      padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;">
              {html.escape(cta_label)}
            </a>
          </td>
        </tr>
        """

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:24px;background:#f1f5f9;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
             color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;
                border:1px solid #e2e8f0;overflow:hidden;">
    <tr>
      <td style="background:#0f172a;padding:18px 28px;color:#ffffff;font-size:16px;font-weight:700;">
        Job Easy
      </td>
    </tr>
    <tr>
      <td style="padding:28px;">
        <h1 style="margin:0 0 16px 0;font-size:20px;line-height:1.3;">{html.escape(title)}</h1>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="font-size:14px;line-height:1.6;color:#334155;">
          {body}
          {cta_html}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;
                 font-size:12px;color:#64748b;">
        This is an automated message from Job Easy.
      </td>
    </tr>
  </table>
</body>
</html>"""


def _detail_rows(rows: list[tuple[str, str | None]]) -> str:
    """Render label/value pairs as table rows, skipping empty values."""
    out = []
    for label, value in rows:
        if value in (None, ""):
            continue
        out.append(
            f"""
        <tr>
          <td style="padding:4px 0;font-size:14px;color:#334155;">
            <strong style="color:#0f172a;">{html.escape(label)}:</strong>
            {html.escape(str(value))}
          </td>
        </tr>"""
        )
    return "".join(out)


async def send_admin_approval_request_email(
    admin_email: str,
    requester_name: str,
    requester_email: str,
    request_id: int,
    sender_name: str | None = None,
    sender_email: str | None = None,
    requested_at: str | None = None,
) -> None:
    """Tell an admin that a customer is waiting for an access decision."""
    review_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/admin/requests"

    body = f"""
        <tr>
          <td style="padding:0 0 14px 0;">
            <strong>{html.escape(requester_name or requester_email)}</strong> requested access to
            Job Easy email automation and is waiting for your approval.
          </td>
        </tr>
        {_detail_rows([
            ("Request ID", f"#{request_id}"),
            ("Account", requester_email),
            ("Sender display name", sender_name),
            ("Sender email", sender_email),
            ("Requested at", requested_at),
        ])}
        <tr><td style="padding:14px 0 6px 0;">
          Open the admin dashboard to approve or reject this request.
        </td></tr>
    """

    await asyncio.to_thread(
        _send_email_sync,
        to_email=admin_email,
        subject=f"New access request from {requester_name or requester_email}",
        html_content=_layout(
            "New email automation access request",
            body,
            cta_label="Review request",
            cta_url=review_url,
        ),
        from_name=settings.EMAIL_FROM_NAME,
        from_email=settings.EMAIL_FROM,
    )


async def send_request_approved_email(
    user_email: str,
    user_name: str | None = None,
    admin_notes: str | None = None,
) -> None:
    """Tell the customer their access request was approved."""
    app_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/app/templates"
    greeting = html.escape(user_name) if user_name else "there"

    notes_block = ""
    if admin_notes:
        notes_block = f"""
        <tr>
          <td style="padding:12px 0;">
            <div style="background:#f8fafc;border-left:3px solid #0f172a;padding:10px 14px;
                        border-radius:6px;color:#334155;">
              <strong style="color:#0f172a;">Note from the admin:</strong><br>
              {html.escape(admin_notes)}
            </div>
          </td>
        </tr>"""

    body = f"""
        <tr><td style="padding:0 0 12px 0;">Hi {greeting},</td></tr>
        <tr>
          <td style="padding:0 0 12px 0;">
            Good news — your email automation request has been
            <strong style="color:#15803d;">approved</strong>. You now have full access to Job Easy:
            create your templates and start sending job applications right away.
          </td>
        </tr>
        {notes_block}
        <tr><td style="padding:6px 0 14px 0;">Sign in to get started.</td></tr>
    """

    await asyncio.to_thread(
        _send_email_sync,
        to_email=user_email,
        subject="Your Job Easy access request is approved",
        html_content=_layout(
            "Your request is approved",
            body,
            cta_label="Go to Job Easy",
            cta_url=app_url,
        ),
        from_name=settings.EMAIL_FROM_NAME,
        from_email=settings.EMAIL_FROM,
    )


async def send_request_rejected_email(
    user_email: str,
    user_name: str | None = None,
    admin_notes: str | None = None,
) -> None:
    """Tell the customer their access request was rejected."""
    request_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/app/request-access"
    greeting = html.escape(user_name) if user_name else "there"

    notes_block = ""
    if admin_notes:
        notes_block = f"""
        <tr>
          <td style="padding:12px 0;">
            <div style="background:#fef2f2;border-left:3px solid #dc2626;padding:10px 14px;
                        border-radius:6px;color:#7f1d1d;">
              <strong>Reason from the admin:</strong><br>
              {html.escape(admin_notes)}
            </div>
          </td>
        </tr>"""

    body = f"""
        <tr><td style="padding:0 0 12px 0;">Hi {greeting},</td></tr>
        <tr>
          <td style="padding:0 0 12px 0;">
            Your email automation access request was not approved this time.
          </td>
        </tr>
        {notes_block}
        <tr>
          <td style="padding:6px 0 14px 0;">
            You can update your sender details and submit a new request whenever you're ready.
          </td>
        </tr>
    """

    await asyncio.to_thread(
        _send_email_sync,
        to_email=user_email,
        subject="Update on your Job Easy access request",
        html_content=_layout(
            "Your request was not approved",
            body,
            cta_label="Submit a new request",
            cta_url=request_url,
        ),
        from_name=settings.EMAIL_FROM_NAME,
        from_email=settings.EMAIL_FROM,
    )


async def notify_safe(coro) -> bool:
    """Await a notification coroutine without letting failures bubble up.

    Approval bookkeeping is already committed by the time we notify, so a
    dead mail provider must not turn a successful approval into a 5xx.
    Returns True when the notification was delivered.
    """
    try:
        await coro
        return True
    except Exception as exc:  # noqa: BLE001 - notifications are best-effort
        logger.error(f"Approval notification could not be sent: {exc}", exc_info=True)
        return False
