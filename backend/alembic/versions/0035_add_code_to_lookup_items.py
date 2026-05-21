"""add code column to lookup_items

Revision ID: 0035
Revises: 0034
Create Date: 2026-05-15
"""
from alembic import op
import sqlalchemy as sa

revision = "0035"
down_revision = "0034"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("lookup_items", sa.Column("code", sa.String(20), nullable=True))
    op.create_index(
        "uq_lookup_items_list_code",
        "lookup_items",
        ["list_id", "code"],
        unique=True,
        postgresql_where=sa.text("code IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_lookup_items_list_code", table_name="lookup_items")
    op.drop_column("lookup_items", "code")
