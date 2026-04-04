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

    model_config = {"from_attributes": True}


# --- Subscription ---
class TenantSubscriptionBase(BaseModel):
    package_slug: str
    billing_cycle: str = "monthly"
    currency: str = "ILS"
    template_id: Optional[uuid.UUID] = None
    seat_count: int = 0
    selected_module_slugs: list[str] = Field(default_factory=list)
    discount_pct: Decimal = Decimal("0")
    is_price_locked: bool = False


class TenantSubscriptionOut(TenantSubscriptionBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    next_renewal_at: Optional[date] = None
    valid_from: date
    valid_to: Optional[date] = None
    created_at: datetime

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


class TenantApplyTemplateRequest(BaseModel):
    template_id: uuid.UUID
    valid_from: Optional[date] = None


# --- Response ---
class TenantOut(BaseModel):
    tenant_id: uuid.UUID
    org_number: int
    created_at: datetime
    identity: Optional[TenantIdentityOut] = None
    contact: Optional[TenantContactOut] = None
    address: Optional[TenantAddressOut] = None
    subscription: Optional[TenantSubscriptionOut] = None
    status: Optional[TenantStatusOut] = None

    model_config = {"from_attributes": True}


class TenantListItem(BaseModel):
    tenant_id: uuid.UUID
    org_number: int
    name_he: str
    status: str
    package_slug: str
    created_at: datetime
