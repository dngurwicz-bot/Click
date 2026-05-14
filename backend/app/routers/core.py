"""Core module — employee management endpoints."""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator, model_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, cast, Integer

from app.database import get_db
from app.middleware.auth import require_permission, CurrentUser
from app.models.core import (
    Employee, EmployeeIdentity, EmployeePersonal, EmployeeContact,
    EmployeeEmployment, EmployeeCompensation, EmployeeBankAccount,
    EmploymentEvent, EmployeeTraining,
    OrgUnit, Position,
)
from app.services.temporal import (
    close_and_create, get_active, get_history,
    update_in_place, delete_specific_row, close_active_row, kabiya,
)

router = APIRouter(prefix="/api/core", tags=["core"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _fmtd(d: date | None) -> str | None:
    return d.isoformat() if d else None


def _fmtdt(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


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
    company: Optional[str] = None
    employment_type: Optional[str] = None
    manager_id: Optional[uuid.UUID] = None
    start_date: Optional[date] = None
    # compensation fields
    comp_code: Optional[str] = None
    comp_name: Optional[str] = None
    amount: Optional[Decimal] = None
    percentage: Optional[Decimal] = None
    # bank fields
    payment_code: Optional[str] = None
    bank_code: Optional[str] = None
    bank_name: Optional[str] = None
    branch: Optional[str] = None
    account: Optional[str] = None
    pct_payment: Optional[Decimal] = None
    fixed_amount: Optional[Decimal] = None
    signature_date: Optional[date] = None

    @model_validator(mode="after")
    def _validate_temporal_window(self) -> "TemporalActionBody":
        if self.valid_from and self.valid_to and self.valid_to < self.valid_from:
            raise ValueError("תאריך סיום לא יכול להיות מוקדם מתאריך התחלה")
        return self


class EventBody(BaseModel):
    event_type: str
    event_date: date
    reason: Optional[str] = None
    description: Optional[str] = None


class TrainingBody(BaseModel):
    course_name: str
    course_date: Optional[date] = None
    score: Optional[str] = None
    institute: Optional[str] = None


# ── Identity row serializer ────────────────────────────────────────────────────

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
        "company": r.company,
        "employment_type": r.employment_type,
        "manager_id": str(r.manager_id) if r.manager_id else None,
        "start_date": _fmtd(r.start_date),
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
        "comp_code": r.comp_code,
        "comp_name": r.comp_name,
        "amount": float(r.amount) if r.amount is not None else None,
        "percentage": float(r.percentage) if r.percentage is not None else None,
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
        "payment_code": r.payment_code,
        "bank_code": r.bank_code,
        "bank_name": r.bank_name,
        "branch": r.branch,
        "account": r.account,
        "pct_payment": float(r.pct_payment),
        "fixed_amount": float(r.fixed_amount),
        "signature_date": _fmtd(r.signature_date),
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
        "event_date": _fmtd(r.event_date),
        "reason": r.reason,
        "description": r.description,
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
        org_names = {row.id: row.name for row in res}

    if pos_ids:
        res = await db.execute(
            select(Position.id, Position.name).where(Position.id.in_(pos_ids))
        )
        pos_names = {row.id: row.name for row in res}

    return {
        r.id: (
            org_names.get(r.org_unit_id) if r.org_unit_id else None,
            pos_names.get(r.position_id) if r.position_id else None,
        )
        for r in employment_rows
    }


# ── Generic temporal action handler ───────────────────────────────────────────

async def _handle_temporal(
    db: AsyncSession,
    model: type,
    tenant_id: uuid.UUID,
    employee_id: uuid.UUID,
    body: TemporalActionBody,
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
            # Update specific row in-place
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
    tenant_id: uuid.UUID,
    body: EmployeeCreateBody,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "edit")),
):
    actor_id = user.id

    employee_number = body.employee_number or await _next_employee_number(db, tenant_id)
    if len(employee_number) > 9:
        raise HTTPException(
            status_code=400,
            detail={"error": "מספר עובד לא יכול להכיל יותר מ-9 ספרות", "code": "BAD_EMPLOYEE_NUMBER"},
        )

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

    existing_identity = await db.execute(
        select(EmployeeIdentity.id)
        .where(EmployeeIdentity.tenant_id == tenant_id)
        .where(EmployeeIdentity.legal_id_number == body.id_number)
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
    emp.status = body.status
    db.add(emp)
    await db.flush()

    identity = EmployeeIdentity(
        employee_id=emp.id,
        tenant_id=tenant_id,
        first_name=body.first_name,
        last_name=body.last_name,
        id_number=body.id_number,
        gender=body.gender,
        valid_from=date.today(),
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
    extra = {"employee_id": employee_id}

    # Load all temporal histories
    identity_rows = await get_history(db, EmployeeIdentity, tenant_id, extra)
    personal_rows = await get_history(db, EmployeePersonal, tenant_id, extra)
    contact_rows = await get_history(db, EmployeeContact, tenant_id, extra)
    employment_rows = await get_history(db, EmployeeEmployment, tenant_id, extra)
    compensation_rows = await get_history(db, EmployeeCompensation, tenant_id, extra)
    bank_rows = await get_history(db, EmployeeBankAccount, tenant_id, extra)

    # Non-temporal
    events_result = await db.execute(
        select(EmploymentEvent)
        .where(EmploymentEvent.employee_id == employee_id)
        .order_by(EmploymentEvent.event_date.desc())
    )
    events = list(events_result.scalars().all())

    training_result = await db.execute(
        select(EmployeeTraining)
        .where(EmployeeTraining.employee_id == employee_id)
        .order_by(EmployeeTraining.course_date.desc())
    )
    trainings = list(training_result.scalars().all())

    # Resolve org/position names for employment rows
    emp_names = await _resolve_org_pos_names(db, tenant_id, employment_rows)

    # Active identity for header
    active_ident = next((r for r in identity_rows if r.valid_to is None), None)

    return {
        "id": str(emp.id),
        "employee_number": emp.employee_number,
        "status": emp.status,
        "photo_url": emp.photo_url,
        "full_name": f"{active_ident.first_name} {active_ident.last_name}" if active_ident else "—",
        "id_number": active_ident.id_number if active_ident else None,
        "created_at": _fmtdt(emp.created_at),
        "identity": [_ser_identity(r) for r in identity_rows],
        "personal": [_ser_personal(r) for r in personal_rows],
        "contact": [_ser_contact(r) for r in contact_rows],
        "employment": [
            _ser_employment(r, emp_names.get(r.id, (None, None))[0], emp_names.get(r.id, (None, None))[1])
            for r in employment_rows
        ],
        "compensation": [_ser_compensation(r) for r in compensation_rows],
        "bank": [_ser_bank(r) for r in bank_rows],
        "events": [_ser_event(r) for r in events],
        "training": [_ser_training(r) for r in trainings],
    }


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

    # Employees may be referenced as managers in other employment rows.
    await db.execute(
        update(EmployeeEmployment)
        .where(EmployeeEmployment.tenant_id == tenant_id)
        .where(EmployeeEmployment.manager_id == employee.id)
        .values(manager_id=None)
        .execution_options(synchronize_session=False)
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
        "company": body.company,
        "employment_type": body.employment_type,
        "manager_id": body.manager_id,
        "start_date": body.start_date,
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
        "comp_code": body.comp_code,
        "comp_name": body.comp_name,
        "amount": body.amount,
        "percentage": body.percentage,
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
        "payment_code": body.payment_code,
        "bank_code": body.bank_code,
        "bank_name": body.bank_name,
        "branch": body.branch,
        "account": body.account,
        "pct_payment": body.pct_payment,
        "fixed_amount": body.fixed_amount,
        "signature_date": body.signature_date,
    }.items() if v is not None}
    await _handle_temporal(db, EmployeeBankAccount, tenant_id, employee_id, body, user.id, data)
    return {"ok": True}


@router.post("/employees/{employee_id}/events", status_code=status.HTTP_201_CREATED)
async def add_event(
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
        event_date=body.event_date,
        reason=body.reason,
        description=body.description,
        created_by=user.id,
    )
    db.add(ev)
    await db.commit()
    return {"ok": True}


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


# ── Org units & positions (for dropdowns) ─────────────────────────────────────

@router.get("/org-units")
async def list_org_units(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "view")),
):
    today = date.today()
    result = await db.execute(
        select(OrgUnit)
        .where(OrgUnit.tenant_id == tenant_id)
        .where(OrgUnit.valid_from <= today)
        .where((OrgUnit.valid_to.is_(None)) | (OrgUnit.valid_to >= today))
        .order_by(OrgUnit.name)
    )
    return [{"id": str(r.id), "code": r.code, "name": r.name, "unit_type": r.unit_type} for r in result.scalars()]


@router.get("/positions")
async def list_positions(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_permission("core", "view")),
):
    today = date.today()
    result = await db.execute(
        select(Position)
        .where(Position.tenant_id == tenant_id)
        .where(Position.valid_from <= today)
        .where((Position.valid_to.is_(None)) | (Position.valid_to >= today))
        .order_by(Position.name)
    )
    return [{"id": str(r.id), "code": r.code, "name": r.name} for r in result.scalars()]
