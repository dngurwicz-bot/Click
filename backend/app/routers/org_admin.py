"""Org Admin router — reference table management scoped to a single tenant."""
import uuid
from datetime import date, datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator, model_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.middleware.auth import get_enforced_tenant_id, require_org_or_system_admin, CurrentUser
from app.models.core import OrgUnit, Position, CourseCatalog, Employee, EmployeeIdentity
from app.models.tenant import Tenant, TenantIdentity, TenantOrgStructureConfig
from app.services.core import next_three_digit_code
from app.services.temporal import kabiya
from app.services.tenant_org_structure import (
    DEFAULT_ORG_STRUCTURE_LEVELS,
    get_expected_parent_level,
    resolve_optional_position_attachment_level,
    sanitize_org_structure_levels,
)

router = APIRouter(prefix="/api/org", tags=["org-admin"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _fmtd(d: date | None) -> str | None:
    return d.isoformat() if d else None


def _is_active(row: OrgUnit | Position | CourseCatalog) -> bool:
    today = date.today()
    return row.valid_from <= today and (row.valid_to is None or row.valid_to >= today)


def _bad_request(message: str, code: str, *, status_code: int = 422) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"error": message, "code": code})


def _validate_temporal_window(valid_from: date, valid_to: date | None, *, code: str = "INVALID_DATE_RANGE") -> None:
    if valid_to is not None and valid_to < valid_from:
        raise _bad_request("valid_to cannot be earlier than valid_from", code)


