from enum import Enum
from pydantic import BaseModel
from datetime import datetime


class RequestStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class EmailAutomationRequestCreate(BaseModel):
    user_email_info_id: int


class EmailAutomationRequestUpdate(BaseModel):
    status: RequestStatus
    admin_notes: str | None = None


class EmailAutomationRequestResponse(BaseModel):
    id: int
    user_email: str
    user_email_info_id: int
    status: RequestStatus
    requested_at: datetime
    reviewed_at: datetime | None
    reviewed_by_admin_email: str | None
    admin_notes: str | None

    class Config:
        from_attributes = True


class EmailAutomationRequestAdminResponse(EmailAutomationRequestResponse):
    pass
