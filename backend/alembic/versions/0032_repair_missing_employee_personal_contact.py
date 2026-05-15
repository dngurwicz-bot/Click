"""repair missing employee personal/contact tables

Revision ID: 0032
Revises: 0031
Create Date: 2026-05-15
"""

from alembic import op


revision = "0032"
down_revision = "0031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS employee_personal (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
            birth_date date NULL,
            birth_country varchar NULL,
            citizenship1 varchar NULL,
            citizenship2 varchar NULL,
            marital_status varchar NULL,
            num_children integer NOT NULL DEFAULT 0,
            valid_from date NOT NULL,
            valid_to date NULL,
            created_by uuid NULL REFERENCES admin_users(id),
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_by uuid NULL REFERENCES admin_users(id),
            updated_at timestamptz NULL
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS employee_contact (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
            address1 varchar NULL,
            address2 varchar NULL,
            city varchar NULL,
            zip_code varchar NULL,
            country varchar NOT NULL DEFAULT 'IL',
            phone varchar NULL,
            mobile varchar NULL,
            home_phone varchar NULL,
            fax varchar NULL,
            email varchar NULL,
            valid_from date NOT NULL,
            valid_to date NULL,
            created_by uuid NULL REFERENCES admin_users(id),
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_by uuid NULL REFERENCES admin_users(id),
            updated_at timestamptz NULL
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_employee_personal_employee_id ON employee_personal (employee_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_employee_contact_employee_id ON employee_contact (employee_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_employee_contact_employee_id")
    op.execute("DROP INDEX IF EXISTS ix_employee_personal_employee_id")
    op.execute("DROP TABLE IF EXISTS employee_contact")
    op.execute("DROP TABLE IF EXISTS employee_personal")
