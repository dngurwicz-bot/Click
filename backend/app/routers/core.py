"""Core module — employee management endpoints."""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal, Optional
import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator, model_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, cast, Integer, text, delete

from app.database import get_db
from app.middleware.auth import require_permission, CurrentUser
from app.models.core import (
    Employee, EmployeeIdentity, EmployeePersonal, EmployeeContact,
    EmployeeEmployment, EmployeeCompensation, EmployeeBankAccount,
    EmploymentEvent, EmployeeTraining, EmployeeDocumentIndex,
    EmployeeChild, EmployeeAward, EmployeeCertification,
    EmployeeCourse, EmployeeSkill, EmployeeWorkBreak,
    OrgUnit, Position,
)
from app.models.tenant import Tenant
from app.schemas.core import (
    DepartmentMovementOut,
    EmployeeBankAccountCreate,
    EmployeeCreate,
    EmployeeEmploymentOut,
    EmployeeIdentityActionBody,
    EmploymentEventIn,
    OrgUnitActionBody,
    OrgUnitCreate,
    PositionCreate,
    PositionHistoryOut,
)
from app.services.core import next_three_digit_code
from app.services.temporal import (
    close_and_create, get_active, get_history,
    update_in_place, delete_specific_row, close_active_row, kabiya,
)
from app.services.tenant_org_structure import DEFAULT_ORG_STRUCTURE_LEVELS, get_expected_parent_level

