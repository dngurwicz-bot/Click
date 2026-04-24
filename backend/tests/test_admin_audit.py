from types import SimpleNamespace
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app
from app.middleware.audit import AuditMiddleware
from app.middleware.auth import CurrentUser, get_current_user
from app.config import get_settings
from app.schemas.admin_user import ALL_RESOURCES, DEFAULT_PERMISSIONS


class FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class FakeSession:
    def __init__(self, rows):
        self.rows = rows

    async def execute(self, _query):
        return FakeResult(self.rows)


@pytest.mark.asyncio
async def test_audit_route_requires_audit_view_permission():
    async def override_current_user():
        return CurrentUser(
            id=uuid4(),
            email="support@example.com",
            role="support",
            permissions={"audit": {"can_view": False, "can_edit": False}},
        )

    async def override_db():
        yield FakeSession([])

    app.dependency_overrides[get_current_user] = override_current_user
    app.dependency_overrides[get_db] = override_db

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/admin/audit")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_audit_route_returns_enriched_rows():
    actor_id = uuid4()
    entity_id = uuid4()
    audit_row = SimpleNamespace(
        id=uuid4(),
        tenant_id=None,
        actor_id=actor_id,
        actor_type="admin_user",
        action="update",
        entity_type="tenants",
        entity_id=entity_id,
        old_values=None,
        new_values=None,
        ip_address="127.0.0.1",
        created_at="2026-04-05T12:00:00Z",
    )

    async def override_current_user():
        return CurrentUser(
            id=uuid4(),
            email="admin@example.com",
            role="admin",
            permissions={"audit": {"can_view": True, "can_edit": False}},
        )

    async def override_db():
        yield FakeSession([(audit_row, "דנה לוי", "dana@example.com")])

    app.dependency_overrides[get_current_user] = override_current_user
    app.dependency_overrides[get_db] = override_db

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/admin/audit?limit=5")
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["actor_name"] == "דנה לוי"
        assert body[0]["actor_email"] == "dana@example.com"
        assert body[0]["entity_type"] == "tenants"
        assert body[0]["entity_id"] == str(entity_id)
    finally:
        app.dependency_overrides.clear()


def test_audit_path_parser_handles_custom_action_suffix():
    entity_type, entity_id, explicit_action = AuditMiddleware._parse_path(
        f"/api/admin/billing/invoices/{uuid4()}/mark-paid"
    )

    assert entity_type == "invoices"
    assert entity_id is not None
    assert explicit_action == "mark_paid"


def test_audit_path_parser_handles_tenant_hard_delete_suffix():
    entity_type, entity_id, explicit_action = AuditMiddleware._parse_path(
        f"/api/admin/tenants/{uuid4()}/hard-delete"
    )

    assert entity_type == "tenants"
    assert entity_id is not None
    assert explicit_action == "delete"


def test_permissions_match_billing_feature_flag():
    settings = get_settings()

    if settings.BILLING_ENABLED:
        assert "billing" in ALL_RESOURCES
        assert DEFAULT_PERMISSIONS["admin"]["billing"]["can_view"] is True
        assert DEFAULT_PERMISSIONS["billing"]["billing"]["can_edit"] is True
    else:
        assert "billing" not in ALL_RESOURCES
        assert "billing" not in DEFAULT_PERMISSIONS["admin"]
        assert "billing" not in DEFAULT_PERMISSIONS
