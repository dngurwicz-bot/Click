from datetime import date
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.middleware.auth import CurrentUser
from app.routers import org_admin


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

    def all(self):
        return list(self._rows)


class _FakeSession:
    def __init__(self, execute_results: list[object]):
        self.execute_results = list(execute_results)
        self.added: list[object] = []
        self.deleted: list[object] = []
        self.commit_calls = 0
        self.refresh_calls = 0

    async def execute(self, _query):
        if not self.execute_results:
            raise AssertionError("Unexpected execute call")
        next_value = self.execute_results.pop(0)
        if isinstance(next_value, list):
            return _ScalarListResult(next_value)
        return _ScalarResult(next_value)

    def add(self, row):
        self.added.append(row)

    async def delete(self, row):
        self.deleted.append(row)

    async def commit(self):
        self.commit_calls += 1

    async def refresh(self, _row):
        self.refresh_calls += 1


def _current_user(*, tenant_id=None) -> CurrentUser:
    return CurrentUser(
        id=uuid4(),
        email="admin@example.com",
        role="admin",
        tenant_id=tenant_id,
        permissions={"org_admin": {"can_view": True, "can_edit": True}},
    )


def _org_structure(
    *,
    levels: list[str] | None = None,
    position_attachment_level: str | None = "team",
    is_hierarchical: bool = True,
):
    normalized_levels = levels or ["division", "department", "section", "team"]
    attachment_level = position_attachment_level
    if attachment_level == "team" and "team" not in normalized_levels:
        attachment_level = normalized_levels[-1] if normalized_levels else None
    return SimpleNamespace(
        tenant_id=uuid4(),
        levels=normalized_levels,
        position_attachment_level=attachment_level,
        is_hierarchical=is_hierarchical,
        valid_from=date(2026, 1, 1),
        valid_to=None,
    )


@pytest.mark.asyncio
async def test_create_org_unit_rejects_invalid_parent_type_chain():
    tenant_id = uuid4()
    parent_id = uuid4()
    db = _FakeSession(
        [
            _org_structure(),
            SimpleNamespace(id=parent_id, tenant_id=tenant_id, unit_type="department", parent_unit_id=None),
        ]
    )

    with pytest.raises(HTTPException) as exc_info:
        await org_admin.create_org_unit(
            org_admin.OrgUnitCreate(
                unit_type="team",
                name="צוות גיוס",
                parent_unit_id=parent_id,
                valid_from=date(2026, 5, 15),
            ),
            tenant_id=tenant_id,
            db=db,
            user=_current_user(),
        )

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail["code"] == "INVALID_PARENT_UNIT_TYPE"


@pytest.mark.asyncio
async def test_create_org_unit_rejects_manager_from_different_tenant():
    tenant_id = uuid4()
    manager_id = uuid4()
    db = _FakeSession([_org_structure(levels=["division"]) , None])

    with pytest.raises(HTTPException) as exc_info:
        await org_admin.create_org_unit(
            org_admin.OrgUnitCreate(
                unit_type="division",
                name="חטיבה",
                manager_employee_id=manager_id,
                valid_from=date(2026, 5, 15),
            ),
            tenant_id=tenant_id,
            db=db,
            user=_current_user(),
        )

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail["code"] == "ORG_UNIT_MANAGER_NOT_FOUND"


@pytest.mark.asyncio
async def test_create_position_requires_org_unit_when_attachment_enabled():
    tenant_id = uuid4()
    db = _FakeSession([_org_structure(position_attachment_level="team")])

    with pytest.raises(HTTPException) as exc_info:
        await org_admin.create_position(
            org_admin.PositionCreate(
                title="רכז/ת גיוס",
                org_unit_id=None,
                valid_from=date(2026, 5, 15),
            ),
            tenant_id=tenant_id,
            db=db,
            user=_current_user(),
        )

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail["code"] == "ORG_UNIT_REQUIRED"


