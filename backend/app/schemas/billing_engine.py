import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


RatingModel = Literal["flat", "per_seat", "tiered"]
ContractStatus = Literal["draft", "active", "paused", "cancelled"]
ChangeEventType = Literal[
    "start_contract",
    "add_module",
    "remove_module",
    "change_quantity",
    "override_price",
    "cancel_contract",
]
LedgerEntryType = Literal[
    "recurring",
    "setup_fee",
    "proration_debit",
    "credit",
    "manual_adjustment",
    "carry_forward_credit",
]
LedgerEntryStatus = Literal["open", "documented", "void"]
DocumentType = Literal["invoice", "credit_note"]
DocumentStatus = Literal["draft", "draft_blocked", "issued", "paid", "overdue", "void"]
BillRunType = Literal["renewal", "adjustment"]


class TierDefinitionRow(BaseModel):
    up_to: Optional[int] = None
    unit_amount_ils: Decimal


class BillingContractItemBase(BaseModel):
    module_slug: str
    rating_model: RatingModel = "flat"
    quantity: int = 0
    base_amount_ils: Decimal = Decimal("0")
    included_qty: int = 0
    per_unit_amount_ils: Decimal = Decimal("0")
    tier_definition: Optional[list[TierDefinitionRow]] = None
    setup_fee_amount_ils: Decimal = Decimal("0")
    discount_pct: Decimal = Decimal("0")
    effective_from: date
    effective_to: Optional[date] = None


class BillingContractItemCreate(BillingContractItemBase):
    pass


class BillingContractItemUpdate(BaseModel):
    rating_model: Optional[RatingModel] = None
    quantity: Optional[int] = None
    base_amount_ils: Optional[Decimal] = None
    included_qty: Optional[int] = None
    per_unit_amount_ils: Optional[Decimal] = None
    tier_definition: Optional[list[TierDefinitionRow]] = None
    setup_fee_amount_ils: Optional[Decimal] = None
    discount_pct: Optional[Decimal] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    status: Optional[Literal["active", "removed"]] = None


class BillingContractItemOut(BillingContractItemBase):
    id: uuid.UUID
    contract_id: uuid.UUID
    status: Literal["active", "removed"]
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class BillingContractCreate(BaseModel):
    tenant_id: uuid.UUID
    status: ContractStatus = "active"
    billing_cycle: Literal["monthly", "yearly"] = "monthly"
    anchor_day: int = 1
    timezone: str = "Asia/Jerusalem"
    payment_terms_days: int = 30
    currency: str = "ILS"
    start_date: date
    end_date: Optional[date] = None
    items: list[BillingContractItemCreate] = Field(default_factory=list)

    @field_validator("anchor_day")
    @classmethod
    def validate_anchor_day(cls, value: int) -> int:
        if value < 1 or value > 31:
            raise ValueError("anchor_day must be between 1 and 31")
        return value


