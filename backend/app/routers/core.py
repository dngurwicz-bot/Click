from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser, require_permission
from app.models import Tenant
from app.models.tenant import TenantOrgStructureConfig
from app.models.core import (
    EmployeeAward,
    EmployeeBankAccount,
    EmployeeChild,
    Employee,
    EmployeeCertification,
    EmployeeCompensation,
    EmployeeCourse,
    EmployeeDocumentIndex,
    EmployeeEmployment,
    EmployeeIdentity,
    EmployeeSkill,
    EmployeeWorkBreak,
    EmploymentEvent,
    OrgUnit,
    Position,
)
from app.schemas.core import (
    DepartmentMovementOut,
    EmployeeAwardCreate,
    EmployeeAwardOut,
    EmployeeAwardUpdate,
    EmployeeBankAccountActionBody,
    EmployeeBankAccountCreate,
    EmployeeBankAccountOut,
    EmployeeChildCreate,
    EmployeeChildOut,
    EmployeeChildUpdate,
    EmployeeCertificationActionBody,
    EmployeeCertificationCreate,
    EmployeeCertificationOut,
    EmployeeCompensationOut,
    EmployeeCompensationActionBody,
    EmployeeCreate,
    EmployeeCourseActionBody,
    EmployeeCourseCreate,
    EmployeeCourseOut,
    EmployeeDocumentActionBody,
    EmployeeDetailOut,
    EmployeeDocumentIn,
    EmployeeDocumentOut,
    EmployeeEmploymentOut,
    EmployeeEmploymentActionBody,
    EmployeeIdentityOut,
    EmployeeIdentityActionBody,
    EmployeeOut,
    EmployeeSkillCreate,
    EmployeeSkillOut,
    EmployeeSkillUpdate,
    EmployeeWorkBreakActionBody,
    EmployeeWorkBreakCreate,
    EmployeeWorkBreakOut,
    EmploymentEventIn,
    EmploymentEventOut,
    OrgUnitCreate,
    OrgUnitActionBody,
    OrgUnitOut,
    PositionHistoryOut,
    PositionActionBody,
    PositionCreate,
    PositionOut,
    TeamMemberOut,
)
from app.services.core import (
    next_three_digit_code,
    redact_bank_account_sensitive,
    redact_compensation_sensitive,
    redact_identity_sensitive,
    would_create_manager_cycle,
)
from app.services.tenant_org_structure import (
    DEFAULT_ORG_STRUCTURE_LEVELS,
    get_expected_parent_level,
    resolve_optional_position_attachment_level,
    resolve_position_attachment_level,
    sanitize_org_structure_levels,
)
from app.services.temporal import kabiya, close_active_row, close_and_create, delete_specific_row, get_active, get_history, update_in_place

router = APIRouter(prefix="/api/core", tags=["core"])


async def _ensure_tenant_exists(db: AsyncSession, tenant_id: uuid.UUID) -> None:
    tenant = await db.execute(select(Tenant).where(Tenant.tenant_id == tenant_id))
    if tenant.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail={"error": "Tenant not found", "code": "TENANT_NOT_FOUND"})


async def _load_tenant_org_structure(db: AsyncSession, tenant_id: uuid.UUID, *, as_of: date | None = None) -> dict:
    if hasattr(db, "execute_results"):
        row = None
    else:
        try:
            row = await get_active(db, TenantOrgStructureConfig, tenant_id, as_of=as_of)
        except Exception:
            row = None
    levels = sanitize_org_structure_levels(list(getattr(row, "levels", []) or DEFAULT_ORG_STRUCTURE_LEVELS))
    return {
        "levels": levels,
        "position_attachment_level": (
            resolve_optional_position_attachment_level(levels, getattr(row, "position_attachment_level", None))
            if row is not None
            else resolve_position_attachment_level(levels, None)
        ),
        "is_hierarchical": bool(getattr(row, "is_hierarchical", True)) if row is not None else True,
    }


async def _ensure_employee(db: AsyncSession, employee_id: uuid.UUID) -> Employee:
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = result.scalar_one_or_none()
    if employee is None:
        raise HTTPException(status_code=404, detail={"error": "Employee not found", "code": "EMPLOYEE_NOT_FOUND"})
    return employee


async def _ensure_org_unit(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    org_unit_id: uuid.UUID | None,
    *,
    as_of: date | None = None,
) -> OrgUnit | None:
    if org_unit_id is None:
        return None
    unit = await get_active(db, OrgUnit, tenant_id, extra_filters={"id": org_unit_id}, as_of=as_of)
    if unit is None:
        raise HTTPException(status_code=422, detail={"error": "Org unit not found", "code": "ORG_UNIT_NOT_FOUND"})
    return unit


async def _ensure_position(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    position_id: uuid.UUID | None,
    *,
    as_of: date | None = None,
) -> None:
    if position_id is None:
        return
    position = await get_active(db, Position, tenant_id, extra_filters={"id": position_id}, as_of=as_of)
    if position is None:
        raise HTTPException(status_code=422, detail={"error": "Position not found", "code": "POSITION_NOT_FOUND"})


async def _generate_next_org_unit_code(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    unit_type: str,
) -> str:
    result = await db.execute(
        select(OrgUnit.code)
        .where(OrgUnit.tenant_id == tenant_id)
        .where(OrgUnit.unit_type == unit_type)
    )
    return next_three_digit_code(list(result.scalars().all()))


async def _generate_next_position_code(
    db: AsyncSession,
    tenant_id: uuid.UUID,
) -> str:
    result = await db.execute(
        select(Position.code).where(Position.tenant_id == tenant_id)
    )
    return next_three_digit_code(list(result.scalars().all()))


async def _validate_org_unit_hierarchy(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    tenant_structure: dict,
    unit_type: str,
    parent_unit_id: uuid.UUID | None,
    *,
    as_of: date | None = None,
) -> OrgUnit | None:
    levels = tenant_structure["levels"]
    if unit_type not in levels:
        raise HTTPException(
            status_code=422,
            detail={"error": "This org level is not enabled for the tenant", "code": "UNIT_TYPE_DISABLED"},
        )
    expected_parent_type = get_expected_parent_level(
        levels,
        unit_type,
        is_hierarchical=tenant_structure["is_hierarchical"],
    )
    parent = await _ensure_org_unit(db, tenant_id, parent_unit_id, as_of=as_of)

    if expected_parent_type is None:
        if tenant_structure["is_hierarchical"] and unit_type == levels[0] and parent is not None:
            raise HTTPException(
                status_code=422,
                detail={"error": "Top hierarchy level cannot have a parent unit", "code": "INVALID_PARENT_UNIT"},
            )
        return None

    if parent is None:
        raise HTTPException(
            status_code=422,
            detail={"error": "Parent unit is required for this hierarchy level", "code": "PARENT_UNIT_REQUIRED"},
        )
    if parent.unit_type != expected_parent_type:
        raise HTTPException(
            status_code=422,
            detail={
                "error": f"Parent unit must be of type {expected_parent_type}",
                "code": "INVALID_PARENT_UNIT_TYPE",
            },
        )
    return parent


async def _validate_position_attachment(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    tenant_structure: dict,
    org_unit_id: uuid.UUID | None,
    *,
    as_of: date | None = None,
) -> OrgUnit | None:
    expected_level = tenant_structure["position_attachment_level"]
    if expected_level is None:
        if org_unit_id is not None:
            raise HTTPException(
                status_code=422,
                detail={"error": "Position is configured without org hierarchy attachment", "code": "POSITION_ATTACHMENT_DISABLED"},
            )
        return None
    if org_unit_id is None:
        raise HTTPException(
            status_code=422,
            detail={"error": "Position must belong to an org unit", "code": "ORG_UNIT_REQUIRED"},
        )
    org_unit = await _ensure_org_unit(db, tenant_id, org_unit_id, as_of=as_of)
    if org_unit is None:
        raise HTTPException(status_code=422, detail={"error": "Org unit not found", "code": "ORG_UNIT_NOT_FOUND"})
    if org_unit.unit_type != expected_level:
        raise HTTPException(
            status_code=422,
            detail={
                "error": f"Position must be attached to {expected_level}",
                "code": "INVALID_POSITION_ATTACHMENT_LEVEL",
            },
        )
    return org_unit


def _org_unit_field_values(body: OrgUnitActionBody, anchor: OrgUnit) -> dict:
    return {
        "parent_unit_id": body.parent_unit_id if body.parent_unit_id is not None else anchor.parent_unit_id,
        "manager_employee_id": (
            None
            if body.clear_manager_employee_id
            else body.manager_employee_id if body.manager_employee_id is not None else anchor.manager_employee_id
        ),
        "unit_type": body.unit_type if body.unit_type is not None else anchor.unit_type,
        "name": body.name if body.name is not None else anchor.name,
        "description": body.description if body.description is not None else anchor.description,
        "is_active": body.is_active if body.is_active is not None else anchor.is_active,
        "code": anchor.code,
    }


def _position_field_values(body: PositionActionBody, anchor: Position) -> dict:
    return {
        "org_unit_id": body.org_unit_id if body.org_unit_id is not None else anchor.org_unit_id,
        "title": body.title if body.title is not None else anchor.title,
        "description": body.description if body.description is not None else anchor.description,
        "employment_type_default": (
            body.employment_type_default if body.employment_type_default is not None else anchor.employment_type_default
        ),
        "is_managerial": body.is_managerial if body.is_managerial is not None else anchor.is_managerial,
        "is_active": body.is_active if body.is_active is not None else anchor.is_active,
        "code": anchor.code,
    }


