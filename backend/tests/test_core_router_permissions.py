from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from types import SimpleNamespace
from datetime import UTC, date, datetime

from app.database import get_db
from app.main import app
from app.middleware.auth import CurrentUser, get_current_user
from app.routers import core as core_router
from app.schemas.core import EmploymentEventIn


class FakeSession:
    async def execute(self, _query):
        raise AssertionError("DB should not be queried before sensitive permission guard rejects the request")


@pytest.mark.asyncio
async def test_create_employee_rejects_sensitive_write_without_manage_sensitive():
    async def override_current_user():
        return CurrentUser(
            id=uuid4(),
            email="support@example.com",
            role="support",
            permissions={"core": {"can_view": True, "can_edit": True, "can_manage_sensitive": False}},
        )

    async def override_db():
        yield FakeSession()

    app.dependency_overrides[get_current_user] = override_current_user
    app.dependency_overrides[get_db] = override_db

    payload = {
        "tenant_id": str(uuid4()),
        "employee_number": "1001",
        "identity": {
            "first_name": "Dana",
            "last_name": "Levi",
            "legal_id_type": "national_id",
            "legal_id_number": "123456789",
            "bank_account": "987654321",
        },
        "employment": {
            "employment_status": "active",
            "employment_type": "employee",
            "salary_type": "monthly",
            "start_date": "2026-05-02",
            "employment_scope_pct": 100,
        },
        "compensation": {
            "base_salary": 14000,
            "currency": "ILS",
            "pay_cycle": "monthly",
        },
    }

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/core/employees", json=payload)
        assert response.status_code == 403
        assert response.json()["detail"]["code"] == "FORBIDDEN"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_employee_event_rejects_sensitive_write_without_manage_sensitive():
    async def override_current_user():
        return CurrentUser(
            id=uuid4(),
            email="support@example.com",
            role="support",
            permissions={"core": {"can_view": True, "can_edit": True, "can_manage_sensitive": False}},
        )

    async def override_db():
        yield FakeSession()

    app.dependency_overrides[get_current_user] = override_current_user
    app.dependency_overrides[get_db] = override_db

    payload = {
        "event_type": "compensation_change",
        "effective_date": "2026-05-02",
        "compensation": {
            "base_salary": 15000,
            "currency": "ILS",
            "pay_cycle": "monthly",
        },
    }

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(f"/api/core/employees/{uuid4()}/events", json=payload)
        assert response.status_code == 403
        assert response.json()["detail"]["code"] == "FORBIDDEN"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_employee_bank_account_rejects_without_manage_sensitive():
    async def override_current_user():
        return CurrentUser(
            id=uuid4(),
            email="support@example.com",
            role="support",
            permissions={"core": {"can_view": True, "can_edit": True, "can_manage_sensitive": False}},
        )

    async def override_db():
        yield FakeSession()

    app.dependency_overrides[get_current_user] = override_current_user
    app.dependency_overrides[get_db] = override_db

    payload = {
        "bank_name": "Leumi",
        "branch_number": "123",
        "account_number": "987654321",
        "valid_from": "2026-05-02",
    }

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(f"/api/core/employees/{uuid4()}/bank-accounts", json=payload)
        assert response.status_code == 403
        assert response.json()["detail"]["code"] == "FORBIDDEN"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_employee_rejects_spouse_legal_id_without_manage_sensitive():
    async def override_current_user():
        return CurrentUser(
            id=uuid4(),
            email="support@example.com",
            role="support",
            permissions={"core": {"can_view": True, "can_edit": True, "can_manage_sensitive": False}},
        )

    async def override_db():
        yield FakeSession()

    app.dependency_overrides[get_current_user] = override_current_user
    app.dependency_overrides[get_db] = override_db

    payload = {
        "tenant_id": str(uuid4()),
        "employee_number": "1002",
        "identity": {
            "first_name": "Dana",
            "last_name": "Levi",
            "legal_id_type": "national_id",
            "spouse_legal_id": "123456789",
        },
        "employment": {
            "employment_status": "active",
            "employment_type": "employee",
            "salary_type": "monthly",
            "start_date": "2026-05-02",
            "employment_scope_pct": 100,
        },
    }

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/core/employees", json=payload)
        assert response.status_code == 403
        assert response.json()["detail"]["code"] == "FORBIDDEN"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_status_only_event_preserves_existing_employment_fields(monkeypatch):
    employee_id = uuid4()
    tenant_id = uuid4()
    current_user = CurrentUser(
        id=uuid4(),
        email="admin@example.com",
        role="admin",
        permissions={"core": {"can_view": True, "can_edit": True, "can_manage_sensitive": True}},
    )
    current_employment = SimpleNamespace(
        tenant_id=tenant_id,
        employee_id=employee_id,
        org_unit_id=uuid4(),
        manager_employee_id=uuid4(),
        position_id=uuid4(),
        employment_status="active",
        employment_type="employee",
        salary_type="monthly",
        start_date=date(2026, 1, 5),
        end_date=None,
        employment_scope_pct=100,
        branch_name="Jerusalem",
        work_site="HQ",
        time_clock_id="CLK-77",
        notes="Existing notes",
        valid_from=date(2026, 1, 5),
        valid_to=None,
    )
    captured: dict[str, object] = {}

    class FakeDb:
        def __init__(self):
            self.added = []

        def add(self, obj):
            self.added.append(obj)

        async def flush(self):
            for obj in self.added:
                if getattr(obj, "id", None) is None:
                    obj.id = uuid4()
                if getattr(obj, "created_at", None) is None:
                    obj.created_at = datetime.now(UTC)

        async def refresh(self, _obj):
            return None

    async def fake_ensure_employee(_db, requested_employee_id):
        return SimpleNamespace(id=requested_employee_id, tenant_id=tenant_id, is_active=True)

    async def fake_get_active(_db, model, _tenant_id, extra_filters=None, **_kwargs):
        if model is core_router.EmployeeEmployment and extra_filters == {"employee_id": employee_id}:
            return current_employment
        return None

    async def fake_close_and_create(_db, _model, _tenant_id, payload, _user_id, **_kwargs):
        captured["payload"] = payload
        return SimpleNamespace(**payload)

    monkeypatch.setattr(core_router, "_ensure_employee", fake_ensure_employee)
    monkeypatch.setattr(core_router, "get_active", fake_get_active)
    monkeypatch.setattr(core_router, "close_and_create", fake_close_and_create)

    body = EmploymentEventIn(
        event_type="status_change",
        effective_date=date(2026, 6, 1),
        notes="Changed status",
    )

    await core_router.create_employee_event(
        employee_id,
        body,
        db=FakeDb(),
        current_user=current_user,
    )

    assert captured["payload"]["branch_name"] == "Jerusalem"
    assert captured["payload"]["time_clock_id"] == "CLK-77"


