"""Make users.email the primary key and remove users.user_id.

Existing user-owned rows already reference users.email, so this migration
preserves those rows while replacing the surrogate user identifier.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d7f4c9a1e2b3"
down_revision: Union[str, Sequence[str], None] = "aa47061e5f9a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The preceding migrations changed all application foreign keys to
    # users.email. Do not recreate or copy users: dropping the surrogate key
    # leaves every existing user and every email foreign key intact.
    op.drop_constraint("users_pkey", "users", type_="primary")
    op.drop_column("users", "user_id")
    op.create_primary_key("users_pkey", "users", ["email"])


def downgrade() -> None:
    # A downgrade cannot recover the old generated IDs without storing them.
    # Recreate a surrogate key for structural compatibility; existing rows get
    # new IDs and email remains the canonical foreign-key target.
    op.drop_constraint("users_pkey", "users", type_="primary")
    op.add_column(
        "users",
        sa.Column("user_id", sa.Integer(), autoincrement=True, nullable=True),
    )
    op.execute(sa.text("UPDATE users SET user_id = nextval('users_user_id_seq')"))
    op.alter_column("users", "user_id", nullable=False)
    op.create_primary_key("users_pkey", "users", ["user_id"])
