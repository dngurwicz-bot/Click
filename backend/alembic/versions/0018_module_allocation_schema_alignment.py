"""align module allocation schema

Revision ID: 0018
Revises: 0017
Create Date: 2026-05-01
"""

from alembic import op
import sqlalchemy as sa


revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    if not _has_column("org_template_modules", "seats_default"):
        op.add_column("org_template_modules", sa.Column("seats_default", sa.Integer(), nullable=True))

    if not _has_column("tenant_subscription_modules", "allocated_seats"):
        op.add_column(
            "tenant_subscription_modules",
            sa.Column("allocated_seats", sa.Integer(), nullable=False, server_default="0"),
        )
        op.alter_column("tenant_subscription_modules", "allocated_seats", server_default=None)

    if not _has_column("tenant_subscription_modules", "extra_seats"):
        op.add_column(
            "tenant_subscription_modules",
            sa.Column("extra_seats", sa.Integer(), nullable=False, server_default="0"),
        )
        op.alter_column("tenant_subscription_modules", "extra_seats", server_default=None)


def downgrade() -> None:
    if _has_column("tenant_subscription_modules", "extra_seats"):
        op.drop_column("tenant_subscription_modules", "extra_seats")
    if _has_column("tenant_subscription_modules", "allocated_seats"):
        op.drop_column("tenant_subscription_modules", "allocated_seats")
    if _has_column("org_template_modules", "seats_default"):
        op.drop_column("org_template_modules", "seats_default")
