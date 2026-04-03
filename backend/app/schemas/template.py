from pydantic import BaseModel
import uuid
from datetime import date, datetime
from typing import Optional


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