router = APIRouter(prefix="/api/core", tags=["core"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _fmtd(d: date | None) -> str | None:
    return d.isoformat() if d else None


def _fmtdt(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def _is_optional_schema_error(exc: Exception, relation_names: set[str]) -> bool:
    message = str(exc).lower()
    if (
        "undefinedtableerror" not in message
        and "undefinedcolumnerror" not in message
        and "relation" not in message
        and "column" not in message
    ):
        return False
    return any(relation.lower() in message for relation in relation_names)


async def _model_schema_matches(db: AsyncSession, model: type) -> bool:
    cache_store = getattr(db, "info", None)
    if cache_store is None:
        return True

    cache = cache_store.setdefault("core_model_schema_matches", {})
    table_name = model.__tablename__
    if table_name in cache:
        return cache[table_name]

    result = await db.execute(
        text(
            """
            select column_name
            from information_schema.columns
            where table_schema = 'public' and table_name = :table_name
            """
        ),
        {"table_name": table_name},
    )
    actual_columns = {row[0] for row in result.all()}
    expected_columns = {column.name for column in model.__table__.columns}
    matches = expected_columns.issubset(actual_columns)
    cache[table_name] = matches
    return matches


async def _ensure_employee(db: AsyncSession, employee_id: uuid.UUID) -> Employee:
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail={"error": "Employee not found", "code": "NOT_FOUND"})
    return emp


async def _get_employee_or_404(db: AsyncSession, employee_id: uuid.UUID, tenant_id: uuid.UUID) -> Employee:
    result = await db.execute(
        select(Employee)
        .where(Employee.id == employee_id)
        .where(Employee.tenant_id == tenant_id)
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail={"error": "Employee not found", "code": "NOT_FOUND"})
    return emp


async def _next_employee_number(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    result = await db.execute(
        select(func.coalesce(func.max(cast(Employee.employee_number, Integer)), 0) + 1)
        .where(Employee.tenant_id == tenant_id)
    )
    return str(result.scalar_one())


def _validate_digits(value: str, field_label: str, *, max_length: int = 9) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError(f"{field_label} הוא שדה חובה")
    if not cleaned.isdigit():
        raise ValueError(f"{field_label} חייב להכיל ספרות בלבד")
    if len(cleaned) > max_length:
        raise ValueError(f"{field_label} לא יכול להכיל יותר מ-{max_length} ספרות")
    return cleaned


def _build_department_movements(rows: list[EmployeeEmploymentOut]) -> list[DepartmentMovementOut]:
    ordered_rows = sorted(rows, key=lambda row: (row.valid_from, row.created_at))
    movements: list[DepartmentMovementOut] = []
    for previous_row, next_row in zip(ordered_rows, ordered_rows[1:]):
        if previous_row.org_unit_name == next_row.org_unit_name:
            continue
        movements.append(
            DepartmentMovementOut(
                effective_date=next_row.valid_from,
                previous_org_unit_name=previous_row.org_unit_name,
                next_org_unit_name=next_row.org_unit_name,
                position_title=next_row.position_title,
                employment_status=next_row.employment_status,
            )
        )
    return movements


def _build_position_history(rows: list[EmployeeEmploymentOut]) -> list[PositionHistoryOut]:
    ordered_rows = sorted(rows, key=lambda row: (row.valid_from, row.created_at), reverse=True)
    return [
        PositionHistoryOut(
            valid_from=row.valid_from,
            valid_to=row.valid_to,
            position_title=row.position_title,
            employment_type=row.employment_type,
            employment_status=row.employment_status,
            org_unit_name=row.org_unit_name,
            manager_name=row.manager_name,
        )
        for row in ordered_rows
    ]


async def _load_tenant_org_structure(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    as_of: date | None = None,
) -> dict[str, object]:
    return {
        "levels": DEFAULT_ORG_STRUCTURE_LEVELS.copy(),
        "position_attachment_level": DEFAULT_ORG_STRUCTURE_LEVELS[-1],
        "is_hierarchical": True,
    }


def _org_unit_field_values(body: OrgUnitActionBody, anchor: Any) -> dict[str, Any]:
    return {
        "name": body.name if body.name is not None else anchor.name,
        "description": body.description if body.description is not None else anchor.description,
        "parent_unit_id": body.parent_unit_id if body.parent_unit_id is not None else anchor.parent_unit_id,
        "manager_employee_id": (
            None
            if body.clear_manager_employee_id
            else body.manager_employee_id if body.manager_employee_id is not None else anchor.manager_employee_id
        ),
        "valid_from": body.valid_from or getattr(anchor, "valid_from", date.today()),
        "valid_to": body.valid_to if body.valid_to is not None else getattr(anchor, "valid_to", None),
    }


async def _ensure_tenant_exists(db: AsyncSession, tenant_id: uuid.UUID) -> Any:
    result = await db.execute(select(Tenant).where(Tenant.tenant_id == tenant_id))
    tenant = result.scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=404, detail={"error": "Tenant not found", "code": "NOT_FOUND"})
    return tenant


async def _get_org_unit_for_tenant(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    org_unit_id: uuid.UUID,
) -> OrgUnit | None:
    result = await db.execute(
        select(OrgUnit).where(OrgUnit.id == org_unit_id).where(OrgUnit.tenant_id == tenant_id)
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


async def create_org_unit(
    body: OrgUnitCreate,
    db: AsyncSession,
    current_user: CurrentUser,
):
    await _ensure_tenant_exists(db, body.tenant_id)
    structure = await _load_tenant_org_structure(db, body.tenant_id, as_of=body.valid_from)
    levels = list(structure["levels"])
    is_hierarchical = bool(structure["is_hierarchical"])

    try:
        expected_parent_type = get_expected_parent_level(levels, body.unit_type, is_hierarchical=is_hierarchical)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail={"error": str(exc), "code": "INVALID_ORG_UNIT_TYPE"}) from exc

    if expected_parent_type is None:
        if body.parent_unit_id is not None:
            raise HTTPException(
                status_code=422,
                detail={"error": "Selected org unit type cannot have a parent", "code": "INVALID_PARENT_UNIT_TYPE"},
            )
    else:
        if body.parent_unit_id is None:
            raise HTTPException(
                status_code=422,
                detail={"error": "Parent org unit is required for this unit type", "code": "PARENT_UNIT_REQUIRED"},
            )
        parent = await _get_org_unit_for_tenant(db, body.tenant_id, body.parent_unit_id)
        if parent is None:
            raise HTTPException(
                status_code=422,
                detail={"error": "Parent org unit not found", "code": "PARENT_UNIT_NOT_FOUND"},
            )
        if parent.unit_type != expected_parent_type:
            raise HTTPException(
                status_code=422,
                detail={"error": "Parent org unit type is invalid for this unit type", "code": "INVALID_PARENT_UNIT_TYPE"},
            )

    if body.manager_employee_id and not await _employee_exists_for_tenant(db, body.tenant_id, body.manager_employee_id):
        raise HTTPException(
            status_code=422,
            detail={"error": "Manager employee not found for tenant", "code": "ORG_UNIT_MANAGER_NOT_FOUND"},
        )

    code_result = await db.execute(
        select(OrgUnit.code).where(OrgUnit.tenant_id == body.tenant_id).where(OrgUnit.unit_type == body.unit_type)
    )
    code = next_three_digit_code(list(code_result.scalars().all()))
    unit = OrgUnit(
        tenant_id=body.tenant_id,
        code=code,
        name=body.name,
        unit_type=body.unit_type,
        description=body.description,
        parent_unit_id=body.parent_unit_id,
        manager_employee_id=body.manager_employee_id,
        valid_from=body.valid_from or date.today(),
        valid_to=None,
        created_by=current_user.id,
    )
    db.add(unit)
    if hasattr(db, "flush"):
        await db.flush()
    if hasattr(db, "refresh"):
        await db.refresh(unit)
    return unit


async def create_position(
    body: PositionCreate,
    db: AsyncSession,
    current_user: CurrentUser,
):
    await _ensure_tenant_exists(db, body.tenant_id)
    structure = await _load_tenant_org_structure(db, body.tenant_id, as_of=body.valid_from)
    attachment_level = structure["position_attachment_level"]

    if attachment_level is None:
        if body.org_unit_id is not None:
            raise HTTPException(
                status_code=422,
                detail={"error": "Position attachment is disabled for this tenant", "code": "POSITION_ATTACHMENT_DISABLED"},
            )
    else:
        if body.org_unit_id is None:
            raise HTTPException(
                status_code=422,
                detail={"error": "Org unit is required for positions", "code": "ORG_UNIT_REQUIRED"},
            )
        org_unit = await _get_org_unit_for_tenant(db, body.tenant_id, body.org_unit_id)
        if org_unit is None:
            raise HTTPException(
                status_code=422,
                detail={"error": "Org unit not found", "code": "ORG_UNIT_NOT_FOUND"},
            )
        if org_unit.unit_type != attachment_level:
            raise HTTPException(
                status_code=422,
                detail={"error": "Position must attach to an org unit at the configured level", "code": "POSITION_ORG_UNIT_TYPE_MISMATCH"},
            )

    code_result = await db.execute(select(Position.code).where(Position.tenant_id == body.tenant_id))
    code = next_three_digit_code(list(code_result.scalars().all()))
    position = Position(
        tenant_id=body.tenant_id,
        code=code,
        title=body.title,
        description=body.description,
        org_unit_id=body.org_unit_id,
        employment_type_default=body.employment_type_default,
        valid_from=body.valid_from or date.today(),
        valid_to=None,
        created_by=current_user.id,
    )
    db.add(position)
    if hasattr(db, "flush"):
        await db.flush()
    if hasattr(db, "refresh"):
        await db.refresh(position)
    return position


# ── Schemas ────────────────────────────────────────────────────────────────────

class EmployeeCreateBody(BaseModel):
    first_name: str
    last_name: str
    id_number: str
    employee_number_mode: Literal["candidate", "manual"] = "candidate"
    employee_number: Optional[str] = None
    gender: Optional[str] = None
    start_date: Optional[date] = None
    status: str = "active"

    @field_validator("first_name", "last_name")
    @classmethod
    def _require_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("שדה חובה")
        return cleaned

    @field_validator("id_number")
    @classmethod
    def _validate_id_number(cls, value: str) -> str:
        return _validate_digits(value, "תעודת זהות")

    @field_validator("employee_number")
    @classmethod
    def _validate_employee_number(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return _validate_digits(value, "מספר עובד")

    @model_validator(mode="after")
    def _validate_employee_number_mode(self) -> "EmployeeCreateBody":
        if self.employee_number_mode == "manual" and not self.employee_number:
            raise ValueError("מספר עובד הוא שדה חובה כאשר בוחרים מספר ידני")
        if self.employee_number_mode == "candidate":
            self.employee_number = None
        return self


class EmployeeStatusBody(BaseModel):
    status: str


class TemporalActionBody(BaseModel):
    action: str  # update | add | set | delete | close
    record_id: Optional[uuid.UUID] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    # identity fields
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    id_number: Optional[str] = None
    gender: Optional[str] = None
    # personal fields
    birth_date: Optional[date] = None
    birth_country: Optional[str] = None
    citizenship1: Optional[str] = None
    citizenship2: Optional[str] = None
    marital_status: Optional[str] = None
    num_children: Optional[int] = None
    # contact fields
    address1: Optional[str] = None
    address2: Optional[str] = None
    city: Optional[str] = None
    zip_code: Optional[str] = None
    country: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    home_phone: Optional[str] = None
    fax: Optional[str] = None
    email: Optional[str] = None
    # employment fields
    org_unit_id: Optional[uuid.UUID] = None
    position_id: Optional[uuid.UUID] = None
    manager_employee_id: Optional[uuid.UUID] = None
    employment_status: Optional[str] = None
    employment_type: Optional[str] = None
    salary_type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    employment_scope_pct: Optional[int] = None
    branch_name: Optional[str] = None
    work_site: Optional[str] = None
    time_clock_id: Optional[str] = None
    notes: Optional[str] = None
    # compensation fields
    base_salary: Optional[Decimal] = None
    currency: Optional[str] = None
    pay_cycle: Optional[str] = None
    cost_center: Optional[str] = None
    components_json: Optional[dict] = None
    # bank fields
    bank_code: Optional[str] = None
    bank_name: Optional[str] = None
    branch_number: Optional[str] = None
    branch_description: Optional[str] = None
    account_number: Optional[str] = None
    account_holder_name: Optional[str] = None
    payment_method: Optional[str] = None
    payment_percent: Optional[Decimal] = None
    fixed_amount: Optional[Decimal] = None
    payment_priority: Optional[int] = None
    company_name: Optional[str] = None

    @model_validator(mode="after")
    def _validate_temporal_window(self) -> "TemporalActionBody":
        if self.valid_from and self.valid_to and self.valid_to < self.valid_from:
            raise ValueError("תאריך סיום לא יכול להיות מוקדם מתאריך התחלה")
        return self


class EventBody(BaseModel):
    event_type: str
    effective_date: date
    notes: Optional[str] = None


class TrainingBody(BaseModel):
    course_name: str
    course_date: Optional[date] = None
    score: Optional[str] = None
    institute: Optional[str] = None


class ChildBody(BaseModel):
    child_name: str
    last_name: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[str] = None
    legal_id_number: Optional[str] = None
    military_service_status: Optional[str] = None
    service_start_date: Optional[date] = None
    service_end_date: Optional[date] = None
    allowance_eligible: Optional[bool] = None
    notes: Optional[str] = None


class ChildUpdateBody(BaseModel):
    child_name: Optional[str] = None
    last_name: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[str] = None
    legal_id_number: Optional[str] = None
    military_service_status: Optional[str] = None
    service_start_date: Optional[date] = None
    service_end_date: Optional[date] = None
    allowance_eligible: Optional[bool] = None
    notes: Optional[str] = None


class AwardBody(BaseModel):
    award_type: str
    award_date: Optional[date] = None
    description: Optional[str] = None
    granted_by: Optional[str] = None
    notes: Optional[str] = None


class AwardUpdateBody(BaseModel):
    award_type: Optional[str] = None
    award_date: Optional[date] = None
    description: Optional[str] = None
    granted_by: Optional[str] = None
    notes: Optional[str] = None


class CertificationActionBody(BaseModel):
    action: str = "update"  # update | add | set | close | delete
    record_id: Optional[uuid.UUID] = None
    certification_type: Optional[str] = None
    issuer: Optional[str] = None
    issued_on: Optional[date] = None
    expires_on: Optional[date] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None


class CourseActionBody(BaseModel):
    action: str = "update"  # update | add | set | close | delete
    record_id: Optional[uuid.UUID] = None
    course_name: Optional[str] = None
    provider: Optional[str] = None
    started_on: Optional[date] = None
    completed_on: Optional[date] = None
    status: Optional[str] = None
    score: Optional[str] = None
    notes: Optional[str] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None


class SkillBody(BaseModel):
    skill_name: str
    level: Optional[str] = None
    category: Optional[str] = None
    source: Optional[str] = None
    assessed_on: Optional[date] = None
    notes: Optional[str] = None


class SkillUpdateBody(BaseModel):
    skill_name: Optional[str] = None
    level: Optional[str] = None
    category: Optional[str] = None
    source: Optional[str] = None
    assessed_on: Optional[date] = None
    notes: Optional[str] = None


class WorkBreakActionBody(BaseModel):
    action: str = "update"  # update | add | set | close | delete
    record_id: Optional[uuid.UUID] = None
    break_type: Optional[str] = None
    reason: Optional[str] = None
    started_on: Optional[date] = None
    ended_on: Optional[date] = None
    approved_by: Optional[str] = None
    notes: Optional[str] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None


class DocumentActionBody(BaseModel):
    action: str = "update"  # update | add | set | close | delete
    record_id: Optional[uuid.UUID] = None
    document_type: Optional[str] = None
    file_name: Optional[str] = None
    storage_path: Optional[str] = None
    issued_on: Optional[date] = None
    expires_on: Optional[date] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None


# ── Row serializers ────────────────────────────────────────────────────────────

def _ser_identity(r: EmployeeIdentity) -> dict[str, Any]:
    return {
        "id": str(r.id),
        "first_name": r.first_name,
        "last_name": r.last_name,
        "id_number": r.id_number,
        "gender": r.gender,
        "valid_from": _fmtd(r.valid_from),
        "valid_to": _fmtd(r.valid_to),
        "created_at": _fmtdt(r.created_at),
        "_current": r.valid_to is None,
        "_valid_from_raw": _fmtd(r.valid_from),
        "_valid_to_raw": _fmtd(r.valid_to),
    }


def _build_identity_temporal_data(body: "TemporalActionBody") -> dict[str, Any]:
    columns = set(EmployeeIdentity.__table__.columns.keys())
    data: dict[str, Any] = {}

    if body.first_name is not None:
        cleaned = body.first_name.strip()
        if not cleaned:
            raise HTTPException(status_code=400, detail={"error": "שם פרטי הוא שדה חובה", "code": "BAD_FIRST_NAME"})
        data["first_name"] = cleaned
    if body.last_name is not None:
        cleaned = body.last_name.strip()
        if not cleaned:
            raise HTTPException(status_code=400, detail={"error": "שם משפחה הוא שדה חובה", "code": "BAD_LAST_NAME"})
        data["last_name"] = cleaned
    if body.gender is not None:
        data["gender"] = body.gender

    if body.id_number is not None:
        cleaned_id = body.id_number.strip()
        if cleaned_id:
            try:
                _validate_digits(cleaned_id, "תעודת זהות")
            except ValueError as exc:
                raise HTTPException(status_code=400, detail={"error": str(exc), "code": "BAD_ID_NUMBER"}) from exc
        if "id_number" in columns:
            data["id_number"] = cleaned_id or None
        elif "legal_id_number" in columns:
            data["legal_id_number"] = cleaned_id or None

    return data


def _ser_personal(r: EmployeePersonal) -> dict[str, Any]:
    return {
        "id": str(r.id),
        "birth_date": _fmtd(r.birth_date),
        "birth_country": r.birth_country,
        "citizenship1": r.citizenship1,
        "citizenship2": r.citizenship2,
        "marital_status": r.marital_status,
        "num_children": r.num_children,
        "valid_from": _fmtd(r.valid_from),
        "valid_to": _fmtd(r.valid_to),
        "created_at": _fmtdt(r.created_at),
        "_current": r.valid_to is None,
        "_valid_from_raw": _fmtd(r.valid_from),
        "_valid_to_raw": _fmtd(r.valid_to),
    }


def _ser_contact(r: EmployeeContact) -> dict[str, Any]:
    return {
        "id": str(r.id),
        "address1": r.address1,
        "address2": r.address2,
        "city": r.city,
        "zip_code": r.zip_code,
        "country": r.country,
        "phone": r.phone,
        "mobile": r.mobile,
        "home_phone": r.home_phone,
        "fax": r.fax,
        "email": r.email,
        "valid_from": _fmtd(r.valid_from),
        "valid_to": _fmtd(r.valid_to),
        "created_at": _fmtdt(r.created_at),
        "_current": r.valid_to is None,
        "_valid_from_raw": _fmtd(r.valid_from),
        "_valid_to_raw": _fmtd(r.valid_to),
    }


def _ser_employment(r: EmployeeEmployment, org_name: str | None, pos_name: str | None) -> dict[str, Any]:
    return {
        "id": str(r.id),
        "org_unit_id": str(r.org_unit_id) if r.org_unit_id else None,
        "org_unit_name": org_name,
        "position_id": str(r.position_id) if r.position_id else None,
        "position_name": pos_name,
        "manager_employee_id": str(r.manager_employee_id) if r.manager_employee_id else None,
        "employment_status": r.employment_status,
        "employment_type": r.employment_type,
        "salary_type": r.salary_type,
        "start_date": _fmtd(r.start_date),
        "end_date": _fmtd(r.end_date),
        "employment_scope_pct": r.employment_scope_pct,
        "branch_name": r.branch_name,
        "work_site": r.work_site,
        "time_clock_id": r.time_clock_id,
        "notes": r.notes,
        "valid_from": _fmtd(r.valid_from),
        "valid_to": _fmtd(r.valid_to),
        "created_at": _fmtdt(r.created_at),
        "_current": r.valid_to is None,
        "_valid_from_raw": _fmtd(r.valid_from),
        "_valid_to_raw": _fmtd(r.valid_to),
    }


def _ser_compensation(r: EmployeeCompensation) -> dict[str, Any]:
    return {
        "id": str(r.id),
        "base_salary": float(r.base_salary) if r.base_salary is not None else None,
        "currency": r.currency,
        "pay_cycle": r.pay_cycle,
        "cost_center": r.cost_center,
        "components_json": r.components_json,
        "valid_from": _fmtd(r.valid_from),
        "valid_to": _fmtd(r.valid_to),
        "created_at": _fmtdt(r.created_at),
        "_current": r.valid_to is None,
        "_valid_from_raw": _fmtd(r.valid_from),
        "_valid_to_raw": _fmtd(r.valid_to),
    }


def _ser_bank(r: EmployeeBankAccount) -> dict[str, Any]:
    return {
        "id": str(r.id),
        "bank_code": r.bank_code,
        "bank_name": r.bank_name,
        "branch_number": r.branch_number,
        "branch_description": r.branch_description,
        "account_number": r.account_number,
        "account_holder_name": r.account_holder_name,
        "payment_method": r.payment_method,
        "payment_percent": float(r.payment_percent) if r.payment_percent is not None else None,
        "fixed_amount": float(r.fixed_amount) if r.fixed_amount is not None else None,
        "payment_priority": r.payment_priority,
        "company_name": r.company_name,
        "notes": r.notes,
        "valid_from": _fmtd(r.valid_from),
        "valid_to": _fmtd(r.valid_to),
        "created_at": _fmtdt(r.created_at),
        "_current": r.valid_to is None,
        "_valid_from_raw": _fmtd(r.valid_from),
        "_valid_to_raw": _fmtd(r.valid_to),
    }


def _ser_event(r: EmploymentEvent) -> dict[str, Any]:
    return {
        "id": str(r.id),
        "event_type": r.event_type,
        "event_date": _fmtd(r.effective_date),
        "reason": r.notes,
        "created_at": _fmtdt(r.created_at),
    }


def _ser_training(r: EmployeeTraining) -> dict[str, Any]:
    return {
        "id": str(r.id),
        "course_name": r.course_name,
        "course_date": _fmtd(r.course_date),
        "score": r.score,
        "institute": r.institute,
        "created_at": _fmtdt(r.created_at),
    }


def _ser_document(r: EmployeeDocumentIndex) -> dict[str, Any]:
    return {
        "id": str(r.id),
        "document_type": r.document_type,
        "file_name": r.file_name,
        "storage_path": r.storage_path,
        "issued_on": _fmtd(r.issued_on),
        "expires_on": _fmtd(r.expires_on),
        "status": r.status,
        "notes": r.notes,
        "valid_from": _fmtd(r.valid_from),
        "valid_to": _fmtd(r.valid_to),
        "created_at": _fmtdt(r.created_at),
        "_current": r.valid_to is None,
    }


def _ser_child(r: EmployeeChild) -> dict[str, Any]:
    return {
        "id": str(r.id),
        "child_name": r.child_name,
        "last_name": r.last_name,
        "birth_date": _fmtd(r.birth_date),
        "gender": r.gender,
        "legal_id_number": r.legal_id_number,
        "military_service_status": r.military_service_status,
        "service_start_date": _fmtd(r.service_start_date),
        "service_end_date": _fmtd(r.service_end_date),
        "allowance_eligible": r.allowance_eligible,
        "notes": r.notes,
        "created_at": _fmtdt(r.created_at),
    }


def _ser_award(r: EmployeeAward) -> dict[str, Any]:
    return {
        "id": str(r.id),
        "award_type": r.award_type,
        "award_date": _fmtd(r.award_date),
        "description": r.description,
        "granted_by": r.granted_by,
        "notes": r.notes,
        "created_at": _fmtdt(r.created_at),
    }


def _ser_certification(r: EmployeeCertification) -> dict[str, Any]:
    return {
        "id": str(r.id),
        "certification_type": r.certification_type,
        "issuer": r.issuer,
        "issued_on": _fmtd(r.issued_on),
        "expires_on": _fmtd(r.expires_on),
        "status": r.status,
        "notes": r.notes,
        "valid_from": _fmtd(r.valid_from),
        "valid_to": _fmtd(r.valid_to),
        "created_at": _fmtdt(r.created_at),
        "_current": r.valid_to is None,
    }


def _ser_course(r: EmployeeCourse) -> dict[str, Any]:
    return {
        "id": str(r.id),
        "course_name": r.course_name,
        "provider": r.provider,
        "started_on": _fmtd(r.started_on),
        "completed_on": _fmtd(r.completed_on),
        "status": r.status,
        "score": r.score,
        "notes": r.notes,
        "valid_from": _fmtd(r.valid_from),
        "valid_to": _fmtd(r.valid_to),
        "created_at": _fmtdt(r.created_at),
        "_current": r.valid_to is None,
    }


def _ser_skill(r: EmployeeSkill) -> dict[str, Any]:
    return {
        "id": str(r.id),
        "skill_name": r.skill_name,
        "level": r.level,
        "category": r.category,
        "source": r.source,
        "assessed_on": _fmtd(r.assessed_on),
        "notes": r.notes,
        "created_at": _fmtdt(r.created_at),
    }


def _ser_work_break(r: EmployeeWorkBreak) -> dict[str, Any]:
    return {
        "id": str(r.id),
        "break_type": r.break_type,
        "reason": r.reason,
        "started_on": _fmtd(r.started_on),
        "ended_on": _fmtd(r.ended_on),
        "approved_by": r.approved_by,
        "notes": r.notes,
        "valid_from": _fmtd(r.valid_from),
        "valid_to": _fmtd(r.valid_to),
        "created_at": _fmtdt(r.created_at),
        "_current": r.valid_to is None,
    }


# ── Helper: resolve org/position names ────────────────────────────────────────

async def _resolve_org_pos_names(
    db: AsyncSession, tenant_id: uuid.UUID, employment_rows: list[EmployeeEmployment]
) -> dict[uuid.UUID, tuple[str | None, str | None]]:
    """Returns {employment_id: (org_name, pos_name)}"""
    org_ids = {r.org_unit_id for r in employment_rows if r.org_unit_id}
    pos_ids = {r.position_id for r in employment_rows if r.position_id}

    org_names: dict[uuid.UUID, str] = {}
    pos_names: dict[uuid.UUID, str] = {}

    if org_ids:
        res = await db.execute(
            select(OrgUnit.id, OrgUnit.name).where(OrgUnit.id.in_(org_ids))
        )
        org_names = {row.id: row.name for row in res.all()}

    if pos_ids:
        res = await db.execute(
            select(Position.id, Position.title).where(Position.id.in_(pos_ids))
        )
        pos_names = {row.id: row.title for row in res.all()}

    return {
        r.id: (
            org_names.get(r.org_unit_id) if r.org_unit_id else None,
            pos_names.get(r.position_id) if r.position_id else None,
        )
        for r in employment_rows
    }


async def _fetch_employee_rows(
    db: AsyncSession,
    model: type,
    employee_id: uuid.UUID,
) -> list[Any]:
    if not await _model_schema_matches(db, model):
        return []
    try:
        result = await db.execute(
            select(model)
            .where(model.employee_id == employee_id)
            .order_by(model.valid_from.desc(), model.created_at.desc())
        )
        return result.scalars().all()
    except sa.exc.ProgrammingError as exc:
        if not _is_optional_schema_error(exc, {model.__tablename__}):
            raise
        await db.rollback()
        return []


async def _fetch_employee_rows_simple(
    db: AsyncSession,
    model: type,
    employee_id: uuid.UUID,
) -> list[Any]:
    """For non-temporal (append-only) models without valid_from."""
    if not await _model_schema_matches(db, model):
        return []
    try:
        result = await db.execute(
            select(model)
            .where(model.employee_id == employee_id)
            .order_by(model.created_at.desc())
        )
        return result.scalars().all()
    except sa.exc.ProgrammingError as exc:
        if not _is_optional_schema_error(exc, {model.__tablename__}):
            raise
        await db.rollback()
        return []


async def _resolve_manager_names(
    db: AsyncSession,
    employment_rows: list[EmployeeEmployment],
) -> dict[uuid.UUID, str]:
    manager_ids = {row.manager_employee_id for row in employment_rows if row.manager_employee_id}
    if not manager_ids:
        return {}

    result = await db.execute(
        select(EmployeeIdentity)
        .where(EmployeeIdentity.employee_id.in_(manager_ids))
        .order_by(
            EmployeeIdentity.employee_id,
            EmployeeIdentity.valid_from.desc(),
            EmployeeIdentity.created_at.desc(),
        )
    )
    identities = result.scalars().all()

    best_rows: dict[uuid.UUID, tuple[int, date, datetime | None, EmployeeIdentity]] = {}
    for identity in identities:
        rank = 1 if identity.valid_to is None else 0
        candidate = (rank, identity.valid_from, identity.created_at, identity)
        current = best_rows.get(identity.employee_id)
        if current is None or candidate > current:
            best_rows[identity.employee_id] = candidate

    return {
        employee_id: f"{row.first_name} {row.last_name}".strip()
        for employee_id, (_, _, _, row) in best_rows.items()
    }


# ── Generic temporal action handler ───────────────────────────────────────────

async def _handle_temporal(
    db: AsyncSession,
    model: type,
    tenant_id: uuid.UUID,
    employee_id: uuid.UUID,
    body: Any,
    actor_id: uuid.UUID,
    data_fields: dict[str, Any],
) -> None:
    extra = {"employee_id": employee_id}
    valid_from = body.valid_from or date.today()

    if body.action == "add":
        new_row = model(
            **data_fields,
            employee_id=employee_id,
            tenant_id=tenant_id,
            valid_from=valid_from,
            valid_to=body.valid_to,
            created_by=actor_id,
        )
        db.add(new_row)

    elif body.action == "update":
        if body.record_id:
            await db.execute(
                update(model)
                .where(model.id == body.record_id)
                .where(model.employee_id == employee_id)
                .values(**data_fields, valid_from=valid_from, valid_to=body.valid_to)
                .execution_options(synchronize_session=False)
            )
        else:
            await update_in_place(db, model, tenant_id, data_fields, actor_id,
                                  new_valid_from=valid_from, new_valid_to=body.valid_to, extra_filters=extra)

    elif body.action == "set":
        await kabiya(db, model, tenant_id, data_fields, actor_id,
                     new_valid_from=valid_from, new_valid_to=body.valid_to, extra_filters=extra)

    elif body.action == "close":
        await close_active_row(db, model, tenant_id, body.valid_to or date.today(),
                               actor_id=actor_id, extra_filters=extra)

    elif body.action == "delete":
        await delete_specific_row(db, model, tenant_id, valid_from, extra_filters=extra)

    else:
        raise HTTPException(status_code=400, detail={"error": f"Unknown action: {body.action}", "code": "BAD_ACTION"})

    await db.commit()


# ══════════════════════════════════════════════════════════════════════════════
# Employees
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/employees")
async def list_employees(
    tenant_id: uuid.UUID,
    q: str = "",
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "view")),
):
    stmt = (
        select(Employee, EmployeeIdentity)
        .outerjoin(
            EmployeeIdentity,
            (EmployeeIdentity.employee_id == Employee.id) & EmployeeIdentity.valid_to.is_(None),
        )
        .where(Employee.tenant_id == tenant_id)
        .order_by(cast(Employee.employee_number, Integer))
    )
    result = await db.execute(stmt)
    rows = result.all()

    out = []
    for emp, ident in rows:
        full_name = f"{ident.first_name} {ident.last_name}" if ident else "—"
        id_number = ident.id_number if ident else None
        if q and q.lower() not in full_name.lower() and (id_number is None or q not in id_number):
            continue
        out.append({
            "id": str(emp.id),
            "employee_number": emp.employee_number,
            "full_name": full_name,
            "id_number": id_number,
            "status": emp.status,
            "created_at": _fmtdt(emp.created_at),
        })
    return out


@router.post("/employees", status_code=status.HTTP_201_CREATED)
async def create_employee(
    body: EmployeeCreate,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "edit")),
):
    can_manage_sensitive = (user.permissions or {}).get("core", {}).get("can_manage_sensitive", False)

    # Sensitive field guard — must happen before any DB access
    if not can_manage_sensitive:
        ident = body.identity
        if ident.legal_id_number or ident.bank_account or ident.spouse_legal_id:
            raise HTTPException(
                status_code=403,
                detail={"error": "אין הרשאה לשדות רגישים", "code": "FORBIDDEN"},
            )

    tenant_id = body.tenant_id
    actor_id = user.id
    employee_number = body.employee_number

    existing_employee = await db.execute(
        select(Employee.id)
        .where(Employee.tenant_id == tenant_id)
        .where(Employee.employee_number == employee_number)
    )
    if existing_employee.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail={"error": "מספר עובד כבר קיים בארגון", "code": "EMPLOYEE_NUMBER_EXISTS"},
        )

    if body.identity.legal_id_number:
        existing_identity = await db.execute(
            select(EmployeeIdentity.id)
            .where(EmployeeIdentity.tenant_id == tenant_id)
            .where(EmployeeIdentity.legal_id_number == body.identity.legal_id_number)
            .where(EmployeeIdentity.valid_to.is_(None))
        )
        if existing_identity.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail={"error": "תעודת זהות כבר קיימת בארגון", "code": "ID_NUMBER_EXISTS"},
            )

    emp = Employee(
        tenant_id=tenant_id,
        employee_number=employee_number,
        created_by=actor_id,
    )
    db.add(emp)
    await db.flush()

    ident_data = body.identity
    identity = EmployeeIdentity(
        employee_id=emp.id,
        tenant_id=tenant_id,
        first_name=ident_data.first_name,
        last_name=ident_data.last_name,
        legal_id_type=ident_data.legal_id_type or "national_id",
        legal_id_number=ident_data.legal_id_number,
        gender=ident_data.gender,
        birth_date=ident_data.birth_date,
        phone=ident_data.phone,
        email=ident_data.email,
        nationality=ident_data.nationality,
        address_line1=ident_data.address_line1,
        city=ident_data.city,
        postal_code=ident_data.postal_code,
        country=ident_data.country,
        emergency_contact_name=ident_data.emergency_contact_name,
        emergency_contact_phone=ident_data.emergency_contact_phone,
        valid_from=ident_data.valid_from or date.today(),
        created_by=actor_id,
    )
    db.add(identity)
    await db.commit()
    await db.refresh(emp)

    return {"id": str(emp.id), "employee_number": emp.employee_number}


