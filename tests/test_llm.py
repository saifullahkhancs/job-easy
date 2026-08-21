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
    response = _FakeResponse(
        200, {"choices": [{"message": {"content": '{"matches": [], "contact_email": null}'}}]}
    )
    holder = _install_fake_client(monkeypatch, response)

    await llm._call_groq(PROMPT)
    client = holder["client"]
    assert client.last_kwargs["headers"]["Authorization"] == "Bearer q-key"
    assert client.last_kwargs["json"]["response_format"] == {"type": "json_object"}


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
