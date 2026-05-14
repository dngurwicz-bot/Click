"""allow quarterly billing contracts

Revision ID: 0028
Revises: 0027
Create Date: 2026-05-09
"""

from alembic import op


revision = "0028"
down_revision = "0027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_billing_contract_cycle", "billing_contracts", type_="check")
    op.create_check_constraint(
        "ck_billing_contract_cycle",
        "billing_contracts",
        "billing_cycle IN ('monthly','quarterly','yearly')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_billing_contract_cycle", "billing_contracts", type_="check")
    op.create_check_constraint(
        "ck_billing_contract_cycle",
        "billing_contracts",
        "billing_cycle IN ('monthly','yearly')",
    )
