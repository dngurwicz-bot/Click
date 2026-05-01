"""add kind to saved report views

Revision ID: 0020
Revises: 0019
Create Date: 2026-05-01
"""

from alembic import op
import sqlalchemy as sa

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "saved_report_views",
        sa.Column("kind", sa.String(length=16), nullable=False, server_default="report"),
    )
    op.create_index("ix_saved_report_views_kind", "saved_report_views", ["kind"])
    op.execute("UPDATE saved_report_views SET kind = 'report' WHERE kind IS NULL")
    op.alter_column("saved_report_views", "kind", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_saved_report_views_kind", table_name="saved_report_views")
    op.drop_column("saved_report_views", "kind")
