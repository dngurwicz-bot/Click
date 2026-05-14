from __future__ import annotations

from datetime import date, datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.middleware.auth import CurrentUser
from app.routers import tenants as tenants_router
from app.schemas.tenant import TenantOrgStructureConfigActionBody, TenantOrgStructureOverridePreviewRequest
from app.services.tenant_org_structure import validate_org_structure_override


class _ScalarResult:
    def __init__(self, row):
        self._row = row

    def scalar_one_or_none(self):
        return self._row


class _FakeSession:
    def __init__(self, execute_results: list[object]):
        self.execute_results = list(execute_results)

    async def execute(self, _query):
        if not self.execute_results:
            raise AssertionError("Unexpected execute call")
        return _ScalarResult(self.execute_results.pop(0))

    async def commit(self):
        return None


def _super_admin() -> CurrentUser:
    return CurrentUser(
        id=uuid4(),
        email="super@example.com",
        role="super_admin",
        permissions={},
    )


def _admin() -> CurrentUser:
    return CurrentUser(
        id=uuid4(),
        email="admin@example.com",
        role="admin",
        permissions={"tenants": {"can_view": True, "can_edit": True}},
    )


def test_validate_org_structure_override_rejects_reordering():
    with pytest.raises(HTTPException) as exc_info:
        validate_org_structure_override(
            current_levels=["division", "department", "section", "team"],
            proposed_levels=["team", "division"],
            current_is_hierarchical=True,
            proposed_is_hierarchical=True,
        )

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail["code"] == "INVALID_ORG_STRUCTURE_OVERRIDE"


def test_validate_org_structure_override_allows_hierarchy_change_for_override():
    result = validate_org_structure_override(
        current_levels=["division", "department", "section", "team"],
        proposed_levels=["division", "department", "section", "team"],
        current_is_hierarchical=True,
        proposed_is_hierarchical=False,
        allow_hierarchy_change=True,
    )

    assert result == ["division", "department", "section", "team"]


def test_normalize_org_structure_input_allows_positions_without_attachment():
    body = tenants_router.TenantOrgStructureConfigActionBody(
        action="update",
        valid_from=date(2026, 5, 8),
        levels=["division", "department", "team"],
        position_attachment_level=None,
        is_hierarchical=True,
    )

    normalized = tenants_router._normalize_org_structure_input(body)

    assert normalized["levels"] == ["division", "department", "team"]
    assert normalized["position_attachment_level"] is None


def test_compute_org_structure_override_preview_counts_reparented_descendants():
    division_id = uuid4()
    department_id = uuid4()
    section_id = uuid4()
    team_id = uuid4()
    impact = tenants_router._compute_org_structure_override_preview(
        active_units=[
            SimpleNamespace(id=division_id, unit_type="division", parent_unit_id=None),
            SimpleNamespace(id=department_id, unit_type="department", parent_unit_id=division_id),
            SimpleNamespace(id=section_id, unit_type="section", parent_unit_id=department_id),
            SimpleNamespace(id=team_id, unit_type="team", parent_unit_id=section_id),
        ],
        active_positions=[
            SimpleNamespace(id=uuid4(), org_unit_id=section_id),
            SimpleNamespace(id=uuid4(), org_unit_id=team_id),
        ],
        active_employments=[
            SimpleNamespace(id=uuid4(), org_unit_id=section_id),
            SimpleNamespace(id=uuid4(), org_unit_id=team_id),
        ],
        current_levels=["division", "department", "section", "team"],
        proposed_levels=["division", "department", "team"],
        is_hierarchical=True,
    )

    assert impact.converted_units_count == 1
    assert impact.reparented_units_count == 1
    assert impact.affected_positions_count == 2
    assert impact.affected_employments_count == 2


