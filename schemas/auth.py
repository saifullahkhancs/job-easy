from pydantic import BaseModel, EmailStr, HttpUrl
from models.roles import UserRole


class UserRegister(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    linkedin_url: HttpUrl

class UserResponse(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    is_verified: bool
    role: UserRole

    class Config:
        from_attributes = True

class VerifyEmail(BaseModel):
    email: EmailStr
    code: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RegisterResponse(BaseModel):
    message: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class TokenPayload(BaseModel):
    sub: str  # Can be email (old) or user_id (new)
    role: UserRole
    token_type: str | None = None