class BillingContractUpdate(BaseModel):
    status: Optional[ContractStatus] = None
    billing_cycle: Optional[Literal["monthly", "yearly"]] = None
    anchor_day: Optional[int] = None
    timezone: Optional[str] = None
    payment_terms_days: Optional[int] = None
    currency: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class BillingContractOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    status: ContractStatus
    billing_cycle: Literal["monthly", "yearly"]
    anchor_day: int
    timezone: str
    payment_terms_days: int
    currency: str
    credit_balance_ils: Decimal
    start_date: date
    end_date: Optional[date] = None
    next_renewal_at: Optional[date] = None
    items: list[BillingContractItemOut] = Field(default_factory=list)
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class BillingContractListItem(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    tenant_name: Optional[str] = None
    status: ContractStatus
    billing_cycle: Literal["monthly", "yearly"]
    next_renewal_at: Optional[date] = None
    credit_balance_ils: Decimal
    currency: str

    model_config = {"from_attributes": True}


class BillingPauseContractRequest(BaseModel):
    end_date: Optional[date] = None


class BillingCancelContractRequest(BaseModel):
    effective_at: date


class BillingImpactLine(BaseModel):
    entry_type: LedgerEntryType
    module_slug: Optional[str] = None
    description: str
    quantity: Decimal
    amount_ils: Decimal
    service_period_start: Optional[date] = None
    service_period_end: Optional[date] = None


class BillingChangeRequest(BaseModel):
    contract_id: uuid.UUID
    event_type: ChangeEventType
    effective_at: date
    contract_item_id: Optional[uuid.UUID] = None
    module_slug: Optional[str] = None
    quantity: Optional[int] = None
    rating_model: Optional[RatingModel] = None
    base_amount_ils: Optional[Decimal] = None
    included_qty: Optional[int] = None
    per_unit_amount_ils: Optional[Decimal] = None
    tier_definition: Optional[list[TierDefinitionRow]] = None
    setup_fee_amount_ils: Optional[Decimal] = None
    discount_pct: Optional[Decimal] = None
    idempotency_key: Optional[str] = None
    notes: Optional[str] = None


class BillingChangePreviewOut(BaseModel):
    event_type: ChangeEventType
    effective_at: date
    bill_now_ils: Decimal
    next_invoice_impact_ils: Decimal
    credit_impact_ils: Decimal
    lines: list[BillingImpactLine]


class BillingChangeApplyOut(BaseModel):
    event_id: uuid.UUID
    preview: BillingChangePreviewOut
    document_id: Optional[uuid.UUID] = None
    credit_balance_ils: Decimal


class BillingBillRunCreate(BaseModel):
    run_type: BillRunType = "renewal"
    target_date: date
    contract_id: Optional[uuid.UUID] = None
    idempotency_key: Optional[str] = None


class BillingBillRunOut(BaseModel):
    id: uuid.UUID
    contract_id: Optional[uuid.UUID] = None
    run_type: BillRunType
    target_date: date
    status: Literal["pending", "completed", "failed"]
    summary: Optional[dict] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class BillingDocumentLineOut(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    ledger_entry_id: Optional[uuid.UUID] = None
    description: str
    quantity: Decimal
    unit_amount_ils: Decimal
    amount_ils: Decimal
    sort_order: int

    model_config = {"from_attributes": True}


class BillingDocumentOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    tenant_name: Optional[str] = None
    contract_id: Optional[uuid.UUID] = None
    document_type: DocumentType
    status: DocumentStatus
    document_number: Optional[str] = None
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    subtotal_ils: Decimal
    discount_ils: Decimal
    credit_applied_ils: Decimal
    vat_pct: Decimal
    vat_ils: Decimal
    total_ils: Decimal
    paid_amount_ils: Decimal
    notes: Optional[str] = None
    payment_ref: Optional[str] = None
    paid_at: Optional[date] = None
    created_at: datetime
    updated_at: datetime
    lines: list[BillingDocumentLineOut] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class BillingDocumentListItem(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    tenant_name: Optional[str] = None
    contract_id: Optional[uuid.UUID] = None
    document_type: DocumentType
    status: DocumentStatus
    document_number: Optional[str] = None
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    total_ils: Decimal
    paid_amount_ils: Decimal
    created_at: datetime

    model_config = {"from_attributes": True}


class BillingDocumentMarkPaidRequest(BaseModel):
    payment_date: date
    payment_ref: Optional[str] = None
    paid_amount_ils: Optional[Decimal] = None


class BillingDocumentIssueCreditRequest(BaseModel):
    amount_ils: Decimal
    reason: str


class BillingLedgerEntryOut(BaseModel):
    id: uuid.UUID
    contract_id: uuid.UUID
    contract_item_id: Optional[uuid.UUID] = None
    tenant_id: uuid.UUID
    module_slug: Optional[str] = None
    change_event_id: Optional[uuid.UUID] = None
    document_id: Optional[uuid.UUID] = None
    entry_type: LedgerEntryType
    status: LedgerEntryStatus
    description: str
    service_period_start: Optional[date] = None
    service_period_end: Optional[date] = None
    quantity: Decimal
    unit_amount_ils: Decimal
    gross_amount_ils: Decimal
    discount_pct: Decimal
    net_amount_ils: Decimal
    created_at: datetime

    model_config = {"from_attributes": True}
