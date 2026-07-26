from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, String, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import declarative_base, relationship
from models.roles import UserRole

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    # Email is the stable identity used by every user-owned record.
    email = Column(String, primary_key=True, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    verification_code = Column(String, nullable=True)
    verification_code_expires_at = Column(DateTime(timezone=True), nullable=True)
    verification_attempt_count = Column(Integer, default=0, nullable=False)
    verification_attempt_window_start = Column(DateTime(timezone=True), nullable=True)
    role = Column(SQLEnum(UserRole), default=UserRole.VISITOR, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    email_info = relationship("UserEmailInfo", back_populates="user", uselist=False)
    templates = relationship("UserTemplate", back_populates="owner", foreign_keys="UserTemplate.user_email")
    automation_requests = relationship("EmailAutomationRequest", back_populates="user", foreign_keys="EmailAutomationRequest.user_email")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    token_id = Column(String, primary_key=True, index=True, nullable=False)
    email = Column(String, ForeignKey("users.email"), nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
