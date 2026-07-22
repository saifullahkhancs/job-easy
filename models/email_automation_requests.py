from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import Column, DateTime, Integer, String, ForeignKey, Enum as SQLEnum, Text
from sqlalchemy.orm import declarative_base, relationship
from models.user import Base


class RequestStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class EmailAutomationRequest(Base):
    __tablename__ = "email_automation_requests"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True)
    user_email_info_id = Column(Integer, ForeignKey("user_email_info.id"), nullable=False)
    status = Column(SQLEnum(RequestStatus), default=RequestStatus.PENDING, nullable=False)
    requested_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by_admin_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    admin_notes = Column(Text, nullable=True)

    # Relationships
    user = relationship("User", back_populates="automation_requests", foreign_keys=[user_id])
    reviewed_by_admin = relationship("User", foreign_keys=[reviewed_by_admin_id])
