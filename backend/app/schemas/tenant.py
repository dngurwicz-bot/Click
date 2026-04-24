from pydantic import BaseModel, EmailStr, Field
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional


# --- Identity ---
class TenantIdentityBase(BaseModel):
    name_he: str
    name_en: Optional[str] = None
    tax_id: str
    entity_type: Literal["company", "self_employed", "nonprofit", "gov"]
    logo_url: Optional[str] = None
    industry_code: Optional[str] = None


class TenantIdentityOut(TenantIdentityBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    valid_from: date
    valid_to: Optional[date] = None
    created_at: datetime
    created_by: Optional[str] = None
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None

    model_config = {"from_attributes": True}


# --- Contact ---
CONTACT_TYPE_LABELS = {
    "main": "ראשי",
    "billing": "חשבונאות",
    "technical": "טכני",
    "other": "אחר",
}

class TenantContactBase(BaseModel):
    contact_type: Literal["main", "billing", "technical", "other"] = "main"
    email: EmailStr
    phone: str
    phone_alt: Optional[str] = None
    contact_name: Optional[str] = None
    website: Optional[str] = None


class TenantContactOut(TenantContactBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    valid_from: date
    valid_to: Optional[date] = None
    created_at: datetime
    created_by: Optional[str] = None
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None

    model_config = {"from_attributes": True}


# --- Address ---
class TenantAddressBase(BaseModel):
    street: str
    city: str
    zip_code: Optional[str] = None
    country: str = "IL"
    addr_type: str = "main"


class TenantAddressOut(TenantAddressBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    valid_from: date
    valid_to: Optional[date] = None
    created_at: datetime
    created_by: Optional[str] = None
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None

    model_config = {"from_attributes": True}


# --- Subscription ---
class TenantSubscriptionBase(BaseModel):
    billing_cycle: str = "monthly"
    currency: str = "ILS"
    template_id: Optional[uuid.UUID] = None
    # Backward-compatible aggregate view fields. The source of truth is
    # tenant_subscription_modules, not the subscription header row.
    seat_count: int = 0
    selected_module_slugs: list[str] = Field(default_factory=list)
    discount_pct: Decimal = Decimal("0")
    is_price_locked: bool = False


class TenantSubscriptionModuleBase(BaseModel):
    module_slug: str
    source_type: Literal["template", "manual"] = "manual"
    status: Literal["active", "removed"] = "active"
    seats: int = 0
    pricing_mode: Literal["catalog", "override"] = "catalog"
    override_base_price_ils: Optional[Decimal] = None
    override_per_seat_ils: Optional[Decimal] = None
    override_setup_fee_ils: Optional[Decimal] = None
    override_included_seats: Optional[int] = None
    price_lock_reason: Optional[str] = None
    notes: Optional[str] = None


class TenantSubscriptionModuleCreate(TenantSubscriptionModuleBase):
    pass


class TenantSubscriptionModuleUpdate(BaseModel):
    status: Optional[Literal["active", "removed"]] = None
    seats: Optional[int] = None
    pricing_mode: Optional[Literal["catalog", "override"]] = None
    override_base_price_ils: Optional[Decimal] = None
    override_per_seat_ils: Optional[Decimal] = None
    override_setup_fee_ils: Optional[Decimal] = None
    override_included_seats: Optional[int] = None
    price_lock_reason: Optional[str] = None
    notes: Optional[str] = None


class TenantSubscriptionModuleActionBody(BaseModel):
    action: Literal["update", "add", "set", "delete", "close"] = "update"
    module_id: Optional[uuid.UUID] = None
    module_slug: Optional[str] = None
    source_type: Optional[Literal["template", "manual"]] = None
    status: Optional[Literal["active", "removed"]] = None
    seats: Optional[int] = None
    pricing_mode: Optional[Literal["catalog", "override"]] = None
    override_base_price_ils: Optional[Decimal] = None
    override_per_seat_ils: Optional[Decimal] = None
    override_setup_fee_ils: Optional[Decimal] = None
    override_included_seats: Optional[int] = None
    price_lock_reason: Optional[str] = None
    notes: Optional[str] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None


class TenantSubscriptionModuleOut(TenantSubscriptionModuleBase):
    id: uuid.UUID
    tenant_subscription_id: uuid.UUID
    valid_from: date
    valid_to: Optional[date] = None
    created_at: datetime
    created_by: Optional[str] = None
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None

    model_config = {"from_attributes": True}


class TenantSubscriptionOut(TenantSubscriptionBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    next_renewal_at: Optional[date] = None
    valid_from: date
    valid_to: Optional[date] = None
    created_at: datetime
    created_by: Optional[str] = None
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None

    model_config = {"from_attributes": True}


# --- Status ---
class TenantStatusBase(BaseModel):
    status: Literal["trial", "active", "suspended", "cancelled"] = "trial"
    reason: Optional[str] = None
    notes: Optional[str] = None


class TenantStatusOut(TenantStatusBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    valid_from: date
    valid_to: Optional[date] = None
    created_at: datetime
    created_by: Optional[str] = None
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None

    model_config = {"from_attributes": True}


# --- Create Tenant (full onboarding payload) ---
class TenantCreateRequest(BaseModel):
    identity: TenantIdentityBase
    contact: TenantContactBase
    address: TenantAddressBase
    subscription: TenantSubscriptionBase
    status: TenantStatusBase = TenantStatusBase()


# --- Update (partial) ---
class TenantIdentityUpdate(TenantIdentityBase):
    pass


class TenantContactUpdate(TenantContactBase):
    pass


class TenantAddressUpdate(TenantAddressBase):
    pass


class TenantSubscriptionUpdate(TenantSubscriptionBase):
    pass


class TenantStatusUpdate(TenantStatusBase):
    pass


class TenantUpdateRequest(BaseModel):
    valid_from: Optional[date] = None
    valid_to:   Optional[date] = None   # used by קביעה (action='set') for the period end
    action: Literal["update", "add", "set", "delete", "close"] = "update"
    # "update" = עדכון in-place (action '2')
    # "add"    = הוספה close+create  (action ' ')
    # "set"    = קביעה overwrite period (action '4')
    # "delete" = ביטול מחיקה — hard-delete the row at valid_from (action '3')
    # "close"  = ביטול גמר תוקף — set valid_to on active row (action '3')
    identity: Optional[TenantIdentityUpdate] = None
    contact: Optional[TenantContactUpdate] = None
    address: Optional[TenantAddressUpdate] = None
    subscription: Optional[TenantSubscriptionUpdate] = None
    status: Optional[TenantStatusUpdate] = None


# --- Response ---
class TenantOut(BaseModel):
    tenant_id: uuid.UUID
    org_number: int
    created_at: datetime
    created_by: Optional[str] = None
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None
    identity: Optional[TenantIdentityOut] = None
    contact: Optional[TenantContactOut] = None
    address: Optional[TenantAddressOut] = None
    subscription: Optional[TenantSubscriptionOut] = None
    subscription_modules: list[TenantSubscriptionModuleOut] = []
    status: Optional[TenantStatusOut] = None

    model_config = {"from_attributes": True}


class TenantListItem(BaseModel):
    tenant_id: uuid.UUID
    org_number: int
    name_he: str
    status: str
    template_name: Optional[str] = None
    created_at: datetime


class TenantSyncPreviewModuleDiff(BaseModel):
    module_slug: str
    module_name: str
    action: Literal["add", "remove", "update"]
    current_seats: int = 0
    proposed_seats: int = 0
    pricing_mode: Literal["catalog", "override"] = "catalog"
    current_monthly_ils: Decimal = Decimal("0")
    proposed_monthly_ils: Decimal = Decimal("0")
    current_setup_ils: Decimal = Decimal("0")
    proposed_setup_ils: Decimal = Decimal("0")


class TenantSyncPreviewOut(BaseModel):
    tenant_id: uuid.UUID
    template_id: uuid.UUID
    effective_from: date
    current_discount_pct: Decimal = Decimal("0")
    proposed_discount_pct: Decimal = Decimal("0")
    current_is_price_locked: bool = False
    proposed_is_price_locked: bool = False
    module_diffs: list[TenantSyncPreviewModuleDiff] = []
    current_monthly_total_ils: Decimal = Decimal("0")
    proposed_monthly_total_ils: Decimal = Decimal("0")
    current_setup_total_ils: Decimal = Decimal("0")
    proposed_setup_total_ils: Decimal = Decimal("0")
    immediate_proration_total_ils: Decimal = Decimal("0")


class TenantApplyTemplateRequest(BaseModel):
    template_id: uuid.UUID
    valid_from: Optional[date] = None


class TenantApplySyncRequest(BaseModel):
    template_id: uuid.UUID
    valid_from: Optional[date] = None


class TenantDeleteRequest(BaseModel):
    confirmation_phrase: str
    delete_logo: bool = True
    purge_audit_logs: bool = False


class TenantDeleteImpactOut(BaseModel):
    tenant_id: uuid.UUID
    org_number: int
    tenant_name: Optional[str] = None
    tax_id: Optional[str] = None
    confirmation_phrase: str
    delete_logo: bool
    logo_will_be_deleted: bool
    counts: dict[str, int]
