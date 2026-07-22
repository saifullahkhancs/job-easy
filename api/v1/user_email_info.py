from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError

from api.dependencies import get_current_user, get_db
from core.encryption import encrypt_app_password, decrypt_app_password, mask_email
from models.roles import UserRole
from models.user import User
from models.user_email_info import UserEmailInfo
from schemas.user_email_info import (
    UserEmailInfoCreate,
    UserEmailInfoUpdate,
    UserEmailInfoResponse,
    UserEmailInfoMaskedResponse,
)

router = APIRouter(prefix="/api/v1/user-email-info", tags=["user-email-info"])


@router.post("", response_model=UserEmailInfoResponse, status_code=status.HTTP_201_CREATED)
async def create_email_info(
    email_info_in: UserEmailInfoCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create email configuration for the current user."""
    # Check if user already has email info
    result = await db.execute(
        select(UserEmailInfo).where(UserEmailInfo.user_id == current_user.user_id)
    )
    existing = result.scalars().first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email configuration already exists. Use PUT to update.",
        )
    
    # Encrypt the app password
    encrypted_password = encrypt_app_password(email_info_in.app_password)
    
    email_info = UserEmailInfo(
        user_id=current_user.user_id,
        sender_email=email_info_in.sender_email,
        sender_name=email_info_in.sender_name,
        encrypted_app_password=encrypted_password,
        email_provider=email_info_in.email_provider,
    )
    
    db.add(email_info)
    try:
        await db.commit()
        await db.refresh(email_info)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create email configuration",
        )
    
    return email_info


@router.get("", response_model=UserEmailInfoMaskedResponse)
async def get_email_info(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's email configuration (masked)."""
    result = await db.execute(
        select(UserEmailInfo).where(UserEmailInfo.user_id == current_user.user_id)
    )
    email_info = result.scalars().first()
    
    if not email_info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email configuration not found",
        )
    
    # Return masked response (never expose password)
    return UserEmailInfoMaskedResponse(
        id=email_info.id,
        user_id=email_info.user_id,
        sender_email=mask_email(email_info.sender_email),
        sender_name=email_info.sender_name,
        email_provider=email_info.email_provider,
        created_at=email_info.created_at,
        updated_at=email_info.updated_at,
    )


@router.put("", response_model=UserEmailInfoMaskedResponse)
async def update_email_info(
    email_info_in: UserEmailInfoUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update current user's email configuration."""
    result = await db.execute(
        select(UserEmailInfo).where(UserEmailInfo.user_id == current_user.user_id)
    )
    email_info = result.scalars().first()
    
    if not email_info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email configuration not found",
        )
    
    # Update fields
    if email_info_in.sender_email is not None:
        email_info.sender_email = email_info_in.sender_email
    if email_info_in.sender_name is not None:
        email_info.sender_name = email_info_in.sender_name
    if email_info_in.app_password is not None:
        email_info.encrypted_app_password = encrypt_app_password(email_info_in.app_password)
    if email_info_in.email_provider is not None:
        email_info.email_provider = email_info_in.email_provider
    
    try:
        await db.commit()
        await db.refresh(email_info)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to update email configuration",
        )
    
    return UserEmailInfoMaskedResponse(
        id=email_info.id,
        user_id=email_info.user_id,
        sender_email=mask_email(email_info.sender_email),
        sender_name=email_info.sender_name,
        email_provider=email_info.email_provider,
        created_at=email_info.created_at,
        updated_at=email_info.updated_at,
    )


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_email_info(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete current user's email configuration."""
    result = await db.execute(
        select(UserEmailInfo).where(UserEmailInfo.user_id == current_user.user_id)
    )
    email_info = result.scalars().first()
    
    if not email_info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email configuration not found",
        )
    
    await db.delete(email_info)
    await db.commit()
    return None
