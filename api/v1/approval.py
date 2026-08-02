import logging
from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError

from api.dependencies import get_current_user, get_db
from core.config import settings
from core.email import notify_safe, send_admin_approval_request_email
from models.roles import UserRole
from models.user import User
from models.user_email_info import UserEmailInfo
from models.email_automation_requests import EmailAutomationRequest, RequestStatus
from schemas.email_automation_requests import (
    EmailAutomationRequestCreate,
    EmailAutomationRequestResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/approval", tags=["approval"])


async def get_admin_recipients(db: AsyncSession) -> list[str]:
    """Every address that should be told about a new approval request.

    Admins are read from the database so newly promoted admins are covered
    automatically; ADMIN_NOTIFICATION_EMAILS adds static recipients (e.g. a
    shared inbox) for deployments where no admin account exists yet.
    """
    result = await db.execute(select(User.email).where(User.role == UserRole.ADMIN))
    recipients = [email for email in result.scalars().all() if email]

    for email in settings.admin_notification_emails:
        if email not in recipients:
            recipients.append(email)

    return recipients


async def notify_admins_of_request(
    admin_emails: list[str],
    requester_name: str,
    requester_email: str,
    request_id: int,
    sender_name: str | None,
    sender_email: str | None,
    requested_at: datetime | None,
) -> None:
    """Fan out the "new request" notification to every admin (best-effort)."""
    if not admin_emails:
        logger.warning(
            "Approval request #%s submitted but no admin recipient is configured.",
            request_id,
        )
        return

    requested_at_text = (
        requested_at.strftime("%d %b %Y, %H:%M UTC") if requested_at else None
    )

    for admin_email in admin_emails:
        await notify_safe(
            send_admin_approval_request_email(
                admin_email=admin_email,
                requester_name=requester_name,
                requester_email=requester_email,
                request_id=request_id,
                sender_name=sender_name,
                sender_email=sender_email,
                requested_at=requested_at_text,
            )
        )


@router.post("/request", response_model=EmailAutomationRequestResponse, status_code=status.HTTP_201_CREATED)
async def submit_approval_request(
    request_in: EmailAutomationRequestCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit an email automation approval request."""
    # Check if user already has a pending request
    result = await db.execute(
        select(EmailAutomationRequest).where(
            EmailAutomationRequest.user_email == current_user.email,
            EmailAutomationRequest.status == RequestStatus.PENDING
        )
    )
    pending_request = result.scalars().first()
    if pending_request:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have a pending approval request",
        )
    
    # Verify the email info belongs to the user
    result = await db.execute(
        select(UserEmailInfo).where(
            UserEmailInfo.id == request_in.user_email_info_id,
            UserEmailInfo.user_email == current_user.email
        )
    )
    email_info = result.scalars().first()
    if not email_info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email configuration not found or does not belong to you",
        )
    
    # Create the approval request
    automation_request = EmailAutomationRequest(
        user_email=current_user.email,
        user_email_info_id=request_in.user_email_info_id,
        status=RequestStatus.PENDING,
        requested_at=datetime.now(timezone.utc),
    )
    
    db.add(automation_request)
    try:
        await db.commit()
        await db.refresh(automation_request)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to submit approval request",
        )

    # Tell the admins there is something to review. Sent in the background so a
    # slow mail provider never delays the customer's confirmation, and read the
    # recipients now while the session is still open.
    admin_emails = await get_admin_recipients(db)
    requester_name = " ".join(
        part for part in [current_user.first_name, current_user.last_name] if part
    ).strip()
    background_tasks.add_task(
        notify_admins_of_request,
        admin_emails=admin_emails,
        requester_name=requester_name or current_user.email,
        requester_email=current_user.email,
        request_id=automation_request.id,
        sender_name=email_info.sender_name,
        sender_email=email_info.sender_email,
        requested_at=automation_request.requested_at,
    )

    return automation_request


@router.get("/status", response_model=EmailAutomationRequestResponse)
async def get_approval_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current user's approval request status."""
    result = await db.execute(
        select(EmailAutomationRequest).where(
            EmailAutomationRequest.user_email == current_user.email
        ).order_by(EmailAutomationRequest.requested_at.desc())
    )
    request = result.scalars().first()
    
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No approval request found",
        )
    
    return request


@router.get("/requests", response_model=list[EmailAutomationRequestResponse])
async def list_my_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all approval requests for the current user."""
    result = await db.execute(
        select(EmailAutomationRequest).where(
            EmailAutomationRequest.user_email == current_user.email
        ).order_by(EmailAutomationRequest.requested_at.desc())
    )
    requests = result.scalars().all()
    return requests
