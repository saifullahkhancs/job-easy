from pydantic import BaseModel
from models.roles import UserRole
from enum import Enum


class ApprovalStatus(str, Enum):
    NONE = "none"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class UserProfileResponse(BaseModel):
    user_id: int
    first_name: str
    last_name: str
    email: str
    is_verified: bool
    role: UserRole
    approval_status: ApprovalStatus
    can_manage_templates: bool
    can_send_email: bool
    has_email_info: bool
    template_limit: int
    current_template_count: int

    class Config:
        from_attributes = True
