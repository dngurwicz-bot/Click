from datetime import datetime
from datetime import date
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.middleware.auth import CurrentUser
from app.routers import core as core_router
from app.schemas.core import OrgUnitCreate, PositionCreate
from app.services.core import next_three_digit_code


class _ScalarResult:
    def __init__(self, row):
        self._row = row

    def scalar_one_or_none(self):
        return self._row


class _ScalarsList:
    def __init__(self, rows):
        self._rows = list(rows)

    def all(self):
        return list(self._rows)


class _ScalarListResult:
    def __init__(self, rows):
        self._rows = list(rows)

    def scalars(self):
        return _ScalarsList(self._rows)


class _FakeSession:
    def __init__(self, execute_results: list[object]):
        self.execute_results = list(execute_results)
        self.added: list[object] = []

    async def execute(self, _query):
        if not self.execute_results:
            raise AssertionError("Unexpected execute call")
        next_value = self.execute_results.pop(0)
        if isinstance(next_value, list):
            return _ScalarListResult(next_value)
        return _ScalarResult(next_value)

    def add(self, row):
        self.added.append(row)

    async def flush(self):
        return None

    async def refresh(self, _row):
        if getattr(_row, "id", None) is None:
            _row.id = uuid4()
        if getattr(_row, "created_at", None) is None:
            _row.created_at = datetime(2026, 5, 7, 12, 0, 0)
        return None


def _current_user() -> CurrentUser:
    return CurrentUser(
        id=uuid4(),
        email="admin@example.com",
        role="admin",
        permissions={"core": {"can_view": True, "can_edit": True, "can_manage_sensitive": True}},
    )


def test_build_department_movements_and_position_history_use_employment_changes():
    rows = [
        core_router.EmployeeEmploymentOut(
            id=uuid4(),
            tenant_id=uuid4(),
            employee_id=uuid4(),
            valid_from=date(2026, 1, 1),
            valid_to=date(2026, 2, 1),
            created_at=datetime(2026, 1, 1, 9, 0, 0),
            start_date=date(2026, 1, 1),
            employment_status="active",
            employment_type="employee",
            salary_type="monthly",
            employment_scope_pct=100,
            org_unit_name="מחלקה א",
            position_title="רכז/ת",
            manager_name="מנהל א",
        ),
        core_router.EmployeeEmploymentOut(
            id=uuid4(),
            tenant_id=uuid4(),
            employee_id=uuid4(),
            valid_from=date(2026, 2, 2),
            valid_to=None,
            created_at=datetime(2026, 2, 2, 9, 0, 0),
            start_date=date(2026, 1, 1),
            employment_status="active",
            employment_type="employee",
            salary_type="monthly",
            employment_scope_pct=100,
            org_unit_name="מחלקה ב",
            position_title="ראש צוות",
            manager_name="מנהל ב",
        ),
    ]

    movements = core_router._build_department_movements(rows)
    history = core_router._build_position_history(rows)

    assert len(movements) == 1
    assert movements[0].previous_org_unit_name == "מחלקה א"
    assert movements[0].next_org_unit_name == "מחלקה ב"
    assert history[0].position_title == "ראש צוות"


def test_next_three_digit_code_uses_independent_numeric_sequence():
    assert next_three_digit_code(["001", "002", None, "009"]) == "010"
    assert next_three_digit_code(["abc", "", None]) == "001"


@pytest.mark.asyncio
async def test_create_org_unit_generates_next_code_per_unit_type():
    tenant_id = uuid4()
    db = _FakeSession(
        [
            SimpleNamespace(tenant_id=tenant_id),
            ["001", "002"],
        ]
    )

    result = await core_router.create_org_unit(
        OrgUnitCreate(
            tenant_id=tenant_id,
            unit_type="division",
            name="חטיבת מערכות מידע",
            valid_from=date(2026, 5, 7),
        ),
        db=db,
        current_user=_current_user(),
    )

    assert result.code == "003"
    assert result.unit_type == "division"
    assert db.added[0].code == "003"


@pytest.mark.asyncio
async def test_create_org_unit_rejects_invalid_parent_type_chain():
    tenant_id = uuid4()
    parent_id = uuid4()
    db = _FakeSession(
        [
            SimpleNamespace(tenant_id=tenant_id),
            SimpleNamespace(id=parent_id, unit_type="department", tenant_id=tenant_id),
        ]
    )

    with pytest.raises(HTTPException) as exc_info:
        await core_router.create_org_unit(
            OrgUnitCreate(
                tenant_id=tenant_id,
                unit_type="team",
                parent_unit_id=parent_id,
                name="צוות גיוס",
                valid_from=date(2026, 5, 7),
            ),
            db=db,
            current_user=_current_user(),
        )

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail["code"] == "INVALID_PARENT_UNIT_TYPE"


