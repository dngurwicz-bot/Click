import uuid
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import String, Date, DateTime, ForeignKey, Numeric, Integer, func, Text, CheckConstraint, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Invoice(Base):
    """Invoice header — one per tenant per billing period."""
    __tablename__ = "invoices"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft','sent','paid','overdue','cancelled')",
            name="ck_invoice_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_number: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.tenant_id"), nullable=False)
    billing_period: Mapped[str] = mapped_column(String(7), nullable=False)   # "YYYY-MM"
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    subtotal_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    discount_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    vat_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("17.00"))
    vat_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    total_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    payment_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    payment_ref: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BillingCharge(Base):
    """A single charge line for a tenant — linked to a module and billing period."""
    __tablename__ = "billing_charges"
    __table_args__ = (
        CheckConstraint(
            "charge_type IN ('base_fee','per_seat','setup_fee','addon','credit','manual')",
            name="ck_billing_charge_type",
        ),
        CheckConstraint(
            "status IN ('pending','invoiced','cancelled')",
            name="ck_billing_charge_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.tenant_id"), nullable=False)
    billing_period: Mapped[str] = mapped_column(String(7), nullable=False)   # "YYYY-MM"
    charge_type: Mapped[str] = mapped_column(String(16), nullable=False, default="base_fee")
    module_slug: Mapped[str | None] = mapped_column(String, ForeignKey("modules.slug"), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False, default=1)
    unit_price_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    amount_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    discount_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    amount_after_discount_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    invoice_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class InvoiceLine(Base):
    """A line item on an invoice, tracing back to the source charge."""
    __tablename__ = "invoice_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False
    )
    charge_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("billing_charges.id"), nullable=True
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False, default=1)
    unit_price_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    amount_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=10)


class Quote(Base):
    """Quote/proposal document — sent to prospects or existing tenants."""
    __tablename__ = "quotes"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft','sent','accepted','declined','expired')",
            name="ck_quote_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quote_number: Mapped[str | None] = mapped_column(String(32), nullable=True, unique=True)  # assigned on send
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.tenant_id"), nullable=True)
    prospect_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    prospect_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    valid_until: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    discount_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("0"))
    vat_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("17.00"))
    subtotal_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    discount_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    vat_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    total_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    converted_invoice_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class QuoteLine(Base):
    """A line item inside a Quote."""
    __tablename__ = "quote_lines"
    __table_args__ = (
        CheckConstraint(
            "charge_type IN ('base_fee','per_seat','setup_fee','addon','manual')",
            name="ck_quote_line_charge_type",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quote_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quotes.id", ondelete="CASCADE"), nullable=False
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False, default=Decimal("1"))
    unit_price_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    amount_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    discount_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("0"))
    amount_after_discount_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    module_slug: Mapped[str | None] = mapped_column(String, ForeignKey("modules.slug"), nullable=True)
    charge_type: Mapped[str] = mapped_column(String(16), nullable=False, default="manual")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=10)


class BillingSettings(Base):
    """Singleton-like issuer profile used for invoice rendering."""
    __tablename__ = "billing_settings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    issuer_name_he: Mapped[str] = mapped_column(String(255), nullable=False)
    issuer_name_en: Mapped[str | None] = mapped_column(String(255), nullable=True)
    issuer_tax_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    issuer_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    issuer_phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    issuer_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    issuer_logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    payment_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    footer_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    invoice_primary_color: Mapped[str] = mapped_column(String(16), nullable=False, default="#1e3a8a")
    invoice_layout: Mapped[str] = mapped_column(String(32), nullable=False, default="modern")
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class TenantPaymentRecord(Base):
    """Documentation-only payment tracking for tenants billed in an external system."""

    __tablename__ = "tenant_payment_records"
    __table_args__ = (
        CheckConstraint(
            "status IN ('unreported','paid','unpaid','partial','waived')",
            name="ck_tenant_payment_record_status",
        ),
        UniqueConstraint("tenant_id", "billing_period", name="uq_tenant_payment_record_period"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.tenant_id"), nullable=False)
    billing_period: Mapped[str] = mapped_column(String(7), nullable=False)
    scheduled_charge_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="unreported")
    amount_ils: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    paid_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    external_ref: Mapped[str | None] = mapped_column(String(128), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