@pytest.mark.asyncio
async def test_update_position_add_creates_new_history_row():
    tenant_id = uuid4()
    org_unit_id = uuid4()
    anchor = SimpleNamespace(
        id=uuid4(),
        tenant_id=tenant_id,
        code="007",
        title="רכז/ת גיוס",
        description="תפקיד קיים",
        org_unit_id=org_unit_id,
        employment_type_default="employee",
        valid_from=date(2026, 1, 1),
        valid_to=None,
    )
    db = _FakeSession(
        [
            anchor,
            _org_structure(position_attachment_level="team"),
            SimpleNamespace(id=org_unit_id, tenant_id=tenant_id, unit_type="team"),
        ]
    )

    result = await org_admin.update_position_record(
        anchor.id,
        org_admin.PositionUpdate(
            action="add",
            title="רכז/ת גיוס בכיר/ה",
            valid_from=date(2026, 6, 1),
        ),
        tenant_id=tenant_id,
        db=db,
        user=_current_user(),
    )

    assert result == {"ok": True}
    assert db.commit_calls == 1
    assert len(db.added) == 1
    assert db.added[0].code == "007"
    assert db.added[0].title == "רכז/ת גיוס בכיר/ה"
    assert db.added[0].valid_from == date(2026, 6, 1)


@pytest.mark.asyncio
async def test_update_org_unit_update_with_future_valid_from_splits_active_row():
    tenant_id = uuid4()
    unit = SimpleNamespace(
        id=uuid4(),
        tenant_id=tenant_id,
        code="003",
        unit_type="division",
        name="חטיבת מערכות מידע",
        description=None,
        parent_unit_id=None,
        manager_employee_id=None,
        valid_from=date(2026, 1, 1),
        valid_to=None,
        updated_by=None,
        updated_at=None,
    )
    db = _FakeSession([unit, _org_structure(levels=["division"])])

    result = await org_admin.update_org_unit_record(
        unit.id,
        org_admin.OrgUnitUpdate(
            action="update",
            name="חטיבת דאטה",
            valid_from=date(2026, 6, 1),
        ),
        tenant_id=tenant_id,
        db=db,
        user=_current_user(),
    )

    assert result == {"ok": True}
    assert db.commit_calls == 1
    assert unit.valid_to == date(2026, 5, 31)
    assert len(db.added) == 1
    assert db.added[0].code == "003"
    assert db.added[0].name == "חטיבת דאטה"
    assert db.added[0].valid_from == date(2026, 6, 1)
    assert db.added[0].valid_to is None


@pytest.mark.asyncio
async def test_update_position_update_with_future_valid_from_splits_active_row():
    tenant_id = uuid4()
    org_unit_id = uuid4()
    position = SimpleNamespace(
        id=uuid4(),
        tenant_id=tenant_id,
        code="007",
        title="רכז/ת גיוס",
        description="תפקיד קיים",
        org_unit_id=org_unit_id,
        employment_type_default="employee",
        valid_from=date(2026, 1, 1),
        valid_to=None,
        updated_by=None,
        updated_at=None,
    )
    db = _FakeSession(
        [
            position,
            _org_structure(position_attachment_level="team"),
            SimpleNamespace(id=org_unit_id, tenant_id=tenant_id, unit_type="team"),
        ]
    )

    result = await org_admin.update_position_record(
        position.id,
        org_admin.PositionUpdate(
            action="update",
            title="רכז/ת גיוס בכיר/ה",
            valid_from=date(2026, 6, 1),
        ),
        tenant_id=tenant_id,
        db=db,
        user=_current_user(),
    )

    assert result == {"ok": True}
    assert db.commit_calls == 1
    assert position.valid_to == date(2026, 5, 31)
    assert len(db.added) == 1
    assert db.added[0].code == "007"
    assert db.added[0].title == "רכז/ת גיוס בכיר/ה"
    assert db.added[0].valid_from == date(2026, 6, 1)
    assert db.added[0].valid_to is None