def _normalize_required_text(value: str, *, field_name: str, code: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError(f"{field_name} is required")
    return cleaned


# ── Schemas ────────────────────────────────────────────────────────────────────

class OrgUnitCreate(BaseModel):
    unit_type: str
    name: str
    description: Optional[str] = None
    parent_unit_id: Optional[uuid.UUID] = None
    manager_employee_id: Optional[uuid.UUID] = None
    valid_from: date

    @field_validator("unit_type")
    @classmethod
    def _normalize_unit_type(cls, value: str) -> str:
        return _normalize_required_text(value, field_name="unit_type", code="MISSING_UNIT_TYPE").lower()

    @field_validator("name")
    @classmethod
    def _normalize_name(cls, value: str) -> str:
        return _normalize_required_text(value, field_name="name", code="MISSING_NAME")


class OrgUnitUpdate(BaseModel):
    action: str  # update | add | set | close | delete
    name: Optional[str] = None
    description: Optional[str] = None
    parent_unit_id: Optional[uuid.UUID] = None
    manager_employee_id: Optional[uuid.UUID] = None
    clear_manager_employee_id: bool = False
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None

    @field_validator("action")
    @classmethod
    def _normalize_action(cls, value: str) -> str:
        cleaned = value.strip().lower()
        allowed = {"update", "add", "set", "close", "delete"}
        if cleaned not in allowed:
            raise ValueError("Invalid action")
        return cleaned

    @field_validator("name")
    @classmethod
    def _normalize_optional_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return _normalize_required_text(value, field_name="name", code="MISSING_NAME")

    @model_validator(mode="after")
    def _validate_dates(self) -> "OrgUnitUpdate":
        if self.valid_from and self.valid_to:
            _validate_temporal_window(self.valid_from, self.valid_to)
        return self


class PositionCreate(BaseModel):
    title: str
    description: Optional[str] = None
    org_unit_id: Optional[uuid.UUID] = None
    employment_type_default: Optional[str] = None
    valid_from: date

    @field_validator("title")
    @classmethod
    def _normalize_title(cls, value: str) -> str:
        return _normalize_required_text(value, field_name="title", code="MISSING_TITLE")


class PositionUpdate(BaseModel):
    action: str  # update | add | set | close | delete
    title: Optional[str] = None
    description: Optional[str] = None
    org_unit_id: Optional[uuid.UUID] = None
    employment_type_default: Optional[str] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None

    @field_validator("action")
    @classmethod
    def _normalize_action(cls, value: str) -> str:
        cleaned = value.strip().lower()
        allowed = {"update", "add", "set", "close", "delete"}
        if cleaned not in allowed:
            raise ValueError("Invalid action")
        return cleaned

    @field_validator("title")
    @classmethod
    def _normalize_optional_title(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return _normalize_required_text(value, field_name="title", code="MISSING_TITLE")

    @model_validator(mode="after")
    def _validate_dates(self) -> "PositionUpdate":
        if self.valid_from and self.valid_to:
            _validate_temporal_window(self.valid_from, self.valid_to)
        return self


class CourseCreate(BaseModel):
    code: str
    name: str
    name_en: Optional[str] = None
    category: Optional[str] = None
    duration_hours: Optional[int] = None
    is_mandatory: bool = False
    valid_from: date
    valid_to: Optional[date] = None

    @field_validator("code", "name")
    @classmethod
    def _normalize_required_fields(cls, value: str, info) -> str:
        return _normalize_required_text(value, field_name=info.field_name, code=f"MISSING_{info.field_name.upper()}")

    @field_validator("duration_hours")
    @classmethod
    def _validate_duration_hours(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and value < 0:
            raise ValueError("duration_hours must be non-negative")
        return value

    @model_validator(mode="after")
    def _validate_dates(self) -> "CourseCreate":
        _validate_temporal_window(self.valid_from, self.valid_to)
        return self


class CourseUpdate(BaseModel):
    name: Optional[str] = None
    name_en: Optional[str] = None
    category: Optional[str] = None
    duration_hours: Optional[int] = None
    is_mandatory: Optional[bool] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None

    @field_validator("name")
    @classmethod
    def _normalize_optional_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return _normalize_required_text(value, field_name="name", code="MISSING_NAME")

    @field_validator("duration_hours")
    @classmethod
    def _validate_duration_hours(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and value < 0:
            raise ValueError("duration_hours must be non-negative")
        return value

    @model_validator(mode="after")
    def _validate_dates(self) -> "CourseUpdate":
        if self.valid_from:
            _validate_temporal_window(self.valid_from, self.valid_to)
        return self


# ── Me endpoint ────────────────────────────────────────────────────────────────

@router.get("/me")
async def org_me(
    tenant_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_org_or_system_admin()),
):
    t_id = get_enforced_tenant_id(tenant_id, user)
    result = await db.execute(select(Tenant).where(Tenant.tenant_id == t_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail={"error": "Tenant not found", "code": "NOT_FOUND"})

    ident_result = await db.execute(
        select(TenantIdentity)
        .where(TenantIdentity.tenant_id == t_id)
        .where(TenantIdentity.valid_to.is_(None))
        .limit(1)
    )
    ident = ident_result.scalar_one_or_none()

    return {
        "tenant_id": str(t_id),
        "name_he": ident.name_he if ident else None,
        "name_en": ident.name_en if ident else None,
        "org_number": tenant.org_number,
    }


# ── Employees (minimal — for manager selection) ────────────────────────────────

@router.get("/employees")
async def list_employees_for_manager_selection(
    tenant_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_org_or_system_admin()),
):
    t_id = get_enforced_tenant_id(tenant_id, user)
    result = await db.execute(
        select(Employee, EmployeeIdentity)
        .outerjoin(
            EmployeeIdentity,
            (EmployeeIdentity.employee_id == Employee.id) & EmployeeIdentity.valid_to.is_(None),
        )
        .where(Employee.tenant_id == t_id)
        .order_by(Employee.employee_number)
    )
    return [
        {
            "id": str(emp.id),
            "employee_number": emp.employee_number,
            "full_name": f"{ident.first_name} {ident.last_name}" if ident else "—",
        }
        for emp, ident in result.all()
    ]


# ── Org Units ─────────────────────────────────────────────────────────────────

async def _resolve_org_unit_names(
    db: AsyncSession, tenant_id: uuid.UUID, rows: list[OrgUnit]
) -> dict[uuid.UUID, str]:
    """Resolve parent unit names for a list of org units."""
    parent_ids = {r.parent_unit_id for r in rows if r.parent_unit_id}
    if not parent_ids:
        return {}
    result = await db.execute(
        select(OrgUnit.id, OrgUnit.name, OrgUnit.code)
        .where(OrgUnit.id.in_(parent_ids))
        .where(OrgUnit.tenant_id == tenant_id)
    )
    return {row.id: f"{row.code} - {row.name}" for row in result}


async def _resolve_employee_names(
    db: AsyncSession, tenant_id: uuid.UUID, employee_ids: set[uuid.UUID]
) -> dict[uuid.UUID, str]:
    if not employee_ids:
        return {}
    result = await db.execute(
        select(EmployeeIdentity.employee_id, EmployeeIdentity.first_name, EmployeeIdentity.last_name)
        .where(EmployeeIdentity.employee_id.in_(employee_ids))
        .where(EmployeeIdentity.tenant_id == tenant_id)
        .where(EmployeeIdentity.valid_to.is_(None))
    )
    return {row.employee_id: f"{row.first_name} {row.last_name}" for row in result}


def _ser_org_unit(
    row: OrgUnit,
    parent_names: dict,
    manager_names: dict,
) -> dict:
    return {
        "id": str(row.id),
        "code": row.code,
        "unit_type": row.unit_type,
        "name": row.name,
        "description": row.description,
        "parent_unit_id": str(row.parent_unit_id) if row.parent_unit_id else None,
        "parent_unit_name": parent_names.get(row.parent_unit_id) if row.parent_unit_id else None,
        "manager_employee_id": str(row.manager_employee_id) if row.manager_employee_id else None,
        "manager_name": manager_names.get(row.manager_employee_id) if row.manager_employee_id else None,
        "valid_from": _fmtd(row.valid_from),
        "valid_to": _fmtd(row.valid_to),
        "is_active": _is_active(row),
    }


async def _load_org_structure(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    as_of: date | None = None,
) -> dict[str, object]:
    effective_on = as_of or date.today()
    result = await db.execute(
        select(TenantOrgStructureConfig)
        .where(TenantOrgStructureConfig.tenant_id == tenant_id)
        .where(TenantOrgStructureConfig.valid_from <= effective_on)
        .where((TenantOrgStructureConfig.valid_to.is_(None)) | (TenantOrgStructureConfig.valid_to >= effective_on))
        .order_by(TenantOrgStructureConfig.valid_from.desc())
        .limit(1)
    )
    cfg = result.scalar_one_or_none()
    if cfg is None:
        levels = DEFAULT_ORG_STRUCTURE_LEVELS.copy()
        return {
            "levels": levels,
            "position_attachment_level": levels[-1],
            "is_hierarchical": True,
        }

    levels = sanitize_org_structure_levels(list(getattr(cfg, "levels", []) or DEFAULT_ORG_STRUCTURE_LEVELS))
    try:
        position_attachment_level = resolve_optional_position_attachment_level(
            levels,
            getattr(cfg, "position_attachment_level", None),
        )
    except ValueError as exc:
        raise _bad_request(str(exc), "INVALID_ORG_STRUCTURE_CONFIG") from exc

    return {
        "levels": levels,
        "position_attachment_level": position_attachment_level,
        "is_hierarchical": bool(getattr(cfg, "is_hierarchical", True)),
    }


async def _get_org_unit_row(db: AsyncSession, tenant_id: uuid.UUID, unit_id: uuid.UUID) -> OrgUnit | None:
    result = await db.execute(
        select(OrgUnit).where(OrgUnit.id == unit_id).where(OrgUnit.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


async def _employee_exists_for_tenant(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    employee_id: uuid.UUID,
) -> bool:
    result = await db.execute(
        select(EmployeeIdentity.employee_id)
        .where(EmployeeIdentity.employee_id == employee_id)
        .where(EmployeeIdentity.tenant_id == tenant_id)
        .where(EmployeeIdentity.valid_to.is_(None))
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def _ensure_manager_employee(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    manager_employee_id: uuid.UUID | None,
) -> None:
    if manager_employee_id is None:
        return
    if not await _employee_exists_for_tenant(db, tenant_id, manager_employee_id):
        raise _bad_request("Manager employee not found for tenant", "ORG_UNIT_MANAGER_NOT_FOUND")


async def _validate_org_unit_parent(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    unit_type: str,
    parent_unit_id: uuid.UUID | None,
    structure: dict[str, object],
    current_unit_id: uuid.UUID | None = None,
) -> None:
    levels = list(structure["levels"])
    is_hierarchical = bool(structure["is_hierarchical"])

    try:
        expected_parent_type = get_expected_parent_level(levels, unit_type, is_hierarchical=is_hierarchical)
    except ValueError as exc:
        raise _bad_request(str(exc), "INVALID_ORG_UNIT_TYPE") from exc

    if current_unit_id is not None and parent_unit_id == current_unit_id:
        raise _bad_request("Org unit cannot be its own parent", "INVALID_PARENT_UNIT_TYPE")

    if expected_parent_type is None:
        if parent_unit_id is not None:
            raise _bad_request("Selected org unit type cannot have a parent", "INVALID_PARENT_UNIT_TYPE")
        return

    if parent_unit_id is None:
        raise _bad_request("Parent org unit is required for this unit type", "PARENT_UNIT_REQUIRED")

    parent = await _get_org_unit_row(db, tenant_id, parent_unit_id)
    if parent is None:
        raise _bad_request("Parent org unit not found", "PARENT_UNIT_NOT_FOUND")
    if parent.unit_type != expected_parent_type:
        raise _bad_request("Parent org unit type is invalid for this unit type", "INVALID_PARENT_UNIT_TYPE")

    if current_unit_id is not None:
        cursor = parent.parent_unit_id
        while cursor is not None:
            if cursor == current_unit_id:
                raise _bad_request("Org unit parent relationship creates a cycle", "INVALID_PARENT_UNIT_TYPE")
            ancestor = await _get_org_unit_row(db, tenant_id, cursor)
            if ancestor is None:
                break
            cursor = ancestor.parent_unit_id


async def _validate_position_org_unit(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    org_unit_id: uuid.UUID | None,
    structure: dict[str, object],
) -> None:
    levels = list(structure["levels"])
    attachment_level = structure["position_attachment_level"]

    if attachment_level is None:
        if org_unit_id is not None:
            raise _bad_request("Position attachment is disabled for this tenant", "POSITION_ATTACHMENT_DISABLED")
        return

    if org_unit_id is None:
        raise _bad_request("Org unit is required for positions", "ORG_UNIT_REQUIRED")

    org_unit = await _get_org_unit_row(db, tenant_id, org_unit_id)
    if org_unit is None:
        raise _bad_request("Org unit not found", "ORG_UNIT_NOT_FOUND")
    if org_unit.unit_type not in levels or org_unit.unit_type != attachment_level:
        raise _bad_request("Position must attach to an org unit at the configured level", "POSITION_ORG_UNIT_TYPE_MISMATCH")


async def _next_org_unit_code_for_type(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    unit_type: str,
) -> str:
    result = await db.execute(
        select(OrgUnit.code).where(OrgUnit.tenant_id == tenant_id).where(OrgUnit.unit_type == unit_type)
    )
    return next_three_digit_code(list(result.scalars().all()))


async def _next_position_code(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    result = await db.execute(select(Position.code).where(Position.tenant_id == tenant_id))
    return next_three_digit_code(list(result.scalars().all()))


def _org_unit_payload_from_body(body: OrgUnitUpdate, anchor: OrgUnit) -> dict[str, object]:
    return {
        "name": body.name if body.name is not None else anchor.name,
        "description": body.description if body.description is not None else anchor.description,
        "parent_unit_id": body.parent_unit_id if body.parent_unit_id is not None else anchor.parent_unit_id,
        "manager_employee_id": (
            None
            if body.clear_manager_employee_id
            else body.manager_employee_id if body.manager_employee_id is not None else anchor.manager_employee_id
        ),
        "valid_from": body.valid_from or anchor.valid_from,
        "valid_to": body.valid_to if body.valid_to is not None else anchor.valid_to,
    }


def _position_payload_from_body(body: PositionUpdate, anchor: Position) -> dict[str, object]:
    return {
        "title": body.title if body.title is not None else anchor.title,
        "description": body.description if body.description is not None else anchor.description,
        "org_unit_id": body.org_unit_id if body.org_unit_id is not None else anchor.org_unit_id,
        "employment_type_default": (
            body.employment_type_default
            if body.employment_type_default is not None
            else anchor.employment_type_default
        ),
        "valid_from": body.valid_from or anchor.valid_from,
        "valid_to": body.valid_to if body.valid_to is not None else anchor.valid_to,
    }


@router.get("/org-units")
async def list_org_units(
    tenant_id: Optional[uuid.UUID] = None,
    unit_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_org_or_system_admin()),
):
    t_id = get_enforced_tenant_id(tenant_id, user)
    stmt = select(OrgUnit).where(OrgUnit.tenant_id == t_id).order_by(OrgUnit.name)
    if unit_type:
        stmt = stmt.where(OrgUnit.unit_type == unit_type)
    result = await db.execute(stmt)
    rows = list(result.scalars().all())

    parent_names = await _resolve_org_unit_names(db, t_id, rows)
    manager_ids = {r.manager_employee_id for r in rows if r.manager_employee_id}
    manager_names = await _resolve_employee_names(db, t_id, manager_ids)

    return [_ser_org_unit(r, parent_names, manager_names) for r in rows]


@router.post("/org-units", status_code=status.HTTP_201_CREATED)
async def create_org_unit(
    body: OrgUnitCreate,
    tenant_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_org_or_system_admin()),
):
    t_id = get_enforced_tenant_id(tenant_id, user)
    structure = await _load_org_structure(db, t_id, as_of=body.valid_from)
    await _validate_org_unit_parent(
        db,
        t_id,
        unit_type=body.unit_type,
        parent_unit_id=body.parent_unit_id,
        structure=structure,
    )
    await _ensure_manager_employee(db, t_id, body.manager_employee_id)
    code = await _next_org_unit_code_for_type(db, t_id, body.unit_type)

    unit = OrgUnit(
        id=uuid.uuid4(),
        tenant_id=t_id,
        code=code,
        name=body.name,
        unit_type=body.unit_type,
        description=body.description,
        parent_unit_id=body.parent_unit_id,
        manager_employee_id=body.manager_employee_id,
        valid_from=body.valid_from,
        valid_to=None,
        created_by=user.id,
    )
    db.add(unit)
    await db.commit()
    await db.refresh(unit)
    return {"id": str(unit.id), "code": unit.code}


@router.put("/org-units/{unit_id}/record")
async def update_org_unit_record(
    unit_id: uuid.UUID,
    body: OrgUnitUpdate,
    tenant_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_org_or_system_admin()),
):
    t_id = get_enforced_tenant_id(tenant_id, user)
    result = await db.execute(
        select(OrgUnit).where(OrgUnit.id == unit_id).where(OrgUnit.tenant_id == t_id)
    )
    unit = result.scalar_one_or_none()
    if not unit:
        raise HTTPException(status_code=404, detail={"error": "Org unit not found", "code": "NOT_FOUND"})

    now = datetime.now(timezone.utc)
    today = date.today()
    if body.action == "delete":
        await db.delete(unit)
    elif body.action == "close":
        close_date = body.valid_to or today
        if close_date < unit.valid_from:
            raise _bad_request("valid_to cannot be earlier than valid_from", "INVALID_DATE_RANGE")
        unit.valid_to = close_date
        unit.updated_by = user.id
        unit.updated_at = now
    elif body.action == "update":
        payload = _org_unit_payload_from_body(body, unit)
        _validate_temporal_window(payload["valid_from"], payload["valid_to"])
        structure = await _load_org_structure(db, t_id, as_of=payload["valid_from"])
        await _validate_org_unit_parent(
            db,
            t_id,
            unit_type=unit.unit_type,
            parent_unit_id=payload["parent_unit_id"],
            structure=structure,
            current_unit_id=unit.id,
        )
        await _ensure_manager_employee(db, t_id, payload["manager_employee_id"])
        unit.name = payload["name"]
        unit.description = payload["description"]
        unit.parent_unit_id = payload["parent_unit_id"]
        unit.manager_employee_id = payload["manager_employee_id"]
        unit.valid_from = payload["valid_from"]
        unit.valid_to = payload["valid_to"]
        unit.updated_by = user.id
        unit.updated_at = now
    elif body.action == "add":
        payload = _org_unit_payload_from_body(body, unit)
        if body.valid_from is None:
            raise _bad_request("Add action requires valid_from", "MISSING_DATE")
        _validate_temporal_window(payload["valid_from"], payload["valid_to"])
        structure = await _load_org_structure(db, t_id, as_of=payload["valid_from"])
        await _validate_org_unit_parent(
            db,
            t_id,
            unit_type=unit.unit_type,
            parent_unit_id=payload["parent_unit_id"],
            structure=structure,
        )
        await _ensure_manager_employee(db, t_id, payload["manager_employee_id"])
        db.add(
            OrgUnit(
                id=uuid.uuid4(),
                tenant_id=t_id,
                code=unit.code,
                unit_type=unit.unit_type,
                name=payload["name"],
                description=payload["description"],
                parent_unit_id=payload["parent_unit_id"],
                manager_employee_id=payload["manager_employee_id"],
                valid_from=payload["valid_from"],
                valid_to=payload["valid_to"],
                created_by=user.id,
            )
        )
    elif body.action == "set":
        payload = _org_unit_payload_from_body(body, unit)
        if body.valid_from is None:
            raise _bad_request("Set action requires valid_from", "MISSING_DATE")
        _validate_temporal_window(payload["valid_from"], payload["valid_to"])
        structure = await _load_org_structure(db, t_id, as_of=payload["valid_from"])
        await _validate_org_unit_parent(
            db,
            t_id,
            unit_type=unit.unit_type,
            parent_unit_id=payload["parent_unit_id"],
            structure=structure,
        )
        await _ensure_manager_employee(db, t_id, payload["manager_employee_id"])
        await kabiya(
            db,
            OrgUnit,
            t_id,
            {
                "code": unit.code,
                "unit_type": unit.unit_type,
                "name": payload["name"],
                "description": payload["description"],
                "parent_unit_id": payload["parent_unit_id"],
                "manager_employee_id": payload["manager_employee_id"],
            },
            user.id,
            new_valid_from=payload["valid_from"],
            new_valid_to=payload["valid_to"],
            extra_filters={"code": unit.code},
        )

    await db.commit()
    return {"ok": True}


# ── Positions ─────────────────────────────────────────────────────────────────

async def _resolve_position_org_names(
    db: AsyncSession, tenant_id: uuid.UUID, rows: list[Position]
) -> dict[uuid.UUID, str]:
    org_ids = {r.org_unit_id for r in rows if r.org_unit_id}
    if not org_ids:
        return {}
    result = await db.execute(
        select(OrgUnit.id, OrgUnit.name, OrgUnit.code)
        .where(OrgUnit.id.in_(org_ids))
        .where(OrgUnit.tenant_id == tenant_id)
    )
    return {row.id: f"{row.code} - {row.name}" for row in result}


def _ser_position(row: Position, org_names: dict) -> dict:
    return {
        "id": str(row.id),
        "code": row.code,
        "title": row.title,
        "description": row.description,
        "org_unit_id": str(row.org_unit_id) if row.org_unit_id else None,
        "org_unit_name": org_names.get(row.org_unit_id) if row.org_unit_id else None,
        "employment_type_default": row.employment_type_default,
        "valid_from": _fmtd(row.valid_from),
        "valid_to": _fmtd(row.valid_to),
        "is_active": _is_active(row),
    }


@router.get("/positions")
async def list_positions(
    tenant_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_org_or_system_admin()),
):
    t_id = get_enforced_tenant_id(tenant_id, user)
    result = await db.execute(
        select(Position).where(Position.tenant_id == t_id).order_by(Position.title)
    )
    rows = list(result.scalars().all())
    org_names = await _resolve_position_org_names(db, t_id, rows)
    return [_ser_position(r, org_names) for r in rows]


@router.post("/positions", status_code=status.HTTP_201_CREATED)
async def create_position(
    body: PositionCreate,
    tenant_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_org_or_system_admin()),
):
    t_id = get_enforced_tenant_id(tenant_id, user)
    structure = await _load_org_structure(db, t_id, as_of=body.valid_from)
    await _validate_position_org_unit(
        db,
        t_id,
        org_unit_id=body.org_unit_id,
        structure=structure,
    )
    code = await _next_position_code(db, t_id)

    position = Position(
        id=uuid.uuid4(),
        tenant_id=t_id,
        code=code,
        title=body.title,
        description=body.description,
        org_unit_id=body.org_unit_id,
        employment_type_default=body.employment_type_default,
        valid_from=body.valid_from,
        valid_to=None,
        created_by=user.id,
    )
    db.add(position)
    await db.commit()
    await db.refresh(position)
    return {"id": str(position.id), "code": position.code}


@router.put("/positions/{position_id}/record")
async def update_position_record(
    position_id: uuid.UUID,
    body: PositionUpdate,
    tenant_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_org_or_system_admin()),
):
    t_id = get_enforced_tenant_id(tenant_id, user)
    result = await db.execute(
        select(Position).where(Position.id == position_id).where(Position.tenant_id == t_id)
    )
    position = result.scalar_one_or_none()
    if not position:
        raise HTTPException(status_code=404, detail={"error": "Position not found", "code": "NOT_FOUND"})

    now = datetime.now(timezone.utc)
    today = date.today()
    if body.action == "delete":
        await db.delete(position)
    elif body.action == "close":
        close_date = body.valid_to or today
        if close_date < position.valid_from:
            raise _bad_request("valid_to cannot be earlier than valid_from", "INVALID_DATE_RANGE")
        position.valid_to = close_date
        position.updated_by = user.id
        position.updated_at = now
    elif body.action == "update":
        payload = _position_payload_from_body(body, position)
        _validate_temporal_window(payload["valid_from"], payload["valid_to"])
        structure = await _load_org_structure(db, t_id, as_of=payload["valid_from"])
        await _validate_position_org_unit(
            db,
            t_id,
            org_unit_id=payload["org_unit_id"],
            structure=structure,
        )
        position.title = payload["title"]
        position.description = payload["description"]
        position.org_unit_id = payload["org_unit_id"]
        position.employment_type_default = payload["employment_type_default"]
        position.valid_from = payload["valid_from"]
        position.valid_to = payload["valid_to"]
        position.updated_by = user.id
        position.updated_at = now
    elif body.action == "add":
        payload = _position_payload_from_body(body, position)
        if body.valid_from is None:
            raise _bad_request("Add action requires valid_from", "MISSING_DATE")
        _validate_temporal_window(payload["valid_from"], payload["valid_to"])
        structure = await _load_org_structure(db, t_id, as_of=payload["valid_from"])
        await _validate_position_org_unit(
            db,
            t_id,
            org_unit_id=payload["org_unit_id"],
            structure=structure,
        )
        db.add(
            Position(
                id=uuid.uuid4(),
                tenant_id=t_id,
                code=position.code,
                title=payload["title"],
                description=payload["description"],
                org_unit_id=payload["org_unit_id"],
                employment_type_default=payload["employment_type_default"],
                valid_from=payload["valid_from"],
                valid_to=payload["valid_to"],
                created_by=user.id,
            )
        )
    elif body.action == "set":
        payload = _position_payload_from_body(body, position)
        if body.valid_from is None:
            raise _bad_request("Set action requires valid_from", "MISSING_DATE")
        _validate_temporal_window(payload["valid_from"], payload["valid_to"])
        structure = await _load_org_structure(db, t_id, as_of=payload["valid_from"])
        await _validate_position_org_unit(
            db,
            t_id,
            org_unit_id=payload["org_unit_id"],
            structure=structure,
        )
        await kabiya(
            db,
            Position,
            t_id,
            {
                "code": position.code,
                "title": payload["title"],
                "description": payload["description"],
                "org_unit_id": payload["org_unit_id"],
                "employment_type_default": payload["employment_type_default"],
            },
            user.id,
            new_valid_from=payload["valid_from"],
            new_valid_to=payload["valid_to"],
            extra_filters={"code": position.code},
        )

    await db.commit()
    return {"ok": True}


# ── Org Structure Config ───────────────────────────────────────────────────────

@router.get("/org-structure")
async def get_org_structure(
    tenant_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_org_or_system_admin()),
):
    """Return tenant org structure config — mirrors /api/admin/tenants/{id}/org-structure."""
    t_id = get_enforced_tenant_id(tenant_id, user)
    return await _load_org_structure(db, t_id)


