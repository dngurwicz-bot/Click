import uuid
from datetime import datetime, date
from sqlalchemy import String, Boolean, Date, DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class SeatChangeLog(Base):
    """Immutable log of every seat-count change on a subscription module.

    Used during billing to generate pro-rata charges for the delta
    (positive delta → additional per_seat charge; negative → credit charge).
    Entries are marked as billed once a proration charge is created.
    """
    __tablename__ = "seat_change_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subscription_module_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenant_subscription_modules.id", ondelete="CASCADE"), nullable=False
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.tenant_id"), nullable=False)
    module_slug: Mapped[str] = mapped_column(String, ForeignKey("modules.slug"), nullable=False)
    old_seats: Mapped[int] = mapped_column(Integer, nullable=False)
    new_seats: Mapped[int] = mapped_column(Integer, nullable=False)
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
    billed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    billing_period: Mapped[str | None] = mapped_column(String(7), nullable=True)   # YYYY-MM
    proration_charge_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("billing_charges.id"), nullable=True
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
