from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from types import SimpleNamespace
from datetime import UTC, date, datetime
from fastapi import HTTPException

from app.database import get_db
from app.main import app
from app.middleware.auth import CurrentUser, get_current_user
from app.routers import core as core_router


class FakeSession:
    async def execute(self, _query):
        raise AssertionError("DB should not be queried before sensitive permission guard rejects the request")


class _ScalarRows:
    def __init__(self, rows):
        self._rows = list(rows)

    def all(self):
        return list(self._rows)


class _ScalarResult:
    def __init__(self, rows):
        self._rows = list(rows)

    def scalars(self):
        return _ScalarRows(self._rows)


class _MappingRows:
    def __init__(self, rows):
        self._rows = list(rows)

    def all(self):
        return list(self._rows)


class _MappingResult:
    def __init__(self, rows):
        self._rows = list(rows)

    def mappings(self):
        return _MappingRows(self._rows)


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


def test_temporal_action_body_rejects_invalid_date_window():
    with pytest.raises(ValueError, match="תאריך סיום לא יכול להיות מוקדם מתאריך התחלה"):
        core_router.TemporalActionBody(
            action="update",
            valid_from=date(2026, 5, 14),
            valid_to=date(2026, 5, 13),
        )


@pytest.mark.parametrize(
    ("field_name", "payload", "expected_error"),
    [
        ("first_name", {"first_name": "   ", "last_name": "Levi"}, "שם פרטי הוא שדה חובה"),
        ("last_name", {"first_name": "Dana", "last_name": "   "}, "שם משפחה הוא שדה חובה"),
        ("id_number", {"first_name": "Dana", "last_name": "Levi", "id_number": "12A"}, "תעודת זהות חייב להכיל ספרות בלבד"),
    ],
)
def test_build_identity_temporal_data_rejects_invalid_supported_fields(field_name, payload, expected_error):
    body = core_router.TemporalActionBody(action="update", **payload)

    with pytest.raises(HTTPException) as exc_info:
        core_router._build_identity_temporal_data(body)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail["error"] == expected_error


