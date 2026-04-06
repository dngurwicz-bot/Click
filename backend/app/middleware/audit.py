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
    ACTION_SUFFIX_MAP = {
        "finalize": "finalize",
        "mark-paid": "mark_paid",
        "mark_paid": "mark_paid",
        "temporal": "update",
        "record": "update",
        "apply-template": "apply_template",
        "apply_template": "apply_template",
    }

    @staticmethod
    def _parse_path(path: str) -> tuple[str, uuid.UUID | None, str | None]:
        parts = [part for part in path.strip("/").split("/") if part]
        if parts[:2] == ["api", "admin"]:
            parts = parts[2:]

        explicit_action = None
        if parts and parts[-1] in AuditMiddleware.ACTION_SUFFIX_MAP:
            explicit_action = AuditMiddleware.ACTION_SUFFIX_MAP[parts[-1]]
            parts = parts[:-1]

        entity_type = parts[-1] if parts else "unknown"
        entity_id: uuid.UUID | None = None

        for index in range(len(parts) - 1, -1, -1):
            try:
                entity_id = uuid.UUID(parts[index])
                entity_type = parts[index - 1] if index > 0 else entity_type
                break
            except ValueError:
                continue

        return entity_type, entity_id, explicit_action

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

        entity_type, entity_id, explicit_action = self._parse_path(request.url.path)

        action = {
            "POST": "create",
            "PUT": "update",
            "PATCH": "update",
            "DELETE": "delete",
        }.get(request.method, request.method.lower())
        if explicit_action:
            action = explicit_action

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