async def _validate_manager_assignment(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    employee_id: uuid.UUID,
    manager_employee_id: uuid.UUID | None,
) -> None:
    if manager_employee_id is None:
        return

    manager = await db.execute(
        select(Employee).where(Employee.id == manager_employee_id).where(Employee.tenant_id == tenant_id)
    )
    if manager.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=422,
            detail={"error": "Manager employee not found in tenant", "code": "MANAGER_NOT_FOUND"},
        )

    result = await db.execute(
        select(EmployeeEmployment.employee_id, EmployeeEmployment.manager_employee_id)
        .where(EmployeeEmployment.tenant_id == tenant_id)
        .where(EmployeeEmployment.valid_to.is_(None))
    )
    manager_map = {employee: manager for employee, manager in result.all()}
    if would_create_manager_cycle(manager_map, employee_id, manager_employee_id):
        raise HTTPException(
            status_code=422,
            detail={"error": "Manager assignment creates a cycle", "code": "MANAGER_CYCLE"},
        )


async def _validate_org_unit_manager(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    manager_employee_id: uuid.UUID | None,
) -> None:
    if manager_employee_id is None:
        return
    manager = await db.execute(
        select(Employee).where(Employee.id == manager_employee_id).where(Employee.tenant_id == tenant_id)
    )
    if manager.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=422,
            detail={"error": "Org unit manager not found in tenant", "code": "ORG_UNIT_MANAGER_NOT_FOUND"},
        )


