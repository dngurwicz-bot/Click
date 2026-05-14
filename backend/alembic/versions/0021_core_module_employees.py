"""core module — employees, org units, positions

Revision ID: 0021
Revises: 0020
Create Date: 2026-05-14
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. org_units
    op.execute("CREATE SEQUENCE IF NOT EXISTS employees_number_seq START 1 INCREMENT 1")

    op.create_table(
        "org_units",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.tenant_id"), nullable=False),
        sa.Column("code", sa.Text, nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("unit_type", sa.Text, nullable=False),
        sa.Column("parent_id", UUID(as_uuid=True), sa.ForeignKey("org_units.id"), nullable=True),
        sa.Column("valid_from", sa.Date, nullable=False),
        sa.Column("valid_to", sa.Date, nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "unit_type IN ('division','department','section','team')",
            name="ck_org_units_unit_type",
        ),
    )
    op.create_index("ix_org_units_tenant_id", "org_units", ["tenant_id"])

    # 2. positions
    op.create_table(
        "positions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.tenant_id"), nullable=False),
        sa.Column("code", sa.Text, nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("name_en", sa.Text, nullable=True),
        sa.Column("valid_from", sa.Date, nullable=False),
        sa.Column("valid_to", sa.Date, nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_positions_tenant_id", "positions", ["tenant_id"])

    # 3. employees (header record)
    op.create_table(
        "employees",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.tenant_id"), nullable=False),
        sa.Column("employee_number", sa.Integer, sa.Sequence("employees_number_seq"), server_default=sa.text("nextval('employees_number_seq')"), nullable=False),
        sa.Column("status", sa.Text, nullable=False, server_default="active"),
        sa.Column("photo_url", sa.Text, nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status IN ('active','inactive','terminated')", name="ck_employees_status"),
    )
    op.create_index("ix_employees_tenant_id", "employees", ["tenant_id"])
    op.create_index("ix_employees_tenant_number", "employees", ["tenant_id", "employee_number"], unique=True)

    # 4. employee_identity
    op.create_table(
        "employee_identity",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.tenant_id"), nullable=False),
        sa.Column("first_name", sa.Text, nullable=False),
        sa.Column("last_name", sa.Text, nullable=False),
        sa.Column("first_name_en", sa.Text, nullable=True),
        sa.Column("last_name_en", sa.Text, nullable=True),
        sa.Column("id_number", sa.Text, nullable=True),
        sa.Column("title", sa.Text, nullable=True),
        sa.Column("gender", sa.Text, nullable=True),
        sa.Column("username", sa.Text, nullable=True),
        sa.Column("api_username", sa.Text, nullable=True),
        sa.Column("is_partner", sa.Boolean, server_default=sa.text("false")),
        sa.Column("is_manager", sa.Boolean, server_default=sa.text("false")),
        sa.Column("valid_from", sa.Date, nullable=False),
        sa.Column("valid_to", sa.Date, nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_employee_identity_employee_id", "employee_identity", ["employee_id"])
    op.create_index("ix_employee_identity_tenant_id", "employee_identity", ["tenant_id"])

    # 5. employee_personal
    op.create_table(
        "employee_personal",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.tenant_id"), nullable=False),
        sa.Column("birth_date", sa.Date, nullable=True),
        sa.Column("birth_country", sa.Text, nullable=True),
        sa.Column("citizenship1", sa.Text, nullable=True),
        sa.Column("citizenship2", sa.Text, nullable=True),
        sa.Column("marital_status", sa.Text, nullable=True),
        sa.Column("num_children", sa.Integer, server_default="0"),
        sa.Column("valid_from", sa.Date, nullable=False),
        sa.Column("valid_to", sa.Date, nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_employee_personal_employee_id", "employee_personal", ["employee_id"])

    # 6. employee_contact
    op.create_table(
        "employee_contact",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.tenant_id"), nullable=False),
        sa.Column("address1", sa.Text, nullable=True),
        sa.Column("address2", sa.Text, nullable=True),
        sa.Column("city", sa.Text, nullable=True),
        sa.Column("zip_code", sa.Text, nullable=True),
        sa.Column("country", sa.Text, server_default="IL"),
        sa.Column("phone", sa.Text, nullable=True),
        sa.Column("mobile", sa.Text, nullable=True),
        sa.Column("home_phone", sa.Text, nullable=True),
        sa.Column("fax", sa.Text, nullable=True),
        sa.Column("email", sa.Text, nullable=True),
        sa.Column("valid_from", sa.Date, nullable=False),
        sa.Column("valid_to", sa.Date, nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_employee_contact_employee_id", "employee_contact", ["employee_id"])

    # 7. employee_employment
    op.create_table(
        "employee_employment",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.tenant_id"), nullable=False),
        sa.Column("org_unit_id", UUID(as_uuid=True), sa.ForeignKey("org_units.id"), nullable=True),
        sa.Column("position_id", UUID(as_uuid=True), sa.ForeignKey("positions.id"), nullable=True),
        sa.Column("company", sa.Text, nullable=True),
        sa.Column("employment_type", sa.Text, nullable=True),
        sa.Column("manager_id", UUID(as_uuid=True), sa.ForeignKey("employees.id"), nullable=True),
        sa.Column("start_date", sa.Date, nullable=True),
        sa.Column("valid_from", sa.Date, nullable=False),
        sa.Column("valid_to", sa.Date, nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_employee_employment_employee_id", "employee_employment", ["employee_id"])

    # 8. employee_compensation
    op.create_table(
        "employee_compensation",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.tenant_id"), nullable=False),
        sa.Column("comp_code", sa.Text, nullable=True),
        sa.Column("comp_name", sa.Text, nullable=True),
        sa.Column("amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("percentage", sa.Numeric(5, 2), nullable=True),
        sa.Column("valid_from", sa.Date, nullable=False),
        sa.Column("valid_to", sa.Date, nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_employee_compensation_employee_id", "employee_compensation", ["employee_id"])

    # 9. employee_bank_accounts
    op.create_table(
        "employee_bank_accounts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.tenant_id"), nullable=False),
        sa.Column("payment_code", sa.Text, nullable=True),
        sa.Column("bank_code", sa.Text, nullable=True),
        sa.Column("bank_name", sa.Text, nullable=True),
        sa.Column("branch", sa.Text, nullable=True),
        sa.Column("account", sa.Text, nullable=True),
        sa.Column("pct_payment", sa.Numeric(5, 2), server_default="0"),
        sa.Column("fixed_amount", sa.Numeric(12, 2), server_default="0"),
        sa.Column("signature_date", sa.Date, nullable=True),
        sa.Column("valid_from", sa.Date, nullable=False),
        sa.Column("valid_to", sa.Date, nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_employee_bank_accounts_employee_id", "employee_bank_accounts", ["employee_id"])

    # 10. employment_events
    op.create_table(
        "employment_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.tenant_id"), nullable=False),
        sa.Column("event_type", sa.Text, nullable=False),
        sa.Column("event_date", sa.Date, nullable=False),
        sa.Column("reason", sa.Text, nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_employment_events_employee_id", "employment_events", ["employee_id"])

    # 11. employee_training
    op.create_table(
        "employee_training",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.tenant_id"), nullable=False),
        sa.Column("course_name", sa.Text, nullable=False),
        sa.Column("course_date", sa.Date, nullable=True),
        sa.Column("score", sa.Text, nullable=True),
        sa.Column("institute", sa.Text, nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_employee_training_employee_id", "employee_training", ["employee_id"])


def downgrade() -> None:
    op.drop_table("employee_training")
    op.drop_table("employment_events")
    op.drop_table("employee_bank_accounts")
    op.drop_table("employee_compensation")
    op.drop_table("employee_employment")
    op.drop_table("employee_contact")
    op.drop_table("employee_personal")
    op.drop_table("employee_identity")
    op.drop_table("employees")
    op.drop_table("positions")
    op.drop_table("org_units")
    op.execute("DROP SEQUENCE IF EXISTS employees_number_seq")
