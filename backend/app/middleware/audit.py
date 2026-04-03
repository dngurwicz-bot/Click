"""
Audit log middleware.
Automatically writes to audit_log after every mutating request (POST/PUT/PATCH/DELETE).
"""
import uuid
import json
from datetime import datetime
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal
from app.models.audit_log import AuditLog


class AuditMiddleware(BaseHTTPMiddleware):
    MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        if request.method not in self.MUTATING_METHODS:
            return response

        # Only log successful mutating requests (2xx)
        if not (200 <= response.status_code < 300):
            return response

        # Extract user info injected by auth middleware (if present)
        actor_id: uuid.UUID | None = getattr(request.state, "user_id", None)
        actor_type: str = getattr(request.state, "actor_type", "admin_user")
        tenant_id: uuid.UUID | None = getattr(request.state, "tenant_id", None)

        if actor_id is None:
            return response

        path_parts = request.url.path.strip("/").split("/")
        entity_type = path_parts[-2] if len(path_parts) >= 2 else path_parts[-1]
        entity_id_str = path_parts[-1] if len(path_parts) >= 2 else None
        try:
            entity_id = uuid.UUID(entity_id_str) if entity_id_str else None
        except (ValueError, AttributeError):
            entity_id = None

        action = {
            "POST": "create",
            "PUT": "update",
            "PATCH": "update",
            "DELETE": "delete",
        }.get(request.method, request.method.lower())

        ip_address = request.client.host if request.client else None

        async with AsyncSessionLocal() as session:
            log_entry = AuditLog(
                tenant_id=tenant_id,
                actor_id=actor_id,
                actor_type=actor_type,
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                ip_address=ip_address,
            )
            session.add(log_entry)
            await session.commit()

        return response
