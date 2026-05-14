"""employee card priority alignment

Revision ID: 0030
Revises: 0029
Create Date: 2026-05-13
"""

from alembic import op
import sqlalchemy as sa


revision = "0030"
down_revision = "0029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("employee_children", sa.Column("last_name", sa.String(length=120), nullable=True))
    op.add_column("employee_children", sa.Column("legal_id_number", sa.String(length=32), nullable=True))
    op.add_column("employee_children", sa.Column("military_service_status", sa.String(length=32), nullable=True))
    op.add_column("employee_children", sa.Column("service_start_date", sa.Date(), nullable=True))
    op.add_column("employee_children", sa.Column("service_end_date", sa.Date(), nullable=True))
    op.add_column("employee_children", sa.Column("allowance_eligible", sa.Boolean(), nullable=True))
    op.create_check_constraint(
        "ck_employee_children_service_window",
        "employee_children",
        "service_end_date IS NULL OR service_start_date IS NULL OR service_end_date >= service_start_date",
    )

    op.add_column("employee_bank_accounts", sa.Column("bank_code", sa.String(length=32), nullable=True))
    op.add_column("employee_bank_accounts", sa.Column("branch_description", sa.String(length=120), nullable=True))
    op.add_column("employee_bank_accounts", sa.Column("payment_percent", sa.Numeric(5, 2), nullable=True))
    op.add_column("employee_bank_accounts", sa.Column("fixed_amount", sa.Numeric(12, 2), nullable=True))
    op.add_column("employee_bank_accounts", sa.Column("payment_priority", sa.Integer(), nullable=True))
    op.add_column("employee_bank_accounts", sa.Column("company_name", sa.String(length=120), nullable=True))
    op.create_check_constraint(
        "ck_employee_bank_accounts_payment_percent",
        "employee_bank_accounts",
        "payment_percent IS NULL OR (payment_percent >= 0 AND payment_percent <= 100)",
    )
    op.create_check_constraint(
        "ck_employee_bank_accounts_fixed_amount_non_negative",
        "employee_bank_accounts",
        "fixed_amount IS NULL OR fixed_amount >= 0",
    )
    op.create_check_constraint(
        "ck_employee_bank_accounts_payment_priority_positive",
        "employee_bank_accounts",
        "payment_priority IS NULL OR payment_priority >= 1",
    )


def downgrade() -> None:
    op.drop_constraint("ck_employee_bank_accounts_payment_priority_positive", "employee_bank_accounts", type_="check")
    op.drop_constraint("ck_employee_bank_accounts_fixed_amount_non_negative", "employee_bank_accounts", type_="check")
    op.drop_constraint("ck_employee_bank_accounts_payment_percent", "employee_bank_accounts", type_="check")
    op.drop_column("employee_bank_accounts", "company_name")
    op.drop_column("employee_bank_accounts", "payment_priority")
    op.drop_column("employee_bank_accounts", "fixed_amount")
    op.drop_column("employee_bank_accounts", "payment_percent")
    op.drop_column("employee_bank_accounts", "branch_description")
    op.drop_column("employee_bank_accounts", "bank_code")

    op.drop_constraint("ck_employee_children_service_window", "employee_children", type_="check")
    op.drop_column("employee_children", "allowance_eligible")
    op.drop_column("employee_children", "service_end_date")
    op.drop_column("employee_children", "service_start_date")
    op.drop_column("employee_children", "military_service_status")
    op.drop_column("employee_children", "legal_id_number")
    op.drop_column("employee_children", "last_name")
