"""billing engine v2

Revision ID: 0016
Revises: 0015
Create Date: 2026-04-10
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE IF NOT EXISTS billing_document_number_seq START 1")

    op.create_table(
        "billing_contracts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.tenant_id"), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="draft"),
        sa.Column("billing_cycle", sa.String(16), nullable=False, server_default="monthly"),
        sa.Column("anchor_day", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("timezone", sa.String(64), nullable=False, server_default="Asia/Jerusalem"),
        sa.Column("payment_terms_days", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("currency", sa.String(8), nullable=False, server_default="ILS"),
        sa.Column("credit_balance_ils", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("next_renewal_at", sa.Date(), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status IN ('draft','active','paused','cancelled')", name="ck_billing_contract_status"),
        sa.CheckConstraint("billing_cycle IN ('monthly','yearly')", name="ck_billing_contract_cycle"),
    )
    op.create_index("ix_billing_contracts_tenant_id", "billing_contracts", ["tenant_id"])
    op.create_index("ix_billing_contracts_status", "billing_contracts", ["status"])
    op.create_index("ix_billing_contracts_next_renewal_at", "billing_contracts", ["next_renewal_at"])

    op.create_table(
        "billing_contract_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("contract_id", UUID(as_uuid=True), sa.ForeignKey("billing_contracts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("module_slug", sa.String(), sa.ForeignKey("modules.slug"), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="active"),
        sa.Column("rating_model", sa.String(16), nullable=False, server_default="flat"),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("base_amount_ils", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("included_qty", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("per_unit_amount_ils", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("tier_definition", JSONB(), nullable=True),
        sa.Column("setup_fee_amount_ils", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("discount_pct", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date(), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status IN ('active','removed')", name="ck_billing_contract_item_status"),
        sa.CheckConstraint("rating_model IN ('flat','per_seat','tiered')", name="ck_billing_contract_item_rating_model"),
    )
    op.create_index("ix_billing_contract_items_contract_id", "billing_contract_items", ["contract_id"])
    op.create_index("ix_billing_contract_items_module_slug", "billing_contract_items", ["module_slug"])
    op.create_index("ix_billing_contract_items_effective_from", "billing_contract_items", ["effective_from"])

    op.create_table(
        "billing_change_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("contract_id", UUID(as_uuid=True), sa.ForeignKey("billing_contracts.id"), nullable=False),
        sa.Column("contract_item_id", UUID(as_uuid=True), sa.ForeignKey("billing_contract_items.id"), nullable=True),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.tenant_id"), nullable=False),
        sa.Column("module_slug", sa.String(), sa.ForeignKey("modules.slug"), nullable=True),
        sa.Column("event_type", sa.String(32), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="preview"),
        sa.Column("effective_at", sa.Date(), nullable=False),
        sa.Column("payload", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("preview_snapshot", JSONB(), nullable=True),
        sa.Column("idempotency_key", sa.String(128), nullable=True),
        sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(
            "event_type IN ('start_contract','add_module','remove_module','change_quantity','override_price','cancel_contract')",
            name="ck_billing_change_event_type",
        ),
        sa.CheckConstraint("status IN ('preview','applied','cancelled')", name="ck_billing_change_event_status"),
        sa.UniqueConstraint("idempotency_key", name="uq_billing_change_events_idempotency_key"),
    )
    op.create_index("ix_billing_change_events_contract_id", "billing_change_events", ["contract_id"])
    op.create_index("ix_billing_change_events_effective_at", "billing_change_events", ["effective_at"])

    op.create_table(
        "billing_bill_runs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("contract_id", UUID(as_uuid=True), sa.ForeignKey("billing_contracts.id"), nullable=True),
        sa.Column("run_type", sa.String(16), nullable=False),
        sa.Column("target_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("idempotency_key", sa.String(128), nullable=True),
        sa.Column("summary", JSONB(), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("run_type IN ('renewal','adjustment')", name="ck_billing_bill_run_type"),
        sa.CheckConstraint("status IN ('pending','completed','failed')", name="ck_billing_bill_run_status"),
        sa.UniqueConstraint("idempotency_key", name="uq_billing_bill_runs_idempotency_key"),
    )
    op.create_index("ix_billing_bill_runs_target_date", "billing_bill_runs", ["target_date"])

    op.create_table(
        "billing_documents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.tenant_id"), nullable=False),
        sa.Column("contract_id", UUID(as_uuid=True), sa.ForeignKey("billing_contracts.id"), nullable=True),
        sa.Column("bill_run_id", UUID(as_uuid=True), sa.ForeignKey("billing_bill_runs.id"), nullable=True),
        sa.Column("document_type", sa.String(16), nullable=False, server_default="invoice"),
        sa.Column("status", sa.String(16), nullable=False, server_default="draft"),
        sa.Column("document_number", sa.String(32), nullable=True),
        sa.Column("issue_date", sa.Date(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("subtotal_ils", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("discount_ils", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("credit_applied_ils", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("vat_pct", sa.Numeric(5, 2), nullable=False, server_default="17.00"),
        sa.Column("vat_ils", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("total_ils", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("paid_amount_ils", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("payment_ref", sa.String(128), nullable=True),
        sa.Column("paid_at", sa.Date(), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("document_type IN ('invoice','credit_note')", name="ck_billing_document_type"),
        sa.CheckConstraint("status IN ('draft','draft_blocked','issued','paid','overdue','void')", name="ck_billing_document_status"),
        sa.UniqueConstraint("document_number", name="uq_billing_documents_number"),
    )
    op.create_index("ix_billing_documents_tenant_id", "billing_documents", ["tenant_id"])
    op.create_index("ix_billing_documents_status", "billing_documents", ["status"])

    op.create_table(
        "billing_ledger_entries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("contract_id", UUID(as_uuid=True), sa.ForeignKey("billing_contracts.id"), nullable=False),
        sa.Column("contract_item_id", UUID(as_uuid=True), sa.ForeignKey("billing_contract_items.id"), nullable=True),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.tenant_id"), nullable=False),
        sa.Column("module_slug", sa.String(), sa.ForeignKey("modules.slug"), nullable=True),
        sa.Column("change_event_id", UUID(as_uuid=True), sa.ForeignKey("billing_change_events.id"), nullable=True),
        sa.Column("document_id", UUID(as_uuid=True), sa.ForeignKey("billing_documents.id"), nullable=True),
        sa.Column("bill_run_id", UUID(as_uuid=True), sa.ForeignKey("billing_bill_runs.id"), nullable=True),
        sa.Column("entry_type", sa.String(32), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="open"),
        sa.Column("source_key", sa.String(255), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("service_period_start", sa.Date(), nullable=True),
        sa.Column("service_period_end", sa.Date(), nullable=True),
        sa.Column("quantity", sa.Numeric(10, 4), nullable=False, server_default="1"),
        sa.Column("unit_amount_ils", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("gross_amount_ils", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("discount_pct", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("net_amount_ils", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("metadata_json", JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(
            "entry_type IN ('recurring','setup_fee','proration_debit','credit','manual_adjustment','carry_forward_credit')",
            name="ck_billing_ledger_entry_type",
        ),
        sa.CheckConstraint("status IN ('open','documented','void')", name="ck_billing_ledger_entry_status"),
        sa.UniqueConstraint("source_key", name="uq_billing_ledger_entries_source_key"),
    )
    op.create_index("ix_billing_ledger_entries_contract_id", "billing_ledger_entries", ["contract_id"])
    op.create_index("ix_billing_ledger_entries_document_id", "billing_ledger_entries", ["document_id"])
    op.create_index("ix_billing_ledger_entries_status", "billing_ledger_entries", ["status"])

    op.create_table(
        "billing_document_lines",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("document_id", UUID(as_uuid=True), sa.ForeignKey("billing_documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ledger_entry_id", UUID(as_uuid=True), sa.ForeignKey("billing_ledger_entries.id"), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("quantity", sa.Numeric(10, 4), nullable=False, server_default="1"),
        sa.Column("unit_amount_ils", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("amount_ils", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="10"),
    )
    op.create_index("ix_billing_document_lines_document_id", "billing_document_lines", ["document_id"])


def downgrade() -> None:
    op.drop_index("ix_billing_document_lines_document_id")
    op.drop_table("billing_document_lines")

    op.drop_index("ix_billing_ledger_entries_status")
    op.drop_index("ix_billing_ledger_entries_document_id")
    op.drop_index("ix_billing_ledger_entries_contract_id")
    op.drop_table("billing_ledger_entries")

    op.drop_index("ix_billing_documents_status")
    op.drop_index("ix_billing_documents_tenant_id")
    op.drop_table("billing_documents")

    op.drop_index("ix_billing_bill_runs_target_date")
    op.drop_table("billing_bill_runs")

    op.drop_index("ix_billing_change_events_effective_at")
    op.drop_index("ix_billing_change_events_contract_id")
    op.drop_table("billing_change_events")

    op.drop_index("ix_billing_contract_items_effective_from")
    op.drop_index("ix_billing_contract_items_module_slug")
    op.drop_index("ix_billing_contract_items_contract_id")
    op.drop_table("billing_contract_items")

    op.drop_index("ix_billing_contracts_next_renewal_at")
    op.drop_index("ix_billing_contracts_status")
    op.drop_index("ix_billing_contracts_tenant_id")
    op.drop_table("billing_contracts")

    op.execute("DROP SEQUENCE IF EXISTS billing_document_number_seq")
