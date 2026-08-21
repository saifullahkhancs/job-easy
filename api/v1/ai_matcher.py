"""AI Job Description Matcher + contact-email extractor.

One endpoint, one batched LLM call per submission: the model scores every
template the user is allowed to see *and* extracts a recruiter email from the
pasted job description in the same request. That single-call shape is what
keeps the feature inside a free-tier daily allowance.

Error handling is deliberately explicit — running dry on a free key is
expected — so provider outages, rate limits and the per-user daily cap each
surface as a distinct, machine-readable error instead of a generic 500.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies import get_current_user, get_db
from api.v1.templates_v2 import get_visible_templates
from core import ai_matching
from core.ai_usage import DailyLimitExceeded, consume_allowance, remaining_today
from core.config import settings
from core.llm import (
    LLMError,
    LLMRateLimitedError,
    LLMUnavailableError,
    match_job_description,
)
from core.template_display import template_ownership_label
from models.user import User
from schemas.ai_matcher import JobMatchRequest, JobMatchResponse, TemplateMatch

router = APIRouter(prefix="/api/v1/ai", tags=["ai-matcher"])


class AIMatcherError(Exception):
    """Domain error carrying a machine-readable ``code`` for the frontend."""

    def __init__(self, status_code: int, code: str, message: str, **extra):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.extra = extra
        super().__init__(message)


async def ai_matcher_error_handler(request: Request, exc: AIMatcherError) -> JSONResponse:
    """Render matcher errors as ``{"detail", "code", ...}`` JSON."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message, "code": exc.code, **exc.extra},
    )


def _template_brief(template) -> dict:
    """A trimmed view of one template for the prompt (no CV bytes sent)."""
    context = (template.context or "").strip()
    if len(context) > 1000:
        context = context[:1000] + "…"
    return {
        "id": template.id,
        "title": template.title or "",
        "template_role": template.template_role or "",
        "context": context,
    }


def _quota_error(limit: int) -> AIMatcherError:
    return AIMatcherError(
        status.HTTP_429_TOO_MANY_REQUESTS,
        "daily_limit_reached",
        f"You've used all {limit} AI matches for today. The daily limit resets at midnight UTC — please try again tomorrow.",
        remaining=0,
        limit=limit,
    )


@router.post("/match", response_model=JobMatchResponse)
async def match_job_description_endpoint(
    payload: JobMatchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Score the user's templates against a pasted job description."""
    description = (payload.job_description or "").strip()

    if len(description) < settings.AI_MATCH_MIN_CHARS:
        raise HTTPException(
            422,
            detail=(
                f"Job description is too short. Please paste at least "
                f"{settings.AI_MATCH_MIN_CHARS} characters."
            ),
        )
    if len(description) > settings.AI_MATCH_MAX_CHARS:
        raise HTTPException(
            422,
            detail=(
                f"Job description is too long. Please keep it under "
                f"{settings.AI_MATCH_MAX_CHARS} characters."
            ),
        )

    # Reuse the exact visibility rules from the templates API.
    templates = await get_visible_templates(db, current_user)

    # Nothing to score: answer without spending the shared AI quota.
    if not templates:
        return JobMatchResponse(
            matches=[],
            contact_email=None,
            remaining_today=await remaining_today(db, current_user.email),
            daily_limit=settings.AI_MATCH_DAILY_LIMIT,
        )

    # Spend the per-user daily allowance BEFORE touching the provider.
    try:
        remaining = await consume_allowance(db, current_user.email)
    except DailyLimitExceeded as exc:
        raise _quota_error(exc.limit) from exc

    briefs = [_template_brief(t) for t in templates]

    # Exactly one batched AI call for the whole submission.
    try:
        raw = await match_job_description(description, briefs)
    except LLMRateLimitedError as exc:
        raise AIMatcherError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "ai_unavailable",
            str(exc),
        ) from exc
    except LLMUnavailableError as exc:
        raise AIMatcherError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "ai_unavailable",
            str(exc),
        ) from exc
    except LLMError as exc:
        raise AIMatcherError(
            status.HTTP_502_BAD_GATEWAY,
            "ai_failed",
            f"The AI could not analyse this job description. {str(exc)}",
        ) from exc

    matches_by_id, contact_email = ai_matching.sanitize_result(raw, templates)

    ranked = []
    for template in templates:
        match = matches_by_id[template.id]
        ranked.append(
            TemplateMatch(
                template_id=template.id,
                title=template.title or "",
                template_role=template.template_role or "",
                ownership_label=template_ownership_label(
                    template.template_scope,
                    template.user_email,
                    current_user.email,
                ),
                score=match["score"],
                reason=match["reason"],
            )
        )
    ranked.sort(key=lambda m: m.score, reverse=True)

    return JobMatchResponse(
        matches=ranked,
        contact_email=contact_email,
        remaining_today=remaining,
        daily_limit=settings.AI_MATCH_DAILY_LIMIT,
    )