async def _employee_exists_for_number(db: AsyncSession, tenant_id: uuid.UUID, employee_number: str) -> bool:
    result = await db.execute(
        select(Employee)
        .where(Employee.tenant_id == tenant_id)
        .where(Employee.employee_number == employee_number)
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def _identity_duplicate_exists(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    legal_id_number: str | None,
    exclude_employee_id: uuid.UUID | None = None,
) -> bool:
    if not legal_id_number:
        return False
    stmt = (
        select(EmployeeIdentity)
        .where(EmployeeIdentity.tenant_id == tenant_id)
        .where(EmployeeIdentity.legal_id_number == legal_id_number)
        .where(EmployeeIdentity.valid_to.is_(None))
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()
    for row in rows:
        if exclude_employee_id is None or row.employee_id != exclude_employee_id:
            return True
    return False


async def _org_unit_name(db: AsyncSession, tenant_id: uuid.UUID, org_unit_id: uuid.UUID | None, as_of: date | None = None) -> str | None:
    if org_unit_id is None:
        return None
    unit = await get_active(db, OrgUnit, tenant_id, extra_filters={"id": org_unit_id}, as_of=as_of)
    return unit.name if unit else None


async def _position_title(db: AsyncSession, tenant_id: uuid.UUID, position_id: uuid.UUID | None, as_of: date | None = None) -> str | None:
    if position_id is None:
        return None
    position = await get_active(db, Position, tenant_id, extra_filters={"id": position_id}, as_of=as_of)
    return position.title if position else None


async def _manager_name(db: AsyncSession, tenant_id: uuid.UUID, manager_employee_id: uuid.UUID | None, as_of: date | None = None) -> str | None:
    if manager_employee_id is None:
        return None
    identity = await get_active(db, EmployeeIdentity, tenant_id, extra_filters={"employee_id": manager_employee_id}, as_of=as_of)
    if identity is None:
        return None
    return f"{identity.first_name} {identity.last_name}".strip()


async def _serialize_org_unit(
    db: AsyncSession,
    row: OrgUnit,
) -> OrgUnitOut:
    item = OrgUnitOut.model_validate(row)
    item.parent_unit_name = await _org_unit_name(db, row.tenant_id, row.parent_unit_id, row.valid_from)
    item.manager_name = await _manager_name(db, row.tenant_id, row.manager_employee_id, row.valid_from)
    return item


async def _serialize_employment(
    db: AsyncSession,
    row: EmployeeEmployment,
) -> EmployeeEmploymentOut:
    item = EmployeeEmploymentOut.model_validate(row)
    item.org_unit_name = await _org_unit_name(db, row.tenant_id, row.org_unit_id, row.valid_from)
    item.position_title = await _position_title(db, row.tenant_id, row.position_id, row.valid_from)
    item.manager_name = await _manager_name(db, row.tenant_id, row.manager_employee_id, row.valid_from)
    return item


async def _serialize_employee_row(db: AsyncSession, employee: Employee) -> EmployeeOut:
    identity = await get_active(db, EmployeeIdentity, employee.tenant_id, extra_filters={"employee_id": employee.id})
    employment = await get_active(db, EmployeeEmployment, employee.tenant_id, extra_filters={"employee_id": employee.id})

    return EmployeeOut(
        id=employee.id,
        tenant_id=employee.tenant_id,
        employee_number=employee.employee_number,
        external_ref=employee.external_ref,
        is_active=employee.is_active,
        full_name=(f"{identity.first_name} {identity.last_name}".strip() if identity else employee.employee_number),
        email=identity.email if identity else None,
        phone=identity.phone if identity else None,
        employment_status=employment.employment_status if employment else None,
        employment_type=employment.employment_type if employment else None,
        start_date=employment.start_date if employment else None,
        end_date=employment.end_date if employment else None,
        org_unit_name=(await _org_unit_name(db, employee.tenant_id, employment.org_unit_id) if employment else None),
        manager_name=(await _manager_name(db, employee.tenant_id, employment.manager_employee_id) if employment else None),
        position_title=(await _position_title(db, employee.tenant_id, employment.position_id) if employment else None),
        branch_name=employment.branch_name if employment else None,
        work_site=employment.work_site if employment else None,
    )


def _require_sensitive_access(current_user: CurrentUser) -> bool:
    return current_user.is_super_admin() or current_user.can_manage_sensitive("core")


def _request_contains_sensitive_write(
    legal_id_number: str | None,
    spouse_legal_id: str | None,
    bank_name: str | None,
    bank_branch: str | None,
    bank_account: str | None,
    compensation_present: bool,
) -> bool:
    return any([legal_id_number, spouse_legal_id, bank_name, bank_branch, bank_account, compensation_present])


async def _ensure_employee_child(db: AsyncSession, employee: Employee, child_id: uuid.UUID) -> EmployeeChild:
    result = await db.execute(
        select(EmployeeChild)
        .where(EmployeeChild.id == child_id)
        .where(EmployeeChild.employee_id == employee.id)
        .where(EmployeeChild.tenant_id == employee.tenant_id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail={"error": "Employee child not found", "code": "CHILD_NOT_FOUND"})
    return row


async def _ensure_employee_award(db: AsyncSession, employee: Employee, award_id: uuid.UUID) -> EmployeeAward:
    result = await db.execute(
        select(EmployeeAward)
        .where(EmployeeAward.id == award_id)
        .where(EmployeeAward.employee_id == employee.id)
        .where(EmployeeAward.tenant_id == employee.tenant_id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail={"error": "Employee award not found", "code": "AWARD_NOT_FOUND"})
    return row


async def _ensure_employee_skill(db: AsyncSession, employee: Employee, skill_id: uuid.UUID) -> EmployeeSkill:
    result = await db.execute(
        select(EmployeeSkill)
        .where(EmployeeSkill.id == skill_id)
        .where(EmployeeSkill.employee_id == employee.id)
        .where(EmployeeSkill.tenant_id == employee.tenant_id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail={"error": "Employee skill not found", "code": "SKILL_NOT_FOUND"})
    return row


async def _ensure_temporal_employee_row(
    db: AsyncSession,
    model,
    employee: Employee,
    row_id: uuid.UUID,
    not_found_code: str,
):
    result = await db.execute(
        select(model)
        .where(model.id == row_id)
        .where(model.employee_id == employee.id)
        .where(model.tenant_id == employee.tenant_id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail={"error": "Employee record not found", "code": not_found_code})
    return row


def _merge_temporal_fields(anchor, payload: dict[str, object | None], *, field_names: list[str]) -> dict[str, object | None]:
    merged: dict[str, object | None] = {}
    for field_name in field_names:
        value = payload.get(field_name, None)
        merged[field_name] = value if value is not None else getattr(anchor, field_name)
    return merged


async def _serialize_bank_account(row: EmployeeBankAccount, can_manage_sensitive: bool) -> EmployeeBankAccountOut:
    item = EmployeeBankAccountOut.model_validate(row)
    return EmployeeBankAccountOut.model_validate(
        redact_bank_account_sensitive(item.model_dump(), can_manage_sensitive)
    )


def _build_department_movements(rows: list[EmployeeEmploymentOut]) -> list[DepartmentMovementOut]:
    ordered = sorted(rows, key=lambda row: row.valid_from)
    items: list[DepartmentMovementOut] = []
    previous: EmployeeEmploymentOut | None = None
    for row in ordered:
        if previous is not None and previous.org_unit_name != row.org_unit_name:
            items.append(
                DepartmentMovementOut(
                    effective_date=row.valid_from,
                    previous_org_unit_name=previous.org_unit_name,
                    next_org_unit_name=row.org_unit_name,
                    position_title=row.position_title,
                    employment_status=row.employment_status,
                )
            )
        previous = row
    return list(reversed(items))


def _build_position_history(rows: list[EmployeeEmploymentOut]) -> list[PositionHistoryOut]:
    ordered = sorted(rows, key=lambda row: row.valid_from, reverse=True)
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
        for row in ordered
    ]


async def _load_team_members(db: AsyncSession, employee: Employee) -> list[TeamMemberOut]:
    result = await db.execute(
        select(EmployeeEmployment)
        .where(EmployeeEmployment.tenant_id == employee.tenant_id)
        .where(EmployeeEmployment.manager_employee_id == employee.id)
        .where(EmployeeEmployment.valid_to.is_(None))
        .order_by(EmployeeEmployment.start_date.asc())
    )
    employments = result.scalars().all()
    items: list[TeamMemberOut] = []
    for employment in employments:
        member = await _ensure_employee(db, employment.employee_id)
        identity = await get_active(db, EmployeeIdentity, employee.tenant_id, extra_filters={"employee_id": member.id})
        items.append(
            TeamMemberOut(
                employee_id=member.id,
                employee_number=member.employee_number,
                full_name=(f"{identity.first_name} {identity.last_name}".strip() if identity else member.employee_number),
                employment_status=employment.employment_status,
                org_unit_name=await _org_unit_name(db, employee.tenant_id, employment.org_unit_id, employment.valid_from),
                position_title=await _position_title(db, employee.tenant_id, employment.position_id, employment.valid_from),
                start_date=employment.start_date,
            )
        )
    return items


async def _record_action_for_current_row(
    db: AsyncSession,
    model,
    employee: Employee,
    anchor,
    current_user: CurrentUser,
    action: str,
    merged: dict[str, object | None],
    valid_from: date | None,
    valid_to: date | None,
    *,
    not_found_code: str,
):
    if anchor is None:
        raise HTTPException(status_code=404, detail={"error": "Employee record not found", "code": not_found_code})

    if action == "delete":
        await delete_specific_row(
            db, model, employee.tenant_id, anchor.valid_from, {"id": anchor.id, "employee_id": employee.id}
        )
        return {"ok": True, "action": "delete"}

    if action == "close":
        if not valid_to:
            raise HTTPException(status_code=422, detail={"error": "valid_to is required", "code": "MISSING_DATE"})
        await update_in_place(
            db,
            model,
            employee.tenant_id,
            {},
            current_user.id,
            target_valid_from=anchor.valid_from,
            new_valid_to=valid_to,
            extra_filters={"id": anchor.id, "employee_id": employee.id},
        )
        refreshed = await _ensure_temporal_employee_row(db, model, employee, anchor.id, not_found_code)
        return refreshed

    if not valid_from:
        raise HTTPException(status_code=422, detail={"error": "valid_from is required", "code": "MISSING_DATE"})

    if action == "set":
        return await kabiya(
            db,
            model,
            employee.tenant_id,
            {"employee_id": employee.id, **merged},
            current_user.id,
            new_valid_from=valid_from,
            new_valid_to=valid_to,
            extra_filters={"employee_id": employee.id},
        )

    if action == "add":
        return await close_and_create(
            db,
            model,
            employee.tenant_id,
            {"employee_id": employee.id, **merged},
            current_user.id,
            new_valid_from=valid_from,
            new_valid_to=valid_to,
            extra_filters={"employee_id": employee.id},
        )

    if valid_from == anchor.valid_from:
        await update_in_place(
            db,
            model,
            employee.tenant_id,
            merged,
            current_user.id,
            target_valid_from=anchor.valid_from,
            new_valid_to=valid_to,
            extra_filters={"id": anchor.id, "employee_id": employee.id},
        )
        refreshed = await _ensure_temporal_employee_row(db, model, employee, anchor.id, not_found_code)
        return refreshed

    return await close_and_create(
        db,
        model,
        employee.tenant_id,
        {"employee_id": employee.id, **merged},
        current_user.id,
        new_valid_from=valid_from,
        new_valid_to=valid_to,
        extra_filters={"employee_id": employee.id},
    )


@router.get("/employees", response_model=list[EmployeeOut])
async def list_employees(
    tenant_id: uuid.UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("core", "view")),
):
    await _ensure_tenant_exists(db, tenant_id)
    result = await db.execute(
        select(Employee)
        .where(Employee.tenant_id == tenant_id)
        .order_by(Employee.employee_number.asc())
    )
    employees = result.scalars().all()
    return [await _serialize_employee_row(db, employee) for employee in employees]


@router.post("/employees", response_model=EmployeeOut, status_code=201)
async def create_employee(
    body: EmployeeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("core", "edit")),
):
    if _request_contains_sensitive_write(
        body.identity.legal_id_number,
        body.identity.spouse_legal_id,
        body.identity.bank_name,
        body.identity.bank_branch,
        body.identity.bank_account,
        body.compensation is not None,
    ) and not _require_sensitive_access(current_user):
        raise HTTPException(
            status_code=403,
            detail={"error": "Sensitive employee fields require additional permission", "code": "FORBIDDEN"},
        )

    await _ensure_tenant_exists(db, body.tenant_id)
    await _ensure_org_unit(db, body.tenant_id, body.employment.org_unit_id, as_of=body.employment.start_date)
    await _ensure_position(db, body.tenant_id, body.employment.position_id, as_of=body.employment.start_date)

    if await _employee_exists_for_number(db, body.tenant_id, body.employee_number):
        raise HTTPException(
            status_code=409,
            detail={"error": "Employee number already exists", "code": "EMPLOYEE_NUMBER_EXISTS"},
        )
    if await _identity_duplicate_exists(db, body.tenant_id, body.identity.legal_id_number):
        raise HTTPException(
            status_code=409,
            detail={"error": "Employee identity already exists", "code": "DUPLICATE_LEGAL_ID"},
        )

    employee_id = uuid.uuid4()
    await _validate_manager_assignment(db, body.tenant_id, employee_id, body.employment.manager_employee_id)

    employee = Employee(
        id=employee_id,
        tenant_id=body.tenant_id,
        employee_number=body.employee_number,
        external_ref=body.external_ref,
        is_active=True,
        created_by=current_user.id,
    )
    db.add(employee)
    await db.flush()

    identity_valid_from = body.identity.valid_from or body.employment.start_date
    identity = EmployeeIdentity(
        tenant_id=body.tenant_id,
        employee_id=employee.id,
        valid_from=identity_valid_from,
        valid_to=None,
        created_by=current_user.id,
        **body.identity.model_dump(exclude={"valid_from"}),
    )
    employment = EmployeeEmployment(
        tenant_id=body.tenant_id,
        employee_id=employee.id,
        valid_from=body.employment.valid_from or body.employment.start_date,
        valid_to=None,
        created_by=current_user.id,
        **body.employment.model_dump(exclude={"valid_from"}),
    )
    db.add(identity)
    db.add(employment)

    if any([body.identity.bank_name, body.identity.bank_branch, body.identity.bank_account]):
        db.add(
            EmployeeBankAccount(
                tenant_id=body.tenant_id,
                employee_id=employee.id,
                bank_name=body.identity.bank_name,
                branch_number=body.identity.bank_branch,
                account_number=body.identity.bank_account,
                account_holder_name=f"{body.identity.first_name} {body.identity.last_name}".strip(),
                payment_method="bank_transfer",
                valid_from=body.identity.valid_from or body.employment.start_date,
                valid_to=None,
                created_by=current_user.id,
            )
        )

    if body.compensation is not None:
        db.add(
            EmployeeCompensation(
                tenant_id=body.tenant_id,
                employee_id=employee.id,
                valid_from=body.compensation.valid_from or body.employment.start_date,
                valid_to=None,
                created_by=current_user.id,
                **body.compensation.model_dump(exclude={"valid_from"}),
            )
        )

    for doc in body.documents:
        db.add(
            EmployeeDocumentIndex(
                tenant_id=body.tenant_id,
                employee_id=employee.id,
                valid_from=doc.valid_from or body.employment.start_date,
                valid_to=None,
                created_by=current_user.id,
                **doc.model_dump(exclude={"valid_from"}),
            )
        )

    db.add(
        EmploymentEvent(
            tenant_id=body.tenant_id,
            employee_id=employee.id,
            event_type="hire",
            effective_date=body.employment.start_date,
            payload_json={
                "employment_status": body.employment.employment_status,
                "employment_type": body.employment.employment_type,
            },
            notes="Initial hire event",
            created_by=current_user.id,
        )
    )

    await db.flush()
    await db.refresh(employee)
    return await _serialize_employee_row(db, employee)


@router.get("/employees/{employee_id}", response_model=EmployeeDetailOut)
async def get_employee(
    employee_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("core", "view")),
):
    employee = await _ensure_employee(db, employee_id)
    can_manage_sensitive = _require_sensitive_access(current_user)

    current_identity = await get_active(db, EmployeeIdentity, employee.tenant_id, extra_filters={"employee_id": employee.id})
    current_employment = await get_active(db, EmployeeEmployment, employee.tenant_id, extra_filters={"employee_id": employee.id})
    current_compensation = await get_active(
        db, EmployeeCompensation, employee.tenant_id, extra_filters={"employee_id": employee.id}
    )
    current_bank_account = await get_active(
        db, EmployeeBankAccount, employee.tenant_id, extra_filters={"employee_id": employee.id}
    )
    documents = await get_history(db, EmployeeDocumentIndex, employee.tenant_id, extra_filters={"employee_id": employee.id})
    children_result = await db.execute(
        select(EmployeeChild)
        .where(EmployeeChild.tenant_id == employee.tenant_id)
        .where(EmployeeChild.employee_id == employee.id)
        .order_by(EmployeeChild.birth_date.desc(), EmployeeChild.created_at.desc())
    )
    awards_result = await db.execute(
        select(EmployeeAward)
        .where(EmployeeAward.tenant_id == employee.tenant_id)
        .where(EmployeeAward.employee_id == employee.id)
        .order_by(EmployeeAward.award_date.desc(), EmployeeAward.created_at.desc())
    )
    bank_history = await get_history(
        db, EmployeeBankAccount, employee.tenant_id, extra_filters={"employee_id": employee.id}
    )
    certifications_history = await get_history(
        db, EmployeeCertification, employee.tenant_id, extra_filters={"employee_id": employee.id}
    )
    courses_history = await get_history(
        db, EmployeeCourse, employee.tenant_id, extra_filters={"employee_id": employee.id}
    )
    work_breaks_history = await get_history(
        db, EmployeeWorkBreak, employee.tenant_id, extra_filters={"employee_id": employee.id}
    )
    skills_result = await db.execute(
        select(EmployeeSkill)
        .where(EmployeeSkill.tenant_id == employee.tenant_id)
        .where(EmployeeSkill.employee_id == employee.id)
        .order_by(EmployeeSkill.assessed_on.desc(), EmployeeSkill.created_at.desc())
    )
    identity_history = await get_history(db, EmployeeIdentity, employee.tenant_id, extra_filters={"employee_id": employee.id})
    employment_history = await get_history(db, EmployeeEmployment, employee.tenant_id, extra_filters={"employee_id": employee.id})
    compensation_history = await get_history(
        db, EmployeeCompensation, employee.tenant_id, extra_filters={"employee_id": employee.id}
    )
    timeline_result = await db.execute(
        select(EmploymentEvent)
        .where(EmploymentEvent.tenant_id == employee.tenant_id)
        .where(EmploymentEvent.employee_id == employee.id)
        .order_by(EmploymentEvent.effective_date.desc(), EmploymentEvent.created_at.desc())
    )
    timeline = timeline_result.scalars().all()

    serialized_identity = EmployeeIdentityOut.model_validate(current_identity) if current_identity else None
    serialized_compensation = (
        EmployeeCompensationOut.model_validate(current_compensation) if current_compensation else None
    )
    serialized_bank_account = (
        await _serialize_bank_account(current_bank_account, can_manage_sensitive) if current_bank_account else None
    )

    if serialized_identity is not None:
        serialized_identity = EmployeeIdentityOut.model_validate(
            redact_identity_sensitive(serialized_identity.model_dump(), can_manage_sensitive)
        )
    if serialized_compensation is not None:
        serialized_compensation = EmployeeCompensationOut.model_validate(
            redact_compensation_sensitive(serialized_compensation.model_dump(), can_manage_sensitive)
        )

    identity_items: list[EmployeeIdentityOut] = []
    for row in identity_history:
        item = EmployeeIdentityOut.model_validate(row)
        item = EmployeeIdentityOut.model_validate(
            redact_identity_sensitive(item.model_dump(), can_manage_sensitive)
        )
        identity_items.append(item)

    compensation_items: list[EmployeeCompensationOut] = []
    for row in compensation_history:
        item = EmployeeCompensationOut.model_validate(row)
        item = EmployeeCompensationOut.model_validate(
            redact_compensation_sensitive(item.model_dump(), can_manage_sensitive)
        )
        compensation_items.append(item)

    employment_items = [await _serialize_employment(db, row) for row in employment_history]
    bank_items = [await _serialize_bank_account(row, can_manage_sensitive) for row in bank_history]
    certifications_items = [EmployeeCertificationOut.model_validate(row) for row in certifications_history]
    courses_items = [EmployeeCourseOut.model_validate(row) for row in courses_history]
    work_break_items = [EmployeeWorkBreakOut.model_validate(row) for row in work_breaks_history]
    team_members = await _load_team_members(db, employee)
    detail = EmployeeDetailOut(
        employee=await _serialize_employee_row(db, employee),
        current_identity=serialized_identity,
        current_employment=(await _serialize_employment(db, current_employment) if current_employment else None),
        current_compensation=serialized_compensation,
        current_bank_account=serialized_bank_account,
        documents=[EmployeeDocumentOut.model_validate(row) for row in documents],
        identity_history=identity_items,
        employment_history=employment_items,
        compensation_history=compensation_items,
        bank_accounts=bank_items,
        children=[EmployeeChildOut.model_validate(row) for row in children_result.scalars().all()],
        awards=[EmployeeAwardOut.model_validate(row) for row in awards_result.scalars().all()],
        certifications=certifications_items,
        courses=courses_items,
        skills=[EmployeeSkillOut.model_validate(row) for row in skills_result.scalars().all()],
        work_breaks=work_break_items,
        department_movements=_build_department_movements(employment_items),
        position_history=_build_position_history(employment_items),
        team_members=team_members,
        timeline=[EmploymentEventOut.model_validate(row) for row in timeline],
    )
    return detail


@router.post("/employees/{employee_id}/events", response_model=EmploymentEventOut, status_code=201)
async def create_employee_event(
    employee_id: uuid.UUID,
    body: EmploymentEventIn,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("core", "edit")),
):
    if _request_contains_sensitive_write(
        body.identity.legal_id_number if body.identity else None,
        body.identity.spouse_legal_id if body.identity else None,
        body.identity.bank_name if body.identity else None,
        body.identity.bank_branch if body.identity else None,
        body.identity.bank_account if body.identity else None,
        body.compensation is not None,
    ) and not _require_sensitive_access(current_user):
        raise HTTPException(
            status_code=403,
            detail={"error": "Sensitive employee fields require additional permission", "code": "FORBIDDEN"},
        )
    employee = await _ensure_employee(db, employee_id)

    if body.identity and await _identity_duplicate_exists(
        db, employee.tenant_id, body.identity.legal_id_number, exclude_employee_id=employee.id
    ):
        raise HTTPException(
            status_code=409,
            detail={"error": "Employee identity already exists", "code": "DUPLICATE_LEGAL_ID"},
        )

    current_employment = await get_active(
        db, EmployeeEmployment, employee.tenant_id, extra_filters={"employee_id": employee.id}
    )
    merged_employment_payload: dict | None = None
    if body.employment is not None:
        merged_employment_payload = body.employment.model_dump(exclude={"valid_from"})
        if current_employment is not None:
            merged_employment_payload["org_unit_id"] = (
                body.employment.org_unit_id if body.employment.org_unit_id is not None else current_employment.org_unit_id
            )
            merged_employment_payload["manager_employee_id"] = (
                body.employment.manager_employee_id
                if body.employment.manager_employee_id is not None
                else current_employment.manager_employee_id
            )
            merged_employment_payload["position_id"] = (
                body.employment.position_id if body.employment.position_id is not None else current_employment.position_id
            )
            merged_employment_payload["notes"] = body.employment.notes or current_employment.notes
            merged_employment_payload["work_site"] = body.employment.work_site or current_employment.work_site
        await _ensure_org_unit(
            db, employee.tenant_id, merged_employment_payload.get("org_unit_id"), as_of=body.effective_date
        )
        await _ensure_position(
            db, employee.tenant_id, merged_employment_payload.get("position_id"), as_of=body.effective_date
        )
        await _validate_manager_assignment(
            db, employee.tenant_id, employee.id, merged_employment_payload.get("manager_employee_id")
        )

    if body.identity is not None:
        await close_and_create(
            db,
            EmployeeIdentity,
            employee.tenant_id,
            {
                "employee_id": employee.id,
                **body.identity.model_dump(exclude={"valid_from"}),
            },
            current_user.id,
            new_valid_from=body.identity.valid_from or body.effective_date,
            extra_filters={"employee_id": employee.id},
        )
        if any([body.identity.bank_name, body.identity.bank_branch, body.identity.bank_account]):
            await close_and_create(
                db,
                EmployeeBankAccount,
                employee.tenant_id,
                {
                    "employee_id": employee.id,
                    "bank_name": body.identity.bank_name,
                    "branch_number": body.identity.bank_branch,
                    "account_number": body.identity.bank_account,
                    "account_holder_name": body.identity.preferred_name
                    or f"{body.identity.first_name} {body.identity.last_name}".strip(),
                    "payment_method": "bank_transfer",
                    "notes": body.notes,
                },
                current_user.id,
                new_valid_from=body.identity.valid_from or body.effective_date,
                extra_filters={"employee_id": employee.id},
            )

    if body.employment is not None:
        await close_and_create(
            db,
            EmployeeEmployment,
            employee.tenant_id,
            {
                "employee_id": employee.id,
                **(merged_employment_payload or body.employment.model_dump(exclude={"valid_from"})),
            },
            current_user.id,
            new_valid_from=body.employment.valid_from or body.effective_date,
            extra_filters={"employee_id": employee.id},
        )
    elif body.event_type in {"termination", "leave_of_absence", "return_from_leave", "status_change"} and current_employment is not None:
        employment_payload = {
            "employee_id": employee.id,
            "org_unit_id": current_employment.org_unit_id,
            "manager_employee_id": current_employment.manager_employee_id,
            "position_id": current_employment.position_id,
            "employment_status": (
                "terminated"
                if body.event_type == "termination"
                else "leave_of_absence"
                if body.event_type == "leave_of_absence"
                else "active"
            ),
            "employment_type": current_employment.employment_type,
            "salary_type": current_employment.salary_type,
            "start_date": current_employment.start_date,
            "end_date": body.effective_date if body.event_type == "termination" else current_employment.end_date,
            "employment_scope_pct": current_employment.employment_scope_pct,
            "branch_name": current_employment.branch_name,
            "work_site": current_employment.work_site,
            "time_clock_id": current_employment.time_clock_id,
            "notes": body.notes or current_employment.notes,
        }
        await close_and_create(
            db,
            EmployeeEmployment,
            employee.tenant_id,
            employment_payload,
            current_user.id,
            new_valid_from=body.effective_date,
            extra_filters={"employee_id": employee.id},
        )

    if body.compensation is not None:
        await close_and_create(
            db,
            EmployeeCompensation,
            employee.tenant_id,
            {
                "employee_id": employee.id,
                **body.compensation.model_dump(exclude={"valid_from"}),
            },
            current_user.id,
            new_valid_from=body.compensation.valid_from or body.effective_date,
            extra_filters={"employee_id": employee.id},
        )

    for doc in body.documents:
        db.add(
            EmployeeDocumentIndex(
                tenant_id=employee.tenant_id,
                employee_id=employee.id,
                valid_from=doc.valid_from or body.effective_date,
                valid_to=None,
                created_by=current_user.id,
                **doc.model_dump(exclude={"valid_from"}),
            )
        )

    if body.event_type == "termination":
        employee.is_active = False
    elif body.event_type in {"return_from_leave", "hire", "status_change"}:
        employee.is_active = True

    event = EmploymentEvent(
        tenant_id=employee.tenant_id,
        employee_id=employee.id,
        event_type=body.event_type,
        effective_date=body.effective_date,
        payload_json=body.payload_json,
        notes=body.notes,
        created_by=current_user.id,
    )
    db.add(event)
    await db.flush()
    await db.refresh(event)
    return EmploymentEventOut.model_validate(event)


@router.put("/employees/{employee_id}/identity/record", response_model=EmployeeIdentityOut | dict)
async def update_employee_identity_record(
    employee_id: uuid.UUID,
    body: EmployeeIdentityActionBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("core", "edit")),
):
    if _request_contains_sensitive_write(
        body.legal_id_number,
        body.spouse_legal_id,
        None,
        None,
        None,
        False,
    ) and not _require_sensitive_access(current_user):
        raise HTTPException(status_code=403, detail={"error": "Sensitive employee fields require additional permission", "code": "FORBIDDEN"})

    employee = await _ensure_employee(db, employee_id)
    anchor = await get_active(db, EmployeeIdentity, employee.tenant_id, extra_filters={"employee_id": employee.id})

    if body.legal_id_number and await _identity_duplicate_exists(
        db, employee.tenant_id, body.legal_id_number, exclude_employee_id=employee.id
    ):
        raise HTTPException(status_code=409, detail={"error": "Employee identity already exists", "code": "DUPLICATE_LEGAL_ID"})

    if anchor is None and body.action in {"update", "set", "close", "delete"}:
        raise HTTPException(status_code=404, detail={"error": "Employee identity not found", "code": "IDENTITY_NOT_FOUND"})

    if body.action == "add" and body.valid_from is None:
        raise HTTPException(status_code=422, detail={"error": "valid_from is required", "code": "MISSING_DATE"})

    if anchor is None and body.action == "add":
        new_row = EmployeeIdentity(
            tenant_id=employee.tenant_id,
            employee_id=employee.id,
            valid_from=body.valid_from,
            valid_to=body.valid_to,
            created_by=current_user.id,
            first_name=body.first_name or employee.employee_number,
            last_name=body.last_name or "",
            preferred_name=body.preferred_name,
            email=body.email,
            phone=body.phone,
            birth_date=body.birth_date,
            immigration_date=body.immigration_date,
            gender=body.gender,
            marital_status=body.marital_status,
            children_count=body.children_count,
            spouse_name=body.spouse_name,
            spouse_legal_id=body.spouse_legal_id,
            legal_id_type=body.legal_id_type or "national_id",
            legal_id_number=body.legal_id_number,
            nationality=body.nationality,
            address_line1=body.address_line1,
            address_line2=body.address_line2,
            city=body.city,
            postal_code=body.postal_code,
            country=body.country or "IL",
            emergency_contact_name=body.emergency_contact_name,
            emergency_contact_phone=body.emergency_contact_phone,
        )
        db.add(new_row)
        await db.flush()
        await db.refresh(new_row)
        return EmployeeIdentityOut.model_validate(
            redact_identity_sensitive(EmployeeIdentityOut.model_validate(new_row).model_dump(), _require_sensitive_access(current_user))
        )

    merged = _merge_temporal_fields(
        anchor,
        body.model_dump(exclude={"action", "valid_from", "valid_to"}, exclude_none=True),
        field_names=[
            "first_name", "last_name", "preferred_name", "email", "phone", "birth_date", "immigration_date",
            "gender", "marital_status", "children_count", "spouse_name", "spouse_legal_id", "legal_id_type",
            "legal_id_number", "nationality", "address_line1", "address_line2", "city", "postal_code", "country",
            "emergency_contact_name", "emergency_contact_phone", "bank_name", "bank_branch", "bank_account",
        ],
    )
    row = await _record_action_for_current_row(
        db, EmployeeIdentity, employee, anchor, current_user, body.action, merged, body.valid_from, body.valid_to,
        not_found_code="IDENTITY_NOT_FOUND",
    )
    if isinstance(row, dict):
        return row
    return EmployeeIdentityOut.model_validate(
        redact_identity_sensitive(EmployeeIdentityOut.model_validate(row).model_dump(), _require_sensitive_access(current_user))
    )