# ── Course Catalog ────────────────────────────────────────────────────────────

def _ser_course(row: CourseCatalog) -> dict:
    return {
        "id": str(row.id),
        "code": row.code,
        "name": row.name,
        "name_en": row.name_en,
        "category": row.category,
        "duration_hours": row.duration_hours,
        "is_mandatory": row.is_mandatory,
        "valid_from": _fmtd(row.valid_from),
        "valid_to": _fmtd(row.valid_to),
        "is_active": _is_active(row),
    }


@router.get("/courses")
async def list_courses(
    tenant_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_org_or_system_admin()),
):
    t_id = get_enforced_tenant_id(tenant_id, user)
    result = await db.execute(
        select(CourseCatalog).where(CourseCatalog.tenant_id == t_id).order_by(CourseCatalog.name)
    )
    return [_ser_course(r) for r in result.scalars()]


@router.post("/courses", status_code=status.HTTP_201_CREATED)
async def create_course(
    body: CourseCreate,
    tenant_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_org_or_system_admin()),
):
    t_id = get_enforced_tenant_id(tenant_id, user)

    existing = await db.execute(
        select(CourseCatalog)
        .where(CourseCatalog.tenant_id == t_id)
        .where(CourseCatalog.code == body.code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "Course code already exists", "code": "DUPLICATE_CODE"},
        )

    course = CourseCatalog(
        id=uuid.uuid4(),
        tenant_id=t_id,
        code=body.code,
        name=body.name,
        name_en=body.name_en,
        category=body.category,
        duration_hours=body.duration_hours,
        is_mandatory=body.is_mandatory,
        valid_from=body.valid_from,
        valid_to=body.valid_to,
        created_by=user.id,
    )
    db.add(course)
    await db.commit()
    await db.refresh(course)
    return {"id": str(course.id)}


