from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


OrgUnitType = Literal["division", "department", "section", "team"]
TemporalAction = Literal["update", "add", "set", "delete", "close"]


class EmployeeIdentityBase(BaseModel):
    first_name: str
    last_name: str
    preferred_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    birth_date: Optional[date] = None
    immigration_date: Optional[date] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None
    children_count: Optional[int] = Field(default=None, ge=0)
    spouse_name: Optional[str] = None
    spouse_legal_id: Optional[str] = None
    legal_id_type: str = "national_id"
    legal_id_number: Optional[str] = None
    nationality: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = "IL"
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None
    bank_account: Optional[str] = None


class EmployeeIdentityIn(EmployeeIdentityBase):
    valid_from: Optional[date] = None


class EmployeeIdentityOut(EmployeeIdentityBase):
    id: uuid.UUID
    employee_id: uuid.UUID
    tenant_id: uuid.UUID
    valid_from: date
    valid_to: Optional[date] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class EmployeeIdentityActionBody(BaseModel):
    action: TemporalAction = "update"
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    preferred_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    birth_date: Optional[date] = None
    immigration_date: Optional[date] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None
    children_count: Optional[int] = Field(default=None, ge=0)
    spouse_name: Optional[str] = None
    spouse_legal_id: Optional[str] = None
    legal_id_type: Optional[str] = None
    legal_id_number: Optional[str] = None
    nationality: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None


class EmployeeEmploymentBase(BaseModel):
    org_unit_id: Optional[uuid.UUID] = None
    manager_employee_id: Optional[uuid.UUID] = None
    position_id: Optional[uuid.UUID] = None
    employment_status: str = "active"
    employment_type: str = "employee"
    salary_type: str = "monthly"
    start_date: date
    end_date: Optional[date] = None
    employment_scope_pct: int = Field(default=100, ge=0, le=100)
    branch_name: Optional[str] = None
    work_site: Optional[str] = None
    time_clock_id: Optional[str] = None
    notes: Optional[str] = None


class EmployeeEmploymentIn(EmployeeEmploymentBase):
    valid_from: Optional[date] = None


class EmployeeEmploymentOut(EmployeeEmploymentBase):
    id: uuid.UUID
    employee_id: uuid.UUID
    tenant_id: uuid.UUID
    valid_from: date
    valid_to: Optional[date] = None
    created_at: datetime
    org_unit_name: Optional[str] = None
    manager_name: Optional[str] = None
    position_title: Optional[str] = None

    model_config = {"from_attributes": True}


class EmployeeEmploymentActionBody(BaseModel):
    action: TemporalAction = "update"
    org_unit_id: Optional[uuid.UUID] = None
    manager_employee_id: Optional[uuid.UUID] = None
    position_id: Optional[uuid.UUID] = None
    employment_status: Optional[str] = None
    employment_type: Optional[str] = None
    salary_type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    employment_scope_pct: Optional[int] = Field(default=None, ge=0, le=100)
    branch_name: Optional[str] = None
    work_site: Optional[str] = None
    time_clock_id: Optional[str] = None
    notes: Optional[str] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None


class EmployeeCompensationBase(BaseModel):
    base_salary: Decimal = Field(default=Decimal("0"), ge=0)
    currency: str = "ILS"
    pay_cycle: str = "monthly"
    cost_center: Optional[str] = None
    components_json: Optional[dict[str, Any]] = None


class EmployeeCompensationIn(EmployeeCompensationBase):
    valid_from: Optional[date] = None


class EmployeeCompensationOut(EmployeeCompensationBase):
    base_salary: Optional[Decimal] = None
    id: uuid.UUID
    employee_id: uuid.UUID
    tenant_id: uuid.UUID
    valid_from: date
    valid_to: Optional[date] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class EmployeeCompensationActionBody(BaseModel):
    action: TemporalAction = "update"
    base_salary: Optional[Decimal] = Field(default=None, ge=0)
    currency: Optional[str] = None
    pay_cycle: Optional[str] = None
    cost_center: Optional[str] = None
    components_json: Optional[dict[str, Any]] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None


