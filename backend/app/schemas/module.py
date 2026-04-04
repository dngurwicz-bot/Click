from pydantic import BaseModel
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional


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
    base_price_ils: Decimal = Decimal("0")
    per_seat_ils: Decimal = Decimal("0")
    included_seats: int = 0
    setup_fee_ils: Decimal = Decimal("0")
    valid_from: date


class ModulePriceUpdate(ModulePriceBase):
    pass


class ModulePriceActionBody(BaseModel):
    """Temporal action body for module price management."""
    action: str = "add"          # "update" | "add" | "set" | "delete" | "close"
    price_id: Optional[uuid.UUID] = None  # row identifier for "update" action
    base_price_ils: Decimal = Decimal("0")
    per_seat_ils: Decimal = Decimal("0")
    included_seats: int = 0
    setup_fee_ils: Decimal = Decimal("0")
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
    base_price_ils: Decimal = Decimal("0")
    per_seat_ils: Decimal = Decimal("0")
    included_seats: int = 0
    setup_fee_ils: Decimal = Decimal("0")


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
