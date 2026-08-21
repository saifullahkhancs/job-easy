"""Pure post-processing for the AI job-description matcher.

Everything here is provider-agnostic and side-effect free so it can be unit
tested without network access: email validation, score clamping, and the
mapping of raw model output back onto the user's own templates.

The model is never trusted blindly — its JSON is validated field by field, and
anything that does not look like a real email address is discarded.
"""

from __future__ import annotations

import re

# Deliberately stricter than RFC so junk like "email: apply at the link below"
# or "hr@company" never leaks through as a contact address.
_EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")

MAX_EMAIL_LENGTH = 254


def is_plausible_email(value) -> bool:
    """Basic but real email-format check used on any model-extracted value."""
    if not isinstance(value, str):
        return False
    value = value.strip()
    if not value or len(value) > MAX_EMAIL_LENGTH:
        return False
    if value.startswith(".") or value.endswith("."):
        return False
    if ".." in value:
        return False
    return bool(_EMAIL_RE.match(value))


def clamp_score(value) -> int:
    """Coerce a model score into an int clamped to 0-100."""
    try:
        score = int(round(float(value)))
    except (TypeError, ValueError):
        return 0
    return max(0, min(100, score))


def sanitize_result(raw, templates) -> tuple[dict, str | None]:
    """Validate raw model output against the user's own templates.

    Returns ``(matches_by_id, contact_email)`` where ``matches_by_id`` maps
    ``template_id -> {"score": int, "reason": str}`` and is guaranteed to
    contain an entry for **every** owned template. ``contact_email`` is the
    sanitised address or ``None``.
    """
    raw_matches = raw.get("matches") if isinstance(raw, dict) else None
    if not isinstance(raw_matches, list):
        raw_matches = []

    owned_ids = {getattr(t, "id") for t in templates}

    matches_by_id: dict = {}
    for item in raw_matches:
        if not isinstance(item, dict):
            continue
        try:
            template_id = int(item.get("template_id"))
        except (TypeError, ValueError):
            continue
        if template_id not in owned_ids:
            continue

        reason = str(item.get("reason") or "").strip()
        matches_by_id[template_id] = {
            "score": clamp_score(item.get("score")),
            "reason": reason or "No explanation provided.",
        }

    # Guarantee full coverage: an owned template the model skipped still gets
    # a result rather than silently disappearing from the ranking.
    for template in templates:
        matches_by_id.setdefault(
            template.id,
            {
                "score": 0,
                "reason": "The model did not return a score for this template.",
            },
        )

    contact_email = raw.get("contact_email") if isinstance(raw, dict) else None
    contact_email = contact_email.strip() if isinstance(contact_email, str) else None
    if not is_plausible_email(contact_email):
        contact_email = None

    return matches_by_id, contact_email