@router.get("/employees/{employee_id}")
async def get_employee(
    employee_id: uuid.UUID,
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "view")),
):
    emp = await _get_employee_or_404(db, employee_id, tenant_id)
    identity_rows = await _fetch_employee_rows(db, EmployeeIdentity, employee_id)
    personal_rows = await _fetch_employee_rows(db, EmployeePersonal, employee_id)
    contact_rows = await _fetch_employee_rows(db, EmployeeContact, employee_id)
    employment_rows = await _fetch_employee_rows(db, EmployeeEmployment, employee_id)
    compensation_rows = await _fetch_employee_rows(db, EmployeeCompensation, employee_id)
    bank_rows = await _fetch_employee_rows(db, EmployeeBankAccount, employee_id)
    document_rows = await _fetch_employee_rows(db, EmployeeDocumentIndex, employee_id)
    certification_rows = await _fetch_employee_rows(db, EmployeeCertification, employee_id)
    course_rows = await _fetch_employee_rows(db, EmployeeCourse, employee_id)
    work_break_rows = await _fetch_employee_rows(db, EmployeeWorkBreak, employee_id)

    event_rows = await _fetch_employee_rows_simple(db, EmploymentEvent, employee_id)
    training_rows = await _fetch_employee_rows_simple(db, EmployeeTraining, employee_id)

    child_result = await db.execute(
        select(EmployeeChild)
        .where(EmployeeChild.employee_id == employee_id)
        .where(EmployeeChild.tenant_id == tenant_id)
        .order_by(EmployeeChild.birth_date.desc(), EmployeeChild.created_at.desc())
    )
    child_rows = child_result.scalars().all()

    award_result = await db.execute(
        select(EmployeeAward)
        .where(EmployeeAward.employee_id == employee_id)
        .where(EmployeeAward.tenant_id == tenant_id)
        .order_by(EmployeeAward.award_date.desc(), EmployeeAward.created_at.desc())
    )
    award_rows = award_result.scalars().all()

    skill_result = await db.execute(
        select(EmployeeSkill)
        .where(EmployeeSkill.employee_id == employee_id)
        .where(EmployeeSkill.tenant_id == tenant_id)
        .order_by(EmployeeSkill.created_at.desc())
    )
    skill_rows = skill_result.scalars().all()

    active_ident = next((row for row in identity_rows if row.valid_to is None), identity_rows[0] if identity_rows else None)
    employment_names = await _resolve_org_pos_names(db, tenant_id, employment_rows)
    manager_names = await _resolve_manager_names(db, employment_rows)

    employment_payload: list[dict[str, Any]] = []
    for row in employment_rows:
        org_name, position_name = employment_names.get(row.id, (None, None))
        payload = _ser_employment(row, org_name, position_name)
        payload["manager_name"] = manager_names.get(row.manager_employee_id) if row.manager_employee_id else None
        employment_payload.append(payload)

    return {
        "id": str(emp.id),
        "employee_number": emp.employee_number,
        "status": emp.status,
        "photo_url": emp.photo_url,
        "full_name": f"{active_ident.first_name} {active_ident.last_name}" if active_ident else "—",
        "id_number": active_ident.id_number if active_ident else None,
        "created_at": _fmtdt(emp.created_at),
        "identity": [_ser_identity(row) for row in identity_rows],
        "personal": [_ser_personal(row) for row in personal_rows],
        "contact": [_ser_contact(row) for row in contact_rows],
        "employment": employment_payload,
        "compensation": [_ser_compensation(row) for row in compensation_rows],
        "bank": [_ser_bank(row) for row in bank_rows],
        "documents": [_ser_document(row) for row in document_rows],
        "certifications": [_ser_certification(row) for row in certification_rows],
        "courses": [_ser_course(row) for row in course_rows],
        "work_breaks": [_ser_work_break(row) for row in work_break_rows],
        "children": [_ser_child(row) for row in child_rows],
        "awards": [_ser_award(row) for row in award_rows],
        "skills": [_ser_skill(row) for row in skill_rows],
        "events": [_ser_event(row) for row in event_rows],
        "training": [_ser_training(row) for row in training_rows],
    }


