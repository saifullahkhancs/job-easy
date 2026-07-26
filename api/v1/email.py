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

    try:
        await send_job_application_email(
            recipient_email=payload.recipient_email,
            subject=template.title,
            sender_email=settings.EMAIL_FROM, # Use platform email from config
            sender_name=user_email_info.sender_name,
            context=template.context,
            cv_bytes=template.cv_bytes,
            cv_filename=template.filename,
        )
        return {"message": "Email sent successfully", "recipient": payload.recipient_email}
    except EmailDeliveryError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send email: {str(e)}",
        )