@router.put("/courses/{course_id}")
async def update_course(
    course_id: uuid.UUID,
    body: CourseUpdate,
    tenant_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_org_or_system_admin()),
):
    t_id = get_enforced_tenant_id(tenant_id, user)
    result = await db.execute(
        select(CourseCatalog).where(CourseCatalog.id == course_id).where(CourseCatalog.tenant_id == t_id)
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail={"error": "Course not found", "code": "NOT_FOUND"})

    next_valid_from = body.valid_from or course.valid_from
    next_valid_to = body.valid_to if body.valid_to is not None else course.valid_to
    _validate_temporal_window(next_valid_from, next_valid_to)

    if body.name is not None:
        course.name = body.name
    if body.name_en is not None:
        course.name_en = body.name_en
    if body.category is not None:
        course.category = body.category
    if body.duration_hours is not None:
        course.duration_hours = body.duration_hours
    if body.is_mandatory is not None:
        course.is_mandatory = body.is_mandatory
    if body.valid_from is not None:
        course.valid_from = body.valid_from
    if body.valid_to is not None:
        course.valid_to = body.valid_to
    course.updated_by = user.id
    course.updated_at = datetime.now(timezone.utc)

    await db.commit()
    return {"ok": True}


@router.delete("/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def close_course(
    course_id: uuid.UUID,
    tenant_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_org_or_system_admin()),
):
    t_id = get_enforced_tenant_id(tenant_id, user)
    result = await db.execute(
        select(CourseCatalog).where(CourseCatalog.id == course_id).where(CourseCatalog.tenant_id == t_id)
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail={"error": "Course not found", "code": "NOT_FOUND"})

    course.valid_to = date.today()
    course.updated_by = user.id
    course.updated_at = datetime.now(timezone.utc)
    await db.commit()