@router.post("/employees/{employee_id}/events", status_code=status.HTTP_201_CREATED)
async def create_employee_event(
    employee_id: uuid.UUID,
    body: EmploymentEventIn,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("core", "edit")),
):
    can_manage_sensitive = (current_user.permissions or {}).get("core", {}).get("can_manage_sensitive", False)

    # Compensation changes require sensitive permission — check before DB access
    if body.compensation is not None and not can_manage_sensitive:
        raise HTTPException(
            status_code=403,
            detail={"error": "אין הרשאה לשינוי שכר", "code": "FORBIDDEN"},
        )

    emp = await _ensure_employee(db, employee_id)
    tenant_id = emp.tenant_id

    # Preserve existing employment fields when creating employment-touching events
    current_emp = await get_active(db, EmployeeEmployment, tenant_id, extra_filters={"employee_id": employee_id})
    if current_emp:
        payload: dict[str, Any] = {
            "tenant_id": tenant_id,
            "employee_id": employee_id,
            "org_unit_id": current_emp.org_unit_id,
            "manager_employee_id": current_emp.manager_employee_id,
            "position_id": current_emp.position_id,
            "employment_status": current_emp.employment_status,
            "employment_type": current_emp.employment_type,
            "salary_type": current_emp.salary_type,
            "start_date": current_emp.start_date,
            "end_date": current_emp.end_date,
            "employment_scope_pct": current_emp.employment_scope_pct,
            "branch_name": current_emp.branch_name,
            "work_site": current_emp.work_site,
            "time_clock_id": current_emp.time_clock_id,
            "notes": current_emp.notes,
            "valid_from": body.effective_date,
        }
        if body.employment:
            overrides = body.employment.model_dump(exclude_none=True, exclude={"valid_from"})
            payload.update(overrides)
        await close_and_create(db, EmployeeEmployment, tenant_id, payload, current_user.id,
                               extra_filters={"employee_id": employee_id})

    return {"ok": True}


