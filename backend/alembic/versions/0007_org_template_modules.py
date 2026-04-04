"""org_template_modules: link table between org_templates and modules

Revision ID: 0007
Revises: 0006
Create Date: 2026-04-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "org_template_modules",
        sa.Column("template_id", UUID(as_uuid=True), sa.ForeignKey("org_templates.id", ondelete="CASCADE"), primary_key=True, nullable=False),
        sa.Column("module_slug", sa.String(), sa.ForeignKey("modules.slug", ondelete="CASCADE"), primary_key=True, nullable=False),
    )


def downgrade() -> None:
    op.drop_table("org_template_modules")