@pytest.mark.asyncio
async def test_update_org_unit_set_uses_kabiya_for_same_code(monkeypatch):
    tenant_id = uuid4()
    unit = SimpleNamespace(
        id=uuid4(),
        tenant_id=tenant_id,
        code="003",
        unit_type="division",
        name="חטיבת מערכות מידע",
        description=None,
        parent_unit_id=None,
        manager_employee_id=None,
        valid_from=date(2026, 1, 1),
        valid_to=None,
    )
    db = _FakeSession([unit, _org_structure(levels=["division"])])
    captured: dict[str, object] = {}

    async def fake_kabiya(session, model, scoped_tenant_id, new_data, actor_id, *, new_valid_from, new_valid_to, extra_filters):
        captured["session"] = session
        captured["model"] = model
        captured["tenant_id"] = scoped_tenant_id
        captured["new_data"] = new_data
        captured["actor_id"] = actor_id
        captured["new_valid_from"] = new_valid_from
        captured["new_valid_to"] = new_valid_to
        captured["extra_filters"] = extra_filters

    monkeypatch.setattr(org_admin, "kabiya", fake_kabiya)

    result = await org_admin.update_org_unit_record(
        unit.id,
        org_admin.OrgUnitUpdate(
            action="set",
            name="חטיבת דאטה",
            valid_from=date(2026, 7, 1),
            valid_to=date(2026, 12, 31),
        ),
        tenant_id=tenant_id,
        db=db,
        user=_current_user(),
    )

    assert result == {"ok": True}
    assert db.commit_calls == 1
    assert captured["model"] is org_admin.OrgUnit
    assert captured["tenant_id"] == tenant_id
    assert captured["new_valid_from"] == date(2026, 7, 1)
    assert captured["new_valid_to"] == date(2026, 12, 31)
    assert captured["extra_filters"] == {"code": "003"}
    assert captured["new_data"]["code"] == "003"
    assert captured["new_data"]["name"] == "חטיבת דאטה"


@pytest.mark.asyncio
async def test_update_course_rejects_invalid_date_range_against_existing_valid_from():
    tenant_id = uuid4()
    course = SimpleNamespace(
        id=uuid4(),
        tenant_id=tenant_id,
        valid_from=date(2026, 5, 15),
        valid_to=None,
        name="קורס",
        name_en=None,
        category=None,
        duration_hours=8,
        is_mandatory=False,
    )
    db = _FakeSession([course])

    with pytest.raises(HTTPException) as exc_info:
        await org_admin.update_course(
            course.id,
            org_admin.CourseUpdate(valid_to=date(2026, 5, 1)),
            tenant_id=tenant_id,
            db=db,
            user=_current_user(),
        )

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail["code"] == "INVALID_DATE_RANGE"


@pytest.mark.asyncio
async def test_list_employees_for_manager_selection_returns_basic_fields():
    tenant_id = uuid4()
    emp = SimpleNamespace(id=uuid4(), employee_number="001", tenant_id=tenant_id)
    ident = SimpleNamespace(first_name="ישראל", last_name="ישראלי")
    db = _FakeSession([[(emp, ident)]])

    result = await org_admin.list_employees_for_manager_selection(
        tenant_id=tenant_id,
        db=db,
        user=_current_user(),
    )

    assert len(result) == 1
    assert result[0]["employee_number"] == "001"
    assert result[0]["full_name"] == "ישראל ישראלי"
    assert result[0]["id"] == str(emp.id)


@pytest.mark.asyncio
async def test_list_employees_for_manager_selection_handles_missing_identity():
    tenant_id = uuid4()
    emp = SimpleNamespace(id=uuid4(), employee_number="002", tenant_id=tenant_id)
    db = _FakeSession([[(emp, None)]])

    result = await org_admin.list_employees_for_manager_selection(
        tenant_id=tenant_id,
        db=db,
        user=_current_user(),
    )

    assert result[0]["full_name"] == "—"
