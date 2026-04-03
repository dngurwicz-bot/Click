"""add missing fields per CLICK_SuperAdmin_Fields_v2 spec

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-28
"""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # tenant_identity — industry_code
    op.add_column("tenant_identity",
        sa.Column("industry_code", sa.Text, nullable=True))

    # tenant_contact — phone_alt
    op.add_column("tenant_contact",
        sa.Column("phone_alt", sa.Text, nullable=True))

    # tenant_subscription — is_price_locked, next_renewal_at
    op.add_column("tenant_subscription",
        sa.Column("is_price_locked", sa.Boolean, nullable=False, server_default=sa.text("false")))
    op.add_column("tenant_subscription",
        sa.Column("next_renewal_at", sa.Date, nullable=True))

    # tenant_status — notes
    op.add_column("tenant_status",
        sa.Column("notes", sa.Text, nullable=True))

    # org_templates — target_industry, recommended_size
    op.add_column("org_templates",
        sa.Column("target_industry", sa.Text, nullable=True))
    op.add_column("org_templates",
        sa.Column("recommended_size", sa.Text, nullable=True))


def downgrade() -> None:
    op.drop_column("org_templates", "recommended_size")
    op.drop_column("org_templates", "target_industry")
    op.drop_column("tenant_status", "notes")
    op.drop_column("tenant_subscription", "next_renewal_at")
    op.drop_column("tenant_subscription", "is_price_locked")
    op.drop_column("tenant_contact", "phone_alt")
    op.drop_column("tenant_identity", "industry_code")
