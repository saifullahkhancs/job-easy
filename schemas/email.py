from pydantic import BaseModel, EmailStr


class SendEmailRequest(BaseModel):
    recipient_email: EmailStr
    template_id: int
    # Optional per-send overrides. When omitted (or left blank) the stored
    # template's title/context are used as-is, so the template itself never
    # changes — these only affect the single email being sent right now.
    subject: str | None = None
    body: str | None = None
