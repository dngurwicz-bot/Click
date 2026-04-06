"""tenant tables: add updated audit fields

Revision ID: 0010
Revises: 0009
Create Date: 2026-04-05
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


TENANT_TABLES = (
    "tenant_identity",
    "tenant_contact",
    "tenant_address",
    "tenant_subscription",
    "tenant_status",
)


def upgrade() -> None:
    for table_name in TENANT_TABLES:
        op.add_column(
            table_name,
            sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        )
        op.add_column(
            table_name,
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_foreign_key(
            f"fk_{table_name}_updated_by_admin_users",
            table_name,
            "admin_users",
            ["updated_by"],
            ["id"],
        )


def downgrade() -> None:
    for table_name in reversed(TENANT_TABLES):
        op.drop_constraint(
            f"fk_{table_name}_updated_by_admin_users",
            table_name,
            type_="foreignkey",
        )
        op.drop_column(table_name, "updated_at")
        op.drop_column(table_name, "updated_by")
