"""saved reports and reports permission

Revision ID: 0017
Revises: 0016
Create Date: 2026-04-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "saved_report_views",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("dataset", sa.String(length=80), nullable=False),
        sa.Column("definition_json", JSONB, nullable=False),
        sa.Column("visibility", sa.String(length=16), nullable=False, server_default="personal"),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("admin_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_saved_report_views_owner_id", "saved_report_views", ["owner_id"])
    op.create_index("ix_saved_report_views_visibility", "saved_report_views", ["visibility"])

    op.execute(
        """
        INSERT INTO admin_user_permissions (user_id, resource, can_view, can_edit)
        SELECT user_id, 'reports', can_view, can_edit
        FROM admin_user_permissions
        WHERE resource = 'modules'
          AND NOT EXISTS (
            SELECT 1
            FROM admin_user_permissions existing
            WHERE existing.user_id = admin_user_permissions.user_id
              AND existing.resource = 'reports'
          )
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM admin_user_permissions WHERE resource = 'reports'")
    op.drop_index("ix_saved_report_views_visibility", table_name="saved_report_views")
    op.drop_index("ix_saved_report_views_owner_id", table_name="saved_report_views")
    op.drop_table("saved_report_views")
