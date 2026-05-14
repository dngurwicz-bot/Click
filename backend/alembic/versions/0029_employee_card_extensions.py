"""employee card extensions

Revision ID: 0029
Revises: 0028
Create Date: 2026-05-12
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0029"
down_revision = "0028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "employee_children",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("employee_id", sa.UUID(), nullable=False),
        sa.Column("child_name", sa.String(length=120), nullable=False),
        sa.Column("birth_date", sa.Date(), nullable=True),
        sa.Column("gender", sa.String(length=32), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("birth_date IS NULL OR birth_date <= CURRENT_DATE", name="ck_employee_children_birth_date"),
        sa.ForeignKeyConstraint(["created_by"], ["admin_users.id"]),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.tenant_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by"], ["admin_users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_employee_children_lookup", "employee_children", ["tenant_id", "employee_id"])

    op.create_table(
        "employee_bank_accounts",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("employee_id", sa.UUID(), nullable=False),
        sa.Column("bank_name", sa.String(length=120), nullable=True),
        sa.Column("branch_number", sa.String(length=32), nullable=True),
        sa.Column("account_number", sa.String(length=32), nullable=True),
        sa.Column("account_holder_name", sa.String(length=120), nullable=True),
        sa.Column("payment_method", sa.String(length=32), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("valid_from", sa.Date(), nullable=False),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("valid_to IS NULL OR valid_to >= valid_from", name="ck_employee_bank_accounts_valid_window"),
        sa.ForeignKeyConstraint(["created_by"], ["admin_users.id"]),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.tenant_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by"], ["admin_users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_employee_bank_accounts_lookup", "employee_bank_accounts", ["tenant_id", "employee_id", "valid_from"])

    op.create_table(
        "employee_awards",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("employee_id", sa.UUID(), nullable=False),
        sa.Column("award_type", sa.String(length=80), nullable=False),
        sa.Column("award_date", sa.Date(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("granted_by", sa.String(length=120), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["admin_users.id"]),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.tenant_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by"], ["admin_users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_employee_awards_lookup", "employee_awards", ["tenant_id", "employee_id"])

    op.create_table(
        "employee_certifications",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("employee_id", sa.UUID(), nullable=False),
        sa.Column("certification_type", sa.String(length=120), nullable=False),
        sa.Column("issuer", sa.String(length=120), nullable=True),
        sa.Column("issued_on", sa.Date(), nullable=True),
        sa.Column("expires_on", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("valid_from", sa.Date(), nullable=False),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("valid_to IS NULL OR valid_to >= valid_from", name="ck_employee_certifications_valid_window"),
        sa.ForeignKeyConstraint(["created_by"], ["admin_users.id"]),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.tenant_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by"], ["admin_users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_employee_certifications_lookup", "employee_certifications", ["tenant_id", "employee_id", "valid_from"])

    op.create_table(
        "employee_courses",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("employee_id", sa.UUID(), nullable=False),
        sa.Column("course_name", sa.String(length=120), nullable=False),
        sa.Column("provider", sa.String(length=120), nullable=True),
        sa.Column("started_on", sa.Date(), nullable=True),
        sa.Column("completed_on", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=True),
        sa.Column("score", sa.String(length=32), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("valid_from", sa.Date(), nullable=False),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("valid_to IS NULL OR valid_to >= valid_from", name="ck_employee_courses_valid_window"),
        sa.ForeignKeyConstraint(["created_by"], ["admin_users.id"]),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.tenant_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by"], ["admin_users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_employee_courses_lookup", "employee_courses", ["tenant_id", "employee_id", "valid_from"])

    op.create_table(
        "employee_skills",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("employee_id", sa.UUID(), nullable=False),
        sa.Column("skill_name", sa.String(length=120), nullable=False),
        sa.Column("level", sa.String(length=32), nullable=True),
        sa.Column("category", sa.String(length=80), nullable=True),
        sa.Column("source", sa.String(length=80), nullable=True),
        sa.Column("assessed_on", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["admin_users.id"]),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.tenant_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by"], ["admin_users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_employee_skills_lookup", "employee_skills", ["tenant_id", "employee_id"])

    op.create_table(
        "employee_work_breaks",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("employee_id", sa.UUID(), nullable=False),
        sa.Column("break_type", sa.String(length=80), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("started_on", sa.Date(), nullable=True),
        sa.Column("ended_on", sa.Date(), nullable=True),
        sa.Column("approved_by", sa.String(length=120), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("valid_from", sa.Date(), nullable=False),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("valid_to IS NULL OR valid_to >= valid_from", name="ck_employee_work_breaks_valid_window"),
        sa.ForeignKeyConstraint(["created_by"], ["admin_users.id"]),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.tenant_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by"], ["admin_users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_employee_work_breaks_lookup", "employee_work_breaks", ["tenant_id", "employee_id", "valid_from"])

    op.execute(
        """
        INSERT INTO employee_bank_accounts (
            id, tenant_id, employee_id, bank_name, branch_number, account_number,
            account_holder_name, payment_method, valid_from, valid_to, created_by, created_at
        )
        SELECT
            gen_random_uuid(),
            ei.tenant_id,
            ei.employee_id,
            ei.bank_name,
            ei.bank_branch,
            ei.bank_account,
            TRIM(CONCAT(COALESCE(ei.first_name, ''), ' ', COALESCE(ei.last_name, ''))),
            'bank_transfer',
            ei.valid_from,
            ei.valid_to,
            ei.created_by,
            COALESCE(ei.created_at, NOW())
        FROM employee_identity ei
        WHERE (ei.bank_name IS NOT NULL AND ei.bank_name <> '')
           OR (ei.bank_branch IS NOT NULL AND ei.bank_branch <> '')
           OR (ei.bank_account IS NOT NULL AND ei.bank_account <> '')
        """
    )


def downgrade() -> None:
    op.drop_index("ix_employee_work_breaks_lookup", table_name="employee_work_breaks")
    op.drop_table("employee_work_breaks")
    op.drop_index("ix_employee_skills_lookup", table_name="employee_skills")
    op.drop_table("employee_skills")
    op.drop_index("ix_employee_courses_lookup", table_name="employee_courses")
    op.drop_table("employee_courses")
    op.drop_index("ix_employee_certifications_lookup", table_name="employee_certifications")
    op.drop_table("employee_certifications")
    op.drop_index("ix_employee_awards_lookup", table_name="employee_awards")
    op.drop_table("employee_awards")
    op.drop_index("ix_employee_bank_accounts_lookup", table_name="employee_bank_accounts")
    op.drop_table("employee_bank_accounts")
    op.drop_index("ix_employee_children_lookup", table_name="employee_children")
    op.drop_table("employee_children")
