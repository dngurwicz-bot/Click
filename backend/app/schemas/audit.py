import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AuditLogOut(BaseModel):
    id: uuid.UUID
    tenant_id: Optional[uuid.UUID] = None
    actor_id: uuid.UUID
    actor_name: Optional[str] = None
    actor_email: Optional[str] = None
    actor_type: str
    action: str
    entity_type: str
    entity_id: Optional[uuid.UUID] = None
    old_values: Optional[dict] = None
    new_values: Optional[dict] = None
    ip_address: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
