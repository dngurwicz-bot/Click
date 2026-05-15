"""org admin tenant_id on admin_users and course_catalog table

Revision ID: 0031
Revises: 0030
Create Date: 2026-05-15
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "0031"
down_revision = "0030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    admin_user_columns = {column["name"] for column in inspector.get_columns("admin_users")}
    admin_user_foreign_keys = {fk["name"] for fk in inspector.get_foreign_keys("admin_users")}
    if "tenant_id" not in admin_user_columns:
        op.add_column(
            "admin_users",
            sa.Column("tenant_id", UUID(as_uuid=True), nullable=True),
        )
    if "fk_admin_users_tenant_id_tenants" not in admin_user_foreign_keys:
        op.create_foreign_key(
            "fk_admin_users_tenant_id_tenants",
            "admin_users",
            "tenants",
            ["tenant_id"],
            ["tenant_id"],
        )

    if "course_catalog" not in inspector.get_table_names():
        op.create_table(
            "course_catalog",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
            sa.Column("code", sa.String(), nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("name_en", sa.String(), nullable=True),
            sa.Column("category", sa.String(), nullable=True),
            sa.Column("duration_hours", sa.Integer(), nullable=True),
            sa.Column("is_mandatory", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("valid_from", sa.Date(), nullable=False),
            sa.Column("valid_to", sa.Date(), nullable=True),
            sa.Column("created_by", UUID(as_uuid=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_by", UUID(as_uuid=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.tenant_id"]),
            sa.ForeignKeyConstraint(["created_by"], ["admin_users.id"]),
            sa.ForeignKeyConstraint(["updated_by"], ["admin_users.id"]),
        )
        op.create_unique_constraint(
            "uq_course_catalog_tenant_code",
            "course_catalog",
            ["tenant_id", "code"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "course_catalog" in inspector.get_table_names():
        op.drop_table("course_catalog")

    admin_user_columns = {column["name"] for column in inspector.get_columns("admin_users")}
    admin_user_foreign_keys = {fk["name"] for fk in inspector.get_foreign_keys("admin_users")}
    if "fk_admin_users_tenant_id_tenants" in admin_user_foreign_keys:
        op.drop_constraint("fk_admin_users_tenant_id_tenants", "admin_users", type_="foreignkey")
    if "tenant_id" in admin_user_columns:
        op.drop_column("admin_users", "tenant_id")