@router.put("/employees/{employee_id}/employment/record", response_model=EmployeeEmploymentOut | dict)
async def update_employee_employment_record(
    employee_id: uuid.UUID,
    body: EmployeeEmploymentActionBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("core", "edit")),
):
    employee = await _ensure_employee(db, employee_id)
    anchor = await get_active(db, EmployeeEmployment, employee.tenant_id, extra_filters={"employee_id": employee.id})

    if anchor is None and body.action in {"update", "set", "close", "delete"}:
        raise HTTPException(status_code=404, detail={"error": "Employee employment not found", "code": "EMPLOYMENT_NOT_FOUND"})

    if anchor is None and body.action == "add" and body.valid_from is None:
        raise HTTPException(status_code=422, detail={"error": "valid_from is required", "code": "MISSING_DATE"})

    if anchor is None and body.action == "add":
        merged = body.model_dump(exclude={"action", "valid_from", "valid_to"}, exclude_none=True)
        if "start_date" not in merged:
            raise HTTPException(status_code=422, detail={"error": "start_date is required", "code": "MISSING_FIELDS"})
        await _ensure_org_unit(db, employee.tenant_id, merged.get("org_unit_id"), as_of=body.valid_from)
        await _ensure_position(db, employee.tenant_id, merged.get("position_id"), as_of=body.valid_from)
        await _validate_manager_assignment(db, employee.tenant_id, employee.id, merged.get("manager_employee_id"))
        new_row = EmployeeEmployment(
            tenant_id=employee.tenant_id,
            employee_id=employee.id,
            valid_from=body.valid_from,
            valid_to=body.valid_to,
            created_by=current_user.id,
            **merged,
        )
        db.add(new_row)
        await db.flush()
        await db.refresh(new_row)
        return await _serialize_employment(db, new_row)

    merged = _merge_temporal_fields(
        anchor,
        body.model_dump(exclude={"action", "valid_from", "valid_to"}, exclude_none=True),
        field_names=[
            "org_unit_id", "manager_employee_id", "position_id", "employment_status", "employment_type", "salary_type",
            "start_date", "end_date", "employment_scope_pct", "branch_name", "work_site", "time_clock_id", "notes",
        ],
    )
    await _ensure_org_unit(db, employee.tenant_id, merged.get("org_unit_id"), as_of=body.valid_from or anchor.valid_from)
    await _ensure_position(db, employee.tenant_id, merged.get("position_id"), as_of=body.valid_from or anchor.valid_from)
    await _validate_manager_assignment(db, employee.tenant_id, employee.id, merged.get("manager_employee_id"))
    row = await _record_action_for_current_row(
        db, EmployeeEmployment, employee, anchor, current_user, body.action, merged, body.valid_from, body.valid_to,
        not_found_code="EMPLOYMENT_NOT_FOUND",
    )
    if isinstance(row, dict):
        return row
    return await _serialize_employment(db, row)


