import uuid
from sqlalchemy import Boolean, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
from app.config import get_settings

settings = get_settings()

RESOURCES = ["tenants", "lookups", "modules", "reports", "users", "templates", "audit"]
if settings.BILLING_ENABLED:
    RESOURCES.insert(4, "billing")


class AdminUserPermission(Base):
    __tablename__ = "admin_user_permissions"
    __table_args__ = (UniqueConstraint("user_id", "resource", name="uq_user_resource"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default="gen_random_uuid()"
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("admin_users.id", ondelete="CASCADE"),
        nullable=False,
    )
    resource: Mapped[str] = mapped_column(String, nullable=False)
    can_view: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    can_edit: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
