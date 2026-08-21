"""Swap-in LLM provider behind a single entry point.

The Job Description Matcher needs exactly one thing from an LLM: turn a job
description plus the user's visible templates into a single structured JSON
document (ranked matches + an optional contact email). Everything provider
specific lives in this module, so the API layer never has to know whether the
brain behind the feature is Gemini or Groq — it only ever calls
``match_job_description``.

Two providers are wired in, both with a genuinely free tier (no credit card):
Google Gemini (AI Studio) and Groq (OpenAI-compatible). ``AI_PROVIDER`` in the
environment picks one explicitly; the default ``auto`` uses whichever free key
is present.

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
# Groq's free tier caps tokens-per-minute (6,000-8,000 depending on the
# model), so every character here is budget that cannot go to the job
# description or the completion.
CONTEXT_CHAR_CAP = 800

# Cap on the generated reply. The expected JSON (a few ranked matches plus a
# short reason each) fits in well under this; reserving more would count
# against the free tier's per-minute token allowance before a single token
# is generated.
MAX_COMPLETION_TOKENS = 1024


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
    """One prompt that asks for both the ranking and the email extraction.

    Template contexts are hard-capped at ``CONTEXT_CHAR_CAP`` characters here
    (not just in the API layer) so the whole prompt always fits the free
    tier's tokens-per-minute allowance.
    """
    trimmed = []
    for template in templates:
        brief = dict(template)
        context = str(brief.get("context") or "")
        if len(context) > CONTEXT_CHAR_CAP:
            context = context[:CONTEXT_CHAR_CAP] + "…"
        brief["context"] = context
        trimmed.append(brief)
    template_block = json.dumps(trimmed, ensure_ascii=False)
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
        raise LLMUnavailableError(
            "AI matching is not configured yet. Set GEMINI_API_KEY to a free "
            "key from https://aistudio.google.com/app/apikey and restart."
        )

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


async def _call_groq(prompt: str) -> dict:
    """A single Groq chat-completions call (OpenAI-compatible), parsed JSON."""
    if not settings.GROQ_API_KEY:
        raise LLMUnavailableError(
            "AI matching is not configured yet. Set GROQ_API_KEY to a free "
            "key from https://console.groq.com/keys and restart."
        )

    url = f"{settings.GROQ_BASE_URL.rstrip('/')}/chat/completions"
    payload = {
        "model": settings.GROQ_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        # JSON mode + the prompt's "ONLY a JSON object" keep the reply parseable.
        "response_format": {"type": "json_object"},
        # Small on purpose: Groq's free tier counts the reservation against
        # its tokens-per-minute allowance, so reserving 4096+ tokens would
        # push even small prompts over the 6,000-8,000 TPM cap.
        "max_completion_tokens": MAX_COMPLETION_TOKENS,
    }
    headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}"}

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=15.0)) as client:
            response = await client.post(url, headers=headers, json=payload)
    except httpx.TimeoutException as exc:
        raise LLMUnavailableError("The AI service timed out. Please try again in a moment.") from exc
    except httpx.HTTPError as exc:
        raise LLMUnavailableError("Could not reach the AI service. Please try again.") from exc

    if response.status_code in (401, 403):
        raise LLMUnavailableError(
            "The AI provider rejected GROQ_API_KEY. Create a new free key at "
            "https://console.groq.com/keys and update the environment."
        )
    if response.status_code == 429:
        raise LLMRateLimitedError("The AI service is at capacity right now. Please try again later.")
    if response.status_code == 413:
        raise LLMRateLimitedError(
            "Groq's free tier hit its tokens-per-minute limit for this model. "
            "Wait a minute and try again, or shorten the job description."
        )
    if response.status_code >= 500:
        raise LLMUnavailableError("The AI service is temporarily unavailable. Please try again later.")

    if response.status_code == 400:
        body = {}
        try:
            body = response.json()
        except ValueError:
            pass
        error = body.get("error") if isinstance(body, dict) else None
        message = str(error.get("message") or "") if isinstance(error, dict) else ""
        if "decommissioned" in message or "no longer supported" in message:
            raise LLMUnavailableError(
                f"GROQ_MODEL '{settings.GROQ_MODEL}' has been retired by Groq. "
                "Set GROQ_MODEL to a current free model, e.g. qwen/qwen3.6-27b."
            )
        if "does not support chat completions" in message:
            raise LLMUnavailableError(
                f"GROQ_MODEL '{settings.GROQ_MODEL}' is not a chat model. "
                "Set GROQ_MODEL to a current free model, e.g. qwen/qwen3.6-27b."
            )
        if "max_tokens" in message or "reduce the length" in message:
            raise LLMError(
                "The request was too large for Groq's free tier. Shorten the "
                "job description or use fewer templates."
            )

    if response.status_code != 200:
        raw_body = str(getattr(response, "text", "") or "")[:500]
        logger.warning(
            "Groq API unexpected status: %s. Response body: %s",
            response.status_code,
            raw_body,
        )
        raise LLMError("The AI service returned an unexpected error.")

    try:
        data = response.json()
    except ValueError as exc:
        raise LLMError("The AI service returned an unreadable response.") from exc

    try:
        text = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise LLMError("The AI returned an empty response.") from exc

    return _extract_json_object(text)


def _resolve_provider() -> str:
    """Pick the LLM provider from settings: explicit choice, else first key set."""
    choice = (settings.AI_PROVIDER or "auto").strip().lower()

    if choice == "gemini":
        if not settings.GEMINI_API_KEY:
            raise LLMUnavailableError(
                "AI_PROVIDER is set to 'gemini' but GEMINI_API_KEY is empty. "
                "Grab a free key at https://aistudio.google.com/app/apikey."
            )
        return "gemini"

    if choice == "groq":
        if not settings.GROQ_API_KEY:
            raise LLMUnavailableError(
                "AI_PROVIDER is set to 'groq' but GROQ_API_KEY is empty. "
                "Grab a free key at https://console.groq.com/keys."
            )
        return "groq"

    if choice != "auto":
        raise LLMUnavailableError(
            f"Unknown AI_PROVIDER '{settings.AI_PROVIDER}'. Use 'auto', 'gemini' or 'groq'."
        )

    # auto: prefer the provider whose free key is present. Gemini first to
    # stay backward compatible with deployments that predate Groq support.
    if settings.GEMINI_API_KEY:
        return "gemini"
    if settings.GROQ_API_KEY:
        return "groq"

    raise LLMUnavailableError(
        "AI matching is not configured yet. Set a free key and restart: "
        "GEMINI_API_KEY from https://aistudio.google.com/app/apikey "
        "or GROQ_API_KEY from https://console.groq.com/keys."
    )


async def match_job_description(job_description: str, templates: list[dict]) -> dict:
    """One batched call: rank ``templates`` and extract a contact email.

    ``templates`` is a list of briefs ``{"id", "title", "template_role",
    "context"}``. Returns the raw parsed model output (``matches`` +
    ``contact_email``); callers sanitise it with ``core.ai_matching``.

    The provider is resolved from ``AI_PROVIDER`` / the configured free keys,
    so swapping providers never touches the endpoint.
    """
    provider = _resolve_provider()
    prompt = _build_prompt(job_description, templates)
    if provider == "groq":
        return await _call_groq(prompt)
    return await _call_gemini(prompt)