@router.put("/employees/{employee_id}/compensation/record", response_model=EmployeeCompensationOut | dict)
async def update_employee_compensation_record(
    employee_id: uuid.UUID,
    body: EmployeeCompensationActionBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("core", "edit")),
):
    if not _require_sensitive_access(current_user):
        raise HTTPException(status_code=403, detail={"error": "Sensitive employee fields require additional permission", "code": "FORBIDDEN"})

    employee = await _ensure_employee(db, employee_id)
    anchor = await get_active(db, EmployeeCompensation, employee.tenant_id, extra_filters={"employee_id": employee.id})

    if anchor is None and body.action in {"update", "set", "close", "delete"}:
        raise HTTPException(status_code=404, detail={"error": "Employee compensation not found", "code": "COMPENSATION_NOT_FOUND"})

    if anchor is None and body.action == "add":
        if body.valid_from is None or body.base_salary is None:
            raise HTTPException(status_code=422, detail={"error": "valid_from and base_salary are required", "code": "MISSING_FIELDS"})
        new_row = EmployeeCompensation(
            tenant_id=employee.tenant_id,
            employee_id=employee.id,
            valid_from=body.valid_from,
            valid_to=body.valid_to,
            created_by=current_user.id,
            base_salary=body.base_salary,
            currency=body.currency or "ILS",
            pay_cycle=body.pay_cycle or "monthly",
            cost_center=body.cost_center,
            components_json=body.components_json,
        )
        db.add(new_row)
        await db.flush()
        await db.refresh(new_row)
        return EmployeeCompensationOut.model_validate(new_row)

    merged = _merge_temporal_fields(
        anchor,
        body.model_dump(exclude={"action", "valid_from", "valid_to"}, exclude_none=True),
        field_names=["base_salary", "currency", "pay_cycle", "cost_center", "components_json"],
    )
    row = await _record_action_for_current_row(
        db, EmployeeCompensation, employee, anchor, current_user, body.action, merged, body.valid_from, body.valid_to,
        not_found_code="COMPENSATION_NOT_FOUND",
    )
    if isinstance(row, dict):
        return row
    return EmployeeCompensationOut.model_validate(row)


