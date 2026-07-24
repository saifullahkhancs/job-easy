from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status, Request
from jose import JWTError, jwt
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from slowapi import Limiter
from slowapi.util import get_remote_address

from api.dependencies import get_current_user, get_db
from core.config import settings
from core.email import (
    EmailDeliveryError,
    send_password_reset_email,
    send_verification_email,
)
from core.security import (
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    generate_5_digit_code,
    generate_token_id,
    hash_password,
    verify_password,
)
from models.roles import UserRole
from models.user import PasswordResetToken, User
from schemas.auth import (
    RefreshTokenRequest,
    ForgotPasswordRequest,
    RegisterResponse,
    ResetPasswordRequest,
    Token,
    ResendVerificationRequest,
    TokenPayload,
    UserLogin,
    UserRegister,
    VerifyEmail,
)
from schemas.user_profile import UserProfileResponse, ApprovalStatus

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)

VERIFICATION_CODE_TTL_MINUTES = 15
VERIFICATION_ATTEMPT_LIMIT = 5
VERIFICATION_ATTEMPT_WINDOW_MINUTES = 15
PASSWORD_RESET_MESSAGE = (
    "If an account exists for this email, a password reset link has been sent"
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_aware(value: datetime | None) -> datetime | None:
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


@router.post("/register", response_model=RegisterResponse,response_model_exclude_none=True, status_code=status.HTTP_201_CREATED,)
@limiter.limit("5/minute")
async def register(
    request: Request,
    user_in: UserRegister,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    # Check for existing user by email
    result = await db.execute(select(User).where(User.email == user_in.email))
    existing_user = result.scalars().first()
    if existing_user is not None:
        response.status_code = status.HTTP_200_OK
        return {"message": "User already exists"}

    verification_code = generate_5_digit_code()
    now = _utc_now()
    user = User(
        first_name=user_in.first_name,
        last_name=user_in.last_name,
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        is_verified=False,
        verification_code=verification_code,
        verification_code_expires_at=now
        + timedelta(minutes=VERIFICATION_CODE_TTL_MINUTES),
        verification_attempt_count=0,
        verification_attempt_window_start=now,
        role=UserRole.VISITOR,
    )

    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        response.status_code = status.HTTP_200_OK
        return {"message": "User already exists"}

    try:
        await send_verification_email(user.email, verification_code)
    except EmailDeliveryError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Account created, but verification email could not be sent",
        )

    return {"message": "Verification code sent to email"}


@router.post("/verify-email")
@limiter.limit("10/minute")
async def verify_email(request: Request, data: VerifyEmail, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalars().first()

    if user is None:
        raise HTTPException(status_code=400, detail="Invalid code or email")

    now = _utc_now()
    window_start = _ensure_aware(user.verification_attempt_window_start)
    if (
        window_start is None
        or window_start + timedelta(minutes=VERIFICATION_ATTEMPT_WINDOW_MINUTES) <= now
    ):
        user.verification_attempt_window_start = now
        user.verification_attempt_count = 0

    if user.verification_attempt_count >= VERIFICATION_ATTEMPT_LIMIT:
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many verification attempts. Please try again later.",
        )

    user.verification_attempt_count += 1

    code_expires_at = _ensure_aware(user.verification_code_expires_at)
    if code_expires_at is None or code_expires_at <= now:
        await db.commit()
        raise HTTPException(status_code=400, detail="Code expired")

    if user.verification_code != data.code:
        await db.commit()
        raise HTTPException(status_code=400, detail="Invalid code or email")

    user.is_verified = True
    user.verification_code = None
    user.verification_code_expires_at = None
    user.verification_attempt_count = 0
    user.verification_attempt_window_start = None
    await db.commit()
    return {"message": "Account verified successfully"}


@router.post("/resend-verification")
async def resend_verification(
    data: ResendVerificationRequest, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalars().first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    if user.is_verified:
        return {"message": "Account already verified"}

    verification_code = generate_5_digit_code()
    now = _utc_now()
    user.verification_code = verification_code
    user.verification_code_expires_at = now + timedelta(
        minutes=VERIFICATION_CODE_TTL_MINUTES
    )
    user.verification_attempt_count = 0
    user.verification_attempt_window_start = now

    try:
        await send_verification_email(user.email, verification_code)
    except EmailDeliveryError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Verification email could not be sent",
        )
    await db.commit()
    return {"message": "Verification code sent to email"}


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
async def login(request: Request, credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalars().first()

    if user is None or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Please verify your email first")

    subject = {
        "sub": str(user.user_id),
        "role": user.role.value if hasattr(user.role, "value") else user.role,
    }
    access_token = create_access_token(subject)
    refresh_token = create_refresh_token(subject)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(
    request: Request, data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalars().first()

    if user is None:
        return {"message": PASSWORD_RESET_MESSAGE}

    reset_token_id = generate_token_id()
    reset_token = create_password_reset_token(user.email, reset_token_id)
    db.add(
        PasswordResetToken(
            token_id=reset_token_id,
            email=user.email,
            expires_at=_utc_now()
            + timedelta(minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES),
        )
    )
    await db.commit()
    reset_link = f"{settings.PASSWORD_RESET_URL}?token={reset_token}"

    try:
        await send_password_reset_email(user.email, reset_link)
    except EmailDeliveryError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password reset email could not be sent",
        )

    return {"message": PASSWORD_RESET_MESSAGE}


@router.post("/resend-password-reset")
async def resend_password_reset(
    data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)
):
    return await forgot_password(data, db)

@router.post("/reset-password")
@limiter.limit("5/minute")
async def reset_password(
    request: Request, data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)
):
    try:
        payload = jwt.decode(
            data.token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        if payload.get("token_type") != "password_reset":
            raise JWTError("Invalid token type")
        email = payload.get("sub")
        token_id = payload.get("jti")
        if not email or not token_id:
            raise JWTError("Missing subject")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired reset token")

    result = await db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token_id == token_id)
    )
    reset_token = result.scalars().first()
    if (
        reset_token is None
        or reset_token.email != email
        or _ensure_aware(reset_token.expires_at) <= _utc_now()
    ):
        raise HTTPException(status_code=401, detail="Invalid or expired reset token")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired reset token")

    user.hashed_password = hash_password(data.password)
    await db.delete(reset_token)
    await db.commit()
    return {"message": "Password reset successfully"}


