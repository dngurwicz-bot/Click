from pydantic import BaseModel, EmailStr
import uuid
from datetime import datetime, date
from typing import Literal, Optional
from app.config import get_settings

settings = get_settings()

if settings.BILLING_ENABLED:
    RESOURCE_NAMES = Literal["tenants", "lookups", "modules", "reports", "billing", "core", "users", "templates", "audit"]
    ROLE_NAMES = Literal["super_admin", "admin", "support", "billing", "org_admin"]
else:
    RESOURCE_NAMES = Literal["tenants", "lookups", "modules", "reports", "core", "users", "templates", "audit"]
    ROLE_NAMES = Literal["super_admin", "admin", "support", "org_admin"]

# Default permissions per role (applied when creating a user)
DEFAULT_PERMISSIONS: dict[str, dict[str, dict]] = {
    "admin": {
        "tenants":   {"can_view": True,  "can_edit": True},
        "lookups":   {"can_view": True,  "can_edit": True},
        "modules":   {"can_view": True,  "can_edit": False},
        "reports":   {"can_view": True,  "can_edit": True},
        "core":      {"can_view": True,  "can_edit": True,  "can_manage_sensitive": True},
        "users":     {"can_view": False, "can_edit": False},
        "templates": {"can_view": True,  "can_edit": True},
        "audit":     {"can_view": True,  "can_edit": False},
    },
    "support": {
        "tenants":   {"can_view": True,  "can_edit": False},
        "lookups":   {"can_view": True,  "can_edit": False},
        "modules":   {"can_view": False, "can_edit": False},
        "reports":   {"can_view": True,  "can_edit": False},
        "core":      {"can_view": True,  "can_edit": False, "can_manage_sensitive": False},
        "users":     {"can_view": False, "can_edit": False},
        "templates": {"can_view": False, "can_edit": False},
        "audit":     {"can_view": False, "can_edit": False},
    },
}

if settings.BILLING_ENABLED:
    DEFAULT_PERMISSIONS["admin"]["billing"] = {"can_view": True, "can_edit": True}
    DEFAULT_PERMISSIONS["support"]["billing"] = {"can_view": True, "can_edit": False}
    DEFAULT_PERMISSIONS["billing"] = {
        "tenants":   {"can_view": False, "can_edit": False},
        "lookups":   {"can_view": False, "can_edit": False},
        "modules":   {"can_view": True,  "can_edit": False},
        "reports":   {"can_view": True,  "can_edit": False},
        "billing":   {"can_view": True,  "can_edit": True},
        "core":      {"can_view": False, "can_edit": False, "can_manage_sensitive": False},
        "users":     {"can_view": False, "can_edit": False},
        "templates": {"can_view": False, "can_edit": False},
        "audit":     {"can_view": False, "can_edit": False},
    }

ALL_RESOURCES = ["tenants", "lookups", "modules", "reports", "core", "users", "templates", "audit"]
if settings.BILLING_ENABLED:
    ALL_RESOURCES.insert(4, "billing")


class PermissionIn(BaseModel):
    resource: str
    can_view: bool = False
    can_edit: bool = False
    can_manage_sensitive: bool = False


class PermissionOut(BaseModel):
    resource: str
    can_view: bool
    can_edit: bool
    can_manage_sensitive: bool

    model_config = {"from_attributes": True}


class AdminUserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: ROLE_NAMES = "admin"
    tenant_id: Optional[uuid.UUID] = None  # required when role == "org_admin"
    permissions: Optional[list[PermissionIn]] = None  # None = use role defaults
    valid_from: Optional[date] = None


class AdminUserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[ROLE_NAMES] = None
    is_active: Optional[bool] = None
    permissions: Optional[list[PermissionIn]] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None


class AdminUserOut(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    role: str
    tenant_id: Optional[uuid.UUID] = None
    is_active: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime
    permissions: list[PermissionOut] = []
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None

    model_config = {"from_attributes": True}


class AdminUserActionBody(BaseModel):
    """Temporal action body: update (in-place) | close (set valid_to) | delete."""
    action: str = "update"
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    permissions: Optional[list[PermissionIn]] = None
