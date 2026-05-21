import uuid
import httpx
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update

from app.database import get_db
from app.config import get_settings
from app.middleware.auth import require_permission, CurrentUser
from app.models.admin_user import AdminUser
from app.models.admin_user_permission import AdminUserPermission, RESOURCES
from app.schemas.admin_user import (
    AdminUserCreate, AdminUserUpdate, AdminUserOut, AdminUserActionBody,
    PermissionOut, DEFAULT_PERMISSIONS, ALL_RESOURCES,
)

router = APIRouter(prefix="/api/admin/users", tags=["admin_users"])
settings = get_settings()


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _load_permissions(db: AsyncSession, user_id: uuid.UUID) -> list[PermissionOut]:
    result = await db.execute(
        select(AdminUserPermission).where(AdminUserPermission.user_id == user_id)
    )
    rows = result.scalars().all()
    perm_map = {r.resource: r for r in rows}
    # Always return all resources in fixed order
    return [
        PermissionOut(
            resource=res,
            can_view=perm_map[res].can_view if res in perm_map else False,
            can_edit=perm_map[res].can_edit if res in perm_map else False,
            can_manage_sensitive=perm_map[res].can_manage_sensitive if res in perm_map else False,
        )
        for res in ALL_RESOURCES
    ]


async def _upsert_permissions(
    db: AsyncSession,
    user_id: uuid.UUID,
    permissions_in: list,
) -> None:
    # Delete existing
    await db.execute(
        delete(AdminUserPermission).where(AdminUserPermission.user_id == user_id)
    )
    # Insert new
    for p in permissions_in:
        # can_edit implies can_view
        can_view = p.can_view or p.can_edit
        db.add(AdminUserPermission(
            user_id=user_id,
            resource=p.resource,
            can_view=can_view,
            can_edit=p.can_edit,
            can_manage_sensitive=(p.can_manage_sensitive if p.resource == "core" else False),
        ))


def _default_permissions_for_role(role: str) -> list:
    """Build PermissionIn-compatible list from role defaults."""
    from app.schemas.admin_user import PermissionIn
    defaults = DEFAULT_PERMISSIONS.get(role, {})
    return [
        PermissionIn(
            resource=res,
            can_view=defaults.get(res, {}).get("can_view", False),
            can_edit=defaults.get(res, {}).get("can_edit", False),
            can_manage_sensitive=defaults.get(res, {}).get("can_manage_sensitive", False),
        )
        for res in ALL_RESOURCES
    ]


def _validate_role_tenant_scope(role: str, tenant_id: uuid.UUID | None) -> None:
    if role == "org_admin":
        if tenant_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": "tenant_id is required for org_admin users", "code": "BAD_REQUEST"},
            )
        return

    if tenant_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "tenant_id is only allowed for org_admin users", "code": "BAD_REQUEST"},
        )


def _resolve_role_tenant_update(
    user: AdminUser,
    requested_role: str | None,
    requested_tenant_id: uuid.UUID | None,
) -> tuple[str, uuid.UUID | None]:
    effective_role = requested_role or user.role

    if effective_role == "org_admin":
        effective_tenant_id = requested_tenant_id if requested_tenant_id is not None else user.tenant_id
        _validate_role_tenant_scope(effective_role, effective_tenant_id)
        return effective_role, effective_tenant_id

    _validate_role_tenant_scope(effective_role, None if requested_tenant_id is None else requested_tenant_id)
    return effective_role, None


async def _create_firebase_user(email: str, password: str) -> uuid.UUID:
    """Create user in Firebase Auth and return a generated UUID."""
    try:
        from firebase_admin import auth
        user_id = uuid.uuid4()
        auth.create_user(
            uid=str(user_id),
            email=email,
            password=password,
            email_verified=True,
        )
        return user_id
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": str(e), "code": "FIREBASE_ERROR"},
        )


