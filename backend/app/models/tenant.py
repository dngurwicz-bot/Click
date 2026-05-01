import uuid
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import String, Boolean, Date, DateTime, ForeignKey, Numeric, Integer, Text, func, CheckConstraint, Sequence
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from app.database import Base

_org_seq = Sequence("tenants_org_seq")


class Tenant(Base):
    __tablename__ = "tenants"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_number: Mapped[int] = mapped_column(
        Integer, _org_seq, server_default=_org_seq.next_value(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class TenantIdentity(Base):
    __tablename__ = "tenant_identity"
    __table_args__ = (
        CheckConstraint(
            "entity_type IN ('company','self_employed','nonprofit','gov')",
            name="ck_tenant_identity_entity_type",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.tenant_id"), nullable=False)
    name_he: Mapped[str] = mapped_column(String, nullable=False)
    name_en: Mapped[str | None] = mapped_column(String, nullable=True)
    tax_id: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    entity_type: Mapped[str] = mapped_column(String, nullable=False)
    logo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    industry_code: Mapped[str | None] = mapped_column(String, nullable=True)
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class TenantContact(Base):
    __tablename__ = "tenant_contact"
    __table_args__ = (
        CheckConstraint(
            "contact_type IN ('main','billing','technical','other')",
            name="ck_tenant_contact_type",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.tenant_id"), nullable=False)
    contact_type: Mapped[str] = mapped_column(String, nullable=False, default="main")
    email: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    phone_alt: Mapped[str | None] = mapped_column(String, nullable=True)
    contact_name: Mapped[str | None] = mapped_column(String, nullable=True)
    website: Mapped[str | None] = mapped_column(String, nullable=True)
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class TenantAddress(Base):
    __tablename__ = "tenant_address"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.tenant_id"), nullable=False)
    street: Mapped[str] = mapped_column(String, nullable=False)
    city: Mapped[str] = mapped_column(String, nullable=False)
    zip_code: Mapped[str | None] = mapped_column(String, nullable=True)
    country: Mapped[str] = mapped_column(String, nullable=False, default="IL")
    addr_type: Mapped[str] = mapped_column(String, nullable=False, default="main")
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class TenantSubscription(Base):
    __tablename__ = "tenant_subscription"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.tenant_id"), nullable=False)
    billing_cycle: Mapped[str] = mapped_column(String, nullable=False, default="monthly")
    currency: Mapped[str] = mapped_column(String, nullable=False, default="ILS")
    template_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("org_templates.id"), nullable=True)
    seat_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    selected_module_slugs: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    discount_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    is_price_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    next_renewal_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class TenantSubscriptionModule(Base):
    __tablename__ = "tenant_subscription_modules"
    __table_args__ = (
        CheckConstraint(
            "source_type IN ('template','manual')",
            name="ck_tenant_subscription_module_source_type",
        ),
        CheckConstraint(
            "status IN ('active','removed')",
            name="ck_tenant_subscription_module_status",
        ),
        CheckConstraint(
            "pricing_mode IN ('catalog','override')",
            name="ck_tenant_subscription_module_pricing_mode",
        ),
        CheckConstraint(
            "seats >= 0 AND allocated_seats >= 0 AND extra_seats >= 0 AND (override_included_seats IS NULL OR override_included_seats >= 0)",
            name="ck_tsm_non_negative_counts",
        ),
        CheckConstraint(
            "valid_to IS NULL OR valid_to >= valid_from",
            name="ck_tsm_valid_window",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_subscription_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenant_subscription.id", ondelete="CASCADE"), nullable=False
    )
    module_slug: Mapped[str] = mapped_column(String, ForeignKey("modules.slug"), nullable=False)
    source_type: Mapped[str] = mapped_column(String, nullable=False, default="template")
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")
    seats: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    allocated_seats: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    extra_seats: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pricing_mode: Mapped[str] = mapped_column(String, nullable=False, default="catalog")
    override_base_price_ils: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    override_per_seat_ils: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    override_setup_fee_ils: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    override_included_seats: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price_lock_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class TenantStatus(Base):
    __tablename__ = "tenant_status"
    __table_args__ = (
        CheckConstraint(
            "status IN ('trial','active','suspended','cancelled')",
            name="ck_tenant_status_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.tenant_id"), nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="trial")
    reason: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