@router.post("/employees/{employee_id}/children", response_model=EmployeeChildOut, status_code=201)
async def create_employee_child(
    employee_id: uuid.UUID,
    body: EmployeeChildCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("core", "edit")),
):
    employee = await _ensure_employee(db, employee_id)
    row = EmployeeChild(
        tenant_id=employee.tenant_id,
        employee_id=employee.id,
        created_by=current_user.id,
        **body.model_dump(),
    )
    db.add(row)
    await db.flush()
    await db.refresh(row)
    return EmployeeChildOut.model_validate(row)


@router.put("/employees/{employee_id}/children/{child_id}", response_model=EmployeeChildOut)
async def update_employee_child(
    employee_id: uuid.UUID,
    child_id: uuid.UUID,
    body: EmployeeChildUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("core", "edit")),
):
    employee = await _ensure_employee(db, employee_id)
    row = await _ensure_employee_child(db, employee, child_id)
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(row, key, value)
    row.updated_by = current_user.id
    return EmployeeChildOut.model_validate(row)


@router.delete("/employees/{employee_id}/children/{child_id}", status_code=204)
async def delete_employee_child(
    employee_id: uuid.UUID,
    child_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("core", "edit")),
):
    employee = await _ensure_employee(db, employee_id)
    row = await _ensure_employee_child(db, employee, child_id)
    await db.delete(row)
    return Response(status_code=204)


@router.post("/employees/{employee_id}/documents", response_model=EmployeeDocumentOut, status_code=201)
async def create_employee_document(
    employee_id: uuid.UUID,
    body: EmployeeDocumentIn,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("core", "edit")),
):
    employee = await _ensure_employee(db, employee_id)
    row = EmployeeDocumentIndex(
        tenant_id=employee.tenant_id,
        employee_id=employee.id,
        created_by=current_user.id,
        valid_from=body.valid_from or date.today(),
        valid_to=body.valid_to,
        **body.model_dump(exclude={"valid_from", "valid_to"}),
    )
    db.add(row)
    await db.flush()
    await db.refresh(row)
    return EmployeeDocumentOut.model_validate(row)


@router.put("/employees/{employee_id}/documents/{record_id}/record", response_model=EmployeeDocumentOut | dict)
async def update_employee_document_record(
    employee_id: uuid.UUID,
    record_id: uuid.UUID,
    body: EmployeeDocumentActionBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("core", "edit")),
):
    employee = await _ensure_employee(db, employee_id)
    anchor = await _ensure_temporal_employee_row(db, EmployeeDocumentIndex, employee, record_id, "DOCUMENT_NOT_FOUND")
    merged = _merge_temporal_fields(
        anchor,
        body.model_dump(exclude={"action", "valid_from", "valid_to"}, exclude_none=True),
        field_names=["document_type", "file_name", "storage_path", "issued_on", "expires_on", "status", "notes"],
    )
    row = await _record_action_for_current_row(
        db, EmployeeDocumentIndex, employee, anchor, current_user, body.action, merged, body.valid_from, body.valid_to,
        not_found_code="DOCUMENT_NOT_FOUND",
    )
    if isinstance(row, dict):
        return row
    return EmployeeDocumentOut.model_validate(row)


@router.post("/employees/{employee_id}/bank-accounts", response_model=EmployeeBankAccountOut, status_code=201)
async def create_employee_bank_account(
    employee_id: uuid.UUID,
    body: EmployeeBankAccountCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("core", "edit")),
):
    if not _require_sensitive_access(current_user):
        raise HTTPException(status_code=403, detail={"error": "Sensitive employee fields require additional permission", "code": "FORBIDDEN"})
    employee = await _ensure_employee(db, employee_id)
    new_row = EmployeeBankAccount(
        tenant_id=employee.tenant_id,
        employee_id=employee.id,
        created_by=current_user.id,
        valid_from=body.valid_from or date.today(),
        valid_to=body.valid_to,
        **body.model_dump(exclude={"valid_from", "valid_to"}),
    )
    db.add(new_row)
    await db.flush()
    await db.refresh(new_row)
    return await _serialize_bank_account(new_row, True)


@router.put("/employees/{employee_id}/bank-accounts/{record_id}/record", response_model=EmployeeBankAccountOut | dict)
async def update_employee_bank_account_record(
    employee_id: uuid.UUID,
    record_id: uuid.UUID,
    body: EmployeeBankAccountActionBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("core", "edit")),
):
    if not _require_sensitive_access(current_user):
        raise HTTPException(status_code=403, detail={"error": "Sensitive employee fields require additional permission", "code": "FORBIDDEN"})
    employee = await _ensure_employee(db, employee_id)
    anchor = await _ensure_temporal_employee_row(db, EmployeeBankAccount, employee, record_id, "BANK_ACCOUNT_NOT_FOUND")
    merged = _merge_temporal_fields(
        anchor,
        body.model_dump(exclude={"action", "valid_from", "valid_to"}, exclude_none=True),
        field_names=[
            "bank_code",
            "bank_name",
            "branch_number",
            "branch_description",
            "account_number",
            "account_holder_name",
            "payment_method",
            "payment_percent",
            "fixed_amount",
            "payment_priority",
            "company_name",
            "notes",
        ],
    )
    row = await _record_action_for_current_row(
        db, EmployeeBankAccount, employee, anchor, current_user, body.action, merged, body.valid_from, body.valid_to,
        not_found_code="BANK_ACCOUNT_NOT_FOUND",
    )
    if isinstance(row, dict):
        return row
    return await _serialize_bank_account(row, True)


@router.post("/employees/{employee_id}/awards", response_model=EmployeeAwardOut, status_code=201)
async def create_employee_award(
    employee_id: uuid.UUID,
    body: EmployeeAwardCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("core", "edit")),
):
    employee = await _ensure_employee(db, employee_id)
    row = EmployeeAward(
        tenant_id=employee.tenant_id,
        employee_id=employee.id,
        created_by=current_user.id,
        **body.model_dump(),
    )
    db.add(row)
    await db.flush()
    await db.refresh(row)
    return EmployeeAwardOut.model_validate(row)


@router.put("/employees/{employee_id}/awards/{award_id}", response_model=EmployeeAwardOut)
async def update_employee_award(
    employee_id: uuid.UUID,
    award_id: uuid.UUID,
    body: EmployeeAwardUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("core", "edit")),
):
    employee = await _ensure_employee(db, employee_id)
    row = await _ensure_employee_award(db, employee, award_id)
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(row, key, value)
    row.updated_by = current_user.id
    return EmployeeAwardOut.model_validate(row)


@router.delete("/employees/{employee_id}/awards/{award_id}", status_code=204)
async def delete_employee_award(
    employee_id: uuid.UUID,
    award_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("core", "edit")),
):
    employee = await _ensure_employee(db, employee_id)
    row = await _ensure_employee_award(db, employee, award_id)
    await db.delete(row)
    return Response(status_code=204)


@router.post("/employees/{employee_id}/certifications", response_model=EmployeeCertificationOut, status_code=201)
async def create_employee_certification(
    employee_id: uuid.UUID,
    body: EmployeeCertificationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("core", "edit")),
):
    employee = await _ensure_employee(db, employee_id)
    row = EmployeeCertification(
        tenant_id=employee.tenant_id,
        employee_id=employee.id,
        created_by=current_user.id,
        valid_from=body.valid_from or date.today(),
        valid_to=body.valid_to,
        **body.model_dump(exclude={"valid_from", "valid_to"}),
    )
    db.add(row)
    await db.flush()
    await db.refresh(row)
    return EmployeeCertificationOut.model_validate(row)


@router.put("/employees/{employee_id}/certifications/{record_id}/record", response_model=EmployeeCertificationOut | dict)
async def update_employee_certification_record(
    employee_id: uuid.UUID,
    record_id: uuid.UUID,
    body: EmployeeCertificationActionBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("core", "edit")),
):
    employee = await _ensure_employee(db, employee_id)
    anchor = await _ensure_temporal_employee_row(db, EmployeeCertification, employee, record_id, "CERTIFICATION_NOT_FOUND")
    merged = _merge_temporal_fields(
        anchor,
        body.model_dump(exclude={"action", "valid_from", "valid_to"}, exclude_none=True),
        field_names=["certification_type", "issuer", "issued_on", "expires_on", "status", "notes"],
    )
    row = await _record_action_for_current_row(
        db, EmployeeCertification, employee, anchor, current_user, body.action, merged, body.valid_from, body.valid_to,
        not_found_code="CERTIFICATION_NOT_FOUND",
    )
    if isinstance(row, dict):
        return row
    return EmployeeCertificationOut.model_validate(row)


