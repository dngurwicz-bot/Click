"""core org hierarchy codes

Revision ID: 0024
Revises: 0023
Create Date: 2026-05-07
"""

from alembic import op
import sqlalchemy as sa


revision = "0024"
down_revision = "0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "org_units",
        sa.Column("unit_type", sa.String(length=32), nullable=False, server_default="department"),
    )

    op.execute(
        """
        WITH ranked_units AS (
            SELECT
                id,
                LPAD(ROW_NUMBER() OVER (
                    PARTITION BY tenant_id, unit_type
                    ORDER BY created_at, valid_from, name, id
                )::text, 3, '0') AS next_code
            FROM org_units
            WHERE code IS NULL OR btrim(code) = ''
        )
        UPDATE org_units AS target
        SET code = ranked_units.next_code
        FROM ranked_units
        WHERE target.id = ranked_units.id
        """
    )

    op.execute(
        """
        WITH ranked_positions AS (
            SELECT
                id,
                LPAD(ROW_NUMBER() OVER (
                    PARTITION BY tenant_id
                    ORDER BY created_at, valid_from, title, id
                )::text, 3, '0') AS next_code
            FROM positions
            WHERE code IS NULL OR btrim(code) = ''
        )
        UPDATE positions AS target
        SET code = ranked_positions.next_code
        FROM ranked_positions
        WHERE target.id = ranked_positions.id
        """
    )

    op.alter_column("org_units", "unit_type", server_default=None)
    op.alter_column("org_units", "code", existing_type=sa.String(length=32), nullable=False)
    op.alter_column("positions", "code", existing_type=sa.String(length=32), nullable=False)

    op.create_check_constraint(
        "ck_org_units_unit_type",
        "org_units",
        "unit_type IN ('division','department','section','team')",
    )
    op.create_unique_constraint(
        "uq_org_units_tenant_type_code",
        "org_units",
        ["tenant_id", "unit_type", "code"],
    )
    op.create_unique_constraint(
        "uq_positions_tenant_code",
        "positions",
        ["tenant_id", "code"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_positions_tenant_code", "positions", type_="unique")
    op.drop_constraint("uq_org_units_tenant_type_code", "org_units", type_="unique")
    op.drop_constraint("ck_org_units_unit_type", "org_units", type_="check")

    op.alter_column("positions", "code", existing_type=sa.String(length=32), nullable=True)
    op.alter_column("org_units", "code", existing_type=sa.String(length=32), nullable=True)
    op.drop_column("org_units", "unit_type")
