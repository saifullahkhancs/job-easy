from pydantic import BaseModel, EmailStr
from datetime import datetime


class UserEmailInfoBase(BaseModel):
    sender_email: EmailStr
    sender_name: str
    email_provider: str = "gmail"


class UserEmailInfoCreate(UserEmailInfoBase):
    app_password: str


class UserEmailInfoUpdate(BaseModel):
    sender_email: EmailStr | None = None
    sender_name: str | None = None
    app_password: str | None = None
    email_provider: str | None = None


class UserEmailInfoResponse(BaseModel):
    id: int
    user_id: int
    sender_email: EmailStr
    sender_name: str
    email_provider: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserEmailInfoMaskedResponse(BaseModel):
    id: int
    user_id: int
    sender_email: EmailStr
    sender_name: str
    email_provider: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