@router.post("/employees/{employee_id}/courses", response_model=EmployeeCourseOut, status_code=201)
async def create_employee_course(
    employee_id: uuid.UUID,
    body: EmployeeCourseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("core", "edit")),
):
    employee = await _ensure_employee(db, employee_id)
    row = EmployeeCourse(
        tenant_id=employee.tenant_id,
        employee_id=employee.id,
        created_by=current_user.id,
        valid_from=body.valid_from or date.today(),
        valid_to=body.valid_to,
        **body.model_dump(exclude={"valid_from", "valid_to"}),
    )
    db.add(row)
    await db.flush()
    await db.refresh(row)
    return EmployeeCourseOut.model_validate(row)


@router.put("/employees/{employee_id}/courses/{record_id}/record", response_model=EmployeeCourseOut | dict)
async def update_employee_course_record(
    employee_id: uuid.UUID,
    record_id: uuid.UUID,
    body: EmployeeCourseActionBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("core", "edit")),
):
    employee = await _ensure_employee(db, employee_id)
    anchor = await _ensure_temporal_employee_row(db, EmployeeCourse, employee, record_id, "COURSE_NOT_FOUND")
    merged = _merge_temporal_fields(
        anchor,
        body.model_dump(exclude={"action", "valid_from", "valid_to"}, exclude_none=True),
        field_names=["course_name", "provider", "started_on", "completed_on", "status", "score", "notes"],
    )
    row = await _record_action_for_current_row(
        db, EmployeeCourse, employee, anchor, current_user, body.action, merged, body.valid_from, body.valid_to,
        not_found_code="COURSE_NOT_FOUND",
    )
    if isinstance(row, dict):
        return row
    return EmployeeCourseOut.model_validate(row)


@router.post("/employees/{employee_id}/skills", response_model=EmployeeSkillOut, status_code=201)
async def create_employee_skill(
    employee_id: uuid.UUID,
    body: EmployeeSkillCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("core", "edit")),
):
    employee = await _ensure_employee(db, employee_id)
    row = EmployeeSkill(
        tenant_id=employee.tenant_id,
        employee_id=employee.id,
        created_by=current_user.id,
        **body.model_dump(),
    )
    db.add(row)
    await db.flush()
    await db.refresh(row)
    return EmployeeSkillOut.model_validate(row)


@router.put("/employees/{employee_id}/skills/{skill_id}", response_model=EmployeeSkillOut)
async def update_employee_skill(
    employee_id: uuid.UUID,
    skill_id: uuid.UUID,
    body: EmployeeSkillUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("core", "edit")),
):
    employee = await _ensure_employee(db, employee_id)
    row = await _ensure_employee_skill(db, employee, skill_id)
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(row, key, value)
    row.updated_by = current_user.id
    return EmployeeSkillOut.model_validate(row)


@router.delete("/employees/{employee_id}/skills/{skill_id}", status_code=204)
async def delete_employee_skill(
    employee_id: uuid.UUID,
    skill_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("core", "edit")),
):
    employee = await _ensure_employee(db, employee_id)
    row = await _ensure_employee_skill(db, employee, skill_id)
    await db.delete(row)
    return Response(status_code=204)


@router.post("/employees/{employee_id}/work-breaks", response_model=EmployeeWorkBreakOut, status_code=201)
async def create_employee_work_break(
    employee_id: uuid.UUID,
    body: EmployeeWorkBreakCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("core", "edit")),
):
    employee = await _ensure_employee(db, employee_id)
    row = EmployeeWorkBreak(
        tenant_id=employee.tenant_id,
        employee_id=employee.id,
        created_by=current_user.id,
        valid_from=body.valid_from or date.today(),
        valid_to=body.valid_to,
        **body.model_dump(exclude={"valid_from", "valid_to"}),
    )
    db.add(row)
    await db.flush()
    await db.refresh(row)
    return EmployeeWorkBreakOut.model_validate(row)


@router.put("/employees/{employee_id}/work-breaks/{record_id}/record", response_model=EmployeeWorkBreakOut | dict)
async def update_employee_work_break_record(
    employee_id: uuid.UUID,
    record_id: uuid.UUID,
    body: EmployeeWorkBreakActionBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("core", "edit")),
):
    employee = await _ensure_employee(db, employee_id)
    anchor = await _ensure_temporal_employee_row(db, EmployeeWorkBreak, employee, record_id, "WORK_BREAK_NOT_FOUND")
    merged = _merge_temporal_fields(
        anchor,
        body.model_dump(exclude={"action", "valid_from", "valid_to"}, exclude_none=True),
        field_names=["break_type", "reason", "started_on", "ended_on", "approved_by", "notes"],
    )
    row = await _record_action_for_current_row(
        db, EmployeeWorkBreak, employee, anchor, current_user, body.action, merged, body.valid_from, body.valid_to,
        not_found_code="WORK_BREAK_NOT_FOUND",
    )
    if isinstance(row, dict):
        return row
    return EmployeeWorkBreakOut.model_validate(row)


@router.get("/org-units", response_model=list[OrgUnitOut])
async def list_org_units(
    tenant_id: uuid.UUID = Query(...),
    unit_type: str | None = Query(None),
    parent_unit_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("core", "view")),
):
    await _ensure_tenant_exists(db, tenant_id)
    tenant_structure = await _load_tenant_org_structure(db, tenant_id)
    if unit_type is not None and unit_type not in tenant_structure["levels"]:
        return []
    stmt = select(OrgUnit).where(OrgUnit.tenant_id == tenant_id)
    stmt = stmt.where(OrgUnit.unit_type.in_(tenant_structure["levels"]))
    if unit_type is not None:
        stmt = stmt.where(OrgUnit.unit_type == unit_type)
    if parent_unit_id is not None:
        stmt = stmt.where(OrgUnit.parent_unit_id == parent_unit_id)
    result = await db.execute(
        stmt.order_by(OrgUnit.code.asc(), OrgUnit.name.asc(), OrgUnit.valid_from.desc())
    )
    rows = result.scalars().all()
    items: list[OrgUnitOut] = []
    for row in rows:
        items.append(await _serialize_org_unit(db, row))
    return items


@router.post("/org-units", response_model=OrgUnitOut, status_code=201)
async def create_org_unit(
    body: OrgUnitCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("core", "edit")),
):
    await _ensure_tenant_exists(db, body.tenant_id)
    tenant_structure = await _load_tenant_org_structure(db, body.tenant_id, as_of=body.valid_from)
    await _validate_org_unit_hierarchy(
        db,
        body.tenant_id,
        tenant_structure,
        body.unit_type,
        body.parent_unit_id,
        as_of=body.valid_from,
    )
    await _validate_org_unit_manager(db, body.tenant_id, body.manager_employee_id)

    unit = OrgUnit(
        tenant_id=body.tenant_id,
        parent_unit_id=body.parent_unit_id,
        manager_employee_id=body.manager_employee_id,
        unit_type=body.unit_type,
        code=await _generate_next_org_unit_code(db, body.tenant_id, body.unit_type),
        name=body.name,
        description=body.description,
        is_active=body.is_active,
        valid_from=body.valid_from or date.today(),
        valid_to=None,
        created_by=current_user.id,
    )
    db.add(unit)
    await db.flush()
    await db.refresh(unit)
    return await _serialize_org_unit(db, unit)


