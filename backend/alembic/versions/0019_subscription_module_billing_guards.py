"""subscription module and billing guards

Revision ID: 0019
Revises: 0018
Create Date: 2026-05-01
"""

from alembic import op
import sqlalchemy as sa


revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_tsm_non_negative_counts",
        "tenant_subscription_modules",
        """
        seats >= 0
        AND allocated_seats >= 0
        AND extra_seats >= 0
        AND (override_included_seats IS NULL OR override_included_seats >= 0)
        """,
    )
    op.create_check_constraint(
        "ck_tsm_valid_window",
        "tenant_subscription_modules",
        "valid_to IS NULL OR valid_to >= valid_from",
    )
    op.create_check_constraint(
        "ck_org_template_modules_seats_default_non_negative",
        "org_template_modules",
        "seats_default IS NULL OR seats_default >= 0",
    )
    op.create_index(
        "ix_tsm_active_lookup",
        "tenant_subscription_modules",
        ["tenant_subscription_id", "status", "module_slug", "valid_from"],
    )
    op.create_index(
        "uq_billing_setup_fee_once",
        "billing_ledger_entries",
        ["tenant_id", "module_slug"],
        unique=True,
        postgresql_where=sa.text("entry_type = 'setup_fee' AND status <> 'void' AND module_slug IS NOT NULL"),
    )
    op.execute(
        """
        CREATE OR REPLACE FUNCTION enforce_active_template_has_modules()
        RETURNS trigger AS $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM org_templates ot
                WHERE ot.is_active = TRUE
                  AND NOT EXISTS (
                      SELECT 1
                      FROM org_template_modules otm
                      WHERE otm.template_id = ot.id
                  )
            ) THEN
                RAISE EXCEPTION 'Active templates must include at least one module';
            END IF;
            RETURN COALESCE(NEW, OLD);
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE CONSTRAINT TRIGGER trg_active_template_has_modules_templates
        AFTER INSERT OR UPDATE OF is_active ON org_templates
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW
        EXECUTE FUNCTION enforce_active_template_has_modules();
        """
    )
    op.execute(
        """
        CREATE CONSTRAINT TRIGGER trg_active_template_has_modules_modules
        AFTER DELETE ON org_template_modules
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW
        EXECUTE FUNCTION enforce_active_template_has_modules();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_active_template_has_modules_modules ON org_template_modules")
    op.execute("DROP TRIGGER IF EXISTS trg_active_template_has_modules_templates ON org_templates")
    op.execute("DROP FUNCTION IF EXISTS enforce_active_template_has_modules()")
    op.drop_index("uq_billing_setup_fee_once", table_name="billing_ledger_entries")
    op.drop_index("ix_tsm_active_lookup", table_name="tenant_subscription_modules")
    op.drop_constraint(
        "ck_org_template_modules_seats_default_non_negative",
        "org_template_modules",
        type_="check",
    )
    op.drop_constraint("ck_tsm_valid_window", "tenant_subscription_modules", type_="check")
    op.drop_constraint("ck_tsm_non_negative_counts", "tenant_subscription_modules", type_="check")
