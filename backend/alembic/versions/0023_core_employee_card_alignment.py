"""core employee card alignment

Revision ID: 0023
Revises: 0022
Create Date: 2026-05-02
"""

from alembic import op
import sqlalchemy as sa


revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("employee_identity", sa.Column("immigration_date", sa.Date(), nullable=True))
    op.add_column("employee_identity", sa.Column("marital_status", sa.String(length=32), nullable=True))
    op.add_column("employee_identity", sa.Column("children_count", sa.Integer(), nullable=True))
    op.add_column("employee_identity", sa.Column("spouse_name", sa.String(length=120), nullable=True))
    op.add_column("employee_identity", sa.Column("spouse_legal_id", sa.String(length=32), nullable=True))
    op.add_column("employee_identity", sa.Column("address_line2", sa.String(length=255), nullable=True))
    op.create_check_constraint(
        "ck_employee_identity_children_count",
        "employee_identity",
        "children_count IS NULL OR children_count >= 0",
    )

    op.add_column("employee_employment", sa.Column("branch_name", sa.String(length=120), nullable=True))
    op.add_column("employee_employment", sa.Column("time_clock_id", sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column("employee_employment", "time_clock_id")
    op.drop_column("employee_employment", "branch_name")

    op.drop_constraint("ck_employee_identity_children_count", "employee_identity", type_="check")
    op.drop_column("employee_identity", "address_line2")
    op.drop_column("employee_identity", "spouse_legal_id")
    op.drop_column("employee_identity", "spouse_name")
    op.drop_column("employee_identity", "children_count")
    op.drop_column("employee_identity", "marital_status")
    op.drop_column("employee_identity", "immigration_date")
