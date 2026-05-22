"""Add scope column to lookup_lists to distinguish system vs org-managed lists

Revision ID: 0036
Revises: 0035
Create Date: 2026-05-22
"""
from alembic import op
import sqlalchemy as sa

revision = "0036"
down_revision = "0035"
branch_labels = None
depends_on = None

# Lists that belong to system admin only (used in tenant/billing management)
_SYSTEM_SCOPE_KEYS = ("entity_type", "contact_type", "package")


def upgrade() -> None:
    op.add_column(
        "lookup_lists",
        sa.Column("scope", sa.String(20), nullable=False, server_default="org"),
    )
    # Mark the system-admin lists explicitly
    keys = ", ".join(f"'{k}'" for k in _SYSTEM_SCOPE_KEYS)
    op.execute(f"UPDATE lookup_lists SET scope = 'system' WHERE list_key IN ({keys})")


def downgrade() -> None:
    op.drop_column("lookup_lists", "scope")
