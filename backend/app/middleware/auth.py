"""
JWT Authentication middleware.
Validates JWT tokens, extracts user_id + role + permissions.
"""
from typing import Optional
import uuid
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import APIKeyCookie
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import get_settings
from app.database import get_db
from app.models.admin_user import AdminUser
from app.models.admin_user_permission import AdminUserPermission

SESSION_COOKIE_NAME = "click_token"
SESSION_HINT_COOKIE_NAME = "click_session_present"

cookie_security = APIKeyCookie(name=SESSION_COOKIE_NAME, auto_error=False)
settings = get_settings()


class CurrentUser:
    def __init__(
        self,
        id: uuid.UUID,
        email: str,
        role: str,
        permissions: dict[str, dict[str, bool]],
        tenant_id: uuid.UUID | None = None,
    ):
        self.id = id
        self.email = email
        self.role = role
        self.tenant_id = tenant_id
        # permissions: {"tenants": {"can_view": True, "can_edit": False}, ...}
        self.permissions = permissions

    def is_super_admin(self) -> bool:
        return self.role == "super_admin"

    def is_org_admin(self) -> bool:
        return self.role == "org_admin"

    def can_view(self, resource: str) -> bool:
        if self.is_super_admin():
            return True
        return self.permissions.get(resource, {}).get("can_view", False)

    def can_edit(self, resource: str) -> bool:
        if self.is_super_admin():
            return True
        return self.permissions.get(resource, {}).get("can_edit", False)

    def can_manage_sensitive(self, resource: str) -> bool:
        if self.is_super_admin():
            return True
        return self.permissions.get(resource, {}).get("can_manage_sensitive", False)


async def get_current_user(
    request: Request,
    session_token: str | None = Depends(cookie_security),
    db: AsyncSession = Depends(get_db),
) -> CurrentUser:
    token = session_token or request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "Authentication required", "code": "AUTH_REQUIRED"},
        )
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            options={"verify_aud": False},
        )
        user_id_str: Optional[str] = payload.get("sub")
        if not user_id_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"error": "Token missing subject", "code": "INVALID_TOKEN"},
            )
        user_id = uuid.UUID(user_id_str)
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "Invalid or expired token", "code": "INVALID_TOKEN"},
        )

    result = await db.execute(
        select(AdminUser).where(AdminUser.id == user_id).where(AdminUser.is_active == True)  # noqa: E712
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "User not found or inactive", "code": "USER_NOT_FOUND"},
        )

    # Load permissions (super_admin skips this, they have full access anyway)
    perms: dict[str, dict[str, bool]] = {}
    if user.role != "super_admin":
        perm_result = await db.execute(
            select(AdminUserPermission).where(AdminUserPermission.user_id == user.id)
        )
        for p in perm_result.scalars().all():
            perms[p.resource] = {
                "can_view": p.can_view,
                "can_edit": p.can_edit,
                "can_manage_sensitive": getattr(p, "can_manage_sensitive", False),
            }

    current_user = CurrentUser(id=user.id, email=user.email, role=user.role, permissions=perms, tenant_id=user.tenant_id)
    request.state.user_id = user.id
    request.state.actor_type = "admin_user"
    request.state.tenant_id = user.tenant_id
    return current_user


def require_roles(*roles: str):
    """Dependency factory: raises 403 if the current user's role is not in the allowed list."""
    async def _check(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "Insufficient permissions", "code": "FORBIDDEN"},
            )
        return current_user
    return _check


def require_permission(resource: str, action: str = "view"):
    """
    Dependency factory: raises 403 if the user cannot perform action on resource.
    action: "view" | "edit" | "manage_sensitive"
    super_admin always passes.
    """
    async def _check(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.is_super_admin():
            return current_user
        if action == "view" and not current_user.can_view(resource):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": f"No view access to {resource}", "code": "FORBIDDEN"},
            )
        if action == "edit" and not current_user.can_edit(resource):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": f"No edit access to {resource}", "code": "FORBIDDEN"},
            )
        if action == "manage_sensitive" and not current_user.can_manage_sensitive(resource):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": f"No sensitive access to {resource}", "code": "FORBIDDEN"},
            )
        return current_user
    return _check


# Pre-built role dependencies
require_admin = require_roles("super_admin", "admin")
require_super_admin = require_roles("super_admin")
require_any = get_current_user


def require_org_or_system_admin():
    """Allows org_admin, super_admin, and admin roles to access org-scoped endpoints."""
    async def _check(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role not in ("org_admin", "super_admin", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "Insufficient permissions", "code": "FORBIDDEN"},
            )
        return current_user
    return _check


def get_enforced_tenant_id(
    tenant_id_param: uuid.UUID | None,
    current_user: CurrentUser,
) -> uuid.UUID:
    """
    For org_admin: always returns their own tenant_id, ignoring any param.
    For super_admin/admin: uses the provided tenant_id_param (required).
    """
    if current_user.is_org_admin():
        return current_user.tenant_id  # type: ignore[return-value]
    if tenant_id_param is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "tenant_id is required", "code": "BAD_REQUEST"},
        )
    return tenant_id_param
