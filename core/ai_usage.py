"""Per-user daily allowance for the AI job-description matcher.

The matcher runs against a shared free-tier provider key, so each user gets a
soft cap per UTC day (``AI_MATCH_DAILY_LIMIT``). This module owns the counter
so the endpoint stays a thin orchestrator.

Counting is attempt-based: the allowance is consumed the moment a request is
about to hit the provider, and is not refunded if the provider errors. That
keeps the behaviour simple and predictable, and stops a user from hammering a
flaky endpoint to burn the shared quota.
"""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from models.ai_usage import AiUsage


class DailyLimitExceeded(Exception):
    """Raised when the user has already used their whole daily allowance."""

    def __init__(self, limit: int):
        self.limit = limit
        super().__init__(f"Daily AI matching limit of {limit} reached.")


def utc_today():
    """The UTC date used to bucket usage. Deterministic across servers."""
    return datetime.now(timezone.utc).date()


async def _get_row(db: AsyncSession, user_email: str):
    result = await db.execute(
        select(AiUsage).where(
            AiUsage.user_email == user_email,
            AiUsage.usage_date == utc_today(),
        )
    )
    return result.scalars().first()


async def remaining_today(db: AsyncSession, user_email: str) -> int:
    """How many AI matches the user has left today (0..limit)."""
    row = await _get_row(db, user_email)
    used = row.count if row is not None else 0
    return max(settings.AI_MATCH_DAILY_LIMIT - used, 0)


async def consume_allowance(db: AsyncSession, user_email: str) -> int:
    """Increment today's counter and return the calls remaining afterwards.

    Raises :class:`DailyLimitExceeded` when the user is already at the cap, in
    which case nothing is incremented.
    """
    limit = settings.AI_MATCH_DAILY_LIMIT
    row = await _get_row(db, user_email)

    if row is None:
        db.add(AiUsage(user_email=user_email, usage_date=utc_today(), count=1))
        used = 1
    else:
        if row.count >= limit:
            raise DailyLimitExceeded(limit)
        row.count += 1
        used = row.count

    await db.commit()
    return max(limit - used, 0)
