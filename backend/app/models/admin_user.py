import uuid
from datetime import datetime, date
from sqlalchemy import String, Boolean, DateTime, Date, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class AdminUser(Base):
    __tablename__ = "admin_users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    role: Mapped[str] = mapped_column(
        String,
        nullable=False,
        default="admin",
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    valid_from: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)