class EmployeeDocumentBase(BaseModel):
    document_type: str
    file_name: str
    storage_path: Optional[str] = None
    issued_on: Optional[date] = None
    expires_on: Optional[date] = None
    status: str = "active"
    notes: Optional[str] = None


class EmployeeDocumentIn(EmployeeDocumentBase):
    valid_from: Optional[date] = None


class EmployeeDocumentOut(EmployeeDocumentBase):
    id: uuid.UUID
    employee_id: uuid.UUID
    tenant_id: uuid.UUID
    valid_from: date
    valid_to: Optional[date] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class EmployeeDocumentActionBody(BaseModel):
    action: TemporalAction = "update"
    document_type: Optional[str] = None
    file_name: Optional[str] = None
    storage_path: Optional[str] = None
    issued_on: Optional[date] = None
    expires_on: Optional[date] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None


class EmployeeChildBase(BaseModel):
    child_name: str
    last_name: Optional[str] = None
    legal_id_number: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[str] = None
    military_service_status: Optional[str] = None
    service_start_date: Optional[date] = None
    service_end_date: Optional[date] = None
    allowance_eligible: Optional[bool] = None
    notes: Optional[str] = None


class EmployeeChildCreate(EmployeeChildBase):
    pass


class EmployeeChildUpdate(BaseModel):
    child_name: Optional[str] = None
    last_name: Optional[str] = None
    legal_id_number: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[str] = None
    military_service_status: Optional[str] = None
    service_start_date: Optional[date] = None
    service_end_date: Optional[date] = None
    allowance_eligible: Optional[bool] = None
    notes: Optional[str] = None


class EmployeeChildOut(EmployeeChildBase):
    id: uuid.UUID
    employee_id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class EmployeeBankAccountBase(BaseModel):
    bank_code: Optional[str] = None
    bank_name: Optional[str] = None
    branch_number: Optional[str] = None
    branch_description: Optional[str] = None
    account_number: Optional[str] = None
    account_holder_name: Optional[str] = None
    payment_method: Optional[str] = None
    payment_percent: Optional[Decimal] = Field(default=None, ge=0, le=100)
    fixed_amount: Optional[Decimal] = Field(default=None, ge=0)
    payment_priority: Optional[int] = Field(default=None, ge=1)
    company_name: Optional[str] = None
    notes: Optional[str] = None


class EmployeeBankAccountCreate(EmployeeBankAccountBase):
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None


class EmployeeBankAccountOut(EmployeeBankAccountBase):
    id: uuid.UUID
    employee_id: uuid.UUID
    tenant_id: uuid.UUID
    valid_from: date
    valid_to: Optional[date] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class EmployeeBankAccountActionBody(BaseModel):
    action: TemporalAction = "update"
    bank_name: Optional[str] = None
    branch_number: Optional[str] = None
    account_number: Optional[str] = None
    account_holder_name: Optional[str] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None


class EmployeeAwardBase(BaseModel):
    award_type: str
    award_date: Optional[date] = None
    description: Optional[str] = None
    granted_by: Optional[str] = None
    notes: Optional[str] = None


class EmployeeAwardCreate(EmployeeAwardBase):
    pass


class EmployeeAwardUpdate(BaseModel):
    award_type: Optional[str] = None
    award_date: Optional[date] = None
    description: Optional[str] = None
    granted_by: Optional[str] = None
    notes: Optional[str] = None


class EmployeeAwardOut(EmployeeAwardBase):
    id: uuid.UUID
    employee_id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class EmployeeCertificationBase(BaseModel):
    certification_type: str
    issuer: Optional[str] = None
    issued_on: Optional[date] = None
    expires_on: Optional[date] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class EmployeeCertificationCreate(EmployeeCertificationBase):
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None