@pytest.mark.asyncio
async def test_update_identity_maps_id_number_to_model_column(monkeypatch):
    employee_id = uuid4()
    tenant_id = uuid4()
    current_user = CurrentUser(
        id=uuid4(),
        email="admin@example.com",
        role="admin",
        permissions={"core": {"can_view": True, "can_edit": True, "can_manage_sensitive": True}},
    )
    captured: dict[str, object] = {}

    async def fake_get_employee_or_404(_db, requested_employee_id, requested_tenant_id):
        return SimpleNamespace(id=requested_employee_id, tenant_id=requested_tenant_id)

    async def fake_handle_temporal(_db, model, requested_tenant_id, requested_employee_id, body, actor_id, data_fields):
        captured["model"] = model
        captured["tenant_id"] = requested_tenant_id
        captured["employee_id"] = requested_employee_id
        captured["body"] = body
        captured["actor_id"] = actor_id
        captured["data_fields"] = data_fields

    monkeypatch.setattr(core_router, "_get_employee_or_404", fake_get_employee_or_404)
    monkeypatch.setattr(core_router, "_handle_temporal", fake_handle_temporal)

    body = core_router.TemporalActionBody(
        action="update",
        first_name="Diego",
        last_name="Gurbicz",
        id_number="313842650",
        username="diegog",
    )

    await core_router.update_identity(
        employee_id,
        tenant_id,
        body,
        db=SimpleNamespace(),
        user=current_user,
    )

    data_fields = captured["data_fields"]
    assert data_fields["first_name"] == "Diego"
    assert data_fields["last_name"] == "Gurbicz"
    assert data_fields["legal_id_number"] == "313842650"
    assert "id_number" not in data_fields
    assert "username" not in data_fields
