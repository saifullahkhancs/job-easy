"""Backfill user_email on admin-created default templates.

Default templates used to be inserted with ``user_email = NULL`` (see the old
``POST /api/v1/admin/default-templates`` handler), so rows created before this
release have no owner recorded. That made them impossible to attribute, to
label in the template dropdowns, or to revert to a user.

The application now always stores the creating admin's e-mail. This migration
repairs the historical rows by assigning them to the longest-standing admin
account, which is the only admin we can infer after the fact. If the database
has no admin user the rows are left untouched — an admin can still link them
manually via ``POST /api/v1/admin/default-templates/assign/{id}``.

Enum columns are stored by *name* (``'DEFAULT'``, ``'ADMIN'``), which is what
the SQL below matches on.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e4a7c9b12f80"
down_revision: Union[str, Sequence[str], None] = "d7f4c9a1e2b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()

    orphaned = connection.execute(
        sa.text(
            """
            SELECT COUNT(*) FROM user_templates
            WHERE user_email IS NULL
              AND UPPER(CAST(template_scope AS VARCHAR)) = 'DEFAULT'
            """
        )
    ).scalar()

    if not orphaned:
        return

    fallback_admin = connection.execute(
        sa.text(
            """
            SELECT email FROM users
            WHERE UPPER(CAST(role AS VARCHAR)) = 'ADMIN'
            ORDER BY created_at ASC
            LIMIT 1
            """
        )
    ).scalar()

    if not fallback_admin:
        # No admin to attribute the templates to; leave them for manual linking.
        return

    # Only claim rows whose role would not collide with a template the admin
    # already owns — the (template_role, user_email) pair is unique.
    connection.execute(
        sa.text(
            """
            UPDATE user_templates
            SET user_email = :admin_email
            WHERE user_email IS NULL
              AND UPPER(CAST(template_scope AS VARCHAR)) = 'DEFAULT'
              AND template_role NOT IN (
                  SELECT template_role FROM user_templates
                  WHERE user_email = :admin_email
              )
            """
        ),
        {"admin_email": fallback_admin},
    )


def downgrade() -> None:
    # The original NULLs carried no information, so there is nothing to restore
    # without wrongly un-owning templates that were legitimately created with
    # an owner. This migration is intentionally not reversible.
    pass
