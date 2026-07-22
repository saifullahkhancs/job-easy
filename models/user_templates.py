from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import Column, DateTime, Integer, String, LargeBinary, ForeignKey, Boolean, Enum as SQLEnum, UniqueConstraint
from sqlalchemy.orm import declarative_base, relationship
from models.user import Base


class TemplateScope(str, Enum):
    DEFAULT = "default"
    CUSTOMER = "customer"


class UserTemplate(Base):
    __tablename__ = "user_templates"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    owner_user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True, index=True)
    template_role = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    context = Column(String, nullable=False)
    filename = Column(String, nullable=False)
    cv_bytes = Column(LargeBinary, nullable=False)
    template_scope = Column(SQLEnum(TemplateScope), default=TemplateScope.CUSTOMER, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    owner = relationship("User", back_populates="templates")

    # Unique constraint: template_role must be unique per user (or globally for default templates)
    __table_args__ = (
        UniqueConstraint('template_role', 'owner_user_id', name='uq_template_role_per_user'),
    )
