"""Swap-in LLM provider behind a single entry point.

The Job Description Matcher needs exactly one thing from an LLM: turn a job
description plus the user's visible templates into a single structured JSON
document (ranked matches + an optional contact email). Everything provider
specific lives in this module, so the API layer never has to know whether the
brain behind the feature is Gemini, Groq or OpenRouter — it only ever calls
``match_job_description``.

Providers are deliberately single-shot: there are **no retry loops**. The
feature runs on a free-tier key with a tiny daily allowance, so a rate limit
or an outage must surface as a clean, distinct error instead of a retry storm.
"""

from __future__ import annotations

import json
import logging

import httpx

from core.config import settings

logger = logging.getLogger(__name__)

GEMINI_GENERATE_PATH = "/v1beta/models/{model}:generateContent"

# How much of each template's email body we send to the model. Keeps prompts
# small on the free tier while still giving the model enough signal to score.
CONTEXT_CHAR_CAP = 1000


class LLMError(Exception):
    """The provider answered but the result could not be used."""


class LLMUnavailableError(Exception):
    """The provider could not be reached (down, timed out, 5xx, unconfigured)."""


class LLMRateLimitedError(Exception):
    """The provider said 'slow down' — treat as temporarily at capacity."""


def _strip_code_fences(text: str) -> str:
    """Remove markdown fences the model may wrap its JSON in."""
    text = text.strip()
    if text.startswith("```"):
        first_newline = text.find("\n")
        if first_newline != -1:
            text = text[first_newline + 1:]
        if text.rstrip().endswith("```"):
            text = text.rstrip()[:-3]
    return text.strip()


def _extract_json_object(text: str) -> dict:
    """Pull the first {...} object out of whatever the model returned."""
    cleaned = _strip_code_fences(text)
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise LLMError("The AI returned a response without a JSON object.")
    try:
        parsed = json.loads(cleaned[start:end + 1])
    except json.JSONDecodeError as exc:
        raise LLMError("The AI response was not valid JSON.") from exc
    if not isinstance(parsed, dict):
        raise LLMError("The AI response was not a JSON object.")
    return parsed


def _build_prompt(job_description: str, templates: list[dict]) -> str:
    """One prompt that asks for both the ranking and the email extraction."""
    template_block = json.dumps(templates, ensure_ascii=False)
    return f"""You are a job-application assistant. You are given a job description and a list of the user's saved application templates.

Each template object has:
- "id": the numeric template id
- "title": the email subject line
- "template_role": the job role this template targets
- "context": the email body (possibly truncated)

Do both tasks in one response:

1. Score EVERY template from 0 to 100 for how well it fits the job description. Higher is a better fit. For each template, write a single-sentence reason that mentions the template's role or the skills it highlights.

2. Extract one contact/recruiter email address from the job description if one is present — the address a candidate should send their application to. If no email address appears in the text, use null. Do not invent an address.

Respond with ONLY a JSON object in exactly this shape (no markdown, no commentary):
{{
  "matches": [
    {{"template_id": 1, "score": 85, "reason": "Strong match for the listed backend skills."}}
  ],
  "contact_email": "recruiter@company.com"
}}

Templates:
{template_block}

Job description:
\"\"\"
{job_description}
\"\"\"
"""


async def _call_gemini(prompt: str) -> dict:
    """A single Gemini ``generateContent`` call, returning the parsed JSON."""
    if not settings.GEMINI_API_KEY:
        raise LLMUnavailableError("AI matching is not configured yet.")

    url = (
        f"{settings.GEMINI_BASE_URL.rstrip('/')}"
        f"{GEMINI_GENERATE_PATH.format(model=settings.GEMINI_MODEL)}"
    )
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            # Ask for raw JSON so we do not have to un-fence the reply.
            "responseMimeType": "application/json",
            "maxOutputTokens": 8192,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=15.0)) as client:
            response = await client.post(
                url,
                params={"key": settings.GEMINI_API_KEY},
                json=payload,
            )
    except httpx.TimeoutException as exc:
        raise LLMUnavailableError("The AI service timed out. Please try again in a moment.") from exc
    except httpx.HTTPError as exc:
        raise LLMUnavailableError("Could not reach the AI service. Please try again.") from exc

    if response.status_code == 429:
        raise LLMRateLimitedError("The AI service is at capacity right now. Please try again later.")
    if response.status_code >= 500:
        raise LLMUnavailableError("The AI service is temporarily unavailable. Please try again later.")
    if response.status_code != 200:
        raise LLMError("The AI service returned an unexpected error.")

    try:
        data = response.json()
    except ValueError as exc:
        raise LLMError("The AI service returned an unreadable response.") from exc

    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError) as exc:
        block_reason = ((data.get("promptFeedback") or {}).get("blockReason")) if isinstance(data, dict) else None
        if block_reason:
            raise LLMError("The AI could not process that job description.") from exc
        raise LLMError("The AI returned an empty response.") from exc

    return _extract_json_object(text)


async def match_job_description(job_description: str, templates: list[dict]) -> dict:
    """One batched call: rank ``templates`` and extract a contact email.

    ``templates`` is a list of briefs ``{"id", "title", "template_role",
    "context"}``. Returns the raw parsed model output (``matches`` +
    ``contact_email``); callers sanitise it with ``core.ai_matching``.

    Swap providers by replacing ``_call_gemini`` (or branching here) without
    touching the endpoint.
    """
    prompt = _build_prompt(job_description, templates)
    return await _call_gemini(prompt)
