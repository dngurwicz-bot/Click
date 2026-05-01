from pydantic import BaseModel, Field, computed_field
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from app.services.pricing_policy import pricing_policy_note, pricing_summary_text


class ModuleOut(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    color_hex: Optional[str] = None
    is_required: bool
    is_active: bool
    sort_order: int
    depends_on: list[str] = []

    model_config = {"from_attributes": True}


class ModuleCreate(BaseModel):
    slug: str
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    color_hex: Optional[str] = None
    is_required: bool = False
    is_active: bool = True
    sort_order: int = 10


class ModuleUpdate(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    color_hex: Optional[str] = None
    is_required: bool = False
    is_active: bool = True
    sort_order: int = 10


class ModulePriceBase(BaseModel):
    base_price_ils: Decimal = Field(default=Decimal("0"), ge=0)
    per_seat_ils: Decimal = Field(default=Decimal("0"), ge=0)
    included_seats: int = Field(default=0, ge=0)
    setup_fee_ils: Decimal = Field(default=Decimal("0"), ge=0)
    valid_from: date

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


class ModulePriceUpdate(ModulePriceBase):
    pass


class ModulePriceActionBody(BaseModel):
    """Temporal action body for module price management."""
    action: str = "add"          # "update" | "add" | "set" | "delete" | "close"
    price_id: Optional[uuid.UUID] = None  # row identifier for "update" action
    base_price_ils: Decimal = Field(default=Decimal("0"), ge=0)
    per_seat_ils: Decimal = Field(default=Decimal("0"), ge=0)
    included_seats: int = Field(default=0, ge=0)
    setup_fee_ils: Decimal = Field(default=Decimal("0"), ge=0)
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None


class ModulePriceOut(ModulePriceBase):
    id: uuid.UUID
    module_slug: str
    valid_to: Optional[date] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ModuleWithPrice(ModuleOut):
    current_price: Optional[ModulePriceOut] = None


class ModuleWithHistory(ModuleOut):
    current_price: Optional[ModulePriceOut] = None
    price_history: list[ModulePriceOut] = []


class MarketPriceAnchor(BaseModel):
    vendor: str
    product: str
    price_display: str
    normalized_monthly_ils: Decimal
    basis: str
    source_url: str


class RecommendedModulePrice(BaseModel):
    base_price_ils: Decimal = Field(default=Decimal("0"), ge=0)
    per_seat_ils: Decimal = Field(default=Decimal("0"), ge=0)
    included_seats: int = Field(default=0, ge=0)
    setup_fee_ils: Decimal = Field(default=Decimal("0"), ge=0)

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


class ModulePricingRecommendationOut(BaseModel):
    module_slug: str
    module_name: str
    market_category: str
    benchmark_team_size: int
    benchmark_window_ils: str
    action: str
    rationale: str
    current_price: Optional[ModulePriceOut] = None
    recommended_price: RecommendedModulePrice
    current_monthly_at_benchmark_ils: Decimal = Decimal("0")
    recommended_monthly_at_benchmark_ils: Decimal = Decimal("0")
    monthly_delta_ils: Decimal = Decimal("0")
    setup_delta_ils: Decimal = Decimal("0")
    anchors: list[MarketPriceAnchor] = []


class ModulePricingResearchOut(BaseModel):
    as_of: date
    exchange_rate_usd_ils: Decimal
    exchange_rate_eur_ils: Decimal
    positioning: str
    methodology: str
    modules: list[ModulePricingRecommendationOut]
