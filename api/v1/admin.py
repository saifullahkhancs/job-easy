from datetime import datetime, timezone
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from api.dependencies import get_current_user, get_db, require_roles
from core.email import (
    notify_safe,
    send_request_approved_email,
    send_request_rejected_email,
)
from core.encryption import mask_email
from models.roles import UserRole
from models.user import User
from models.user_email_info import UserEmailInfo
from models.email_automation_requests import EmailAutomationRequest, RequestStatus
from models.user_templates import UserTemplate, TemplateScope
from schemas.email_automation_requests import EmailAutomationRequestUpdate, EmailAutomationRequestAdminResponse
from schemas.user import UserUpdate, UserResponse

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

# Maximum number of templates a customer may own at once.
CUSTOMER_TEMPLATE_LIMIT = 2
# Maximum number of templates that can be showcased as platform defaults.
MAX_DEFAULT_TEMPLATES = 2


class AssignDefaultTemplateOwnerRequest(BaseModel):
    user_email: EmailStr


def _build_admin_request_response(req: EmailAutomationRequest) -> EmailAutomationRequestAdminResponse:
    """Helper to build the admin response for an approval request."""
    response_dict = {
        "id": req.id,
        "user_email": req.user_email,
        "user_email_info_id": req.user_email_info_id,
        "status": req.status,
        "requested_at": req.requested_at,
        "reviewed_at": req.reviewed_at,
        "reviewed_by_admin_email": req.reviewed_by_admin_email,
        "admin_notes": req.admin_notes,
        "user_email_info": None,
    }

    if req.user_email_info:
        response_dict["user_email_info"] = {
            "id": req.user_email_info.id,
            "user_email": req.user_email_info.user_email,
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


@router.get("/users/{email}", response_model=UserResponse)
async def get_user(
    email: str,
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific user by ID."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return user


@router.patch("/users/{email}", response_model=UserResponse)
async def update_user(
    email: str,
    user_in: UserUpdate,
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    """Update a user (admin only)."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    update_data = user_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "role":
            # value is already a UserRole enum (Pydantic parses it); assign enum directly
            # so SQLAlchemy's Enum column stores it correctly and can be re-loaded.
            user.role = value
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
    background_tasks: BackgroundTasks,
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
    request.reviewed_by_admin_email = current_user.email
    request.admin_notes = request_in.admin_notes

    result = await db.execute(select(User).where(User.email == request.user_email))
    user = result.scalars().first()

    # Approval grants email access; it must never change an existing admin's
    # platform role. Admins remain admins while using this same workflow.
    if request_in.status == RequestStatus.APPROVED:
        if user and user.role != UserRole.ADMIN:
            user.role = UserRole.CUSTOMER

    await db.commit()
    await db.refresh(request)

    # Close the loop with the customer: they asked, an admin decided, so they
    # hear about it. Queued in the background and failure-tolerant so a mail
    # outage cannot undo a decision that is already persisted.
    recipient_name = ""
    if user:
        recipient_name = " ".join(
            part for part in [user.first_name, user.last_name] if part
        ).strip()

    notifier = (
        send_request_approved_email
        if request_in.status == RequestStatus.APPROVED
        else send_request_rejected_email
    )
    background_tasks.add_task(
        _notify_requester,
        notifier,
        request.user_email,
        recipient_name or None,
        request.admin_notes,
    )

    return _build_admin_request_response(request)


async def _notify_requester(notifier, user_email: str, user_name: str | None, admin_notes: str | None) -> None:
    """Send the decision email to the requester without raising on failure."""
    await notify_safe(
        notifier(user_email=user_email, user_name=user_name, admin_notes=admin_notes)
    )


def _template_to_dict(tmpl: UserTemplate, owner: User | None = None) -> dict:
    """Serialize a UserTemplate safely (excluding cv_bytes)."""
    data = {
        "id": tmpl.id,
        "user_email": tmpl.user_email,
        "template_role": tmpl.template_role,
        "title": tmpl.title,
        "context": tmpl.context,
        "filename": tmpl.filename,
        "file_size_bytes": tmpl.file_size_bytes,
        "template_scope": tmpl.template_scope,
        "is_active": tmpl.is_active,
        "created_at": tmpl.created_at,
        "updated_at": tmpl.updated_at,
        "owner": None,
    }
    if owner is not None:
        data["owner"] = {
            "user_email": owner.email,
            "first_name": owner.first_name,
            "last_name": owner.last_name,
            "email": owner.email,
            # Lets the UI word actions correctly: an admin-authored default is
            # returned to an admin, not "to a customer".
            "role": owner.role.value if hasattr(owner.role, "value") else owner.role,
        }
    return data


@router.get("/default-templates")
async def list_default_templates(
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    """List all default templates with their original owner (admin only).

    Default templates keep a reference to the customer who created them so an
    admin can revert them back to that customer instead of deleting them.
    """
    result = await db.execute(
        select(UserTemplate, User)
        .outerjoin(User, UserTemplate.user_email == User.email)
        .where(UserTemplate.template_scope == TemplateScope.DEFAULT)
        .order_by(UserTemplate.created_at.desc())
    )
    return [_template_to_dict(tmpl, owner) for tmpl, owner in result.all()]


@router.get("/all-customer-templates")
async def list_all_customer_templates(
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    """List all customer templates with owner info (admin only)."""
    result = await db.execute(
        select(UserTemplate, User).join(User, UserTemplate.user_email == User.email).where(
            UserTemplate.template_scope == TemplateScope.CUSTOMER,
            UserTemplate.is_active == True,
        ).order_by(UserTemplate.created_at.desc())
    )
    rows = result.all()
    templates = []
    for tmpl, owner in rows:
        templates.append({
            "id": tmpl.id,
            "template_role": tmpl.template_role,
            "title": tmpl.title,
            "context": tmpl.context,
            "filename": tmpl.filename,
            "file_size_bytes": tmpl.file_size_bytes,
            "template_scope": tmpl.template_scope,
            "is_active": tmpl.is_active,
            "created_at": tmpl.created_at,
            "owner": {
                "user_email": owner.email,
                "first_name": owner.first_name,
                "last_name": owner.last_name,
                "email": owner.email,
            },
        })
    return templates


@router.post("/default-templates/promote/{template_id}")
async def promote_to_default(
    template_id: int,
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    """Promote a customer template to a default template (admin only). Max 2 default templates.

    The original owner is preserved on the row so the promotion can later be
    reverted back to the customer instead of deleting their work.
    """
    # Check current default count
    result = await db.execute(
        select(UserTemplate).where(UserTemplate.template_scope == TemplateScope.DEFAULT)
    )
    existing_defaults = result.scalars().all()
    if len(existing_defaults) >= MAX_DEFAULT_TEMPLATES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Maximum of {MAX_DEFAULT_TEMPLATES} default templates allowed. "
                "Revert or remove an existing default template first."
            ),
        )

    # Get the target template
    result = await db.execute(select(UserTemplate).where(UserTemplate.id == template_id))
    template = result.scalars().first()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    if template.template_scope == TemplateScope.DEFAULT:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Template is already a default template")

    # Keep `user_email` so the template can be handed back to its owner later.
    template.template_scope = TemplateScope.DEFAULT
    await db.commit()
    await db.refresh(template)
    return {"message": "Template promoted to default successfully", "template_id": template.id}


@router.post("/default-templates/revert/{template_id}")
async def revert_default_to_customer(
    template_id: int,
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    """Revert a default template back to its owning customer (admin only).

    This is the non-destructive counterpart of deleting a default template:
    the CV goes back to the customer's personal templates untouched.
    """
    result = await db.execute(select(UserTemplate).where(UserTemplate.id == template_id))
    template = result.scalars().first()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    if template.template_scope != TemplateScope.DEFAULT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Template is not a default template",
        )

    if not template.user_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "This default template has no owner recorded, so it cannot be reverted. "
                "Link it to a user first, or delete it."
            ),
        )

    # Make sure the owner still exists before handing the template back.
    result = await db.execute(select(User).where(User.email == template.user_email))
    owner = result.scalars().first()
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The original owner of this template no longer exists. Delete it instead.",
        )

    if owner.role not in (UserRole.CUSTOMER, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The original owner is not a customer or admin, so this template cannot be returned.",
        )

    # Respect the customer authored-template limit of 2. Exclude the default row
    # currently being moved so a 1 personal + 1 promoted customer can recover it.
    # Admins are not capped, so the check only applies to customers.
    if owner.role == UserRole.CUSTOMER:
        result = await db.execute(
            select(UserTemplate).where(
                UserTemplate.user_email == template.user_email,
                UserTemplate.id != template.id,
                UserTemplate.is_active == True,
            )
        )
        if len(result.scalars().all()) >= CUSTOMER_TEMPLATE_LIMIT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"{owner.first_name} {owner.last_name} already has "
                    f"{CUSTOMER_TEMPLATE_LIMIT} authored templates, so this one cannot be returned."
                ),
            )

    template.template_scope = TemplateScope.CUSTOMER
    await db.commit()
    await db.refresh(template)
    return {
        "message": f"Template returned to {owner.first_name} {owner.last_name}.",
        "template_id": template.id,
    }


@router.post("/default-templates/assign/{template_id}")
async def assign_default_template_owner(
    template_id: int,
    payload: AssignDefaultTemplateOwnerRequest,
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    """Link an ownerless default template to a customer or admin.

    Legacy default templates were stored without a `user_email`; this endpoint
    is how those rows get an owner so they can be attributed and reverted.
    """
    result = await db.execute(select(UserTemplate).where(UserTemplate.id == template_id))
    template = result.scalars().first()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    if template.template_scope != TemplateScope.DEFAULT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only default templates can be linked to a user",
        )

    target_email = str(payload.user_email).strip()
    result = await db.execute(select(User).where(User.email == target_email))
    customer = result.scalars().first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if customer.role not in (UserRole.CUSTOMER, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Default templates can only be linked to customer or admin accounts",
        )

    result = await db.execute(
        select(UserTemplate).where(
            UserTemplate.user_email == target_email,
            UserTemplate.template_role == template.template_role,
            UserTemplate.id != template.id,
        )
    )
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"{customer.first_name} {customer.last_name} already has a template "
                f"with the role '{template.template_role}'."
            ),
        )

    template.user_email = target_email
    await db.commit()
    await db.refresh(template)

    return {
        "message": f"Template linked to {customer.first_name} {customer.last_name}.",
        "template": _template_to_dict(template, customer),
    }


@router.post("/default-templates", status_code=status.HTTP_201_CREATED)
async def create_default_template(
    template_role: str = Form(...),
    title: str = Form(...),
    context: str = Form(...),
    cv_pdf: UploadFile = File(...),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    """Create a default template (admin only).

    The admin who uploads the template is stored in `user_email`, exactly like
    every other template row. Leaving it NULL used to make admin-created
    defaults ownerless, so they could not be attributed, reverted or filtered
    by owner anywhere in the app.
    """
    if cv_pdf.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a PDF",
        )

    # Keep the platform showcase within the advertised limit; the promote
    # endpoint already enforces the same cap.
    result = await db.execute(
        select(UserTemplate).where(UserTemplate.template_scope == TemplateScope.DEFAULT)
    )
    if len(result.scalars().all()) >= MAX_DEFAULT_TEMPLATES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Maximum of {MAX_DEFAULT_TEMPLATES} default templates allowed. "
                "Revert or remove an existing default template first."
            ),
        )

    # Roles are stored lowercase everywhere so ownership uniqueness is stable.
    normalized_template_role = template_role.strip().lower()

    result = await db.execute(
        select(UserTemplate).where(
            UserTemplate.user_email == current_user.email,
            UserTemplate.template_role == normalized_template_role,
        )
    )
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A template with the role '{template_role}' already exists.",
        )

    cv_bytes = await cv_pdf.read()

    template = UserTemplate(
        # Default templates keep the e-mail of the admin who created them.
        user_email=current_user.email,
        template_role=normalized_template_role,
        title=title,
        context=context,
        cv_bytes=cv_bytes,
        filename=cv_pdf.filename or "cv.pdf",
        template_scope=TemplateScope.DEFAULT,
    )

    db.add(template)
    await db.commit()
    await db.refresh(template)

    return _template_to_dict(template, current_user)
