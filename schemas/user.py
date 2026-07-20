from pydantic import BaseModel, EmailStr

from models.roles import UserRole


class UserResponse(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    is_verified: bool
    role: UserRole

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
