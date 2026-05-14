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
    # Add tenant_id to admin_users for org_admin role
    op.add_column(
        "admin_users",
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.tenant_id"), nullable=True),
    )

    # Create course_catalog table
    op.create_table(
        "course_catalog",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.tenant_id"), nullable=False),
        sa.Column("code", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("name_en", sa.String(), nullable=True),
        sa.Column("category", sa.String(), nullable=True),
        sa.Column("duration_hours", sa.Integer(), nullable=True),
        sa.Column("is_mandatory", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("valid_from", sa.Date(), nullable=False),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_unique_constraint(
        "uq_course_catalog_tenant_code",
        "course_catalog",
        ["tenant_id", "code"],
    )


def downgrade() -> None:
    op.drop_table("course_catalog")
    op.drop_column("admin_users", "tenant_id")
