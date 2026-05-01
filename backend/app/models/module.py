import uuid
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import String, Boolean, Date, DateTime, ForeignKey, Numeric, Integer, func, ARRAY, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Module(Base):
    __tablename__ = "modules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    icon: Mapped[str | None] = mapped_column(String, nullable=True)
    color_hex: Mapped[str | None] = mapped_column(String, nullable=True)
    is_required: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=10)
    depends_on: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)


class ModulePrice(Base):
    __tablename__ = "module_prices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module_slug: Mapped[str] = mapped_column(String, ForeignKey("modules.slug"), nullable=False)
    base_price_ils: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    per_seat_ils: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    included_seats: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    setup_fee_ils: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class OrgTemplate(Base):
    __tablename__ = "org_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_billing_cycle: Mapped[str] = mapped_column(String, default="monthly")
    trial_days: Mapped[int] = mapped_column(Integer, default=30)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=10)
    target_industry: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommended_size: Mapped[str | None] = mapped_column(Text, nullable=True)
    valid_from: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class OrgTemplateDefault(Base):
    __tablename__ = "org_template_defaults"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("org_templates.id"), nullable=False)
    default_type: Mapped[str] = mapped_column(String, nullable=False)
    default_value: Mapped[str] = mapped_column(String, nullable=False)
    is_mandatory: Mapped[bool] = mapped_column(Boolean, default=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class OrgTemplateModule(Base):
    __tablename__ = "org_template_modules"

    template_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("org_templates.id", ondelete="CASCADE"), primary_key=True)
    module_slug: Mapped[str] = mapped_column(String, ForeignKey("modules.slug", ondelete="CASCADE"), primary_key=True)
    # Per-module seat default — overrides the template-level seat_count default.
    # NULL means "use the template-level default".
    seats_default: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
