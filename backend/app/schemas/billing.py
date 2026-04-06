import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional
from pydantic import BaseModel, field_validator
import re

# ─── Seat Change Log ───────────────────────────────────────────────────────────

class SeatChangeLogOut(BaseModel):
    id: uuid.UUID
    subscription_module_id: uuid.UUID
    tenant_id: uuid.UUID
    module_slug: str
    old_seats: int
    new_seats: int
    effective_date: date
    billed: bool
    billing_period: Optional[str] = None
    proration_charge_id: Optional[uuid.UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}

# ─── Type Aliases ─────────────────────────────────────────────────────────────

ChargeType   = Literal["base_fee", "per_seat", "setup_fee", "addon", "credit", "manual"]
ChargeStatus = Literal["pending", "invoiced", "cancelled"]
InvoiceStatus = Literal["draft", "sent", "paid", "overdue", "cancelled"]

CHARGE_TYPE_LABELS: dict[str, str] = {
    "base_fee":  "דמי מנוי",
    "per_seat":  "לפי מושב",
    "setup_fee": "דמי הקמה",
    "addon":     "תוספת",
    "credit":    "זיכוי",
    "manual":    "ידני",
}

CHARGE_STATUS_LABELS: dict[str, str] = {
    "pending":  "ממתין",
    "invoiced": "חויב",
    "cancelled": "מבוטל",
}

INVOICE_STATUS_LABELS: dict[str, str] = {
    "draft":     "טיוטה",
    "sent":      "נשלח",
    "paid":      "שולם",
    "overdue":   "בפיגור",
    "cancelled": "מבוטל",
}


# ─── Billing Charge ────────────────────────────────────────────────────────────

class BillingChargeCreate(BaseModel):
    tenant_id: uuid.UUID
    billing_period: str                     # "YYYY-MM"
    charge_type: ChargeType = "base_fee"
    module_slug: Optional[str] = None
    description: str
    quantity: Decimal = Decimal("1")
    unit_price_ils: Decimal
    discount_pct: Decimal = Decimal("0")
    notes: Optional[str] = None

    @field_validator("billing_period")
    @classmethod
    def validate_period(cls, v: str) -> str:
        if not re.match(r"^\d{4}-(0[1-9]|1[0-2])$", v):
            raise ValueError("billing_period must be in YYYY-MM format")
        return v


class BillingChargeUpdate(BaseModel):
    description: Optional[str] = None
    quantity: Optional[Decimal] = None
    unit_price_ils: Optional[Decimal] = None
    discount_pct: Optional[Decimal] = None
    notes: Optional[str] = None
    status: Optional[ChargeStatus] = None


class BillingChargeOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    billing_period: str
    charge_type: str
    module_slug: Optional[str] = None
    description: str
    quantity: Decimal
    unit_price_ils: Decimal
    amount_ils: Decimal
    discount_pct: Decimal
    amount_after_discount_ils: Decimal
    status: str
    invoice_id: Optional[uuid.UUID] = None
    notes: Optional[str] = None
    created_at: datetime
    # Resolved display names (populated by router)
    tenant_name: Optional[str] = None
    module_name: Optional[str] = None

    model_config = {"from_attributes": True}


# ─── Generate Charges ─────────────────────────────────────────────────────────

class GenerateChargesRequest(BaseModel):
    billing_period: str                               # "YYYY-MM"
    tenant_ids: Optional[list[uuid.UUID]] = None     # None → all active/trial tenants

    @field_validator("billing_period")
    @classmethod
    def validate_period(cls, v: str) -> str:
        if not re.match(r"^\d{4}-(0[1-9]|1[0-2])$", v):
            raise ValueError("billing_period must be in YYYY-MM format")
        return v


class GenerateChargesResult(BaseModel):
    created: int
    skipped: int
    tenants_processed: int


# ─── Invoice ──────────────────────────────────────────────────────────────────

class InvoiceCreate(BaseModel):
    tenant_id: uuid.UUID
    billing_period: str
    issue_date: date
    due_date: date
    vat_pct: Decimal = Decimal("17.00")
    notes: Optional[str] = None
    charge_ids: Optional[list[uuid.UUID]] = None    # None → auto-pick pending for period

    @field_validator("billing_period")
    @classmethod
    def validate_period(cls, v: str) -> str:
        if not re.match(r"^\d{4}-(0[1-9]|1[0-2])$", v):
            raise ValueError("billing_period must be in YYYY-MM format")
        return v


class InvoiceUpdate(BaseModel):
    due_date: Optional[date] = None
    notes: Optional[str] = None


class MarkPaidRequest(BaseModel):
    payment_date: date
    payment_ref: Optional[str] = None


class InvoiceLineOut(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    charge_id: Optional[uuid.UUID] = None
    description: str
    quantity: Decimal
    unit_price_ils: Decimal
    amount_ils: Decimal
    sort_order: int

    model_config = {"from_attributes": True}


class InvoiceOut(BaseModel):
    id: uuid.UUID
    invoice_number: str
    tenant_id: uuid.UUID
    billing_period: str
    issue_date: date
    due_date: date
    subtotal_ils: Decimal
    discount_ils: Decimal
    vat_pct: Decimal
    vat_ils: Decimal
    total_ils: Decimal
    status: str
    notes: Optional[str] = None
    payment_date: Optional[date] = None
    payment_ref: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    lines: list[InvoiceLineOut] = []
    # Resolved
    tenant_name: Optional[str] = None

    model_config = {"from_attributes": True}


class InvoiceListItem(BaseModel):
    id: uuid.UUID
    invoice_number: str
    tenant_id: uuid.UUID
    tenant_name: Optional[str] = None
    billing_period: str
    issue_date: date
    due_date: date
    subtotal_ils: Decimal
    discount_ils: Decimal
    vat_ils: Decimal
    total_ils: Decimal
    status: str
    payment_date: Optional[date] = None

    model_config = {"from_attributes": True}


# ─── Tenant Billing Summary ────────────────────────────────────────────────────

class TenantBillingSummary(BaseModel):
    charges: list[BillingChargeOut]
    invoices: list[InvoiceListItem]
    pending_total_ils: Decimal
    invoiced_total_ils: Decimal
    paid_total_ils: Decimal


class BillingSettingsBase(BaseModel):
    issuer_name_he: str
    issuer_name_en: Optional[str] = None
    issuer_tax_id: Optional[str] = None
    issuer_address: Optional[str] = None
    issuer_phone: Optional[str] = None
    issuer_email: Optional[str] = None
    issuer_logo_url: Optional[str] = None
    payment_instructions: Optional[str] = None
    footer_text: Optional[str] = None


class BillingSettingsUpdate(BillingSettingsBase):
    pass


class BillingSettingsOut(BillingSettingsBase):
    id: Optional[uuid.UUID] = None
    missing_tax_fields: list[str] = []
    can_render_tax_invoice: bool = False
    source: str = "database"
    updated_at: Optional[datetime] = None


class InvoicePdfVariantAvailability(BaseModel):
    statement_url: str
    tax_url: str
    can_render_tax_invoice: bool
    missing_tax_fields: list[str] = []