class EmployeeCertificationOut(EmployeeCertificationBase):
    id: uuid.UUID
    employee_id: uuid.UUID
    tenant_id: uuid.UUID
    valid_from: date
    valid_to: Optional[date] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class EmployeeCertificationActionBody(BaseModel):
    action: TemporalAction = "update"
    certification_type: Optional[str] = None
    issuer: Optional[str] = None
    issued_on: Optional[date] = None
    expires_on: Optional[date] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None


class EmployeeCourseBase(BaseModel):
    course_name: str
    provider: Optional[str] = None
    started_on: Optional[date] = None
    completed_on: Optional[date] = None
    status: Optional[str] = None
    score: Optional[str] = None
    notes: Optional[str] = None


class EmployeeCourseCreate(EmployeeCourseBase):
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None


class EmployeeCourseOut(EmployeeCourseBase):
    id: uuid.UUID
    employee_id: uuid.UUID
    tenant_id: uuid.UUID
    valid_from: date
    valid_to: Optional[date] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class EmployeeCourseActionBody(BaseModel):
    action: TemporalAction = "update"
    course_name: Optional[str] = None
    provider: Optional[str] = None
    started_on: Optional[date] = None
    completed_on: Optional[date] = None
    status: Optional[str] = None
    score: Optional[str] = None
    notes: Optional[str] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None


class EmployeeSkillBase(BaseModel):
    skill_name: str
    level: Optional[str] = None
    category: Optional[str] = None
    source: Optional[str] = None
    assessed_on: Optional[date] = None
    notes: Optional[str] = None


class EmployeeSkillCreate(EmployeeSkillBase):
    pass


class EmployeeSkillUpdate(BaseModel):
    skill_name: Optional[str] = None
    level: Optional[str] = None
    category: Optional[str] = None
    source: Optional[str] = None
    assessed_on: Optional[date] = None
    notes: Optional[str] = None


class EmployeeSkillOut(EmployeeSkillBase):
    id: uuid.UUID
    employee_id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class EmployeeWorkBreakBase(BaseModel):
    break_type: str
    reason: Optional[str] = None
    started_on: Optional[date] = None
    ended_on: Optional[date] = None
    approved_by: Optional[str] = None
    notes: Optional[str] = None


class EmployeeWorkBreakCreate(EmployeeWorkBreakBase):
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None


class EmployeeWorkBreakOut(EmployeeWorkBreakBase):
    id: uuid.UUID
    employee_id: uuid.UUID
    tenant_id: uuid.UUID
    valid_from: date
    valid_to: Optional[date] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class EmployeeWorkBreakActionBody(BaseModel):
    action: TemporalAction = "update"
    break_type: Optional[str] = None
    reason: Optional[str] = None
    started_on: Optional[date] = None
    ended_on: Optional[date] = None
    approved_by: Optional[str] = None
    notes: Optional[str] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None


class DepartmentMovementOut(BaseModel):
    effective_date: date
    previous_org_unit_name: Optional[str] = None
    next_org_unit_name: Optional[str] = None
    position_title: Optional[str] = None
    employment_status: Optional[str] = None


class PositionHistoryOut(BaseModel):
    valid_from: date
    valid_to: Optional[date] = None
    position_title: Optional[str] = None
    employment_type: Optional[str] = None
    employment_status: Optional[str] = None
    org_unit_name: Optional[str] = None
    manager_name: Optional[str] = None


class TeamMemberOut(BaseModel):
    employee_id: uuid.UUID
    employee_number: str
    full_name: str
    employment_status: Optional[str] = None
    org_unit_name: Optional[str] = None
    position_title: Optional[str] = None
    start_date: Optional[date] = None


class EmployeeCreate(BaseModel):
    tenant_id: uuid.UUID
    employee_number: str
    external_ref: Optional[str] = None
    identity: EmployeeIdentityIn
    employment: EmployeeEmploymentIn
    compensation: Optional[EmployeeCompensationIn] = None
    documents: list[EmployeeDocumentIn] = Field(default_factory=list)


class EmployeeOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    employee_number: str
    external_ref: Optional[str] = None
    is_active: bool
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    employment_status: Optional[str] = None
    employment_type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    org_unit_name: Optional[str] = None
    manager_name: Optional[str] = None
    position_title: Optional[str] = None
    branch_name: Optional[str] = None
    work_site: Optional[str] = None

    model_config = {"from_attributes": True}


class EmployeeDetailOut(BaseModel):
    employee: EmployeeOut
    current_identity: Optional[EmployeeIdentityOut] = None
    current_employment: Optional[EmployeeEmploymentOut] = None
    current_compensation: Optional[EmployeeCompensationOut] = None
    current_bank_account: Optional[EmployeeBankAccountOut] = None
    documents: list[EmployeeDocumentOut] = Field(default_factory=list)
    identity_history: list[EmployeeIdentityOut] = Field(default_factory=list)
    employment_history: list[EmployeeEmploymentOut] = Field(default_factory=list)
    compensation_history: list[EmployeeCompensationOut] = Field(default_factory=list)
    bank_accounts: list[EmployeeBankAccountOut] = Field(default_factory=list)
    children: list[EmployeeChildOut] = Field(default_factory=list)
    awards: list[EmployeeAwardOut] = Field(default_factory=list)
    certifications: list[EmployeeCertificationOut] = Field(default_factory=list)
    courses: list[EmployeeCourseOut] = Field(default_factory=list)
    skills: list[EmployeeSkillOut] = Field(default_factory=list)
    work_breaks: list[EmployeeWorkBreakOut] = Field(default_factory=list)
    department_movements: list[DepartmentMovementOut] = Field(default_factory=list)
    position_history: list[PositionHistoryOut] = Field(default_factory=list)
    team_members: list[TeamMemberOut] = Field(default_factory=list)


class OrgUnitBase(BaseModel):
    unit_type: OrgUnitType
    name: str
    description: Optional[str] = None
    parent_unit_id: Optional[uuid.UUID] = None
    manager_employee_id: Optional[uuid.UUID] = None
    is_active: bool = True
    valid_from: Optional[date] = None


class OrgUnitCreate(OrgUnitBase):
    tenant_id: uuid.UUID


class OrgUnitActionBody(BaseModel):
    action: Literal["update", "add", "set", "delete", "close"] = "update"
    unit_type: Optional[OrgUnitType] = None
    name: Optional[str] = None
    description: Optional[str] = None
    parent_unit_id: Optional[uuid.UUID] = None
    manager_employee_id: Optional[uuid.UUID] = None
    clear_manager_employee_id: bool = False
    is_active: Optional[bool] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None


class OrgUnitOut(OrgUnitBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    code: str
    valid_from: date
    valid_to: Optional[date] = None
    created_at: datetime
    parent_unit_name: Optional[str] = None
    manager_name: Optional[str] = None

    model_config = {"from_attributes": True}


class PositionBase(BaseModel):
    org_unit_id: Optional[uuid.UUID] = None
    title: str
    description: Optional[str] = None
    employment_type_default: Optional[str] = None
    is_managerial: bool = False
    is_active: bool = True
    valid_from: Optional[date] = None


class PositionCreate(PositionBase):
    tenant_id: uuid.UUID


class PositionActionBody(BaseModel):
    action: Literal["update", "add", "set", "delete", "close"] = "update"
    org_unit_id: Optional[uuid.UUID] = None
    title: Optional[str] = None
    description: Optional[str] = None
    employment_type_default: Optional[str] = None
    is_managerial: Optional[bool] = None
    is_active: Optional[bool] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None


class PositionOut(PositionBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    code: str
    valid_from: date
    valid_to: Optional[date] = None
    created_at: datetime
    org_unit_name: Optional[str] = None

    model_config = {"from_attributes": True}
