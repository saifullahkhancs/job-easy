"""Shared rules for how templates are presented in pickers/dropdowns.

Both the API responses and the React selectors have to agree on two things:

* which **ownership/type label** a template gets ("Owned by you", "Default",
  "Default · Owned by you" or "User"), and
* the **order** templates appear in: the requester's own templates first, then
  the platform defaults, then templates owned by other users.

Keeping the rules in one dependency-free module means the backend can ship the
label with every template and the frontend can fall back to the exact same
logic without the two drifting apart.
"""

from __future__ import annotations

from typing import Any, Iterable

# Scope stored on ``UserTemplate.template_scope``.
DEFAULT_SCOPE = "default"

# Ownership/type labels. These strings are user visible.
LABEL_DEFAULT_OWNED_BY_YOU = "Default · Owned by you"
LABEL_DEFAULT = "Default"
LABEL_OWNED_BY_YOU = "Owned by you"
LABEL_OTHER_USER = "User"

# Display groups, lowest sorts first.
GROUP_MINE = 0
GROUP_DEFAULT = 1
GROUP_OTHER_USER = 2


def scope_value(scope: Any) -> str:
    """Normalize a scope that may be an Enum, a string or ``None``."""
    value = getattr(scope, "value", scope)
    return str(value).lower() if value is not None else ""


def is_owned_by(template_user_email: str | None, current_user_email: str | None) -> bool:
    """True when the template was authored by the requesting user.

    A default template keeps the e-mail of whoever created it (customer *or*
    admin), so ownership is always a plain e-mail comparison.
    """
    if not template_user_email or not current_user_email:
        return False
    return template_user_email.strip().lower() == current_user_email.strip().lower()


def is_default_scope(scope: Any) -> bool:
    return scope_value(scope) == DEFAULT_SCOPE


def template_group_rank(
    scope: Any,
    template_user_email: str | None,
    current_user_email: str | None,
) -> int:
    """Return the display group: mine (0), default (1) or other user (2)."""
    if is_owned_by(template_user_email, current_user_email):
        return GROUP_MINE
    if is_default_scope(scope):
        return GROUP_DEFAULT
    return GROUP_OTHER_USER


def template_ownership_label(
    scope: Any,
    template_user_email: str | None,
    current_user_email: str | None,
) -> str:
    """Return the ownership/type label shown next to a template."""
    mine = is_owned_by(template_user_email, current_user_email)
    if is_default_scope(scope):
        return LABEL_DEFAULT_OWNED_BY_YOU if mine else LABEL_DEFAULT
    return LABEL_OWNED_BY_YOU if mine else LABEL_OTHER_USER


def template_sort_key(template: Any, current_user_email: str | None) -> tuple:
    """Sort key implementing: my templates → defaults → other users'.

    Templates inside a group are ordered by title (case-insensitive) and then
    by id so the list is stable between requests.
    """
    group = template_group_rank(
        getattr(template, "template_scope", None),
        getattr(template, "user_email", None),
        current_user_email,
    )
    title = (getattr(template, "title", "") or "").lower()
    template_id = getattr(template, "id", 0) or 0
    return (group, title, template_id)


def sort_templates_for_display(
    templates: Iterable[Any],
    current_user_email: str | None,
) -> list:
    """Order templates the way every template picker shows them."""
    return sorted(templates, key=lambda t: template_sort_key(t, current_user_email))