@router.post("/employees/{employee_id}/bank-accounts", status_code=status.HTTP_201_CREATED)
async def create_bank_account(
    employee_id: uuid.UUID,
    body: EmployeeBankAccountCreate,
    tenant_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "edit")),
):
    can_manage_sensitive = (user.permissions or {}).get("core", {}).get("can_manage_sensitive", False)
    if not can_manage_sensitive:
        raise HTTPException(
            status_code=403,
            detail={"error": "אין הרשאה לניהול חשבון בנק", "code": "FORBIDDEN"},
        )

    if tenant_id is None:
        raise HTTPException(
            status_code=422,
            detail={"error": "tenant_id is required", "code": "MISSING_TENANT_ID"},
        )

    await _get_employee_or_404(db, employee_id, tenant_id)

    row = EmployeeBankAccount(
        employee_id=employee_id,
        tenant_id=tenant_id,
        bank_name=body.bank_name,
        branch_number=body.branch_number,
        account_number=body.account_number,
        account_holder_name=body.account_holder_name,
        payment_method=body.payment_method,
        payment_percent=body.payment_percent,
        fixed_amount=body.fixed_amount,
        payment_priority=body.payment_priority,
        company_name=body.company_name,
        notes=body.notes,
        valid_from=body.valid_from or date.today(),
        valid_to=body.valid_to,
        created_by=user.id,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return {"id": str(row.id)}


@router.patch("/employees/{employee_id}/status")
async def update_employee_status(
    employee_id: uuid.UUID,
    tenant_id: uuid.UUID,
    body: EmployeeStatusBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "edit")),
):
    emp = await _get_employee_or_404(db, employee_id, tenant_id)
    allowed = {"active", "inactive", "terminated"}
    if body.status not in allowed:
        raise HTTPException(status_code=400, detail={"error": "Invalid status", "code": "BAD_STATUS"})
    emp.status = body.status
    await db.commit()
    return {"ok": True}


