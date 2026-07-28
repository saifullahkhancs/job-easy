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
    user_email: str | None
    filename: str
    file_size_bytes: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    # True when the requesting user is the original author of this template.
    # A default template can still be owned by the customer who created it,
    # which lets the UI congratulate them instead of showing an empty state.
    is_mine: bool = False
    # Ownership/type label used by every template dropdown:
    # "Owned by you" | "Default" | "Default · Owned by you" | "User".
    ownership_label: str = ""
    # Display group used for ordering: 0 = mine, 1 = default, 2 = other users.
    display_group: int = 0

    class Config:
        from_attributes = True


class UserTemplateDetailResponse(UserTemplateResponse):
    context: str
