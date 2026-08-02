"""
Tests for the approval workflow e-mail notifications.

Covers both directions of the loop:
  * customer submits a request  -> every admin gets an e-mail
  * admin approves / rejects it -> the customer gets an e-mail

The tests run against an in-memory SQLite database and stub out the Resend
transport, so nothing is actually sent. They use plain `asyncio.run` so no
pytest-asyncio plugin is required.
"""
import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402

import core.email as core_email  # noqa: E402
from api.dependencies import get_current_user, get_db  # noqa: E402
from models.email_automation_requests import (  # noqa: E402
    EmailAutomationRequest,
    RequestStatus,
)
from models.roles import UserRole  # noqa: E402
from models.user import Base, User  # noqa: E402
from models.user_email_info import UserEmailInfo  # noqa: E402


def _build_app():
    from fastapi import FastAPI

    from api.v1 import admin, approval

    app = FastAPI()
    app.include_router(approval.router)
    app.include_router(admin.router)
    return app


class Harness:
    """Spins up the API with an isolated DB and a captured mail transport."""

    def __init__(self, sent):
        self.sent = sent

    async def __aenter__(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        self.session_maker = async_sessionmaker(self.engine, expire_on_commit=False)
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        self.app = _build_app()

        async def override_db():
            async with self.session_maker() as session:
                yield session

        self.app.dependency_overrides[get_db] = override_db
        return self

    async def __aexit__(self, *exc):
        await self.engine.dispose()

    def login_as(self, user: User):
        self.app.dependency_overrides[get_current_user] = lambda: user

    def client(self):
        return AsyncClient(
            transport=ASGITransport(app=self.app), base_url="http://test"
        )


def _capture_emails(monkeypatch):
    """Replace the Resend transport with an in-memory recorder."""
    sent = []

    def fake_send(**kwargs):
        sent.append(kwargs)

    monkeypatch.setattr(core_email, "_send_email_sync", fake_send)
    return sent


async def _seed(harness, *, admin_emails=("admin@jobeasy.online",)):
    async with harness.session_maker() as session:
        for index, admin_email in enumerate(admin_emails):
            session.add(
                User(
                    email=admin_email,
                    first_name="Admin",
                    last_name=str(index),
                    hashed_password="x",
                    is_verified=True,
                    role=UserRole.ADMIN,
                )
            )
        customer = User(
            email="jane@example.com",
            first_name="Jane",
            last_name="Doe",
            hashed_password="x",
            is_verified=True,
            role=UserRole.VISITOR,
        )
        session.add(customer)
        session.add(
            UserEmailInfo(
                id=1,
                user_email="jane@example.com",
                sender_email="jane@example.com",
                sender_name="Jane Doe",
                encrypted_app_password="enc",
            )
        )
        await session.commit()

    async with harness.session_maker() as session:
        customer = await session.get(User, "jane@example.com")
        admins = [await session.get(User, email) for email in admin_emails]
        return customer, admins


def test_submitting_a_request_emails_every_admin(monkeypatch):
    sent = _capture_emails(monkeypatch)

    async def scenario():
        async with Harness(sent) as harness:
            customer, _ = await _seed(
                harness, admin_emails=("admin@jobeasy.online", "second@jobeasy.online")
            )
            harness.login_as(customer)

            async with harness.client() as client:
                response = await client.post(
                    "/api/v1/approval/request", json={"user_email_info_id": 1}
                )
            assert response.status_code == 201, response.text

    asyncio.run(scenario())

    recipients = {mail["to_email"] for mail in sent}
    assert recipients == {"admin@jobeasy.online", "second@jobeasy.online"}
    assert all("Jane Doe" in mail["subject"] for mail in sent)
    body = sent[0]["html_content"]
    assert "jane@example.com" in body
    # The admin needs a way to act on it.
    assert "/admin/requests" in body


def test_request_still_succeeds_when_admin_email_fails(monkeypatch):
    def exploding_send(**kwargs):
        raise core_email.EmailDeliveryError("provider down")

    monkeypatch.setattr(core_email, "_send_email_sync", exploding_send)

    async def scenario():
        async with Harness([]) as harness:
            customer, _ = await _seed(harness)
            harness.login_as(customer)

            async with harness.client() as client:
                response = await client.post(
                    "/api/v1/approval/request", json={"user_email_info_id": 1}
                )
            assert response.status_code == 201, response.text

            # The request is persisted even though the notification failed.
            async with harness.session_maker() as session:
                stored = await session.get(EmailAutomationRequest, 1)
                assert stored is not None
                assert stored.status == RequestStatus.PENDING

    asyncio.run(scenario())


def _review(status_value, notes=None):
    sent = []

    def fake_send(**kwargs):
        sent.append(kwargs)

    async def scenario():
        async with Harness(sent) as harness:
            customer, admins = await _seed(harness)
            harness.login_as(customer)

            async with harness.client() as client:
                created = await client.post(
                    "/api/v1/approval/request", json={"user_email_info_id": 1}
                )
                assert created.status_code == 201, created.text
                request_id = created.json()["id"]

                sent.clear()  # drop the admin notification, keep the decision one
                harness.login_as(admins[0])
                payload = {"status": status_value}
                if notes:
                    payload["admin_notes"] = notes
                reviewed = await client.patch(
                    f"/api/v1/admin/approval-requests/{request_id}", json=payload
                )
                assert reviewed.status_code == 200, reviewed.text

            async with harness.session_maker() as session:
                user = await session.get(User, "jane@example.com")
                role = user.role

        return role

    import core.email as ce

    original = ce._send_email_sync
    ce._send_email_sync = fake_send
    try:
        role = asyncio.run(scenario())
    finally:
        ce._send_email_sync = original
    return sent, role


def test_approval_emails_the_customer():
    sent, role = _review("approved", notes="Welcome aboard!")

    assert role == UserRole.CUSTOMER
    assert len(sent) == 1
    mail = sent[0]
    assert mail["to_email"] == "jane@example.com"
    assert "approved" in mail["subject"].lower()
    assert "Jane Doe" in mail["html_content"]
    assert "Welcome aboard!" in mail["html_content"]


def test_rejection_emails_the_customer_with_the_reason():
    sent, _ = _review("rejected", notes="Sender name looks like a company.")

    assert len(sent) == 1
    mail = sent[0]
    assert mail["to_email"] == "jane@example.com"
    assert "approved" not in mail["subject"].lower()
    assert "Sender name looks like a company." in mail["html_content"]


def test_notify_safe_swallows_delivery_errors():
    async def boom():
        raise core_email.EmailDeliveryError("nope")

    async def ok():
        return None

    assert asyncio.run(core_email.notify_safe(boom())) is False
    assert asyncio.run(core_email.notify_safe(ok())) is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