@router.delete("/employees/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_employee(
    employee_id: uuid.UUID,
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "edit")),
):
    employee = await _get_employee_or_404(db, employee_id, tenant_id)

    await db.execute(
        text(
            """
            UPDATE employee_employment
            SET manager_employee_id = NULL
            WHERE tenant_id = :tenant_id
              AND manager_employee_id = :employee_id
            """
        ),
        {"tenant_id": tenant_id, "employee_id": employee.id},
    )

    await db.execute(
        text(
            """
            UPDATE org_units
            SET manager_employee_id = NULL
            WHERE tenant_id = :tenant_id
              AND manager_employee_id = :employee_id
            """
        ),
        {"tenant_id": tenant_id, "employee_id": employee.id},
    )

    await db.delete(employee)
    await db.commit()


# ── Temporal sub-resource endpoints ───────────────────────────────────────────

@router.put("/employees/{employee_id}/identity")
async def update_identity(
    employee_id: uuid.UUID,
    tenant_id: uuid.UUID,
    body: TemporalActionBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "edit")),
):
    await _get_employee_or_404(db, employee_id, tenant_id)
    data = _build_identity_temporal_data(body)
    await _handle_temporal(db, EmployeeIdentity, tenant_id, employee_id, body, user.id, data)
    return {"ok": True}


@router.put("/employees/{employee_id}/identity/record")
async def update_identity_record(
    employee_id: uuid.UUID,
    tenant_id: uuid.UUID,
    body: EmployeeIdentityActionBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "edit")),
):
    await _get_employee_or_404(db, employee_id, tenant_id)

    _IDENTITY_FIELDS = (
        "first_name", "last_name", "preferred_name", "email", "phone",
        "birth_date", "immigration_date", "gender",
        "marital_status", "children_count", "spouse_name", "spouse_legal_id",
        "legal_id_type", "legal_id_number", "nationality",
        "address_line1", "address_line2", "city", "postal_code", "country",
        "emergency_contact_name", "emergency_contact_phone",
    )
    data = {f: getattr(body, f) for f in _IDENTITY_FIELDS if getattr(body, f) is not None}

    valid_from = body.valid_from or date.today()
    extra = {"employee_id": employee_id}

    if body.action == "add":
        row = EmployeeIdentity(
            **data,
            employee_id=employee_id,
            tenant_id=tenant_id,
            valid_from=valid_from,
            valid_to=body.valid_to,
            created_by=user.id,
        )
        db.add(row)

    elif body.action == "update":
        await update_in_place(db, EmployeeIdentity, tenant_id, data, user.id,
                              new_valid_from=valid_from, new_valid_to=body.valid_to, extra_filters=extra)

    elif body.action == "set":
        await kabiya(db, EmployeeIdentity, tenant_id, data, user.id,
                     new_valid_from=valid_from, new_valid_to=body.valid_to, extra_filters=extra)

    elif body.action == "close":
        await close_active_row(db, EmployeeIdentity, tenant_id, body.valid_to or date.today(),
                               actor_id=user.id, extra_filters=extra)

    elif body.action == "delete":
        await delete_specific_row(db, EmployeeIdentity, tenant_id, valid_from, extra_filters=extra)

    else:
        raise HTTPException(status_code=400, detail={"error": f"Unknown action: {body.action}", "code": "BAD_ACTION"})

    await db.commit()
    return {"ok": True}


@router.put("/employees/{employee_id}/personal")
async def update_personal(
    employee_id: uuid.UUID,
    tenant_id: uuid.UUID,
    body: TemporalActionBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "edit")),
):
    await _get_employee_or_404(db, employee_id, tenant_id)
    data = {k: v for k, v in {
        "birth_date": body.birth_date,
        "birth_country": body.birth_country,
        "citizenship1": body.citizenship1,
        "citizenship2": body.citizenship2,
        "marital_status": body.marital_status,
        "num_children": body.num_children,
    }.items() if v is not None}
    await _handle_temporal(db, EmployeePersonal, tenant_id, employee_id, body, user.id, data)
    return {"ok": True}


