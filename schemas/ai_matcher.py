from pydantic import BaseModel


class JobMatchRequest(BaseModel):
    job_description: str


class TemplateMatch(BaseModel):
    template_id: int
    title: str
    template_role: str
    ownership_label: str
    score: int
    reason: str


class JobMatchResponse(BaseModel):
    matches: list[TemplateMatch]
    contact_email: str | None
    remaining_today: int
    daily_limit: int
