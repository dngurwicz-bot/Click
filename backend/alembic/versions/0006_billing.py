"""billing: charges, invoices, invoice_lines

Revision ID: 0006
Revises: 0005
Create Date: 2026-03-31
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Invoice number sequence ───────────────────────────────────────────────
    op.execute("CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1")

    # ── invoices ─────────────────────────────────────────────────────────────
    op.create_table(
        "invoices",
        sa.Column("id",             UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("invoice_number", sa.String(32),      nullable=False),
        sa.Column("tenant_id",      UUID(as_uuid=True), sa.ForeignKey("tenants.tenant_id"), nullable=False),
        sa.Column("billing_period", sa.String(7),       nullable=False),
        sa.Column("issue_date",     sa.Date,            nullable=False),
        sa.Column("due_date",       sa.Date,            nullable=False),
        sa.Column("subtotal_ils",   sa.Numeric(12, 2),  nullable=False, server_default="0"),
        sa.Column("discount_ils",   sa.Numeric(12, 2),  nullable=False, server_default="0"),
        sa.Column("vat_pct",        sa.Numeric(5, 2),   nullable=False, server_default="17.00"),
        sa.Column("vat_ils",        sa.Numeric(12, 2),  nullable=False, server_default="0"),
        sa.Column("total_ils",      sa.Numeric(12, 2),  nullable=False, server_default="0"),
        sa.Column("status",         sa.String(16),      nullable=False, server_default="draft"),
        sa.Column("notes",          sa.Text,            nullable=True),
        sa.Column("payment_date",   sa.Date,            nullable=True),
        sa.Column("payment_ref",    sa.String(128),     nullable=True),
        sa.Column("created_by",     UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("created_at",     sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at",     sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("invoice_number", name="uq_invoice_number"),
        sa.CheckConstraint(
            "status IN ('draft','sent','paid','overdue','cancelled')",
            name="ck_invoice_status",
        ),
    )
    op.create_index("ix_invoices_tenant_id",      "invoices", ["tenant_id"])
    op.create_index("ix_invoices_billing_period", "invoices", ["billing_period"])
    op.create_index("ix_invoices_status",         "invoices", ["status"])

    # ── billing_charges ───────────────────────────────────────────────────────
    op.create_table(
        "billing_charges",
        sa.Column("id",                        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id",                 UUID(as_uuid=True), sa.ForeignKey("tenants.tenant_id"), nullable=False),
        sa.Column("billing_period",            sa.String(7),       nullable=False),
        sa.Column("charge_type",               sa.String(16),      nullable=False, server_default="base_fee"),
        sa.Column("module_slug",               sa.String,          sa.ForeignKey("modules.slug"), nullable=True),
        sa.Column("description",               sa.Text,            nullable=False),
        sa.Column("quantity",                  sa.Numeric(10, 4),  nullable=False, server_default="1"),
        sa.Column("unit_price_ils",            sa.Numeric(12, 2),  nullable=False, server_default="0"),
        sa.Column("amount_ils",                sa.Numeric(12, 2),  nullable=False, server_default="0"),
        sa.Column("discount_pct",              sa.Numeric(5, 2),   nullable=False, server_default="0"),
        sa.Column("amount_after_discount_ils", sa.Numeric(12, 2),  nullable=False, server_default="0"),
        sa.Column("status",                    sa.String(16),      nullable=False, server_default="pending"),
        sa.Column("invoice_id",                UUID(as_uuid=True), sa.ForeignKey("invoices.id"), nullable=True),
        sa.Column("notes",                     sa.Text,            nullable=True),
        sa.Column("created_by",                UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("created_at",                sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(
            "charge_type IN ('base_fee','per_seat','setup_fee','addon','credit','manual')",
            name="ck_billing_charge_type",
        ),
        sa.CheckConstraint(
            "status IN ('pending','invoiced','cancelled')",
            name="ck_billing_charge_status",
        ),
    )
    op.create_index("ix_billing_charges_tenant_id",      "billing_charges", ["tenant_id"])
    op.create_index("ix_billing_charges_billing_period", "billing_charges", ["billing_period"])
    op.create_index("ix_billing_charges_invoice_id",     "billing_charges", ["invoice_id"])
    op.create_index("ix_billing_charges_status",         "billing_charges", ["status"])

    # ── invoice_lines ─────────────────────────────────────────────────────────
    op.create_table(
        "invoice_lines",
        sa.Column("id",             UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("invoice_id",     UUID(as_uuid=True), sa.ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False),
        sa.Column("charge_id",      UUID(as_uuid=True), sa.ForeignKey("billing_charges.id"), nullable=True),
        sa.Column("description",    sa.Text,            nullable=False),
        sa.Column("quantity",       sa.Numeric(10, 4),  nullable=False, server_default="1"),
        sa.Column("unit_price_ils", sa.Numeric(12, 2),  nullable=False, server_default="0"),
        sa.Column("amount_ils",     sa.Numeric(12, 2),  nullable=False, server_default="0"),
        sa.Column("sort_order",     sa.Integer,         nullable=False, server_default="10"),
    )
    op.create_index("ix_invoice_lines_invoice_id", "invoice_lines", ["invoice_id"])


def downgrade() -> None:
    op.drop_table("invoice_lines")
    op.drop_index("ix_billing_charges_status")
    op.drop_index("ix_billing_charges_invoice_id")
    op.drop_index("ix_billing_charges_billing_period")
    op.drop_index("ix_billing_charges_tenant_id")
    op.drop_table("billing_charges")
    op.drop_index("ix_invoices_status")
    op.drop_index("ix_invoices_billing_period")
    op.drop_index("ix_invoices_tenant_id")
    op.drop_table("invoices")
    op.execute("DROP SEQUENCE IF EXISTS invoice_number_seq")
