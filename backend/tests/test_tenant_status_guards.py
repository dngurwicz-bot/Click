from datetime import UTC, date, datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.middleware.auth import CurrentUser
from app.routers import tenants as tenants_router
from app.schemas.tenant import (
    TenantApplyTemplateRequest,
    TenantStatusUpdate,
    TenantSubscriptionModuleCreate,
    TenantUpdateRequest,
)


class _ScalarOneResult:
    def __init__(self, row):
        self._row = row

    def scalar_one_or_none(self):
        return self._row


class _FakeSession:
    def __init__(self, execute_results: list[object] | None = None):
        self.execute_results = list(execute_results or [])
        self.added: list[object] = []

    async def execute(self, _query):
        if self.execute_results:
            return _ScalarOneResult(self.execute_results.pop(0))
        return _ScalarOneResult(None)

    def add(self, row):
        self.added.append(row)

    async def flush(self):
        return None

    async def refresh(self, _row):
        return None

    async def commit(self):
        return None


def _current_user() -> CurrentUser:
    return CurrentUser(
        id=uuid4(),
        email="admin@example.com",
        role="admin",
        permissions={"tenants": {"can_view": True, "can_edit": True}},
    )


@pytest.mark.asyncio
async def test_update_tenant_status_skips_date_guard(monkeypatch):
    tenant_id = uuid4()
    db = _FakeSession([SimpleNamespace(tenant_id=tenant_id, created_at=datetime.now(UTC))])
    guard_calls: list[tuple[date, date | None]] = []

    async def fake_guard(_db, _tenant_id, valid_from, valid_to=None):
        guard_calls.append((valid_from, valid_to))

    async def fake_get_active(_db, model, _tenant_id, extra_filters=None):
        if model is tenants_router.TenantStatus:
            return SimpleNamespace(valid_from=date(2026, 4, 1), valid_to=None, status="cancelled")
        return None

    async def fake_update_in_place(*_args, **_kwargs):
        return None

    async def fake_build_tenant_out(tenant, _db):
        return tenant

    monkeypatch.setattr(tenants_router, "_ensure_tenant_operation_window", fake_guard)
    monkeypatch.setattr(tenants_router, "get_active", fake_get_active)
    monkeypatch.setattr(tenants_router, "update_in_place", fake_update_in_place)
    monkeypatch.setattr(tenants_router, "_build_tenant_out", fake_build_tenant_out)

    result = await tenants_router.update_tenant(
        tenant_id,
        TenantUpdateRequest(status=TenantStatusUpdate(status="active", reason="reactivate")),
        db=db,
        current_user=_current_user(),
    )

    assert result.tenant_id == tenant_id
    assert guard_calls == []


@pytest.mark.asyncio
async def test_add_subscription_module_checks_today_window(monkeypatch):
    tenant_id = uuid4()
    subscription = SimpleNamespace(id=uuid4())
    db = _FakeSession([None])

    async def fake_guard(_db, _tenant_id, valid_from, valid_to=None):
        assert valid_from == date.today()
        assert valid_to is None
        raise HTTPException(
            status_code=409,
            detail={"error": "blocked", "code": "TENANT_INACTIVE_FOR_DATE"},
        )

    async def fake_get_active(_db, model, _tenant_id, extra_filters=None):
        if model is tenants_router.TenantSubscription:
            return subscription
        return None

    monkeypatch.setattr(tenants_router, "_ensure_tenant_operation_window", fake_guard)
    monkeypatch.setattr(tenants_router, "get_active", fake_get_active)

    with pytest.raises(HTTPException) as exc_info:
        await tenants_router.add_tenant_subscription_module(
            tenant_id,
            TenantSubscriptionModuleCreate(module_slug="core"),
            db=db,
            current_user=_current_user(),
        )

    assert exc_info.value.detail["code"] == "TENANT_INACTIVE_FOR_DATE"


@pytest.mark.asyncio
async def test_apply_template_checks_effective_date(monkeypatch):
    tenant_id = uuid4()
    template_id = uuid4()
    tenant = SimpleNamespace(tenant_id=tenant_id, created_at=datetime.now(UTC))
    template = SimpleNamespace(id=template_id, default_billing_cycle="monthly")
    db = _FakeSession([tenant, template])
    guard_calls: list[tuple[date, date | None]] = []

    async def fake_guard(_db, _tenant_id, valid_from, valid_to=None):
        guard_calls.append((valid_from, valid_to))

    async def fake_load_template_defaults(_db, _template_id):
        return {}

    async def fake_load_template_modules(_db, _template_id):
        return []

    async def fake_materialize(*_args, **_kwargs):
        return []

    async def fake_build_tenant_out(tenant_obj, _db):
        return tenant_obj

    async def fake_get_active(_db, _model, _tenant_id, extra_filters=None):
        return None

    monkeypatch.setattr(tenants_router, "_ensure_tenant_operation_window", fake_guard)
    monkeypatch.setattr(tenants_router, "_load_template_defaults", fake_load_template_defaults)
    monkeypatch.setattr(tenants_router, "_load_template_modules", fake_load_template_modules)
    monkeypatch.setattr(tenants_router, "_materialize_subscription_modules", fake_materialize)
    monkeypatch.setattr(tenants_router, "_build_tenant_out", fake_build_tenant_out)
    monkeypatch.setattr(tenants_router, "get_active", fake_get_active)

    result = await tenants_router.apply_template_to_tenant(
        tenant_id,
        TenantApplyTemplateRequest(template_id=template_id, valid_from=date(2026, 3, 27)),
        db=db,
        current_user=_current_user(),
    )

    assert result.tenant_id == tenant_id
    assert guard_calls == [(date(2026, 3, 27), None)]
