"""add seat_change_log table for proration billing

Revision ID: 0013
Revises: 0012
Create Date: 2026-04-06
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "seat_change_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "subscription_module_id", UUID(as_uuid=True),
            sa.ForeignKey("tenant_subscription_modules.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.tenant_id"), nullable=False),
        sa.Column("module_slug", sa.String(), sa.ForeignKey("modules.slug"), nullable=False),
        sa.Column("old_seats", sa.Integer(), nullable=False),
        sa.Column("new_seats", sa.Integer(), nullable=False),
        sa.Column("effective_date", sa.Date(), nullable=False),
        sa.Column("billed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("billing_period", sa.String(7), nullable=True),
        sa.Column(
            "proration_charge_id", UUID(as_uuid=True),
            sa.ForeignKey("billing_charges.id"),
            nullable=True,
        ),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_seat_change_log_module", "seat_change_log", ["subscription_module_id"])
    op.create_index("ix_seat_change_log_tenant", "seat_change_log", ["tenant_id", "effective_date"])
    op.create_index(
        "ix_seat_change_log_unbilled",
        "seat_change_log",
        ["billed", "effective_date"],
        postgresql_where=sa.text("NOT billed"),
    )


def downgrade() -> None:
    op.drop_index("ix_seat_change_log_unbilled", table_name="seat_change_log")
    op.drop_index("ix_seat_change_log_tenant", table_name="seat_change_log")
    op.drop_index("ix_seat_change_log_module", table_name="seat_change_log")
    op.drop_table("seat_change_log")
