from datetime import datetime
from pydantic import BaseModel, EmailStr, HttpUrl
from models.roles import UserRole


class UserResponse(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    is_verified: bool
    role: UserRole
    created_at: datetime | None = None
    updated_at: datetime | None = None
    # Legacy field still expected by the admin UI; not present in current User model
    # but kept optional so the response remains backward compatible.
    linkedin_url: str | None = None

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    password: str | None = None
    is_verified: bool | None = None
    role: UserRole | None = None


class UserDeleteResponse(BaseModel):
    message: str
