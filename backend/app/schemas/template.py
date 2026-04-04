from pydantic import BaseModel
import uuid
from datetime import date, datetime
from typing import Optional
from decimal import Decimal


class TemplateModulePricing(BaseModel):
    module_slug: str
    module_name: str
    has_active_price: bool = False
    base_price_ils: Decimal = Decimal("0")
    per_seat_ils: Decimal = Decimal("0")
    included_seats: int = 0
    setup_fee_ils: Decimal = Decimal("0")
    seat_count: int = 0
    billable_seats: int = 0
    recurring_total_ils: Decimal = Decimal("0")
    setup_total_ils: Decimal = Decimal("0")


class TemplatePricingSummary(BaseModel):
    seat_count: int = 0
    discount_pct: Decimal = Decimal("0")
    is_price_locked: bool = False
    modules_count: int = 0
    recurring_before_discount_ils: Decimal = Decimal("0")
    recurring_after_discount_ils: Decimal = Decimal("0")
    setup_before_discount_ils: Decimal = Decimal("0")
    setup_after_discount_ils: Decimal = Decimal("0")
    total_before_discount_ils: Decimal = Decimal("0")
    total_after_discount_ils: Decimal = Decimal("0")


class TemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    default_package_slug: Optional[str] = None
    default_billing_cycle: str
    trial_days: int
    is_active: bool
    sort_order: int
    target_industry: Optional[str] = None
    recommended_size: Optional[str] = None
    valid_from: date
    valid_to: Optional[date] = None
    created_at: Optional[datetime] = None
    module_slugs: list[str] = []
    seat_count: int = 0
    discount_pct: Decimal = Decimal("0")
    is_price_locked: bool = False
    module_pricing: list[TemplateModulePricing] = []
    pricing_summary: Optional[TemplatePricingSummary] = None

    model_config = {"from_attributes": True}


class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    default_package_slug: Optional[str] = None
    default_billing_cycle: str = "monthly"
    trial_days: int = 30
    is_active: bool = True
    sort_order: int = 10
    target_industry: Optional[str] = None
    recommended_size: Optional[str] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    module_slugs: list[str] = []
    seat_count: int = 0
    discount_pct: Decimal = Decimal("0")
    is_price_locked: bool = False


class TemplateActionBody(BaseModel):
    """Temporal action: update | add | set | delete | close"""
    action: str = "update"
    template_id: Optional[uuid.UUID] = None  # row identifier for "update"
    name: Optional[str] = None
    description: Optional[str] = None
    default_package_slug: Optional[str] = None
    default_billing_cycle: Optional[str] = None
    trial_days: Optional[int] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    target_industry: Optional[str] = None
    recommended_size: Optional[str] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    module_slugs: Optional[list[str]] = None
    seat_count: Optional[int] = None
    discount_pct: Optional[Decimal] = None
    is_price_locked: Optional[bool] = None
