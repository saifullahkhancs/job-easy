from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.email import EmailDeliveryError, send_job_application_email
from database import async_session
from api.v1.templates import get_template_by_type
from schemas.job_template import SendEmailRequest


async def send_email(payload: SendEmailRequest):
    async with async_session() as session:
        job_data = await get_template_by_type(session, payload.type)

    if not job_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job type '{payload.type}' not found.",
        )

    try:
        await send_job_application_email(
            recipient_email=payload.recipient_email,
            subject=job_data.title,
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
