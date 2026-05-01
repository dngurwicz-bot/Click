from pydantic import BaseModel, computed_field
import uuid
from datetime import date, datetime
from typing import Optional
from decimal import Decimal

from app.services.pricing_policy import pricing_policy_note, pricing_summary_text


class TemplateModuleEntry(BaseModel):
    """A module assigned to a template, with an optional per-module seat default."""
    module_slug: str
    seats_default: Optional[int] = None  # None → fall back to template-level seat_count


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

    @computed_field
    @property
    def pricing_model(self) -> str:
        return "base_included_overage"

    @computed_field
    @property
    def overage_per_seat_ils(self) -> Decimal:
        return self.per_seat_ils

    @computed_field
    @property
    def pricing_policy_note(self) -> str:
        return pricing_policy_note(self.included_seats)

    @computed_field
    @property
    def pricing_summary_text(self) -> str:
        return pricing_summary_text(
            base_price_ils=self.base_price_ils,
            included_seats=self.included_seats,
            overage_per_seat_ils=self.per_seat_ils,
        )


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
    default_billing_cycle: str
    trial_days: int
    is_active: bool
    sort_order: int
    target_industry: Optional[str] = None
    recommended_size: Optional[str] = None
    valid_from: date
    valid_to: Optional[date] = None
    created_at: Optional[datetime] = None
    # Legacy flat list (backward-compatible)
    module_slugs: list[str] = []
    # Rich list with per-module seat defaults
    modules: list[TemplateModuleEntry] = []
    seat_count: int = 0
    discount_pct: Decimal = Decimal("0")
    is_price_locked: bool = False
    module_pricing: list[TemplateModulePricing] = []
    pricing_summary: Optional[TemplatePricingSummary] = None

    model_config = {"from_attributes": True}


class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    default_billing_cycle: str = "monthly"
    trial_days: int = 30
    is_active: bool = True
    sort_order: int = 10
    target_industry: Optional[str] = None
    recommended_size: Optional[str] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    # Supports both legacy (list[str]) and rich (list[TemplateModuleEntry]) formats
    module_slugs: list[str] = []
    modules: list[TemplateModuleEntry] = []
    seat_count: int = 0
    discount_pct: Decimal = Decimal("0")
    is_price_locked: bool = False


class TemplateActionBody(BaseModel):
    """Temporal action: update | add | set | delete | close"""
    action: str = "update"
    template_id: Optional[uuid.UUID] = None  # row identifier for "update"
    name: Optional[str] = None
    description: Optional[str] = None
    default_billing_cycle: Optional[str] = None
    trial_days: Optional[int] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    target_industry: Optional[str] = None
    recommended_size: Optional[str] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    module_slugs: Optional[list[str]] = None
    modules: Optional[list[TemplateModuleEntry]] = None
    seat_count: Optional[int] = None
    discount_pct: Optional[Decimal] = None
    is_price_locked: Optional[bool] = None
