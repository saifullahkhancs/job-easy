"""Tests for the LLM provider layer: provider resolution and the Groq caller.

No network access — the httpx client is stubbed and settings fields are
monkeypatched, so these tests are fast and hermetic.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

from core import llm  # noqa: E402
from core.config import settings  # noqa: E402

PROMPT = "score these templates"


class _FakeResponse:
    def __init__(self, status_code, payload=None, json_exc=None):
        self.status_code = status_code
        self._payload = payload
        self._json_exc = json_exc

    def json(self):
        if self._json_exc is not None:
            raise self._json_exc
        return self._payload


class _FakeClient:
    """Stands in for httpx.AsyncClient; records the request for assertions."""

    def __init__(self, response):
        self._response = response
        self.last_kwargs = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def post(self, url, **kwargs):
        self.last_kwargs = kwargs
        return self._response


def _install_fake_client(monkeypatch, response):
    """Replace httpx.AsyncClient; returns a holder for the fake instance."""
    holder = {}

    def factory(*args, **kwargs):
        client = _FakeClient(response)
        holder["client"] = client
        return client

    monkeypatch.setattr(llm.httpx, "AsyncClient", factory)
    return holder


def _set_ai_settings(monkeypatch, provider="auto", gemini_key="", groq_key=""):
    monkeypatch.setattr(settings, "AI_PROVIDER", provider)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", gemini_key)
    monkeypatch.setattr(settings, "GROQ_API_KEY", groq_key)


# ── _resolve_provider ──────────────────────────────────────────────────────


def test_auto_without_keys_raises_unavailable(monkeypatch):
    _set_ai_settings(monkeypatch)
    with pytest.raises(llm.LLMUnavailableError, match="not configured"):
        llm._resolve_provider()


def test_auto_prefers_gemini_when_both_keys_present(monkeypatch):
    _set_ai_settings(monkeypatch, gemini_key="g-key", groq_key="q-key")
    assert llm._resolve_provider() == "gemini"


def test_auto_uses_groq_when_only_groq_key_present(monkeypatch):
    _set_ai_settings(monkeypatch, groq_key="q-key")
    assert llm._resolve_provider() == "groq"


def test_explicit_gemini_without_key_raises(monkeypatch):
    _set_ai_settings(monkeypatch, provider="gemini")
    with pytest.raises(llm.LLMUnavailableError, match="GEMINI_API_KEY"):
        llm._resolve_provider()


def test_explicit_groq_without_key_raises(monkeypatch):
    _set_ai_settings(monkeypatch, provider="groq")
    with pytest.raises(llm.LLMUnavailableError, match="GROQ_API_KEY"):
        llm._resolve_provider()


def test_unknown_provider_raises(monkeypatch):
    _set_ai_settings(monkeypatch, provider="openai", gemini_key="g-key", groq_key="q-key")
    with pytest.raises(llm.LLMUnavailableError, match="Unknown AI_PROVIDER"):
        llm._resolve_provider()


@pytest.mark.asyncio
async def test_match_job_description_routes_to_groq(monkeypatch):
    _set_ai_settings(monkeypatch, provider="groq", groq_key="q-key")

    async def fake_groq(prompt):
        return {"matches": [], "contact_email": None}

    async def fake_gemini(prompt):  # pragma: no cover - must not be called
        raise AssertionError("gemini caller should not run when provider=groq")

    monkeypatch.setattr(llm, "_call_groq", fake_groq)
    monkeypatch.setattr(llm, "_call_gemini", fake_gemini)

    result = await llm.match_job_description("job description", [{"id": 1}])
    assert result == {"matches": [], "contact_email": None}


@pytest.mark.asyncio
async def test_match_job_description_routes_to_gemini_by_default(monkeypatch):
    _set_ai_settings(monkeypatch, gemini_key="g-key")

    async def fake_gemini(prompt):
        return {"matches": [], "contact_email": None}

    async def fake_groq(prompt):  # pragma: no cover - must not be called
        raise AssertionError("groq caller should not run when only gemini key is set")

    monkeypatch.setattr(llm, "_call_gemini", fake_gemini)
    monkeypatch.setattr(llm, "_call_groq", fake_groq)

    result = await llm.match_job_description("job description", [{"id": 1}])
    assert result == {"matches": [], "contact_email": None}


# ── _call_groq ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_call_groq_missing_key_raises(monkeypatch):
    _set_ai_settings(monkeypatch, provider="groq", groq_key="")
    with pytest.raises(llm.LLMUnavailableError, match="GROQ_API_KEY"):
        await llm._call_groq(PROMPT)


@pytest.mark.asyncio
async def test_call_groq_success_parses_json(monkeypatch):
    _set_ai_settings(monkeypatch, groq_key="q-key")
    _install_fake_client(
        monkeypatch,
        _FakeResponse(
            200,
            {"choices": [{"message": {"content": '{"matches": [], "contact_email": null}'}}]},
        ),
    )

    result = await llm._call_groq(PROMPT)
    assert result == {"matches": [], "contact_email": None}


@pytest.mark.asyncio
async def test_call_groq_unfences_markdown_json(monkeypatch):
    _set_ai_settings(monkeypatch, groq_key="q-key")
    _install_fake_client(
        monkeypatch,
        _FakeResponse(
            200,
            {"choices": [{"message": {"content": '```json\n{"matches": [], "contact_email": null}\n```'}}]},
        ),
    )

    result = await llm._call_groq(PROMPT)
    assert result == {"matches": [], "contact_email": None}


@pytest.mark.asyncio
async def test_call_groq_sends_bearer_auth_and_json_mode(monkeypatch):
    _set_ai_settings(monkeypatch, groq_key="q-key")
    monkeypatch.setattr(settings, "GROQ_MODEL", "qwen/qwen3.6-27b")
    response = _FakeResponse(
        200, {"choices": [{"message": {"content": '{"matches": [], "contact_email": null}'}}]}
    )
    holder = _install_fake_client(monkeypatch, response)

    await llm._call_groq(PROMPT)
    client = holder["client"]
    assert client.last_kwargs["headers"]["Authorization"] == "Bearer q-key"
    assert client.last_kwargs["json"]["response_format"] == {"type": "json_object"}
    assert client.last_kwargs["json"]["max_completion_tokens"] == llm.MAX_COMPLETION_TOKENS
    assert client.last_kwargs["json"]["reasoning_effort"] == "none"


@pytest.mark.asyncio
async def test_call_groq_reasoning_model_disables_reasoning(monkeypatch):
    """qwen3.6 is a reasoning model; its thinking must be switched off so the
    completion budget goes to the JSON answer instead of an empty response."""
    _set_ai_settings(monkeypatch, groq_key="q-key")
    monkeypatch.setattr(settings, "GROQ_MODEL", "qwen/qwen3.6-27b")
    response = _FakeResponse(
        200, {"choices": [{"message": {"content": '{"matches": [], "contact_email": null}'}}]}
    )
    holder = _install_fake_client(monkeypatch, response)

    await llm._call_groq(PROMPT)
    assert holder["client"].last_kwargs["json"]["reasoning_effort"] == "none"


@pytest.mark.asyncio
async def test_call_groq_non_reasoning_model_omits_reasoning_effort(monkeypatch):
    """reasoning_effort must not be sent to models that do not support it."""
    _set_ai_settings(monkeypatch, groq_key="q-key")
    monkeypatch.setattr(settings, "GROQ_MODEL", "meta-llama/llama-3.3-70b-versatile")
    response = _FakeResponse(
        200, {"choices": [{"message": {"content": '{"matches": [], "contact_email": null}'}}]}
    )
    holder = _install_fake_client(monkeypatch, response)

    await llm._call_groq(PROMPT)
    assert "reasoning_effort" not in holder["client"].last_kwargs["json"]


@pytest.mark.asyncio
async def test_call_groq_rejected_key_raises_unavailable(monkeypatch):
    _set_ai_settings(monkeypatch, groq_key="bad-key")
    _install_fake_client(monkeypatch, _FakeResponse(401, {"error": "invalid"}))

    with pytest.raises(llm.LLMUnavailableError, match="rejected"):
        await llm._call_groq(PROMPT)


@pytest.mark.asyncio
async def test_call_groq_rate_limited_raises(monkeypatch):
    _set_ai_settings(monkeypatch, groq_key="q-key")
    _install_fake_client(monkeypatch, _FakeResponse(429, {"error": "slow down"}))

    with pytest.raises(llm.LLMRateLimitedError):
        await llm._call_groq(PROMPT)


@pytest.mark.asyncio
async def test_call_groq_tpm_exceeded_raises_rate_limited(monkeypatch):
    """Groq free tier answers 413 when the request exceeds tokens/minute."""
    _set_ai_settings(monkeypatch, groq_key="q-key")
    _install_fake_client(
        monkeypatch,
        _FakeResponse(
            413,
            {"error": {"message": "Request too large ... tokens per minute (TPM)",
                       "type": "tokens", "code": "rate_limit_exceeded"}},
        ),
    )

    with pytest.raises(llm.LLMRateLimitedError, match="tokens-per-minute"):
        await llm._call_groq(PROMPT)


@pytest.mark.asyncio
async def test_call_groq_decommissioned_model_raises_unavailable(monkeypatch):
    _set_ai_settings(monkeypatch, groq_key="q-key")
    monkeypatch.setattr(settings, "GROQ_MODEL", "old-retired-model")
    _install_fake_client(
        monkeypatch,
        _FakeResponse(
            400,
            {"error": {"message": "The model `old-retired-model` has been decommissioned "
                                 "and is no longer supported.",
                       "type": "invalid_request_error", "code": "model_decommissioned"}},
        ),
    )

    with pytest.raises(llm.LLMUnavailableError, match="retired by Groq"):
        await llm._call_groq(PROMPT)


@pytest.mark.asyncio
async def test_call_groq_non_chat_model_raises_unavailable(monkeypatch):
    _set_ai_settings(monkeypatch, groq_key="q-key")
    _install_fake_client(
        monkeypatch,
        _FakeResponse(
            400,
            {"error": {"message": "The model `whisper-large-v3` does not support "
                                 "chat completions", "type": "invalid_request_error"}},
        ),
    )

    with pytest.raises(llm.LLMUnavailableError, match="not a chat model"):
        await llm._call_groq(PROMPT)


@pytest.mark.asyncio
async def test_call_groq_oversized_request_raises_llm_error(monkeypatch):
    _set_ai_settings(monkeypatch, groq_key="q-key")
    _install_fake_client(
        monkeypatch,
        _FakeResponse(
            400,
            {"error": {"message": "Please reduce the length of the messages or completion.",
                       "type": "invalid_request_error", "param": "messages"}},
        ),
    )

    with pytest.raises(llm.LLMError, match="too large"):
        await llm._call_groq(PROMPT)


@pytest.mark.asyncio
async def test_call_groq_json_validation_failure_raises_llm_error(monkeypatch):
    """The exact 400 Groq returns when reasoning eats the reply budget and the
    model emits an empty answer (json_validate_failed, empty failed_generation)."""
    _set_ai_settings(monkeypatch, groq_key="q-key")
    _install_fake_client(
        monkeypatch,
        _FakeResponse(
            400,
            {
                "error": {
                    "message": "Failed to validate JSON. Please adjust your prompt. "
                               "See 'failed_generation' for more details.",
                    "type": "invalid_request_error",
                    "code": "json_validate_failed",
                    "failed_generation": "",
                }
            },
        ),
    )

    with pytest.raises(llm.LLMError, match="no usable JSON"):
        await llm._call_groq(PROMPT)


@pytest.mark.asyncio
async def test_call_groq_server_error_raises_unavailable(monkeypatch):
    _set_ai_settings(monkeypatch, groq_key="q-key")
    _install_fake_client(monkeypatch, _FakeResponse(503, {"error": "down"}))

    with pytest.raises(llm.LLMUnavailableError):
        await llm._call_groq(PROMPT)


@pytest.mark.asyncio
async def test_call_groq_empty_response_raises_llm_error(monkeypatch):
    _set_ai_settings(monkeypatch, groq_key="q-key")
    _install_fake_client(monkeypatch, _FakeResponse(200, {"choices": []}))

    with pytest.raises(llm.LLMError, match="empty"):
        await llm._call_groq(PROMPT)


@pytest.mark.asyncio
async def test_call_groq_unreadable_response_raises_llm_error(monkeypatch):
    _set_ai_settings(monkeypatch, groq_key="q-key")
    _install_fake_client(monkeypatch, _FakeResponse(200, json_exc=ValueError("boom")))

    with pytest.raises(llm.LLMError, match="unreadable"):
        await llm._call_groq(PROMPT)


# ── _build_prompt size control ──────────────────────────────────────────────


def test_build_prompt_truncates_long_template_contexts():
    templates = [
        {"id": 1, "title": "t", "template_role": "r", "context": "x" * 3000},
    ]
    prompt = llm._build_prompt("job description", templates)
    assert "x" * 3000 not in prompt
    assert ("x" * llm.CONTEXT_CHAR_CAP) + "…" in prompt


def test_build_prompt_keeps_short_contexts_untouched():
    templates = [
        {"id": 1, "title": "t", "template_role": "r", "context": "short body"},
    ]
    prompt = llm._build_prompt("job description", templates)
    assert "short body" in prompt