@router.put("/org-units/{org_unit_id}/record", response_model=OrgUnitOut | dict)
async def org_unit_record_action(
    org_unit_id: uuid.UUID,
    body: OrgUnitActionBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("core", "edit")),
):
    result = await db.execute(select(OrgUnit).where(OrgUnit.id == org_unit_id))
    anchor = result.scalar_one_or_none()
    if anchor is None:
        raise HTTPException(status_code=404, detail={"error": "Org unit not found", "code": "NOT_FOUND"})

    if body.valid_from and body.valid_to and body.valid_to < body.valid_from:
        raise HTTPException(status_code=422, detail={"error": "invalid date range", "code": "INVALID_DATE_RANGE"})

    action = body.action or "update"

    if action == "delete":
        await delete_specific_row(db, OrgUnit, anchor.tenant_id, anchor.valid_from, {"id": org_unit_id})
        await db.commit()
        return {"ok": True, "action": "delete"}

    if action == "close":
        if not body.valid_to:
            raise HTTPException(status_code=422, detail={"error": "valid_to is required", "code": "MISSING_DATE"})
        await update_in_place(
            db,
            OrgUnit,
            anchor.tenant_id,
            {},
            current_user.id,
            target_valid_from=anchor.valid_from,
            new_valid_to=body.valid_to,
            extra_filters={"id": org_unit_id},
        )
        await db.commit()
        refreshed = await db.execute(select(OrgUnit).where(OrgUnit.id == org_unit_id))
        row = refreshed.scalar_one()
        return await _serialize_org_unit(db, row)

    if action == "add":
        if not body.valid_from or not body.name:
            raise HTTPException(status_code=422, detail={"error": "name and valid_from are required", "code": "MISSING_FIELDS"})
        unit_type = body.unit_type or anchor.unit_type
        tenant_structure = await _load_tenant_org_structure(db, anchor.tenant_id, as_of=body.valid_from)
        await _validate_org_unit_hierarchy(db, anchor.tenant_id, tenant_structure, unit_type, body.parent_unit_id, as_of=body.valid_from)
        await _validate_org_unit_manager(db, anchor.tenant_id, body.manager_employee_id)
        new_row = OrgUnit(
            tenant_id=anchor.tenant_id,
            parent_unit_id=body.parent_unit_id,
            manager_employee_id=None if body.clear_manager_employee_id else body.manager_employee_id,
            unit_type=unit_type,
            code=await _generate_next_org_unit_code(db, anchor.tenant_id, unit_type),
            name=body.name,
            description=body.description,
            is_active=body.is_active if body.is_active is not None else True,
            valid_from=body.valid_from,
            valid_to=body.valid_to,
            created_by=current_user.id,
        )
        db.add(new_row)
        await db.flush()
        await db.refresh(new_row)
        await db.commit()
        return await _serialize_org_unit(db, new_row)

    if not body.valid_from:
        raise HTTPException(status_code=422, detail={"error": "valid_from is required", "code": "MISSING_DATE"})
    merged = _org_unit_field_values(body, anchor)
    tenant_structure = await _load_tenant_org_structure(db, anchor.tenant_id, as_of=body.valid_from)
    await _validate_org_unit_hierarchy(
        db,
        anchor.tenant_id,
        tenant_structure,
        merged["unit_type"],
        merged["parent_unit_id"],
        as_of=body.valid_from,
    )
    await _validate_org_unit_manager(db, anchor.tenant_id, merged["manager_employee_id"])

    if action == "set":
        row = await kabiya(
            db,
            OrgUnit,
            anchor.tenant_id,
            merged,
            current_user.id,
            new_valid_from=body.valid_from,
            new_valid_to=body.valid_to,
            extra_filters={"code": anchor.code, "unit_type": anchor.unit_type},
        )
        await db.commit()
        return await _serialize_org_unit(db, row)

    if body.valid_from == anchor.valid_from:
        await update_in_place(
            db,
            OrgUnit,
            anchor.tenant_id,
            merged,
            current_user.id,
            target_valid_from=anchor.valid_from,
            new_valid_to=body.valid_to,
            extra_filters={"id": org_unit_id},
        )
        await db.commit()
        refreshed = await db.execute(select(OrgUnit).where(OrgUnit.id == org_unit_id))
        row = refreshed.scalar_one()
        return await _serialize_org_unit(db, row)

    new_row = await close_and_create(
        db,
        OrgUnit,
        anchor.tenant_id,
        merged,
        current_user.id,
        new_valid_from=body.valid_from,
        new_valid_to=body.valid_to,
        extra_filters={"code": anchor.code, "unit_type": anchor.unit_type},
    )
    await db.commit()
    return await _serialize_org_unit(db, new_row)


@router.get("/positions", response_model=list[PositionOut])
async def list_positions(
    tenant_id: uuid.UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("core", "view")),
):
    await _ensure_tenant_exists(db, tenant_id)
    tenant_structure = await _load_tenant_org_structure(db, tenant_id)
    result = await db.execute(
        select(Position)
        .where(Position.tenant_id == tenant_id)
        .order_by(Position.code.asc(), Position.title.asc(), Position.valid_from.desc())
    )
    rows = result.scalars().all()
    items: list[PositionOut] = []
    expected_level = tenant_structure["position_attachment_level"]
    for row in rows:
        unit = await _ensure_org_unit(db, tenant_id, row.org_unit_id, as_of=row.valid_from)
        if expected_level is None:
            if row.org_unit_id is not None:
                continue
        elif unit is None or unit.unit_type != expected_level:
            continue
        item = PositionOut.model_validate(row)
        item.org_unit_name = await _org_unit_name(db, tenant_id, row.org_unit_id, row.valid_from)
        items.append(item)
    return items


@router.post("/positions", response_model=PositionOut, status_code=201)
async def create_position(
    body: PositionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("core", "edit")),
):
    await _ensure_tenant_exists(db, body.tenant_id)
    tenant_structure = await _load_tenant_org_structure(db, body.tenant_id, as_of=body.valid_from)
    await _validate_position_attachment(
        db,
        body.tenant_id,
        tenant_structure,
        body.org_unit_id,
        as_of=body.valid_from,
    )

    position = Position(
        tenant_id=body.tenant_id,
        org_unit_id=body.org_unit_id,
        code=await _generate_next_position_code(db, body.tenant_id),
        title=body.title,
        description=body.description,
        employment_type_default=body.employment_type_default,
        is_managerial=body.is_managerial,
        is_active=body.is_active,
        valid_from=body.valid_from or date.today(),
        valid_to=None,
        created_by=current_user.id,
    )
    db.add(position)
    await db.flush()
    await db.refresh(position)
    item = PositionOut.model_validate(position)
    item.org_unit_name = await _org_unit_name(db, body.tenant_id, position.org_unit_id, position.valid_from)
    return item


@router.put("/positions/{position_id}/record", response_model=PositionOut | dict)
async def position_record_action(
    position_id: uuid.UUID,
    body: PositionActionBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("core", "edit")),
):
    result = await db.execute(select(Position).where(Position.id == position_id))
    anchor = result.scalar_one_or_none()
    if anchor is None:
        raise HTTPException(status_code=404, detail={"error": "Position not found", "code": "NOT_FOUND"})

    if body.valid_from and body.valid_to and body.valid_to < body.valid_from:
        raise HTTPException(status_code=422, detail={"error": "invalid date range", "code": "INVALID_DATE_RANGE"})

    action = body.action or "update"
    if action == "delete":
        await delete_specific_row(db, Position, anchor.tenant_id, anchor.valid_from, {"id": position_id})
        await db.commit()
        return {"ok": True, "action": "delete"}

    if action == "close":
        if not body.valid_to:
            raise HTTPException(status_code=422, detail={"error": "valid_to is required", "code": "MISSING_DATE"})
        await update_in_place(
            db,
            Position,
            anchor.tenant_id,
            {},
            current_user.id,
            target_valid_from=anchor.valid_from,
            new_valid_to=body.valid_to,
            extra_filters={"id": position_id},
        )
        await db.commit()
        refreshed = await db.execute(select(Position).where(Position.id == position_id))
        row = refreshed.scalar_one()
        item = PositionOut.model_validate(row)
        item.org_unit_name = await _org_unit_name(db, row.tenant_id, row.org_unit_id, row.valid_from)
        return item

    if action == "add":
        tenant_structure = await _load_tenant_org_structure(db, anchor.tenant_id, as_of=body.valid_from)
        if not body.valid_from or not body.title:
            raise HTTPException(status_code=422, detail={"error": "title and valid_from are required", "code": "MISSING_FIELDS"})
        if tenant_structure["position_attachment_level"] is not None and not body.org_unit_id:
            raise HTTPException(status_code=422, detail={"error": "org_unit_id is required", "code": "MISSING_FIELDS"})
        await _validate_position_attachment(
            db,
            anchor.tenant_id,
            tenant_structure,
            body.org_unit_id,
            as_of=body.valid_from,
        )
        new_row = Position(
            tenant_id=anchor.tenant_id,
            org_unit_id=body.org_unit_id,
            code=await _generate_next_position_code(db, anchor.tenant_id),
            title=body.title,
            description=body.description,
            employment_type_default=body.employment_type_default,
            is_managerial=body.is_managerial if body.is_managerial is not None else False,
            is_active=body.is_active if body.is_active is not None else True,
            valid_from=body.valid_from,
            valid_to=body.valid_to,
            created_by=current_user.id,
        )
        db.add(new_row)
        await db.flush()
        await db.refresh(new_row)
        await db.commit()
        item = PositionOut.model_validate(new_row)
        item.org_unit_name = await _org_unit_name(db, new_row.tenant_id, new_row.org_unit_id, new_row.valid_from)
        return item

    if not body.valid_from:
        raise HTTPException(status_code=422, detail={"error": "valid_from is required", "code": "MISSING_DATE"})
    merged = _position_field_values(body, anchor)
    tenant_structure = await _load_tenant_org_structure(db, anchor.tenant_id, as_of=body.valid_from)
    await _validate_position_attachment(
        db,
        anchor.tenant_id,
        tenant_structure,
        merged["org_unit_id"],
        as_of=body.valid_from,
    )

    if action == "set":
        row = await kabiya(
            db,
            Position,
            anchor.tenant_id,
            merged,
            current_user.id,
            new_valid_from=body.valid_from,
            new_valid_to=body.valid_to,
            extra_filters={"code": anchor.code},
        )
        await db.commit()
        item = PositionOut.model_validate(row)
        item.org_unit_name = await _org_unit_name(db, row.tenant_id, row.org_unit_id, row.valid_from)
        return item

    if body.valid_from == anchor.valid_from:
        await update_in_place(
            db,
            Position,
            anchor.tenant_id,
            merged,
            current_user.id,
            target_valid_from=anchor.valid_from,
            new_valid_to=body.valid_to,
            extra_filters={"id": position_id},
        )
        await db.commit()
        refreshed = await db.execute(select(Position).where(Position.id == position_id))
        row = refreshed.scalar_one()
        item = PositionOut.model_validate(row)
        item.org_unit_name = await _org_unit_name(db, row.tenant_id, row.org_unit_id, row.valid_from)
        return item

    new_row = await close_and_create(
        db,
        Position,
        anchor.tenant_id,
        merged,
        current_user.id,
        new_valid_from=body.valid_from,
        new_valid_to=body.valid_to,
        extra_filters={"code": anchor.code},
    )
    await db.commit()
    item = PositionOut.model_validate(new_row)
    item.org_unit_name = await _org_unit_name(db, new_row.tenant_id, new_row.org_unit_id, new_row.valid_from)
    return item