@pytest.mark.asyncio
async def test_update_tenant_org_structure_rejects_regular_update_when_locked(monkeypatch):
    tenant_id = uuid4()
    anchor = SimpleNamespace(
        id=uuid4(),
        tenant_id=tenant_id,
        levels=["division", "department", "section", "team"],
        position_attachment_level="team",
        is_hierarchical=True,
        valid_from=date(2026, 5, 1),
    )

    async def fake_get_active(_db, model, requested_tenant_id, **_kwargs):
        if model is tenants_router.TenantOrgStructureConfig and requested_tenant_id == tenant_id:
            return anchor
        return None

    monkeypatch.setattr(tenants_router, "get_active", fake_get_active)

    db = _FakeSession([SimpleNamespace(tenant_id=tenant_id)])

    with pytest.raises(HTTPException) as exc_info:
        await tenants_router.update_tenant_org_structure(
            tenant_id,
            TenantOrgStructureConfigActionBody(
                action="update",
                valid_from=date(2026, 5, 8),
                levels=["division", "department", "team"],
                is_hierarchical=True,
            ),
            db=db,
            current_user=_super_admin(),
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail["code"] == "ORG_STRUCTURE_LOCKED"


@pytest.mark.asyncio
async def test_preview_override_returns_impact_summary(monkeypatch):
    tenant_id = uuid4()
    anchor = SimpleNamespace(
        id=uuid4(),
        tenant_id=tenant_id,
        levels=["division", "department", "section", "team"],
        position_attachment_level="team",
        is_hierarchical=True,
        valid_from=date(2026, 5, 1),
    )

    async def fake_get_active(_db, model, requested_tenant_id, **_kwargs):
        if model is tenants_router.TenantOrgStructureConfig and requested_tenant_id == tenant_id:
            return anchor
        return None

    async def fake_units(_db, _tenant_id, _as_of):
        division_id = uuid4()
        section_id = uuid4()
        return [
            SimpleNamespace(id=division_id, unit_type="division", parent_unit_id=None),
            SimpleNamespace(id=uuid4(), unit_type="department", parent_unit_id=division_id),
            SimpleNamespace(id=section_id, unit_type="section", parent_unit_id=uuid4()),
        ]

    async def fake_positions(_db, _tenant_id, _as_of):
        return [SimpleNamespace(id=uuid4(), org_unit_id=None)]

    async def fake_employments(_db, _tenant_id, _as_of):
        return [SimpleNamespace(id=uuid4(), org_unit_id=None)]

    monkeypatch.setattr(tenants_router, "get_active", fake_get_active)
    monkeypatch.setattr(tenants_router, "_load_org_units_as_of", fake_units)
    monkeypatch.setattr(tenants_router, "_load_positions_as_of", fake_positions)
    monkeypatch.setattr(tenants_router, "_load_employments_as_of", fake_employments)

    db = _FakeSession([SimpleNamespace(tenant_id=tenant_id)])

    result = await tenants_router.preview_tenant_org_structure_override(
        tenant_id,
        TenantOrgStructureOverridePreviewRequest(
            valid_from=date(2026, 5, 8),
            levels=["department", "section", "team"],
            is_hierarchical=True,
        ),
        db=db,
        _=_super_admin(),
    )

    assert result.current_levels == ["division", "department", "section", "team"]
    assert result.proposed_levels == ["department", "section", "team"]
    assert result.current_position_attachment_level == "team"
    assert result.proposed_position_attachment_level is None
    assert result.impact.converted_units_count >= 1


@pytest.mark.asyncio
async def test_update_tenant_org_structure_force_override_uses_apply(monkeypatch):
    tenant_id = uuid4()
    anchor = SimpleNamespace(
        id=uuid4(),
        tenant_id=tenant_id,
        levels=["division", "department", "section", "team"],
        position_attachment_level="team",
        is_hierarchical=True,
        valid_from=date(2026, 5, 1),
    )
    refreshed = SimpleNamespace(
        id=uuid4(),
        tenant_id=tenant_id,
        levels=["department", "section", "team"],
        position_attachment_level="team",
        is_hierarchical=True,
        valid_from=date(2026, 5, 8),
        valid_to=None,
        created_at=datetime(2026, 5, 8, 10, 0, 0),
        created_by=uuid4(),
        updated_at=None,
        updated_by=None,
    )

    async def fake_get_active(_db, model, requested_tenant_id, **_kwargs):
        if model is tenants_router.TenantOrgStructureConfig and requested_tenant_id == tenant_id:
            return anchor
        return None

    async def fake_apply(_db, **kwargs):
        assert kwargs["proposed_levels"] == ["department", "section", "team"]
        assert kwargs["proposed_is_hierarchical"] is True
        return refreshed, tenants_router.TenantOrgStructureOverrideImpactOut()

    async def fake_user_lookup(_db, _ids):
        return {}

    monkeypatch.setattr(tenants_router, "get_active", fake_get_active)
    monkeypatch.setattr(tenants_router, "_apply_org_structure_override", fake_apply)
    monkeypatch.setattr(tenants_router, "_load_user_lookup", fake_user_lookup)

    db = _FakeSession([SimpleNamespace(tenant_id=tenant_id)])

    result = await tenants_router.update_tenant_org_structure(
        tenant_id,
        TenantOrgStructureConfigActionBody(
            action="update",
            force_override=True,
            valid_from=date(2026, 5, 8),
            levels=["department", "section", "team"],
            is_hierarchical=True,
        ),
        db=db,
        current_user=_super_admin(),
    )

    assert result.is_locked is True
    assert result.can_force_override is True
    assert result.levels == ["department", "section", "team"]


@pytest.mark.asyncio
async def test_update_tenant_org_structure_force_override_allows_hierarchy_change(monkeypatch):
    tenant_id = uuid4()
    anchor = SimpleNamespace(
        id=uuid4(),
        tenant_id=tenant_id,
        levels=["division", "department", "section", "team"],
        position_attachment_level="team",
        is_hierarchical=True,
        valid_from=date(2026, 5, 1),
    )
    refreshed = SimpleNamespace(
        id=uuid4(),
        tenant_id=tenant_id,
        levels=["division", "department", "section", "team"],
        position_attachment_level=None,
        is_hierarchical=False,
        valid_from=date(2026, 5, 8),
        valid_to=None,
        created_at=datetime(2026, 5, 8, 10, 0, 0),
        created_by=uuid4(),
        updated_at=None,
        updated_by=None,
    )

    async def fake_get_active(_db, model, requested_tenant_id, **_kwargs):
        if model is tenants_router.TenantOrgStructureConfig and requested_tenant_id == tenant_id:
            return anchor
        return None

    async def fake_apply(_db, **kwargs):
        assert kwargs["proposed_levels"] == ["division", "department", "section", "team"]
        assert kwargs["proposed_position_attachment_level"] is None
        assert kwargs["proposed_is_hierarchical"] is False
        return refreshed, tenants_router.TenantOrgStructureOverrideImpactOut()

    async def fake_user_lookup(_db, _ids):
        return {}

    monkeypatch.setattr(tenants_router, "get_active", fake_get_active)
    monkeypatch.setattr(tenants_router, "_apply_org_structure_override", fake_apply)
    monkeypatch.setattr(tenants_router, "_load_user_lookup", fake_user_lookup)

    db = _FakeSession([SimpleNamespace(tenant_id=tenant_id)])

    result = await tenants_router.update_tenant_org_structure(
        tenant_id,
        TenantOrgStructureConfigActionBody(
            action="update",
            force_override=True,
            valid_from=date(2026, 5, 8),
            levels=["division", "department", "section", "team"],
            position_attachment_level=None,
            is_hierarchical=False,
        ),
        db=db,
        current_user=_super_admin(),
    )

    assert result.is_hierarchical is False
    assert result.position_attachment_level is None