async def _delete_firebase_user(user_id: uuid.UUID) -> None:
    """Remove user from Firebase Auth (best-effort, no raise on failure)."""
    try:
        from firebase_admin import auth
        auth.delete_user(str(user_id))
    except Exception:
        pass


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[AdminUserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("users", "view")),
):
    result = await db.execute(select(AdminUser).order_by(AdminUser.created_at.desc()))
    users = result.scalars().all()
    user_ids = [u.id for u in users]

    # ── BATCH LOAD: All permissions for all users ──
    perm_res = await db.execute(
        select(AdminUserPermission).where(AdminUserPermission.user_id.in_(user_ids))
    )
    perms_all = perm_res.scalars().all()
    perms_by_user = {}
    for p in perms_all:
        perms_by_user.setdefault(p.user_id, {})[p.resource] = p

    out = []
    for u in users:
        user_perms = perms_by_user.get(u.id, {})
        # Always return all resources in fixed order
        perms_out = [
            PermissionOut(
                resource=res,
                can_view=user_perms[res].can_view if res in user_perms else False,
                can_edit=user_perms[res].can_edit if res in user_perms else False,
                can_manage_sensitive=user_perms[res].can_manage_sensitive if res in user_perms else False,
            )
            for res in ALL_RESOURCES
        ]
        obj = AdminUserOut.model_validate(u)
        obj.permissions = perms_out
        out.append(obj)
    return out


@router.post("", response_model=AdminUserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: AdminUserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("users", "edit")),
):
    # Only super_admin can create another super_admin
    if body.role == "super_admin" and not current_user.is_super_admin():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "Only super_admin can create super_admin users", "code": "FORBIDDEN"},
        )

    # org_admin requires a tenant_id
    _validate_role_tenant_scope(body.role, body.tenant_id)

    # Check duplicate email in our table
    existing = await db.execute(select(AdminUser).where(AdminUser.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "Email already exists", "code": "DUPLICATE_EMAIL"},
        )

    # Create in Supabase Auth
    supabase_id = await _create_firebase_user(body.email, body.password)

    # Create in our admin_users table
    user = AdminUser(
        id=supabase_id,
        full_name=body.full_name,
        email=body.email,
        role=body.role,
        tenant_id=body.tenant_id,
        created_by=current_user.id,
        valid_from=body.valid_from or date.today(),
    )
    db.add(user)
    await db.flush()  # get ID before permissions insert

    # Resolve permissions
    perms_in = body.permissions if body.permissions is not None else _default_permissions_for_role(body.role)
    await _upsert_permissions(db, user.id, perms_in)

    await db.commit()
    await db.refresh(user)

    perms_out = await _load_permissions(db, user.id)
    obj = AdminUserOut.model_validate(user)
    obj.permissions = perms_out
    return obj


@router.put("/{user_id}", response_model=AdminUserOut)
async def update_user(
    user_id: uuid.UUID,
    body: AdminUserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("users", "edit")),
):
    result = await db.execute(select(AdminUser).where(AdminUser.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail={"error": "User not found", "code": "NOT_FOUND"})

    # Self-protection: cannot change own role or deactivate yourself
    if user_id == current_user.id:
        if body.role is not None and body.role != user.role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": "Cannot change your own role", "code": "SELF_ROLE_CHANGE"},
            )
        if body.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": "Cannot deactivate your own account", "code": "SELF_DEACTIVATE"},
            )

    # Prevent demoting last super_admin
    if body.role is not None and user.role == "super_admin" and body.role != "super_admin":
        count_result = await db.execute(
            select(AdminUser).where(
                AdminUser.role == "super_admin",
                AdminUser.is_active == True,  # noqa: E712
            )
        )
        active_super_admins = count_result.scalars().all()
        if len(active_super_admins) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": "Cannot demote the last super_admin", "code": "LAST_SUPER_ADMIN"},
            )

    resolved_role, resolved_tenant_id = _resolve_role_tenant_update(user, body.role, body.tenant_id)

    if body.full_name is not None:
        user.full_name = body.full_name
    user.role = resolved_role
    user.tenant_id = resolved_tenant_id
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.valid_from is not None:
        user.valid_from = body.valid_from
    if body.valid_to is not None:
        user.valid_to = body.valid_to

    if body.permissions is not None:
        await _upsert_permissions(db, user.id, body.permissions)

    await db.commit()
    await db.refresh(user)

    perms_out = await _load_permissions(db, user.id)
    obj = AdminUserOut.model_validate(user)
    obj.permissions = perms_out
    return obj


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("users", "edit")),
):
    result = await db.execute(select(AdminUser).where(AdminUser.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail={"error": "User not found", "code": "NOT_FOUND"})

    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "Cannot delete your own account", "code": "SELF_DELETE"},
        )

    # Prevent deleting last super_admin
    if user.role == "super_admin":
        count_result = await db.execute(
            select(AdminUser).where(
                AdminUser.role == "super_admin",
                AdminUser.is_active == True,  # noqa: E712
            )
        )
        if len(count_result.scalars().all()) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": "Cannot delete the last super_admin", "code": "LAST_SUPER_ADMIN"},
            )

    # Remove from Supabase Auth (best-effort)
    await _delete_firebase_user(user_id)

    # Permissions cascade-deleted by FK
    await db.delete(user)
    await db.commit()


