"""tenant payment tracking and subscription billing anchor day

Revision ID: 0021_billing_payment_tracking
Revises: 0020
Create Date: 2026-05-02
"""

from alembic import op
import sqlalchemy as sa


revision = "0021_billing_payment_tracking"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tenant_subscription",
        sa.Column("billing_anchor_day", sa.Integer(), nullable=False, server_default="1"),
    )
    op.execute(
        """
        UPDATE tenant_subscription
        SET billing_anchor_day = GREATEST(1, LEAST(31, EXTRACT(DAY FROM COALESCE(next_renewal_at, valid_from))::int))
        """
    )
    op.alter_column("tenant_subscription", "billing_anchor_day", server_default=None)

    op.create_table(
        "tenant_payment_records",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("billing_period", sa.String(length=7), nullable=False),
        sa.Column("scheduled_charge_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="unreported"),
        sa.Column("amount_ils", sa.Numeric(12, 2), nullable=True),
        sa.Column("paid_at", sa.Date(), nullable=True),
        sa.Column("external_ref", sa.String(length=128), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["admin_users.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.tenant_id"]),
        sa.ForeignKeyConstraint(["updated_by"], ["admin_users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "billing_period", name="uq_tenant_payment_record_period"),
        sa.CheckConstraint(
            "status IN ('unreported','paid','unpaid','partial','waived')",
            name="ck_tenant_payment_record_status",
        ),
    )
    op.create_index(
        "ix_tenant_payment_records_lookup",
        "tenant_payment_records",
        ["tenant_id", "billing_period"],
    )


def downgrade() -> None:
    op.drop_index("ix_tenant_payment_records_lookup", table_name="tenant_payment_records")
    op.drop_table("tenant_payment_records")
    op.drop_column("tenant_subscription", "billing_anchor_day")
