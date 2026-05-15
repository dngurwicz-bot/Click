from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app
from app.middleware.auth import CurrentUser, SESSION_COOKIE_NAME, get_current_user


class _UnexpectedDbSession:
    async def execute(self, _query):
        raise AssertionError("DB should not be queried when request is rejected before authorization.")


@pytest.mark.asyncio
async def test_dynamic_report_builder_requires_reports_view_permission():
    async def override_current_user():
        return CurrentUser(
            id=uuid4(),
            email="module-admin@example.com",
            role="admin",
            permissions={"modules": {"can_view": True, "can_edit": True}},
        )

    async def override_db():
        yield _UnexpectedDbSession()

    app.dependency_overrides[get_current_user] = override_current_user
    app.dependency_overrides[get_db] = override_db

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/insights/builder/schema")
        assert response.status_code == 403
        assert response.json()["detail"]["code"] == "FORBIDDEN"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_logout_clears_session_cookie():
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            client.cookies.set(SESSION_COOKIE_NAME, "session-token")
            response = await client.post("/api/auth/logout")
        assert response.status_code == 204
        set_cookie_header = response.headers.get("set-cookie", "")
        assert f"{SESSION_COOKIE_NAME}=" in set_cookie_header
        assert "Max-Age=0" in set_cookie_header or "expires=" in set_cookie_header.lower()
    finally:
        app.dependency_overrides.clear()
