from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from api.dependencies import get_current_user, get_db, require_roles
from core.encryption import mask_email
from models.roles import UserRole
from models.user import User
from models.user_email_info import UserEmailInfo
from models.email_automation_requests import EmailAutomationRequest, RequestStatus
from models.user_templates import UserTemplate, TemplateScope
from schemas.email_automation_requests import EmailAutomationRequestUpdate, EmailAutomationRequestAdminResponse
from schemas.user import UserUpdate, UserResponse

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def _build_admin_request_response(req: EmailAutomationRequest) -> EmailAutomationRequestAdminResponse:
    """Helper to build the admin response for an approval request."""
    response_dict = {
        "id": req.id,
        "user_id": req.user_id,
        "user_email_info_id": req.user_email_info_id,
        "status": req.status,
        "requested_at": req.requested_at,
        "reviewed_at": req.reviewed_at,
        "reviewed_by_admin_id": req.reviewed_by_admin_id,
        "admin_notes": req.admin_notes,
        "user_email": None,
    }
    
    if req.user_email_info:
        response_dict["user_email"] = {
            "id": req.user_email_info.id,
            "user_id": req.user_email_info.user_id,
            "sender_email": mask_email(req.user_email_info.sender_email),
            "sender_name": req.user_email_info.sender_name,
            "email_provider": req.user_email_info.email_provider,
        }
    
    return EmailAutomationRequestAdminResponse(**response_dict)


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    role: UserRole | None = Query(None, description="Filter by role"),
    is_verified: bool | None = Query(None, description="Filter by verification status"),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    """List all users with optional filtering."""
    query = select(User)
    
    if role:
        query = query.where(User.role == role)
    if is_verified is not None:
        query = query.where(User.is_verified == is_verified)
    
    query = query.order_by(User.created_at.desc())
    result = await db.execute(query)
    users = result.scalars().all()
    return users


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific user by ID."""
    result = await db.execute(select(User).where(User.user_id == user_id))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    return user


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_in: UserUpdate,
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    """Update a user (admin only)."""
    result = await db.execute(select(User).where(User.user_id == user_id))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    update_data = user_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "role":
            user.role = value.value if hasattr(value, "value") else value
        elif field == "password":
            from core.security import hash_password
            user.hashed_password = hash_password(value)
        else:
            setattr(user, field, value)
    
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/approval-requests", response_model=list[EmailAutomationRequestAdminResponse])
async def list_approval_requests(
    status: RequestStatus | None = Query(None, description="Filter by status"),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    """List all approval requests with optional filtering."""
    query = select(EmailAutomationRequest).options(
        selectinload(EmailAutomationRequest.user),
        selectinload(EmailAutomationRequest.user_email_info)
    )
    
    if status:
        query = query.where(EmailAutomationRequest.status == status)
    
    query = query.order_by(EmailAutomationRequest.requested_at.desc())
    result = await db.execute(query)
    requests = result.scalars().all()
    
    return [_build_admin_request_response(req) for req in requests]


@router.get("/approval-requests/{request_id}", response_model=EmailAutomationRequestAdminResponse)
async def get_approval_request(
    request_id: int,
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific approval request."""
    result = await db.execute(
        select(EmailAutomationRequest).options(
            selectinload(EmailAutomationRequest.user),
            selectinload(EmailAutomationRequest.user_email_info)
        ).where(EmailAutomationRequest.id == request_id)
    )
    request = result.scalars().first()
    
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval request not found",
        )
    
    return _build_admin_request_response(request)


@router.patch("/approval-requests/{request_id}", response_model=EmailAutomationRequestAdminResponse)
async def review_approval_request(
    request_id: int,
    request_in: EmailAutomationRequestUpdate,
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    """Approve or reject an approval request."""
    result = await db.execute(
        select(EmailAutomationRequest).options(
            selectinload(EmailAutomationRequest.user),
            selectinload(EmailAutomationRequest.user_email_info)
        ).where(EmailAutomationRequest.id == request_id)
    )
    request = result.scalars().first()
    
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval request not found",
        )
    
    if request.status != RequestStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request has already been reviewed",
        )
    
    # Update request
    request.status = request_in.status
    request.reviewed_at = datetime.now(timezone.utc)
    request.reviewed_by_admin_id = current_user.user_id
    request.admin_notes = request_in.admin_notes
    
    # If approved, change user role to customer
    if request_in.status == RequestStatus.APPROVED:
        result = await db.execute(select(User).where(User.user_id == request.user_id))
        user = result.scalars().first()
        if user:
            user.role = UserRole.CUSTOMER
    
    await db.commit()
    await db.refresh(request)
    
    return _build_admin_request_response(request)


@router.get("/default-templates")
async def list_default_templates(
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    """List all default templates (admin only)."""
    result = await db.execute(
        select(UserTemplate).where(
            UserTemplate.template_scope == TemplateScope.DEFAULT
        ).order_by(UserTemplate.created_at.desc())
    )
    templates = result.scalars().all()
    return templates


@router.post("/default-templates", status_code=status.HTTP_201_CREATED)
async def create_default_template(
    template_role: str = Form(...),
    title: str = Form(...),
    context: str = Form(...),
    cv_pdf: UploadFile = File(...),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    """Create a default template (admin only)."""
    if cv_pdf.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a PDF",
        )
    
    cv_bytes = await cv_pdf.read()
    
    template = UserTemplate(
        owner_user_id=None,  # Default templates have no owner
        template_role=template_role,
        title=title,
        context=context,
        cv_bytes=cv_bytes,
        filename=cv_pdf.filename or "cv.pdf",
        template_scope=TemplateScope.DEFAULT,
    )
    
    db.add(template)
    await db.commit()
    await db.refresh(template)
    
    return template
