from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Integer, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import declarative_base, relationship
from models.user import Base


class UserEmailInfo(Base):
    __tablename__ = "user_email_info"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, unique=True, index=True)
    sender_email = Column(String, nullable=False)
    sender_name = Column(String, nullable=False)
    encrypted_app_password = Column(String, nullable=False)
    email_provider = Column(String, default="gmail", nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", back_populates="email_info")
    automation_requests = relationship("EmailAutomationRequest", back_populates="user_email_info")
