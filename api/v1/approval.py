from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError

from api.dependencies import get_current_user, get_db
from models.roles import UserRole
from models.user import User
from models.user_email_info import UserEmailInfo
from models.email_automation_requests import EmailAutomationRequest, RequestStatus
from schemas.email_automation_requests import (
    EmailAutomationRequestCreate,
    EmailAutomationRequestResponse,
)

router = APIRouter(prefix="/api/v1/approval", tags=["approval"])


@router.post("/request", response_model=EmailAutomationRequestResponse, status_code=status.HTTP_201_CREATED)
async def submit_approval_request(
    request_in: EmailAutomationRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit an email automation approval request."""
    # Check if user already has a pending request
    result = await db.execute(
        select(EmailAutomationRequest).where(
            EmailAutomationRequest.user_id == current_user.user_id,
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
            UserEmailInfo.user_id == current_user.user_id
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
        user_id=current_user.user_id,
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
    
    return automation_request


@router.get("/status", response_model=EmailAutomationRequestResponse)
async def get_approval_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current user's approval request status."""
    result = await db.execute(
        select(EmailAutomationRequest).where(
            EmailAutomationRequest.user_id == current_user.user_id
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
            EmailAutomationRequest.user_id == current_user.user_id
        ).order_by(EmailAutomationRequest.requested_at.desc())
    )
    requests = result.scalars().all()
    return requests
