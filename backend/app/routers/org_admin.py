"""Org Admin router — reference table management scoped to a single tenant."""
import uuid
from datetime import date, datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.database import get_db
from app.middleware.auth import get_enforced_tenant_id, require_org_or_system_admin, CurrentUser
from app.models.core import OrgUnit, Position, CourseCatalog
from app.models.tenant import Tenant, TenantIdentity

router = APIRouter(prefix="/api/org", tags=["org-admin"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _fmtd(d: date | None) -> str | None:
    return d.isoformat() if d else None


def _auto_code(prefix: str, existing_count: int) -> str:
    return f"{prefix}{existing_count + 1:04d}"


def _is_active(row: OrgUnit | Position | CourseCatalog) -> bool:
    today = date.today()
    return row.valid_from <= today and (row.valid_to is None or row.valid_to >= today)


# ── Schemas ────────────────────────────────────────────────────────────────────

class OrgUnitCreate(BaseModel):
    unit_type: str
    name: str
    description: Optional[str] = None
    parent_unit_id: Optional[uuid.UUID] = None
    manager_employee_id: Optional[uuid.UUID] = None
    valid_from: date


class OrgUnitUpdate(BaseModel):
    action: str  # update | add | set | close | delete
    name: Optional[str] = None
    description: Optional[str] = None
    parent_unit_id: Optional[uuid.UUID] = None
    manager_employee_id: Optional[uuid.UUID] = None
    clear_manager_employee_id: bool = False
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None


class PositionCreate(BaseModel):
    title: str
    description: Optional[str] = None
    org_unit_id: Optional[uuid.UUID] = None
    employment_type_default: Optional[str] = None
    valid_from: date


class PositionUpdate(BaseModel):
    action: str  # update | add | set | close | delete
    title: Optional[str] = None
    description: Optional[str] = None
    org_unit_id: Optional[uuid.UUID] = None
    employment_type_default: Optional[str] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None


class CourseCreate(BaseModel):
    code: str
    name: str
    name_en: Optional[str] = None
    category: Optional[str] = None
    duration_hours: Optional[int] = None
    is_mandatory: bool = False
    valid_from: date
    valid_to: Optional[date] = None


class CourseUpdate(BaseModel):
    name: Optional[str] = None
    name_en: Optional[str] = None
    category: Optional[str] = None
    duration_hours: Optional[int] = None
    is_mandatory: Optional[bool] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None


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
    from app.models.core import EmployeeIdentity
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

    count_result = await db.execute(
        select(OrgUnit).where(OrgUnit.tenant_id == t_id).where(OrgUnit.unit_type == body.unit_type)
    )
    code = _auto_code(body.unit_type[:3].upper(), len(list(count_result.scalars().all())))

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
        unit.valid_to = body.valid_to or today
        unit.updated_by = user.id
        unit.updated_at = now
    elif body.action in ("update", "add", "set"):
        if body.name is not None:
            unit.name = body.name
        if body.description is not None:
            unit.description = body.description
        if body.parent_unit_id is not None:
            unit.parent_unit_id = body.parent_unit_id
        if body.clear_manager_employee_id:
            unit.manager_employee_id = None
        elif body.manager_employee_id is not None:
            unit.manager_employee_id = body.manager_employee_id
        if body.valid_from is not None:
            unit.valid_from = body.valid_from
        if body.valid_to is not None:
            unit.valid_to = body.valid_to
        unit.updated_by = user.id
        unit.updated_at = now
    else:
        raise HTTPException(status_code=400, detail={"error": "Invalid action", "code": "BAD_REQUEST"})

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

    count_result = await db.execute(select(Position).where(Position.tenant_id == t_id))
    code = _auto_code("POS", len(list(count_result.scalars().all())))

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
        position.valid_to = body.valid_to or today
        position.updated_by = user.id
        position.updated_at = now
    elif body.action in ("update", "add", "set"):
        if body.title is not None:
            position.title = body.title
        if body.description is not None:
            position.description = body.description
        if body.org_unit_id is not None:
            position.org_unit_id = body.org_unit_id
        if body.employment_type_default is not None:
            position.employment_type_default = body.employment_type_default
        if body.valid_from is not None:
            position.valid_from = body.valid_from
        if body.valid_to is not None:
            position.valid_to = body.valid_to
        position.updated_by = user.id
        position.updated_at = now
    else:
        raise HTTPException(status_code=400, detail={"error": "Invalid action", "code": "BAD_REQUEST"})

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
    from app.models.tenant import TenantOrgStructureConfig
    t_id = get_enforced_tenant_id(tenant_id, user)
    result = await db.execute(
        select(TenantOrgStructureConfig)
        .where(TenantOrgStructureConfig.tenant_id == t_id)
        .where(TenantOrgStructureConfig.valid_to.is_(None))
        .limit(1)
    )
    cfg = result.scalar_one_or_none()
    if not cfg:
        return {"levels": ["division", "department", "section", "team"], "position_attachment_level": None, "is_hierarchical": True}
    return {
        "levels": cfg.enabled_levels or ["division", "department", "section", "team"],
        "position_attachment_level": cfg.position_attachment_level,
        "is_hierarchical": cfg.is_hierarchical if hasattr(cfg, "is_hierarchical") else True,
    }


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
