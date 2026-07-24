from fastapi import HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from api.dependencies import get_current_user
from core.email import EmailDeliveryError, send_job_application_email # type: ignore
from core.encryption import decrypt_data
from database import async_session
from api.v1.templates import get_template_by_type
from models.user import User
from models.user_email_info import UserEmailInfo
from schemas.job_template import SendEmailRequest


async def send_email(
    payload: SendEmailRequest, current_user: User = Depends(get_current_user)
):
    async with async_session() as session:
        job_data = await get_template_by_type(session, payload.type)

    if not job_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job type '{payload.type}' not found.",
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

    # Decrypt the API key
    resend_api_key = decrypt_data(user_email_info.encrypted_api_key) # type: ignore

    try:
        await send_job_application_email(
            recipient_email=payload.recipient_email,
            subject=job_data.title,
            sender_email=user_email_info.sender_email,
            sender_name=user_email_info.sender_name,
            context=job_data.context,
            cv_bytes=job_data.cv_bytes,
            cv_filename=job_data.filename,
        )
        return {"message": "Email sent successfully", "recipient": payload.recipient_email}
    except EmailDeliveryError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send email: {str(e)}",
        )
