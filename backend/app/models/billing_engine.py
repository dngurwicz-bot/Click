import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class BillingContract(Base):
    __tablename__ = "billing_contracts"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft','active','paused','cancelled')",
            name="ck_billing_contract_status",
        ),
        CheckConstraint(
            "billing_cycle IN ('monthly','quarterly','yearly')",
            name="ck_billing_contract_cycle",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.tenant_id"), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    billing_cycle: Mapped[str] = mapped_column(String(16), nullable=False, default="monthly")
    anchor_day: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="Asia/Jerusalem")
    payment_terms_days: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="ILS")
    credit_balance_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    next_renewal_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class BillingContractItem(Base):
    __tablename__ = "billing_contract_items"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active','removed')",
            name="ck_billing_contract_item_status",
        ),
        CheckConstraint(
            "rating_model IN ('flat','per_seat','tiered')",
            name="ck_billing_contract_item_rating_model",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("billing_contracts.id", ondelete="CASCADE"), nullable=False
    )
    module_slug: Mapped[str] = mapped_column(String, ForeignKey("modules.slug"), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    rating_model: Mapped[str] = mapped_column(String(16), nullable=False, default="flat")
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    base_amount_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    included_qty: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    per_unit_amount_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    tier_definition: Mapped[list[dict] | None] = mapped_column(JSONB, nullable=True)
    setup_fee_amount_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    discount_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("0"))
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class BillingChangeEvent(Base):
    __tablename__ = "billing_change_events"
    __table_args__ = (
        CheckConstraint(
            "event_type IN ('start_contract','add_module','remove_module','change_quantity','override_price','cancel_contract')",
            name="ck_billing_change_event_type",
        ),
        CheckConstraint(
            "status IN ('preview','applied','cancelled')",
            name="ck_billing_change_event_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("billing_contracts.id"), nullable=False)
    contract_item_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("billing_contract_items.id"), nullable=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.tenant_id"), nullable=False)
    module_slug: Mapped[str | None] = mapped_column(String, ForeignKey("modules.slug"), nullable=True)
    event_type: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="preview")
    effective_at: Mapped[date] = mapped_column(Date, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    preview_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=True)
    applied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BillingBillRun(Base):
    __tablename__ = "billing_bill_runs"
    __table_args__ = (
        CheckConstraint(
            "run_type IN ('renewal','adjustment')",
            name="ck_billing_bill_run_type",
        ),
        CheckConstraint(
            "status IN ('pending','completed','failed')",
            name="ck_billing_bill_run_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("billing_contracts.id"), nullable=True)
    run_type: Mapped[str] = mapped_column(String(16), nullable=False)
    target_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    idempotency_key: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=True)
    summary: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BillingDocument(Base):
    __tablename__ = "billing_documents"
    __table_args__ = (
        CheckConstraint(
            "document_type IN ('invoice','credit_note')",
            name="ck_billing_document_type",
        ),
        CheckConstraint(
            "status IN ('draft','draft_blocked','issued','paid','overdue','void')",
            name="ck_billing_document_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.tenant_id"), nullable=False)
    contract_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("billing_contracts.id"), nullable=True)
    bill_run_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("billing_bill_runs.id"), nullable=True)
    document_type: Mapped[str] = mapped_column(String(16), nullable=False, default="invoice")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    document_number: Mapped[str | None] = mapped_column(String(32), nullable=True, unique=True)
    issue_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    subtotal_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    discount_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    credit_applied_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    vat_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("17.00"))
    vat_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    total_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    paid_amount_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    payment_ref: Mapped[str | None] = mapped_column(String(128), nullable=True)
    paid_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("admin_users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BillingLedgerEntry(Base):
    __tablename__ = "billing_ledger_entries"
    __table_args__ = (
        CheckConstraint(
            "entry_type IN ('recurring','setup_fee','proration_debit','credit','manual_adjustment','carry_forward_credit')",
            name="ck_billing_ledger_entry_type",
        ),
        CheckConstraint(
            "status IN ('open','documented','void')",
            name="ck_billing_ledger_entry_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("billing_contracts.id"), nullable=False)
    contract_item_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("billing_contract_items.id"), nullable=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.tenant_id"), nullable=False)
    module_slug: Mapped[str | None] = mapped_column(String, ForeignKey("modules.slug"), nullable=True)
    change_event_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("billing_change_events.id"), nullable=True)
    document_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("billing_documents.id"), nullable=True)
    bill_run_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("billing_bill_runs.id"), nullable=True)
    entry_type: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="open")
    source_key: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    service_period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    service_period_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False, default=Decimal("1"))
    unit_amount_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    gross_amount_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    discount_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("0"))
    net_amount_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    metadata_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BillingDocumentLine(Base):
    __tablename__ = "billing_document_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("billing_documents.id", ondelete="CASCADE"), nullable=False
    )
    ledger_entry_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("billing_ledger_entries.id"), nullable=True
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False, default=Decimal("1"))
    unit_amount_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    amount_ils: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
