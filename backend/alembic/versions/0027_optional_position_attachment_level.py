"""optional position attachment level

Revision ID: 0027
Revises: 0026
Create Date: 2026-05-08
"""

from alembic import op
import sqlalchemy as sa


revision = "0027"
down_revision = "0026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("tenant_org_structure_config") as batch_op:
        batch_op.alter_column(
            "position_attachment_level",
            existing_type=sa.String(),
            nullable=True,
        )


def downgrade() -> None:
    op.execute(
        """
        UPDATE tenant_org_structure_config
        SET position_attachment_level = 'team'
        WHERE position_attachment_level IS NULL
        """
    )
    with op.batch_alter_table("tenant_org_structure_config") as batch_op:
        batch_op.alter_column(
            "position_attachment_level",
            existing_type=sa.String(),
            nullable=False,
        )