@router.put("/employees/{employee_id}/contact")
async def update_contact(
    employee_id: uuid.UUID,
    tenant_id: uuid.UUID,
    body: TemporalActionBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "edit")),
):
    await _get_employee_or_404(db, employee_id, tenant_id)
    data = {k: v for k, v in {
        "address1": body.address1,
        "address2": body.address2,
        "city": body.city,
        "zip_code": body.zip_code,
        "country": body.country,
        "phone": body.phone,
        "mobile": body.mobile,
        "home_phone": body.home_phone,
        "fax": body.fax,
        "email": body.email,
    }.items() if v is not None}
    await _handle_temporal(db, EmployeeContact, tenant_id, employee_id, body, user.id, data)
    return {"ok": True}


@router.put("/employees/{employee_id}/employment")
async def update_employment(
    employee_id: uuid.UUID,
    tenant_id: uuid.UUID,
    body: TemporalActionBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "edit")),
):
    await _get_employee_or_404(db, employee_id, tenant_id)
    data = {k: v for k, v in {
        "org_unit_id": body.org_unit_id,
        "position_id": body.position_id,
        "manager_employee_id": body.manager_employee_id,
        "employment_status": body.employment_status,
        "employment_type": body.employment_type,
        "salary_type": body.salary_type,
        "start_date": body.start_date,
        "end_date": body.end_date,
        "employment_scope_pct": body.employment_scope_pct,
        "branch_name": body.branch_name,
        "work_site": body.work_site,
        "time_clock_id": body.time_clock_id,
        "notes": body.notes,
    }.items() if v is not None}
    await _handle_temporal(db, EmployeeEmployment, tenant_id, employee_id, body, user.id, data)
    return {"ok": True}


@router.put("/employees/{employee_id}/compensation")
async def update_compensation(
    employee_id: uuid.UUID,
    tenant_id: uuid.UUID,
    body: TemporalActionBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "edit")),
):
    await _get_employee_or_404(db, employee_id, tenant_id)
    data = {k: v for k, v in {
        "base_salary": body.base_salary,
        "currency": body.currency,
        "pay_cycle": body.pay_cycle,
        "cost_center": body.cost_center,
        "components_json": body.components_json,
    }.items() if v is not None}
    await _handle_temporal(db, EmployeeCompensation, tenant_id, employee_id, body, user.id, data)
    return {"ok": True}


@router.put("/employees/{employee_id}/bank")
async def update_bank(
    employee_id: uuid.UUID,
    tenant_id: uuid.UUID,
    body: TemporalActionBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "edit")),
):
    await _get_employee_or_404(db, employee_id, tenant_id)
    data = {k: v for k, v in {
        "bank_code": body.bank_code,
        "bank_name": body.bank_name,
        "branch_number": body.branch_number,
        "branch_description": body.branch_description,
        "account_number": body.account_number,
        "account_holder_name": body.account_holder_name,
        "payment_method": body.payment_method,
        "payment_percent": body.payment_percent,
        "fixed_amount": body.fixed_amount,
        "payment_priority": body.payment_priority,
        "company_name": body.company_name,
        "notes": body.notes,
    }.items() if v is not None}
    await _handle_temporal(db, EmployeeBankAccount, tenant_id, employee_id, body, user.id, data)
    return {"ok": True}


@router.put("/employees/{employee_id}/documents")
async def update_documents(
    employee_id: uuid.UUID,
    tenant_id: uuid.UUID,
    body: DocumentActionBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "edit")),
):
    await _get_employee_or_404(db, employee_id, tenant_id)
    data = {k: v for k, v in {
        "document_type": body.document_type,
        "file_name": body.file_name,
        "storage_path": body.storage_path,
        "issued_on": body.issued_on,
        "expires_on": body.expires_on,
        "status": body.status,
        "notes": body.notes,
    }.items() if v is not None}
    await _handle_temporal(db, EmployeeDocumentIndex, tenant_id, employee_id, body, user.id, data)
    return {"ok": True}


@router.put("/employees/{employee_id}/certifications")
async def update_certifications(
    employee_id: uuid.UUID,
    tenant_id: uuid.UUID,
    body: CertificationActionBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "edit")),
):
    await _get_employee_or_404(db, employee_id, tenant_id)
    data = {k: v for k, v in {
        "certification_type": body.certification_type,
        "issuer": body.issuer,
        "issued_on": body.issued_on,
        "expires_on": body.expires_on,
        "status": body.status,
        "notes": body.notes,
    }.items() if v is not None}
    await _handle_temporal(db, EmployeeCertification, tenant_id, employee_id, body, user.id, data)
    return {"ok": True}


@router.put("/employees/{employee_id}/courses")
async def update_courses(
    employee_id: uuid.UUID,
    tenant_id: uuid.UUID,
    body: CourseActionBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "edit")),
):
    await _get_employee_or_404(db, employee_id, tenant_id)
    data = {k: v for k, v in {
        "course_name": body.course_name,
        "provider": body.provider,
        "started_on": body.started_on,
        "completed_on": body.completed_on,
        "status": body.status,
        "score": body.score,
        "notes": body.notes,
    }.items() if v is not None}
    await _handle_temporal(db, EmployeeCourse, tenant_id, employee_id, body, user.id, data)
    return {"ok": True}


@router.put("/employees/{employee_id}/work-breaks")
async def update_work_breaks(
    employee_id: uuid.UUID,
    tenant_id: uuid.UUID,
    body: WorkBreakActionBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "edit")),
):
    await _get_employee_or_404(db, employee_id, tenant_id)
    data = {k: v for k, v in {
        "break_type": body.break_type,
        "reason": body.reason,
        "started_on": body.started_on,
        "ended_on": body.ended_on,
        "approved_by": body.approved_by,
        "notes": body.notes,
    }.items() if v is not None}
    await _handle_temporal(db, EmployeeWorkBreak, tenant_id, employee_id, body, user.id, data)
    return {"ok": True}


# ── Children (append-only with update/delete) ─────────────────────────────────

@router.post("/employees/{employee_id}/children", status_code=status.HTTP_201_CREATED)
async def add_child(
    employee_id: uuid.UUID,
    tenant_id: uuid.UUID,
    body: ChildBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "edit")),
):
    await _get_employee_or_404(db, employee_id, tenant_id)
    child = EmployeeChild(
        employee_id=employee_id,
        tenant_id=tenant_id,
        child_name=body.child_name,
        last_name=body.last_name,
        birth_date=body.birth_date,
        gender=body.gender,
        legal_id_number=body.legal_id_number,
        military_service_status=body.military_service_status,
        service_start_date=body.service_start_date,
        service_end_date=body.service_end_date,
        allowance_eligible=body.allowance_eligible,
        notes=body.notes,
        created_by=user.id,
    )
    db.add(child)
    await db.commit()
    await db.refresh(child)
    return _ser_child(child)


@router.put("/employees/{employee_id}/children/{child_id}")
async def update_child(
    employee_id: uuid.UUID,
    child_id: uuid.UUID,
    tenant_id: uuid.UUID,
    body: ChildUpdateBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "edit")),
):
    await _get_employee_or_404(db, employee_id, tenant_id)
    result = await db.execute(
        select(EmployeeChild)
        .where(EmployeeChild.id == child_id)
        .where(EmployeeChild.employee_id == employee_id)
        .where(EmployeeChild.tenant_id == tenant_id)
    )
    child = result.scalar_one_or_none()
    if not child:
        raise HTTPException(status_code=404, detail={"error": "Child not found", "code": "NOT_FOUND"})

    update_data = body.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(child, field, value)
    child.updated_by = user.id
    await db.commit()
    return {"ok": True}


@router.delete("/employees/{employee_id}/children/{child_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_child(
    employee_id: uuid.UUID,
    child_id: uuid.UUID,
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "edit")),
):
    await _get_employee_or_404(db, employee_id, tenant_id)
    result = await db.execute(
        select(EmployeeChild)
        .where(EmployeeChild.id == child_id)
        .where(EmployeeChild.employee_id == employee_id)
        .where(EmployeeChild.tenant_id == tenant_id)
    )
    child = result.scalar_one_or_none()
    if not child:
        raise HTTPException(status_code=404, detail={"error": "Child not found", "code": "NOT_FOUND"})
    await db.delete(child)
    await db.commit()


