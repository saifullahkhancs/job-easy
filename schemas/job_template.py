from enum import Enum
from pydantic import BaseModel, EmailStr


class JobType(str, Enum):
    python_dev = "Python Developer"
    fullstack_dev = "Full Stack Developer"


class JobTemplateResponse(BaseModel):
    type: str
    title: str
    filename: str
    file_size_bytes: int
    context: str | None = None

    class Config:
        from_attributes = True


class JobTemplateCreate(BaseModel):
    type: JobType
    title: str
    context: str


class JobTemplateUpdate(BaseModel):
    title: str | None = None
    context: str | None = None


class SendEmailRequest(BaseModel):
    recipient_email: EmailStr
    type: str
