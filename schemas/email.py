from pydantic import BaseModel, EmailStr


class SendEmailRequest(BaseModel):
    recipient_email: EmailStr
    template_id: int
