"""Add per-user daily usage tracking for the AI job matcher.

The matcher lives on a shared free-tier LLM key, so we record one row per
(user, UTC day) and cap each user at ``AI_MATCH_DAILY_LIMIT`` (default 20).
The composite primary key enforces the one-row-per-day invariant directly.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7d41f2a9c05"
down_revision: Union[str, Sequence[str], None] = "e4a7c9b12f80"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_matcher_usage",
        sa.Column("user_email", sa.String(), sa.ForeignKey("users.email"), primary_key=True, nullable=False),
        sa.Column("usage_date", sa.Date(), primary_key=True, nullable=False),
        sa.Column("count", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_table("ai_matcher_usage")