@pytest.mark.asyncio
async def test_create_org_unit_rejects_manager_from_different_tenant():
    tenant_id = uuid4()
    manager_id = uuid4()
    db = _FakeSession(
        [
            SimpleNamespace(tenant_id=tenant_id),
            None,
        ]
    )

    with pytest.raises(HTTPException) as exc_info:
        await core_router.create_org_unit(
            OrgUnitCreate(
                tenant_id=tenant_id,
                unit_type="division",
                name="חטיבת תפעול",
                manager_employee_id=manager_id,
                valid_from=date(2026, 5, 7),
            ),
            db=db,
            current_user=_current_user(),
        )

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail["code"] == "ORG_UNIT_MANAGER_NOT_FOUND"


def test_org_unit_field_values_can_clear_manager_assignment():
    manager_id = uuid4()
    anchor = SimpleNamespace(
        parent_unit_id=None,
        manager_employee_id=manager_id,
        unit_type="division",
        name="חטיבת מערכות",
        description=None,
        is_active=True,
        code="001",
    )
    body = core_router.OrgUnitActionBody(
        action="update",
        clear_manager_employee_id=True,
    )

    merged = core_router._org_unit_field_values(body, anchor)

    assert merged["manager_employee_id"] is None


@pytest.mark.asyncio
async def test_create_position_requires_org_unit_and_generates_code():
    tenant_id = uuid4()
    org_unit_id = uuid4()
    db = _FakeSession(
        [
            SimpleNamespace(tenant_id=tenant_id),
            SimpleNamespace(id=org_unit_id, unit_type="team", tenant_id=tenant_id),
            ["001", "002", "003"],
            SimpleNamespace(id=org_unit_id, name="צוות גיוס", tenant_id=tenant_id),
        ]
    )

    result = await core_router.create_position(
        PositionCreate(
            tenant_id=tenant_id,
            org_unit_id=org_unit_id,
            title="רכז/ת גיוס",
            employment_type_default="employee",
            valid_from=date(2026, 5, 7),
        ),
        db=db,
        current_user=_current_user(),
    )

    assert result.code == "004"
    assert db.added[0].code == "004"

    failing_db = _FakeSession([SimpleNamespace(tenant_id=tenant_id)])
    with pytest.raises(HTTPException) as exc_info:
        await core_router.create_position(
            PositionCreate(
                tenant_id=tenant_id,
                org_unit_id=None,
                title="תפקיד ללא יחידה",
                valid_from=date(2026, 5, 7),
            ),
            db=failing_db,
            current_user=_current_user(),
        )

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail["code"] == "ORG_UNIT_REQUIRED"


@pytest.mark.asyncio
async def test_create_position_allows_no_org_unit_when_attachment_disabled(monkeypatch):
    tenant_id = uuid4()
    db = _FakeSession([SimpleNamespace(tenant_id=tenant_id), []])

    async def fake_structure(_db, _tenant_id, *, as_of=None):
        return {
            "levels": ["division", "department", "section", "team"],
            "position_attachment_level": None,
            "is_hierarchical": True,
        }

    monkeypatch.setattr(core_router, "_load_tenant_org_structure", fake_structure)

    result = await core_router.create_position(
        PositionCreate(
            tenant_id=tenant_id,
            org_unit_id=None,
            title="רכז/ת גיוס",
            employment_type_default="employee",
            valid_from=date(2026, 5, 7),
        ),
        db=db,
        current_user=_current_user(),
    )

    assert result.org_unit_id is None
    assert db.added[0].org_unit_id is None


@pytest.mark.asyncio
async def test_create_position_rejects_org_unit_when_attachment_disabled(monkeypatch):
    tenant_id = uuid4()
    org_unit_id = uuid4()
    db = _FakeSession([SimpleNamespace(tenant_id=tenant_id)])

    async def fake_structure(_db, _tenant_id, *, as_of=None):
        return {
            "levels": ["division", "department", "section", "team"],
            "position_attachment_level": None,
            "is_hierarchical": True,
        }

    monkeypatch.setattr(core_router, "_load_tenant_org_structure", fake_structure)

    with pytest.raises(HTTPException) as exc_info:
        await core_router.create_position(
            PositionCreate(
                tenant_id=tenant_id,
                org_unit_id=org_unit_id,
                title="רכז/ת גיוס",
                employment_type_default="employee",
                valid_from=date(2026, 5, 7),
            ),
            db=db,
            current_user=_current_user(),
        )

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail["code"] == "POSITION_ATTACHMENT_DISABLED"