@pytest.mark.asyncio
async def test_get_employee_returns_model_aligned_sections(monkeypatch):
    employee_id = uuid4()
    tenant_id = uuid4()
    mgr_id = uuid4()
    employment_row = SimpleNamespace(
        id=uuid4(),
        org_unit_id=uuid4(),
        position_id=uuid4(),
        manager_employee_id=mgr_id,
        employment_status="active",
        employment_type="employee",
        salary_type="monthly",
        start_date=date(2026, 1, 1),
        end_date=None,
        employment_scope_pct=100,
        branch_name=None,
        work_site=None,
        time_clock_id=None,
        notes=None,
        valid_from=date(2026, 1, 1),
        valid_to=None,
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
    )
    db_results = [
        # identity
        _ScalarResult(
            [
                SimpleNamespace(
                    id=uuid4(),
                    first_name="Dana",
                    last_name="Levi",
                    id_number="123456789",
                    gender="F",
                    valid_from=date(2026, 1, 1),
                    valid_to=None,
                    created_at=datetime(2026, 1, 1, tzinfo=UTC),
                )
            ]
        ),
        # personal
        _ScalarResult(
            [
                SimpleNamespace(
                    id=uuid4(),
                    birth_date=date(1990, 5, 2),
                    birth_country="IL",
                    citizenship1="IL",
                    citizenship2=None,
                    marital_status="single",
                    num_children=0,
                    valid_from=date(2026, 1, 1),
                    valid_to=None,
                    created_at=datetime(2026, 1, 1, tzinfo=UTC),
                )
            ]
        ),
        # contact
        _ScalarResult(
            [
                SimpleNamespace(
                    id=uuid4(),
                    address1="Herzl 1",
                    address2=None,
                    city="Jerusalem",
                    zip_code="91000",
                    country="IL",
                    phone="02-0000000",
                    mobile="0501234567",
                    home_phone=None,
                    fax=None,
                    email="dana@example.com",
                    valid_from=date(2026, 1, 1),
                    valid_to=None,
                    created_at=datetime(2026, 1, 1, tzinfo=UTC),
                )
            ]
        ),
        # employment
        _ScalarResult([employment_row]),
        # compensation
        _ScalarResult(
            [
                SimpleNamespace(
                    id=uuid4(),
                    base_salary=14500,
                    currency="ILS",
                    pay_cycle="monthly",
                    cost_center=None,
                    components_json=None,
                    valid_from=date(2026, 1, 1),
                    valid_to=None,
                    created_at=datetime(2026, 1, 1, tzinfo=UTC),
                )
            ]
        ),
        # bank
        _ScalarResult(
            [
                SimpleNamespace(
                    id=uuid4(),
                    bank_code="10",
                    bank_name="Leumi",
                    branch_number="123",
                    branch_description=None,
                    account_number="456789",
                    account_holder_name="Dana Levi",
                    payment_method="bank_transfer",
                    payment_percent=None,
                    fixed_amount=None,
                    payment_priority=None,
                    company_name=None,
                    notes=None,
                    valid_from=date(2026, 1, 1),
                    valid_to=None,
                    created_at=datetime(2026, 1, 1, tzinfo=UTC),
                )
            ]
        ),
        # documents
        _ScalarResult([]),
        # certifications
        _ScalarResult([]),
        # courses
        _ScalarResult([]),
        # work_breaks
        _ScalarResult([]),
        # training
        _ScalarResult(
            [
                SimpleNamespace(
                    id=uuid4(),
                    course_name="Safety",
                    course_date=date(2026, 2, 1),
                    score="95",
                    institute="Click Academy",
                    created_at=datetime(2026, 2, 1, tzinfo=UTC),
                )
            ]
        ),
        # children
        _ScalarResult([]),
        # awards
        _ScalarResult([]),
        # skills
        _ScalarResult([]),
    ]

    class _FakeDb:
        def __init__(self, execute_results):
            self.execute_results = list(execute_results)

        async def execute(self, _query, _params=None):
            if not self.execute_results:
                raise AssertionError("Unexpected execute call")
            return self.execute_results.pop(0)

    async def fake_get_employee_or_404(_db, requested_employee_id, requested_tenant_id):
        return SimpleNamespace(
            id=requested_employee_id,
            tenant_id=requested_tenant_id,
            employee_number="1001",
            status="active",
            photo_url=None,
            created_at=datetime(2026, 1, 1, tzinfo=UTC),
        )

    async def fake_resolve_org_pos_names(_db, _tenant_id, _rows):
        return {employment_row.id: ("Operations", "Analyst")}

    async def fake_resolve_manager_names(_db, _rows):
        return {employment_row.manager_employee_id: "Manager Name"}

    monkeypatch.setattr(core_router, "_get_employee_or_404", fake_get_employee_or_404)
    monkeypatch.setattr(core_router, "_resolve_org_pos_names", fake_resolve_org_pos_names)
    monkeypatch.setattr(core_router, "_resolve_manager_names", fake_resolve_manager_names)

    payload = await core_router.get_employee(
        employee_id,
        tenant_id,
        db=_FakeDb(db_results),
        user=CurrentUser(
            id=uuid4(),
            email="admin@example.com",
            role="admin",
            permissions={"core": {"can_view": True, "can_edit": True, "can_manage_sensitive": True}},
        ),
    )

    assert payload["id_number"] == "123456789"
    assert payload["personal"][0]["birth_country"] == "IL"
    assert payload["contact"][0]["email"] == "dana@example.com"
    assert payload["employment"][0]["position_name"] == "Analyst"
    assert payload["employment"][0]["manager_name"] == "Manager Name"
    assert payload["compensation"][0]["base_salary"] == 14500.0
    assert "amount" not in payload["compensation"][0]
    assert payload["bank"][0]["branch_number"] == "123"
    assert payload["training"][0]["institute"] == "Click Academy"
