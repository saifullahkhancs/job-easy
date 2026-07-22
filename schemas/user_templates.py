from enum import Enum
from pydantic import BaseModel
from datetime import datetime


class TemplateScope(str, Enum):
    DEFAULT = "default"
    CUSTOMER = "customer"


class UserTemplateBase(BaseModel):
    template_role: str
    title: str
    context: str
    template_scope: TemplateScope = TemplateScope.CUSTOMER


class UserTemplateCreate(UserTemplateBase):
    pass


class UserTemplateUpdate(BaseModel):
    title: str | None = None
    context: str | None = None
    template_role: str | None = None
    is_active: bool | None = None


class UserTemplateResponse(UserTemplateBase):
    id: int
    owner_user_id: int | None
    filename: str
    file_size_bytes: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserTemplateDetailResponse(UserTemplateResponse):
    context: str
