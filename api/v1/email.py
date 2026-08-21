from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from api.dependencies import get_current_user
from core.email import EmailDeliveryError, send_job_application_email # type: ignore
from core.config import settings
from database import async_session
from models.user import User
from models.user_email_info import UserEmailInfo
from models.user_templates import UserTemplate
from models.email_automation_requests import EmailAutomationRequest
from schemas.email import SendEmailRequest

router = APIRouter(prefix="/api/v1/email", tags=["email"])

@router.post("/send", status_code=status.HTTP_200_OK)
async def send_email_v2(
    payload: SendEmailRequest, current_user: User = Depends(get_current_user)
):
    async with async_session() as session:
        # Fetch the user's chosen template
        result = await session.execute(
            select(UserTemplate).where(UserTemplate.id == payload.template_id)
        )
        template = result.scalars().first()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with id '{payload.template_id}' not found.",
        )

    # Customers may only send with templates they authored, even if those
    # templates were later promoted to default by an admin. Admins can send
    # with any template. This enforces that promoted defaults remain usable
    # for their original owner.
    # NOTE: we allow `is_active` check implicitly via existence, but we also
    # explicitly verify ownership for non-admins.
    from models.roles import UserRole
    if current_user.role == UserRole.CUSTOMER:
        # Must be owned by this customer (scope can be customer or default)
        if template.user_email != current_user.email:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only send emails using your own templates. Promoted defaults that you own are still usable.",
            )

    # Admins must request email automation access before they can send. The
    # profile exposes the same status, but enforce it here as the security
    # boundary as well.
    if current_user.role in (UserRole.ADMIN, UserRole.VISITOR):
        async with async_session() as session:
            access_result = await session.execute(
                select(EmailAutomationRequest).where(
                    EmailAutomationRequest.user_email == current_user.email,
                    EmailAutomationRequest.status == "approved",
                )
            )
            if not access_result.scalars().first():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Email access is not approved. Request access before sending emails.",
                )

    # Fetch user's email sending configuration
    async with async_session() as session:
        result = await session.execute(
            select(UserEmailInfo).where(UserEmailInfo.user_email == current_user.email) # type: ignore
        )
        user_email_info = result.scalars().first()

    if not user_email_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User has not configured email sending information.",
        )

    # Allow one-off subject/body tweaks for this send only. Blank or missing
    # overrides fall back to the stored template values, so the template itself
    # is never mutated — the sender just personalises the email at send time.
    subject = (
        payload.subject
        if payload.subject is not None and payload.subject.strip()
        else template.title
    )
    body = (
        payload.body
        if payload.body is not None and payload.body.strip()
        else template.context
    )

    try:
        await send_job_application_email(
            recipient_email=payload.recipient_email,
            subject=subject,
            sender_email=settings.EMAIL_FROM, # Use platform email from config
            sender_name=user_email_info.sender_name,
            context=body,
            cv_bytes=template.cv_bytes,
            cv_filename=template.filename,
        )
        return {"message": "Email sent successfully", "recipient": payload.recipient_email}
    except EmailDeliveryError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send email: {str(e)}",
        )
