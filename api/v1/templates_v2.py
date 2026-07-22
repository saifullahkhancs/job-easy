from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from api.dependencies import get_current_user, get_db, require_roles
from models.roles import UserRole
from models.user import User
from models.user_templates import UserTemplate, TemplateScope
from schemas.user_templates import (
    UserTemplateCreate,
    UserTemplateUpdate,
    UserTemplateResponse,
    UserTemplateDetailResponse,
)

router = APIRouter(prefix="/api/v1/templates", tags=["templates"])


@router.get("", response_model=list[UserTemplateResponse])
async def list_templates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List templates based on user role."""
    if current_user.role == UserRole.ADMIN:
        # Admins see all templates
        result = await db.execute(select(UserTemplate).order_by(UserTemplate.created_at.desc()))
        templates = result.scalars().all()
    elif current_user.role == UserRole.VISITOR:
        # Visitors see only default templates
        result = await db.execute(
            select(UserTemplate).where(
                UserTemplate.template_scope == TemplateScope.DEFAULT,
                UserTemplate.is_active == True
            ).order_by(UserTemplate.created_at.desc())
        )
        templates = result.scalars().all()
    else:  # CUSTOMER
        # Customers see only their own templates by default
        result = await db.execute(
            select(UserTemplate).where(
                UserTemplate.owner_user_id == current_user.user_id,
                UserTemplate.template_scope == TemplateScope.CUSTOMER,
                UserTemplate.is_active == True
            ).order_by(UserTemplate.created_at.desc())
        )
        templates = result.scalars().all()
    
    return templates


@router.get("/{template_id}", response_model=UserTemplateDetailResponse)
async def get_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific template by ID."""
    result = await db.execute(select(UserTemplate).where(UserTemplate.id == template_id))
    template = result.scalars().first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )
    
    # Authorization check
    if current_user.role == UserRole.VISITOR:
        if template.template_scope != TemplateScope.DEFAULT:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Visitors can only access default templates",
            )
    elif current_user.role == UserRole.CUSTOMER:
        if template.owner_user_id != current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access your own templates",
            )
    
    return template


@router.get("/{template_id}/cv")
async def download_cv(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download CV for a specific template."""
    result = await db.execute(select(UserTemplate).where(UserTemplate.id == template_id))
    template = result.scalars().first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )
    
    # Authorization check
    if current_user.role == UserRole.VISITOR:
        if template.template_scope != TemplateScope.DEFAULT:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Visitors can only access default templates",
            )
    elif current_user.role == UserRole.CUSTOMER:
        if template.owner_user_id != current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access your own templates",
            )
    
    return Response(
        content=template.cv_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{template.filename}"'},
    )


@router.post("", response_model=UserTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    template_role: str = Form(...),
    title: str = Form(...),
    context: str = Form(...),
    cv_pdf: UploadFile = File(...),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.CUSTOMER])),
    db: AsyncSession = Depends(get_db),
):
    """Create a new template (admin or customer only)."""
    # Validate file type
    if cv_pdf.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a PDF",
        )
    
    # For customers, enforce max 2 templates limit
    if current_user.role == UserRole.CUSTOMER:
        result = await db.execute(
            select(UserTemplate).where(
                UserTemplate.owner_user_id == current_user.user_id,
                UserTemplate.template_scope == TemplateScope.CUSTOMER
            )
        )
        existing_count = len(result.scalars().all())
        if existing_count >= 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum limit of 2 templates reached",
            )
    
    cv_bytes = await cv_pdf.read()
    
    template = UserTemplate(
        owner_user_id=current_user.user_id if current_user.role == UserRole.CUSTOMER else None,
        template_role=template_role,
        title=title,
        context=context,
        cv_bytes=cv_bytes,
        filename=cv_pdf.filename or "cv.pdf",
        template_scope=TemplateScope.CUSTOMER if current_user.role == UserRole.CUSTOMER else TemplateScope.DEFAULT,
    )
    
    db.add(template)
    await db.commit()
    await db.refresh(template)
    
    return template


@router.put("/{template_id}", response_model=UserTemplateResponse)
async def update_template(
    template_id: int,
    template_in: UserTemplateUpdate,
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.CUSTOMER])),
    db: AsyncSession = Depends(get_db),
):
    """Update a template (admin or customer only)."""
    result = await db.execute(select(UserTemplate).where(UserTemplate.id == template_id))
    template = result.scalars().first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )
    
    # Authorization check
    if current_user.role == UserRole.CUSTOMER:
        if template.owner_user_id != current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update your own templates",
            )
    
    # Update fields
    update_data = template_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)
    
    await db.commit()
    await db.refresh(template)
    
    return template


@router.patch("/{template_id}/cv", response_model=UserTemplateResponse)
async def update_template_cv(
    template_id: int,
    cv_pdf: UploadFile = File(...),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.CUSTOMER])),
    db: AsyncSession = Depends(get_db),
):
    """Update CV for a template (admin or customer only)."""
    if cv_pdf.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a PDF",
        )
    
    result = await db.execute(select(UserTemplate).where(UserTemplate.id == template_id))
    template = result.scalars().first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )
    
    # Authorization check
    if current_user.role == UserRole.CUSTOMER:
        if template.owner_user_id != current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update your own templates",
            )
    
    template.cv_bytes = await cv_pdf.read()
    template.filename = cv_pdf.filename or template.filename
    
    await db.commit()
    await db.refresh(template)
    
    return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: int,
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.CUSTOMER])),
    db: AsyncSession = Depends(get_db),
):
    """Delete a template (admin or customer only)."""
    result = await db.execute(select(UserTemplate).where(UserTemplate.id == template_id))
    template = result.scalars().first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )
    
    # Authorization check
    if current_user.role == UserRole.CUSTOMER:
        if template.owner_user_id != current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own templates",
            )
    
    await db.delete(template)
    await db.commit()
    return None
