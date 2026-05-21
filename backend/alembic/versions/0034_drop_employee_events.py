"""drop employee events table

Revision ID: 0034
Revises: 0033
Create Date: 2026-05-15
"""

from alembic import op


revision = "0034"
down_revision = "0033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_employment_events_lookup")
    op.execute("DROP INDEX IF EXISTS ix_employment_events_employee_id")
    op.execute("DROP TABLE IF EXISTS employment_events")


def downgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS employment_events (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
            event_type varchar(32) NOT NULL,
            effective_date date NOT NULL,
            payload_json jsonb NULL,
            notes text NULL,
            created_by uuid NULL REFERENCES admin_users(id),
            created_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT ck_employment_events_event_type CHECK (
                event_type IN (
                    'hire',
                    'org_assignment_change',
                    'status_change',
                    'compensation_change',
                    'leave_of_absence',
                    'termination',
                    'return_from_leave',
                    'identity_update',
                    'document_update'
                )
            )
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_employment_events_lookup "
        "ON employment_events (tenant_id, employee_id, effective_date)"
    )
