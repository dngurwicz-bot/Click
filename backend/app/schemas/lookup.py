from pydantic import BaseModel
import uuid
from datetime import datetime
from typing import Optional


class LookupItemBase(BaseModel):
    item_key:   str
    label_he:   str
    code:       Optional[str] = None
    sort_order: int = 0
    is_active:  bool = True


class LookupItemCreate(LookupItemBase):
    pass


class LookupItemUpdate(BaseModel):
    label_he:   Optional[str]  = None
    code:       Optional[str]  = None
    sort_order: Optional[int]  = None
    is_active:  Optional[bool] = None


class LookupItemOut(LookupItemBase):
    id:         uuid.UUID
    list_id:    uuid.UUID
    is_system:  bool
    created_at: datetime

    model_config = {"from_attributes": True}


class LookupListBase(BaseModel):
    list_key:    str
    name_he:     str
    description: Optional[str] = None
    is_active:   bool = True


class LookupListCreate(LookupListBase):
    scope: str = "org"


class LookupListUpdate(BaseModel):
    name_he:     Optional[str]  = None
    description: Optional[str]  = None
    is_active:   Optional[bool] = None


class LookupListOut(LookupListBase):
    id:         uuid.UUID
    scope:      str
    is_system:  bool
    created_at: datetime
    items:      list[LookupItemOut] = []

    model_config = {"from_attributes": True}


class LookupListItem(BaseModel):
    """For the parent list page (no items embedded)"""
    id:          uuid.UUID
    list_key:    str
    name_he:     str
    description: Optional[str]
    scope:       str
    is_system:   bool
    is_active:   bool
    item_count:  int
    created_at:  datetime

    model_config = {"from_attributes": True}
