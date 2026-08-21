from datetime import date

from sqlalchemy import Column, Date, ForeignKey, Integer, String

from models.user import Base


class AiUsage(Base):
    """Per-user, per-day counter for the AI job-description matcher.

    The matcher runs on a shared free-tier LLM key with a tiny daily allowance,
    so every user gets a soft cap (``AI_MATCH_DAILY_LIMIT``, default 20) that
    resets each UTC day. The composite primary key means there is at most one
    row per (user, day), which keeps the increment cheap and race-tolerant.
    """

    __tablename__ = "ai_matcher_usage"

    user_email = Column(String, ForeignKey("users.email"), primary_key=True, nullable=False)
    usage_date = Column(Date, primary_key=True, nullable=False, default=date.today)
    count = Column(Integer, nullable=False, default=0)
