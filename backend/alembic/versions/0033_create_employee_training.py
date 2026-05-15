"""create employee_training table

Revision ID: 0033
Revises: 0032
Create Date: 2026-05-15
"""

from alembic import op
import sqlalchemy as sa


revision = "0033"
down_revision = "0032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS employee_training (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
            course_name varchar NOT NULL,
            course_date date NULL,
            score varchar NULL,
            institute varchar NULL,
            created_by uuid NULL REFERENCES admin_users(id),
            created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_employee_training_employee_id ON employee_training (employee_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_employee_training_employee_id")
    op.execute("DROP TABLE IF EXISTS employee_training")
