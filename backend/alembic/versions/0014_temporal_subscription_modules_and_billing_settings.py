"""add temporal subscription modules and billing settings

Revision ID: 0014
Revises: 0013
Create Date: 2026-04-06
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tenant_subscription_modules", sa.Column("valid_from", sa.Date(), nullable=True))
    op.add_column("tenant_subscription_modules", sa.Column("valid_to", sa.Date(), nullable=True))

    op.execute(
        """
        UPDATE tenant_subscription_modules tsm
        SET
            valid_from = ts.valid_from,
            valid_to = ts.valid_to
        FROM tenant_subscription ts
        WHERE ts.id = tsm.tenant_subscription_id
        """
    )

    op.alter_column("tenant_subscription_modules", "valid_from", nullable=False)
    op.create_index(
        "ix_tenant_subscription_modules_effective",
        "tenant_subscription_modules",
        ["tenant_subscription_id", "module_slug", "valid_from"],
    )

    op.create_table(
        "billing_settings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("issuer_name_he", sa.String(length=255), nullable=False),
        sa.Column("issuer_name_en", sa.String(length=255), nullable=True),
        sa.Column("issuer_tax_id", sa.String(length=64), nullable=True),
        sa.Column("issuer_address", sa.Text(), nullable=True),
        sa.Column("issuer_phone", sa.String(length=64), nullable=True),
        sa.Column("issuer_email", sa.String(length=255), nullable=True),
        sa.Column("issuer_logo_url", sa.Text(), nullable=True),
        sa.Column("payment_instructions", sa.Text(), nullable=True),
        sa.Column("footer_text", sa.Text(), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("billing_settings")
    op.drop_index("ix_tenant_subscription_modules_effective", table_name="tenant_subscription_modules")
    op.drop_column("tenant_subscription_modules", "valid_to")
    op.drop_column("tenant_subscription_modules", "valid_from")
