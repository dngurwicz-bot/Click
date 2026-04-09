"""add quotes and quote_lines tables

Revision ID: 0015
Revises: 0014
Create Date: 2026-04-09
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE IF NOT EXISTS quote_number_seq START 1")

    op.create_table(
        "quotes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("quote_number", sa.String(32), nullable=True, unique=True),  # Assigned on send
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.tenant_id"), nullable=True),
        sa.Column("prospect_name", sa.String(255), nullable=True),
        sa.Column("prospect_email", sa.String(255), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("valid_until", sa.Date(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="draft"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("discount_pct", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("vat_pct", sa.Numeric(5, 2), nullable=False, server_default="17"),
        sa.Column("subtotal_ils", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("discount_ils", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("vat_ils", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("total_ils", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("converted_invoice_id", UUID(as_uuid=True), sa.ForeignKey("invoices.id"), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "status IN ('draft','sent','accepted','declined','expired')",
            name="ck_quote_status",
        ),
    )
    op.create_index("ix_quotes_tenant_id", "quotes", ["tenant_id"])
    op.create_index("ix_quotes_status", "quotes", ["status"])

    op.create_table(
        "quote_lines",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("quote_id", UUID(as_uuid=True), sa.ForeignKey("quotes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("quantity", sa.Numeric(10, 4), nullable=False, server_default="1"),
        sa.Column("unit_price_ils", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("amount_ils", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("discount_pct", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("amount_after_discount_ils", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("module_slug", sa.String(), sa.ForeignKey("modules.slug"), nullable=True),
        sa.Column("charge_type", sa.String(16), nullable=False, server_default="manual"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="10"),
        sa.CheckConstraint(
            "charge_type IN ('base_fee','per_seat','setup_fee','addon','manual')",
            name="ck_quote_line_charge_type",
        ),
    )
    op.create_index("ix_quote_lines_quote_id", "quote_lines", ["quote_id"])


def downgrade() -> None:
    op.drop_index("ix_quote_lines_quote_id", table_name="quote_lines")
    op.drop_table("quote_lines")
    op.drop_index("ix_quotes_status", table_name="quotes")
    op.drop_index("ix_quotes_tenant_id", table_name="quotes")
    op.drop_table("quotes")
    op.execute("DROP SEQUENCE IF EXISTS quote_number_seq")
