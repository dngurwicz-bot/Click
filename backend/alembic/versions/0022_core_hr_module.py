"""core hr module

Revision ID: 0022
Revises: 0021, 0021_billing_payment_tracking
Create Date: 2026-05-02
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0022"
down_revision = ("0021", "0021_billing_payment_tracking")
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "admin_user_permissions",
        sa.Column("can_manage_sensitive", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.alter_column("admin_user_permissions", "can_manage_sensitive", server_default=None)

    op.execute(
        """
        INSERT INTO admin_user_permissions (id, user_id, resource, can_view, can_edit, can_manage_sensitive)
        SELECT gen_random_uuid(), u.id, 'core',
               CASE WHEN u.role IN ('admin', 'support') THEN true ELSE false END,
               CASE WHEN u.role = 'admin' THEN true ELSE false END,
               CASE WHEN u.role = 'admin' THEN true ELSE false END
        FROM admin_users u
        WHERE NOT EXISTS (
            SELECT 1
            FROM admin_user_permissions p
            WHERE p.user_id = u.id AND p.resource = 'core'
        )
        """
    )

    op.execute(
        """
        INSERT INTO modules (id, slug, name, description, icon, color_hex, is_required, is_active, sort_order, depends_on)
        SELECT gen_random_uuid(), 'core', 'CLICK Core',
               'Foundation HR: employee master data, org structure, and lifecycle timeline.',
               'shield', '#0F766E', true, true, 1, ARRAY[]::text[]
        WHERE NOT EXISTS (SELECT 1 FROM modules WHERE slug = 'core')
        """
    )
    op.execute("UPDATE modules SET is_required = true WHERE slug = 'core'")
    op.execute(
        """
        UPDATE modules
        SET depends_on = CASE
            WHEN slug = 'core' THEN COALESCE(depends_on, ARRAY[]::text[])
            WHEN depends_on IS NULL THEN ARRAY['core']::text[]
            WHEN NOT ('core' = ANY(depends_on)) THEN array_append(depends_on, 'core')
            ELSE depends_on
        END
        WHERE is_active = true
        """
    )

    op.create_table(
        "employees",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("employee_number", sa.String(length=32), nullable=False),
        sa.Column("external_ref", sa.String(length=64), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("employee_number <> ''", name="ck_employees_employee_number_not_blank"),
        sa.ForeignKeyConstraint(["created_by"], ["admin_users.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.tenant_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by"], ["admin_users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "employee_number", name="uq_employees_tenant_employee_number"),
    )
    op.create_index("ix_employees_tenant_lookup", "employees", ["tenant_id", "employee_number"])

    op.create_table(
        "org_units",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("parent_unit_id", sa.UUID(), nullable=True),
        sa.Column("code", sa.String(length=32), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("valid_from", sa.Date(), nullable=False),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("valid_to IS NULL OR valid_to >= valid_from", name="ck_org_units_valid_window"),
        sa.ForeignKeyConstraint(["created_by"], ["admin_users.id"]),
        sa.ForeignKeyConstraint(["parent_unit_id"], ["org_units.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.tenant_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by"], ["admin_users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_org_units_tenant_lookup", "org_units", ["tenant_id", "name"])

    op.create_table(
        "positions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("org_unit_id", sa.UUID(), nullable=True),
        sa.Column("code", sa.String(length=32), nullable=True),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("employment_type_default", sa.String(length=32), nullable=True),
        sa.Column("is_managerial", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("valid_from", sa.Date(), nullable=False),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("valid_to IS NULL OR valid_to >= valid_from", name="ck_positions_valid_window"),
        sa.ForeignKeyConstraint(["created_by"], ["admin_users.id"]),
        sa.ForeignKeyConstraint(["org_unit_id"], ["org_units.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.tenant_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by"], ["admin_users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_positions_tenant_lookup", "positions", ["tenant_id", "title"])

    op.create_table(
        "employee_identity",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("employee_id", sa.UUID(), nullable=False),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("preferred_name", sa.String(length=100), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("birth_date", sa.Date(), nullable=True),
        sa.Column("gender", sa.String(length=32), nullable=True),
        sa.Column("legal_id_type", sa.String(length=24), nullable=False, server_default="national_id"),
        sa.Column("legal_id_number", sa.String(length=32), nullable=True),
        sa.Column("nationality", sa.String(length=64), nullable=True),
        sa.Column("address_line1", sa.String(length=255), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("postal_code", sa.String(length=16), nullable=True),
        sa.Column("country", sa.String(length=2), nullable=True),
        sa.Column("emergency_contact_name", sa.String(length=120), nullable=True),
        sa.Column("emergency_contact_phone", sa.String(length=32), nullable=True),
        sa.Column("bank_name", sa.String(length=120), nullable=True),
        sa.Column("bank_branch", sa.String(length=32), nullable=True),
        sa.Column("bank_account", sa.String(length=32), nullable=True),
        sa.Column("valid_from", sa.Date(), nullable=False),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("legal_id_type IN ('national_id','passport','resident','other')", name="ck_employee_identity_legal_id_type"),
        sa.CheckConstraint("valid_to IS NULL OR valid_to >= valid_from", name="ck_employee_identity_valid_window"),
        sa.ForeignKeyConstraint(["created_by"], ["admin_users.id"]),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.tenant_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by"], ["admin_users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_employee_identity_lookup", "employee_identity", ["tenant_id", "employee_id", "valid_from"])

    op.create_table(
        "employee_employment",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("employee_id", sa.UUID(), nullable=False),
        sa.Column("org_unit_id", sa.UUID(), nullable=True),
        sa.Column("manager_employee_id", sa.UUID(), nullable=True),
        sa.Column("position_id", sa.UUID(), nullable=True),
        sa.Column("employment_status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("employment_type", sa.String(length=32), nullable=False, server_default="employee"),
        sa.Column("salary_type", sa.String(length=16), nullable=False, server_default="monthly"),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("employment_scope_pct", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("work_site", sa.String(length=120), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("valid_from", sa.Date(), nullable=False),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("employment_status IN ('active','leave_of_absence','unpaid_leave','terminated','future','suspended')", name="ck_employee_employment_status"),
        sa.CheckConstraint("employment_type IN ('employee','contractor','temporary','intern','consultant')", name="ck_employee_employment_type"),
        sa.CheckConstraint("salary_type IN ('monthly','hourly','daily','global')", name="ck_employee_employment_salary_type"),
        sa.CheckConstraint("employment_scope_pct >= 0 AND employment_scope_pct <= 100", name="ck_employee_employment_scope_pct"),
        sa.CheckConstraint("valid_to IS NULL OR valid_to >= valid_from", name="ck_employee_employment_valid_window"),
        sa.ForeignKeyConstraint(["created_by"], ["admin_users.id"]),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["manager_employee_id"], ["employees.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["org_unit_id"], ["org_units.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["position_id"], ["positions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.tenant_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by"], ["admin_users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_employee_employment_lookup", "employee_employment", ["tenant_id", "employee_id", "valid_from"])

    op.create_table(
        "employee_compensation",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("employee_id", sa.UUID(), nullable=False),
        sa.Column("base_salary", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="ILS"),
        sa.Column("pay_cycle", sa.String(length=16), nullable=False, server_default="monthly"),
        sa.Column("cost_center", sa.String(length=64), nullable=True),
        sa.Column("components_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("valid_from", sa.Date(), nullable=False),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("pay_cycle IN ('monthly','biweekly','weekly','hourly')", name="ck_employee_compensation_pay_cycle"),
        sa.CheckConstraint("base_salary >= 0", name="ck_employee_compensation_base_salary_non_negative"),
        sa.CheckConstraint("valid_to IS NULL OR valid_to >= valid_from", name="ck_employee_compensation_valid_window"),
        sa.ForeignKeyConstraint(["created_by"], ["admin_users.id"]),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.tenant_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by"], ["admin_users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_employee_compensation_lookup", "employee_compensation", ["tenant_id", "employee_id", "valid_from"])

    op.create_table(
        "employee_documents_index",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("employee_id", sa.UUID(), nullable=False),
        sa.Column("document_type", sa.String(length=64), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("storage_path", sa.String(length=512), nullable=True),
        sa.Column("issued_on", sa.Date(), nullable=True),
        sa.Column("expires_on", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("valid_from", sa.Date(), nullable=False),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status IN ('active','expired','archived','pending')", name="ck_employee_documents_index_status"),
        sa.CheckConstraint("valid_to IS NULL OR valid_to >= valid_from", name="ck_employee_documents_index_valid_window"),
        sa.ForeignKeyConstraint(["created_by"], ["admin_users.id"]),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.tenant_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by"], ["admin_users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_employee_documents_lookup", "employee_documents_index", ["tenant_id", "employee_id", "valid_from"])

    op.create_table(
        "employment_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("employee_id", sa.UUID(), nullable=False),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("effective_date", sa.Date(), nullable=False),
        sa.Column("payload_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("event_type IN ('hire','org_assignment_change','status_change','compensation_change','leave_of_absence','termination','return_from_leave','identity_update','document_update')", name="ck_employment_events_event_type"),
        sa.ForeignKeyConstraint(["created_by"], ["admin_users.id"]),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.tenant_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_employment_events_lookup", "employment_events", ["tenant_id", "employee_id", "effective_date"])


def downgrade() -> None:
    op.drop_index("ix_employment_events_lookup", table_name="employment_events")
    op.drop_table("employment_events")
    op.drop_index("ix_employee_documents_lookup", table_name="employee_documents_index")
    op.drop_table("employee_documents_index")
    op.drop_index("ix_employee_compensation_lookup", table_name="employee_compensation")
    op.drop_table("employee_compensation")
    op.drop_index("ix_employee_employment_lookup", table_name="employee_employment")
    op.drop_table("employee_employment")
    op.drop_index("ix_employee_identity_lookup", table_name="employee_identity")
    op.drop_table("employee_identity")
    op.drop_index("ix_positions_tenant_lookup", table_name="positions")
    op.drop_table("positions")
    op.drop_index("ix_org_units_tenant_lookup", table_name="org_units")
    op.drop_table("org_units")
    op.drop_index("ix_employees_tenant_lookup", table_name="employees")
    op.drop_table("employees")
    op.drop_column("admin_user_permissions", "can_manage_sensitive")
