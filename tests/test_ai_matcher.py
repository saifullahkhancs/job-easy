"""Tests for the AI Job Description Matcher endpoint.

The provider transport is stubbed out (``match_job_description`` is patched),
so nothing hits the network. Runs against an in-memory SQLite database.
"""

import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402

from api.dependencies import get_current_user, get_db  # noqa: E402
from api.v1 import ai_matcher  # noqa: E402
from core import llm  # noqa: E402
from core.config import settings  # noqa: E402
from models.ai_usage import AiUsage  # noqa: E402
from models.roles import UserRole  # noqa: E402
from models.user import Base, User  # noqa: E402
from models.user_templates import UserTemplate, TemplateScope  # noqa: E402


def _build_app():
    from fastapi import FastAPI

    app = FastAPI()
    app.include_router(ai_matcher.router)
    app.add_exception_handler(ai_matcher.AIMatcherError, ai_matcher.ai_matcher_error_handler)
    return app


class Harness:
    def __init__(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        self.session_maker = async_sessionmaker(self.engine, expire_on_commit=False)

    async def __aenter__(self):
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        self.app = _build_app()

        async def override_db():
            async with self.session_maker() as session:
                yield session

        self.app.dependency_overrides[get_db] = override_db
        return self

    async def __aexit__(self, *exc):
        self.app.dependency_overrides.clear()
        await self.engine.dispose()

    def login_as(self, user):
        self.app.dependency_overrides[get_current_user] = lambda: user

    def client(self):
        return AsyncClient(transport=ASGITransport(app=self.app), base_url="http://test")

    async def add(self, *objects):
        async with self.session_maker() as session:
            for obj in objects:
                session.add(obj)
            await session.commit()


def _customer(email="alice@example.com"):
    return User(
        email=email,
        first_name="Alice",
        last_name="Example",
        hashed_password="x",
        is_verified=True,
        role=UserRole.CUSTOMER,
    )


def _template(tid, owner, role="python_dev", scope=TemplateScope.CUSTOMER):
    return UserTemplate(
        id=tid,
        user_email=owner,
        template_role=role,
        title=f"Application for {role}",
        context=f"Body for {role}",
        filename="cv.pdf",
        cv_bytes=b"%PDF-1.4 fake",
        template_scope=scope,
        is_active=True,
    )


LONG_JD = (
    "We are hiring a Python backend engineer. " * 12
)  # > 120 characters


def _stub_llm(monkeypatch, result=None, exc=None):
    async def fake(job_description, templates):
        if exc:
            raise exc
        return result

    monkeypatch.setattr(ai_matcher, "match_job_description", fake)
    return fake


@pytest.mark.asyncio
async def test_happy_path_returns_ranked_matches_and_email(monkeypatch):
    async with Harness() as h:
        user = _customer()
        await h.add(user, _template(1, user.email, "python_dev"), _template(2, user.email, "data_sci"))
        h.login_as(user)

        calls = _stub_llm(
            monkeypatch,
            result={
                "matches": [
                    {"template_id": 1, "score": 93, "reason": "Python role fits."},
                    {"template_id": 2, "score": 41, "reason": "Data science is off-target."},
                ],
                "contact_email": "jobs@acme.io",
            },
        )

        response = await h.client().post(
            "/api/v1/ai/match", json={"job_description": LONG_JD}
        )
        assert response.status_code == 200
        data = response.json()

        assert data["contact_email"] == "jobs@acme.io"
        assert data["daily_limit"] == settings.AI_MATCH_DAILY_LIMIT
        assert data["remaining_today"] == settings.AI_MATCH_DAILY_LIMIT - 1

        scores = [(m["template_id"], m["score"]) for m in data["matches"]]
        assert scores == [(1, 93), (2, 41)]  # ranked high → low
        assert data["matches"][0]["template_role"] == "python_dev"
        assert data["matches"][0]["ownership_label"] == "Owned by you"


@pytest.mark.asyncio
async def test_single_batched_call_and_invalid_email_dropped(monkeypatch):
    async with Harness() as h:
        user = _customer()
        await h.add(user, _template(1, user.email))
        h.login_as(user)

        calls = _stub_llm(
            monkeypatch,
            result={
                "matches": [{"template_id": 1, "score": 50, "reason": "ok"}],
                "contact_email": "not-an-email",
            },
        )
        response = await h.client().post("/api/v1/ai/match", json={"job_description": LONG_JD})
        assert response.status_code == 200
        assert response.json()["contact_email"] is None


@pytest.mark.asyncio
async def test_no_templates_skips_ai_call(monkeypatch):
    async with Harness() as h:
        user = _customer()
        await h.add(user)
        h.login_as(user)

        fake = _stub_llm(monkeypatch, result={"matches": [], "contact_email": None})
        response = await h.client().post("/api/v1/ai/match", json={"job_description": LONG_JD})
        assert response.status_code == 200
        data = response.json()
        assert data["matches"] == []
        assert data["contact_email"] is None
        assert data["remaining_today"] == settings.AI_MATCH_DAILY_LIMIT


@pytest.mark.asyncio
async def test_daily_limit_reached(monkeypatch):
    monkeypatch.setattr(settings, "AI_MATCH_DAILY_LIMIT", 1)
    async with Harness() as h:
        user = _customer()
        from core.ai_usage import utc_today
        await h.add(user, _template(1, user.email), AiUsage(user_email=user.email, usage_date=utc_today(), count=1))
        h.login_as(user)

        _stub_llm(monkeypatch, result={"matches": [], "contact_email": None})
        response = await h.client().post("/api/v1/ai/match", json={"job_description": LONG_JD})
        assert response.status_code == 429
        data = response.json()
        assert data["code"] == "daily_limit_reached"
        assert data["limit"] == 1
        assert data["remaining"] == 0


@pytest.mark.asyncio
async def test_provider_rate_limited_is_distinct_error(monkeypatch):
    async with Harness() as h:
        user = _customer()
        await h.add(user, _template(1, user.email))
        h.login_as(user)

        _stub_llm(monkeypatch, exc=llm.LLMRateLimitedError("The AI service is at capacity right now."))
        response = await h.client().post("/api/v1/ai/match", json={"job_description": LONG_JD})
        assert response.status_code == 503
        assert response.json()["code"] == "ai_unavailable"


@pytest.mark.asyncio
async def test_provider_down_is_distinct_error(monkeypatch):
    async with Harness() as h:
        user = _customer()
        await h.add(user, _template(1, user.email))
        h.login_as(user)

        _stub_llm(monkeypatch, exc=llm.LLMUnavailableError("Could not reach the AI service."))
        response = await h.client().post("/api/v1/ai/match", json={"job_description": LONG_JD})
        assert response.status_code == 503
        assert response.json()["code"] == "ai_unavailable"


@pytest.mark.asyncio
async def test_generic_ai_failure(monkeypatch):
    async with Harness() as h:
        user = _customer()
        await h.add(user, _template(1, user.email))
        h.login_as(user)

        _stub_llm(monkeypatch, exc=llm.LLMError("bad json"))
        response = await h.client().post("/api/v1/ai/match", json={"job_description": LONG_JD})
        assert response.status_code == 502
        assert response.json()["code"] == "ai_failed"


@pytest.mark.asyncio
async def test_too_short_description_rejected(monkeypatch):
    async with Harness() as h:
        user = _customer()
        await h.add(user, _template(1, user.email))
        h.login_as(user)

        _stub_llm(monkeypatch, result={"matches": [], "contact_email": None})
        response = await h.client().post("/api/v1/ai/match", json={"job_description": "too short"})
        assert response.status_code == 422


@pytest.mark.asyncio
async def test_only_scores_logged_in_users_own_cvs(monkeypatch):
    """The model must only see CVs owned by the logged-in user.

    Platform defaults and other users' resumes stay out of the prompt even
    though customers can still pick them in the send flow.
    """
    async with Harness() as h:
        user = _customer("alice@example.com")
        other = _customer("bob@example.com")
        await h.add(
            user,
            other,
            _template(1, user.email, "mine"),
            _template(2, other.email, "theirs"),
            _template(3, None, "default", scope=TemplateScope.DEFAULT),
        )
        h.login_as(user)

        seen = {}
        async def fake(job_description, templates):
            seen["ids"] = [t["id"] for t in templates]
            return {"matches": [{"template_id": 1, "score": 80, "reason": "ok"}], "contact_email": None}

        monkeypatch.setattr(ai_matcher, "match_job_description", fake)
        response = await h.client().post("/api/v1/ai/match", json={"job_description": LONG_JD})
        assert response.status_code == 200
        assert seen["ids"] == [1]
        assert [m["template_id"] for m in response.json()["matches"]] == [1]


@pytest.mark.asyncio
async def test_admin_only_scores_own_cvs_not_every_resume(monkeypatch):
    """Admins can see every template, but matching still only rates their CVs."""
    async with Harness() as h:
        admin = User(
            email="admin@example.com",
            first_name="Ada",
            last_name="Admin",
            hashed_password="x",
            is_verified=True,
            role=UserRole.ADMIN,
        )
        other = _customer("bob@example.com")
        await h.add(
            admin,
            other,
            _template(1, admin.email, "admin_cv"),
            _template(2, other.email, "customer_cv"),
            _template(3, None, "default", scope=TemplateScope.DEFAULT),
        )
        h.login_as(admin)

        seen = {}
        async def fake(job_description, templates):
            seen["ids"] = [t["id"] for t in templates]
            return {"matches": [{"template_id": 1, "score": 70, "reason": "ok"}], "contact_email": None}

        monkeypatch.setattr(ai_matcher, "match_job_description", fake)
        response = await h.client().post("/api/v1/ai/match", json={"job_description": LONG_JD})
        assert response.status_code == 200
        assert seen["ids"] == [1]
        assert [m["template_id"] for m in response.json()["matches"]] == [1]
