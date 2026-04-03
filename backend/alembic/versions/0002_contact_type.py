"""add contact_type to tenant_contact

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-28
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tenant_contact",
        sa.Column("contact_type", sa.String(), nullable=False, server_default="main"),
    )
    op.create_check_constraint(
        "ck_tenant_contact_type",
        "tenant_contact",
        "contact_type IN ('main','billing','technical','other')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_tenant_contact_type", "tenant_contact", type_="check")
    op.drop_column("tenant_contact", "contact_type")
