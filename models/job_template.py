from sqlalchemy import Column, Integer, String, LargeBinary, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import declarative_base
from datetime import datetime

from models.user import Base


class JobTemplate(Base):
    __tablename__ = "job_templates"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)  # null for default templates
    template_role = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    context = Column(String, nullable=False)
    filename = Column(String, nullable=False)
    cv_bytes = Column(LargeBinary, nullable=False)
    template_scope = Column(String, nullable=False, default="customer")  # "default" or "customer"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Unique constraint: template_role must be unique per user (or globally for default templates)
    __table_args__ = (
        UniqueConstraint('template_role', 'owner_user_id', name='uq_template_role_per_user'),
    )
