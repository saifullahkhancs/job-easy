from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, String, ForeignKey, Integer, TypeDecorator
from sqlalchemy.orm import declarative_base, relationship
from models.roles import UserRole

Base = declarative_base()


class FlexibleUserRoleType(TypeDecorator):
    """Stores role by NAME (ADMIN/VISITOR/CUSTOMER) for backward compatibility
    with the existing Postgres ENUM, but reads both NAME and VALUE forms.

    The previous buggy update handler stored the lowercase VALUE (\"admin\")
    which broke loading because SQLAlchemy Enum expects the NAME.
    This type tolerates both, converting them to UserRole on read and
    normalizing to NAME on write, so corrupted rows self-heal on next update.
    """

    impl = String(20)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, UserRole):
            return value.name
        raw = str(value).strip()
        if not raw:
            return None
        upper = raw.upper()
        if upper in UserRole.__members__:
            return upper
        lower = raw.lower()
        for member in UserRole:
            if member.value == lower:
                return member.name
        # Fallback: store uppercased if possible, else raw
        return upper if upper in UserRole.__members__ else raw

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        # Direct name match
        if value in UserRole.__members__:
            return UserRole[value]
        upper = str(value).upper()
        if upper in UserRole.__members__:
            return UserRole[upper]
        # Value match (e.g. \"admin\")
        try:
            return UserRole(str(value))
        except ValueError:
            lower = str(value).lower()
            for member in UserRole:
                if member.value == lower:
                    return member
            # As last resort, try case-insensitive name again
            raise LookupError(f"'{value}' is not among valid UserRole values")



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
    role = Column(FlexibleUserRoleType, default=UserRole.VISITOR, nullable=False)
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