@router.post("/refresh", response_model=Token)
async def refresh_token(data: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    try:
        payload = jwt.decode(
            data.refresh_token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        token_data = TokenPayload(**payload)
        if token_data.token_type != "refresh":
            raise JWTError("Invalid token type")
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    # Try to find user by email (for backward compatibility with old tokens)
    result = await db.execute(select(User).where(User.email == token_data.sub))
    user = result.scalars().first()
    
    # If not found by email, try by user_id (for new tokens)
    if not user:
        try:
            user_id = int(token_data.sub)
            result = await db.execute(select(User).where(User.user_id == user_id))
            user = result.scalars().first()
        except (ValueError, TypeError):
            pass

    if user is None or not user.is_verified:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    subject = {
        "sub": str(user.user_id),
        "role": user.role.value if hasattr(user.role, "value") else user.role,
    }

    return {
        "access_token": create_access_token(subject),
        "refresh_token": create_refresh_token(subject),
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserProfileResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user profile with approval status and permissions."""
    from models.email_automation_requests import EmailAutomationRequest
    from models.user_templates import UserTemplate
    from models.user_email_info import UserEmailInfo
    
    # Determine approval status based on role and automation request
    if current_user.role == UserRole.ADMIN:
        approval_status = ApprovalStatus.APPROVED
    elif current_user.role == UserRole.CUSTOMER:
        approval_status = ApprovalStatus.APPROVED
    else:
        # Check if there's an approved request
        result = await db.execute(
            select(EmailAutomationRequest).where(
                EmailAutomationRequest.user_id == current_user.user_id,
                EmailAutomationRequest.status == "approved"
            )
        )
        approved_request = result.scalars().first()
        if approved_request:
            approval_status = ApprovalStatus.APPROVED
        else:
            # Check for rejected request
            result = await db.execute(
                select(EmailAutomationRequest).where(
                    EmailAutomationRequest.user_id == current_user.user_id,
                    EmailAutomationRequest.status == "rejected"
                )
            )
            rejected_request = result.scalars().first()
            if rejected_request:
                approval_status = ApprovalStatus.REJECTED
            else:
                # Check for pending request
                result = await db.execute(
                    select(EmailAutomationRequest).where(
                        EmailAutomationRequest.user_id == current_user.user_id,
                        EmailAutomationRequest.status == "pending"
                    )
                )
                pending_request = result.scalars().first()
                if pending_request:
                    approval_status = ApprovalStatus.PENDING
                else:
                    approval_status = ApprovalStatus.NONE
    
    # Check if user has email info
    result = await db.execute(
        select(UserEmailInfo).where(UserEmailInfo.user_id == current_user.user_id)
    )
    has_email_info = result.scalars().first() is not None
    
    # Count user's templates
    result = await db.execute(
        select(UserTemplate).where(
            UserTemplate.owner_user_id == current_user.user_id,
            UserTemplate.template_scope == "customer"
        )
    )
    current_template_count = len(result.scalars().all())
    
    # Determine permissions
    can_manage_templates = current_user.role in [UserRole.ADMIN, UserRole.CUSTOMER]
    can_send_email = current_user.role == UserRole.CUSTOMER
    template_limit = 2 if current_user.role == UserRole.CUSTOMER else 0
    
    return UserProfileResponse(
        user_id=current_user.user_id,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        email=current_user.email,
        is_verified=current_user.is_verified,
        role=current_user.role,
        approval_status=approval_status,
        can_manage_templates=can_manage_templates,
        can_send_email=can_send_email,
        has_email_info=has_email_info,
        template_limit=template_limit,
        current_template_count=current_template_count,
    )
