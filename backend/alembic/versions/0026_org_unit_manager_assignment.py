"""org unit manager assignment

Revision ID: 0026
Revises: 0025
Create Date: 2026-05-08
"""

from alembic import op
import sqlalchemy as sa


revision = "0026"
down_revision = "0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("org_units", sa.Column("manager_employee_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_org_units_manager_employee_id_employees",
        "org_units",
        "employees",
        ["manager_employee_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_org_units_manager_employee_id_employees", "org_units", type_="foreignkey")
    op.drop_column("org_units", "manager_employee_id")
