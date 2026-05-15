from datetime import date, datetime, UTC
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.middleware.auth import CurrentUser
from app.routers import admin_users as admin_users_router
from app.schemas.admin_user import AdminUserActionBody, AdminUserUpdate


class _ScalarResult:
    def __init__(self, row):
        self._row = row

    def scalar_one_or_none(self):
        return self._row


class _FakeDb:
    def __init__(self, execute_results):
        self.execute_results = list(execute_results)
        self.committed = False
        self.refreshed = []

    async def execute(self, _query):
        if not self.execute_results:
            raise AssertionError("Unexpected execute call")
        return _ScalarResult(self.execute_results.pop(0))

    async def commit(self):
        self.committed = True

    async def refresh(self, row):
        self.refreshed.append(row)


def _current_user() -> CurrentUser:
    return CurrentUser(
        id=uuid4(),
        email="admin@example.com",
        role="admin",
        permissions={"users": {"can_view": True, "can_edit": True, "can_manage_sensitive": False}},
    )


@pytest.mark.asyncio
async def test_update_user_sets_tenant_id_for_org_admin(monkeypatch):
    tenant_id = uuid4()
    user = SimpleNamespace(
        id=uuid4(),
        full_name="Dana Levi",
        email="dana@example.com",
        role="admin",
        tenant_id=None,
        is_active=True,
        last_login_at=None,
        created_at=datetime(2026, 5, 1, tzinfo=UTC),
        valid_from=date(2026, 5, 1),
        valid_to=None,
    )
    db = _FakeDb([user])

    async def fake_load_permissions(_db, _user_id):
        return []

    monkeypatch.setattr(admin_users_router, "_load_permissions", fake_load_permissions)

    result = await admin_users_router.update_user(
        user.id,
        AdminUserUpdate(role="org_admin", tenant_id=tenant_id),
        db=db,
        current_user=_current_user(),
    )

    assert user.role == "org_admin"
    assert user.tenant_id == tenant_id
    assert result.tenant_id == tenant_id
    assert db.committed is True


@pytest.mark.asyncio
async def test_update_user_clears_tenant_id_when_role_is_system_scope(monkeypatch):
    tenant_id = uuid4()
    user = SimpleNamespace(
        id=uuid4(),
        full_name="Dana Levi",
        email="dana@example.com",
        role="org_admin",
        tenant_id=tenant_id,
        is_active=True,
        last_login_at=None,
        created_at=datetime(2026, 5, 1, tzinfo=UTC),
        valid_from=date(2026, 5, 1),
        valid_to=None,
    )
    db = _FakeDb([user])

    async def fake_load_permissions(_db, _user_id):
        return []

    monkeypatch.setattr(admin_users_router, "_load_permissions", fake_load_permissions)

    result = await admin_users_router.update_user(
        user.id,
        AdminUserUpdate(role="admin"),
        db=db,
        current_user=_current_user(),
    )

    assert user.role == "admin"
    assert user.tenant_id is None
    assert result.tenant_id is None


@pytest.mark.asyncio
async def test_temporal_user_action_updates_tenant_id_for_org_admin(monkeypatch):
    tenant_id = uuid4()
    user = SimpleNamespace(
        id=uuid4(),
        full_name="Dana Levi",
        email="dana@example.com",
        role="support",
        tenant_id=None,
        is_active=True,
        last_login_at=None,
        created_at=datetime(2026, 5, 1, tzinfo=UTC),
        valid_from=date(2026, 5, 1),
        valid_to=None,
    )
    db = _FakeDb([user])

    async def fake_load_permissions(_db, _user_id):
        return []

    monkeypatch.setattr(admin_users_router, "_load_permissions", fake_load_permissions)

    result = await admin_users_router.temporal_user_action(
        user.id,
        AdminUserActionBody(action="update", role="org_admin", tenant_id=tenant_id),
        db=db,
        current_user=_current_user(),
    )

    assert user.role == "org_admin"
    assert user.tenant_id == tenant_id
    assert result.tenant_id == tenant_id