@router.put("/{user_id}/temporal", response_model=AdminUserOut)
async def temporal_user_action(
    user_id: uuid.UUID,
    body: AdminUserActionBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("users", "edit")),
):
    """Temporal actions: update (in-place) | close (set valid_to) | delete."""
    result = await db.execute(select(AdminUser).where(AdminUser.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail={"error": "User not found", "code": "NOT_FOUND"})

    action = body.action or "update"

    # ── Action: delete ────────────────────────────────────────────────────────
    if action == "delete":
        if user_id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": "Cannot delete your own account", "code": "SELF_DELETE"},
            )
        if user.role == "super_admin":
            count_result = await db.execute(
                select(AdminUser).where(
                    AdminUser.role == "super_admin",
                    AdminUser.is_active == True,  # noqa: E712
                )
            )
            if len(count_result.scalars().all()) <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"error": "Cannot delete the last super_admin", "code": "LAST_SUPER_ADMIN"},
                )
        await _delete_firebase_user(user_id)
        await db.delete(user)
        await db.commit()
        return user  # already loaded; return before commit clears it (won't be used by response after 204)

    # ── Action: close ─────────────────────────────────────────────────────────
    if action == "close":
        if not body.valid_to:
            raise HTTPException(
                status_code=422,
                detail={"error": "Close action requires valid_to", "code": "MISSING_DATE"},
            )
        await db.execute(
            update(AdminUser)
            .where(AdminUser.id == user_id)
            .values(valid_to=body.valid_to)
            .execution_options(synchronize_session=False)
        )
        await db.commit()
        await db.refresh(user)
        perms_out = await _load_permissions(db, user.id)
        obj = AdminUserOut.model_validate(user)
        obj.permissions = perms_out
        return obj

    # ── Action: update (in-place) ─────────────────────────────────────────────
    if action == "update":
        # Self-protection checks
        if user_id == current_user.id:
            if body.role is not None and body.role != user.role:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"error": "Cannot change your own role", "code": "SELF_ROLE_CHANGE"},
                )
            if body.is_active is False:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"error": "Cannot deactivate your own account", "code": "SELF_DEACTIVATE"},
                )

        # Prevent demoting last super_admin
        if body.role is not None and user.role == "super_admin" and body.role != "super_admin":
            count_result = await db.execute(
                select(AdminUser).where(
                    AdminUser.role == "super_admin",
                    AdminUser.is_active == True,  # noqa: E712
                )
            )
            active_super_admins = count_result.scalars().all()
            if len(active_super_admins) <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"error": "Cannot demote the last super_admin", "code": "LAST_SUPER_ADMIN"},
                )

        resolved_role, resolved_tenant_id = _resolve_role_tenant_update(user, body.role, body.tenant_id)

        if body.full_name is not None:
            user.full_name = body.full_name
        user.role = resolved_role
        user.tenant_id = resolved_tenant_id
        if body.is_active is not None:
            user.is_active = body.is_active
        if body.valid_from is not None:
            user.valid_from = body.valid_from
        if body.valid_to is not None:
            user.valid_to = body.valid_to

        if body.permissions is not None:
            await _upsert_permissions(db, user.id, body.permissions)

        await db.commit()
        await db.refresh(user)

        perms_out = await _load_permissions(db, user.id)
        obj = AdminUserOut.model_validate(user)
        obj.permissions = perms_out
        return obj

    raise HTTPException(
        status_code=422,
        detail={"error": f"Unknown action: {action}", "code": "UNKNOWN_ACTION"},
    )
