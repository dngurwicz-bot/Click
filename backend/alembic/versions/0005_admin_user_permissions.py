"""admin_user_permissions table

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "admin_user_permissions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("admin_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("resource", sa.Text, nullable=False),
        sa.Column("can_view", sa.Boolean, server_default=sa.text("false"), nullable=False),
        sa.Column("can_edit", sa.Boolean, server_default=sa.text("false"), nullable=False),
        sa.UniqueConstraint("user_id", "resource", name="uq_user_resource"),
    )
    op.create_index("ix_admin_user_permissions_user_id", "admin_user_permissions", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_admin_user_permissions_user_id")
    op.drop_table("admin_user_permissions")
