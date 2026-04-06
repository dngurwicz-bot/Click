import uuid
from typing import Optional

import sqlalchemy as sa
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser, require_permission
from app.models.admin_user import AdminUser
from app.models.audit_log import AuditLog
from app.schemas.audit import AuditLogOut

router = APIRouter(prefix="/api/admin/audit", tags=["audit"])


@router.get("", response_model=list[AuditLogOut])
async def list_audit_logs(
    search: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    actor_id: Optional[uuid.UUID] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("audit", "view")),
):
    q = (
        sa.select(AuditLog, AdminUser.full_name, AdminUser.email)
        .outerjoin(AdminUser, AdminUser.id == AuditLog.actor_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )

    if action:
        q = q.where(AuditLog.action == action)
    if entity_type:
        q = q.where(AuditLog.entity_type == entity_type)
    if actor_id:
        q = q.where(AuditLog.actor_id == actor_id)
    if search:
        term = f"%{search.strip()}%"
        q = q.where(
            sa.or_(
                AuditLog.action.ilike(term),
                AuditLog.entity_type.ilike(term),
                sa.cast(AuditLog.entity_id, sa.String).ilike(term),
                sa.cast(AuditLog.actor_id, sa.String).ilike(term),
                AdminUser.full_name.ilike(term),
                AdminUser.email.ilike(term),
            )
        )

    result = await db.execute(q)
    rows = result.all()
    return [
        AuditLogOut(
            id=audit.id,
            tenant_id=audit.tenant_id,
            actor_id=audit.actor_id,
            actor_name=full_name,
            actor_email=email,
            actor_type=audit.actor_type,
            action=audit.action,
            entity_type=audit.entity_type,
            entity_id=audit.entity_id,
            old_values=audit.old_values,
            new_values=audit.new_values,
            ip_address=audit.ip_address,
            created_at=audit.created_at,
        )
        for audit, full_name, email in rows
    ]