# ── Awards (append-only with update/delete) ───────────────────────────────────

@router.post("/employees/{employee_id}/awards", status_code=status.HTTP_201_CREATED)
async def add_award(
    employee_id: uuid.UUID,
    tenant_id: uuid.UUID,
    body: AwardBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "edit")),
):
    await _get_employee_or_404(db, employee_id, tenant_id)
    award = EmployeeAward(
        employee_id=employee_id,
        tenant_id=tenant_id,
        award_type=body.award_type,
        award_date=body.award_date,
        description=body.description,
        granted_by=body.granted_by,
        notes=body.notes,
        created_by=user.id,
    )
    db.add(award)
    await db.commit()
    await db.refresh(award)
    return _ser_award(award)


@router.put("/employees/{employee_id}/awards/{award_id}")
async def update_award(
    employee_id: uuid.UUID,
    award_id: uuid.UUID,
    tenant_id: uuid.UUID,
    body: AwardUpdateBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "edit")),
):
    await _get_employee_or_404(db, employee_id, tenant_id)
    result = await db.execute(
        select(EmployeeAward)
        .where(EmployeeAward.id == award_id)
        .where(EmployeeAward.employee_id == employee_id)
        .where(EmployeeAward.tenant_id == tenant_id)
    )
    award = result.scalar_one_or_none()
    if not award:
        raise HTTPException(status_code=404, detail={"error": "Award not found", "code": "NOT_FOUND"})

    update_data = body.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(award, field, value)
    award.updated_by = user.id
    await db.commit()
    return {"ok": True}


@router.delete("/employees/{employee_id}/awards/{award_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_award(
    employee_id: uuid.UUID,
    award_id: uuid.UUID,
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "edit")),
):
    await _get_employee_or_404(db, employee_id, tenant_id)
    result = await db.execute(
        select(EmployeeAward)
        .where(EmployeeAward.id == award_id)
        .where(EmployeeAward.employee_id == employee_id)
        .where(EmployeeAward.tenant_id == tenant_id)
    )
    award = result.scalar_one_or_none()
    if not award:
        raise HTTPException(status_code=404, detail={"error": "Award not found", "code": "NOT_FOUND"})
    await db.delete(award)
    await db.commit()


# ── Skills (append-only with update/delete) ───────────────────────────────────

@router.post("/employees/{employee_id}/skills", status_code=status.HTTP_201_CREATED)
async def add_skill(
    employee_id: uuid.UUID,
    tenant_id: uuid.UUID,
    body: SkillBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "edit")),
):
    await _get_employee_or_404(db, employee_id, tenant_id)
    skill = EmployeeSkill(
        employee_id=employee_id,
        tenant_id=tenant_id,
        skill_name=body.skill_name,
        level=body.level,
        category=body.category,
        source=body.source,
        assessed_on=body.assessed_on,
        notes=body.notes,
        created_by=user.id,
    )
    db.add(skill)
    await db.commit()
    await db.refresh(skill)
    return _ser_skill(skill)


@router.put("/employees/{employee_id}/skills/{skill_id}")
async def update_skill(
    employee_id: uuid.UUID,
    skill_id: uuid.UUID,
    tenant_id: uuid.UUID,
    body: SkillUpdateBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "edit")),
):
    await _get_employee_or_404(db, employee_id, tenant_id)
    result = await db.execute(
        select(EmployeeSkill)
        .where(EmployeeSkill.id == skill_id)
        .where(EmployeeSkill.employee_id == employee_id)
        .where(EmployeeSkill.tenant_id == tenant_id)
    )
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail={"error": "Skill not found", "code": "NOT_FOUND"})

    update_data = body.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(skill, field, value)
    skill.updated_by = user.id
    await db.commit()
    return {"ok": True}


@router.delete("/employees/{employee_id}/skills/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_skill(
    employee_id: uuid.UUID,
    skill_id: uuid.UUID,
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "edit")),
):
    await _get_employee_or_404(db, employee_id, tenant_id)
    result = await db.execute(
        select(EmployeeSkill)
        .where(EmployeeSkill.id == skill_id)
        .where(EmployeeSkill.employee_id == employee_id)
        .where(EmployeeSkill.tenant_id == tenant_id)
    )
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail={"error": "Skill not found", "code": "NOT_FOUND"})
    await db.delete(skill)
    await db.commit()


# ── Events and training ────────────────────────────────────────────────────────

@router.post("/employees/{employee_id}/events/log", status_code=status.HTTP_201_CREATED)
async def add_event_log(
    employee_id: uuid.UUID,
    tenant_id: uuid.UUID,
    body: EventBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "edit")),
):
    await _get_employee_or_404(db, employee_id, tenant_id)
    ev = EmploymentEvent(
        employee_id=employee_id,
        tenant_id=tenant_id,
        event_type=body.event_type,
        effective_date=body.effective_date,
        notes=body.notes,
        created_by=user.id,
    )
    db.add(ev)
    await db.commit()
    return {"ok": True}


@router.delete("/employees/{employee_id}/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    employee_id: uuid.UUID,
    event_id: uuid.UUID,
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "edit")),
):
    await _get_employee_or_404(db, employee_id, tenant_id)
    result = await db.execute(
        select(EmploymentEvent)
        .where(EmploymentEvent.id == event_id)
        .where(EmploymentEvent.employee_id == employee_id)
        .where(EmploymentEvent.tenant_id == tenant_id)
    )
    ev = result.scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=404, detail={"error": "Event not found", "code": "NOT_FOUND"})
    await db.delete(ev)
    await db.commit()


@router.post("/employees/{employee_id}/training", status_code=status.HTTP_201_CREATED)
async def add_training(
    employee_id: uuid.UUID,
    tenant_id: uuid.UUID,
    body: TrainingBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "edit")),
):
    await _get_employee_or_404(db, employee_id, tenant_id)
    tr = EmployeeTraining(
        employee_id=employee_id,
        tenant_id=tenant_id,
        course_name=body.course_name,
        course_date=body.course_date,
        score=body.score,
        institute=body.institute,
        created_by=user.id,
    )
    db.add(tr)
    await db.commit()
    return {"ok": True}


@router.delete("/employees/{employee_id}/training/{training_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_training(
    employee_id: uuid.UUID,
    training_id: uuid.UUID,
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "edit")),
):
    await _get_employee_or_404(db, employee_id, tenant_id)
    result = await db.execute(
        select(EmployeeTraining)
        .where(EmployeeTraining.id == training_id)
        .where(EmployeeTraining.employee_id == employee_id)
        .where(EmployeeTraining.tenant_id == tenant_id)
    )
    tr = result.scalar_one_or_none()
    if not tr:
        raise HTTPException(status_code=404, detail={"error": "Training record not found", "code": "NOT_FOUND"})
    await db.delete(tr)
    await db.commit()


# ── Org units & positions (for dropdowns) ─────────────────────────────────────

@router.get("/org-units")
async def list_org_units(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "view")),
):
    result = await db.execute(
        text(
            """
            SELECT id, code, name, unit_type, parent_unit_id
            FROM org_units
            WHERE tenant_id = :tenant_id
              AND valid_from <= CURRENT_DATE
              AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
            ORDER BY name
            """
        ),
        {"tenant_id": tenant_id},
    )
    return [
        {
            "id": str(row["id"]),
            "code": row["code"],
            "name": row["name"],
            "unit_type": row["unit_type"],
            "parent_id": str(row["parent_unit_id"]) if row["parent_unit_id"] else None,
        }
        for row in result.mappings().all()
    ]


@router.get("/positions")
async def list_positions(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "view")),
):
    result = await db.execute(
        text(
            """
            SELECT id, code, title
            FROM positions
            WHERE tenant_id = :tenant_id
              AND valid_from <= CURRENT_DATE
              AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
            ORDER BY title
            """
        ),
        {"tenant_id": tenant_id},
    )
    return [{"id": str(row["id"]), "code": row["code"], "name": row["title"]} for row in result.mappings().all()]
