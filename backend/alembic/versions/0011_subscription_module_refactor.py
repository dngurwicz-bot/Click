"""subscription module refactor

Revision ID: 0011
Revises: 0010
Create Date: 2026-04-05
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("package_modules", sa.Column("default_seats", sa.Integer(), nullable=False, server_default="0"))
    op.add_column(
        "package_modules",
        sa.Column("is_included_by_default", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column(
        "package_modules",
        sa.Column("is_mandatory", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )

    op.create_table(
        "tenant_subscription_modules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "tenant_subscription_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenant_subscription.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("module_slug", sa.String(), sa.ForeignKey("modules.slug"), nullable=False),
        sa.Column("source_type", sa.String(), nullable=False, server_default="package"),
        sa.Column("status", sa.String(), nullable=False, server_default="active"),
        sa.Column("seats", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("pricing_mode", sa.String(), nullable=False, server_default="catalog"),
        sa.Column("override_base_price_ils", sa.Numeric(10, 2), nullable=True),
        sa.Column("override_per_seat_ils", sa.Numeric(10, 2), nullable=True),
        sa.Column("override_setup_fee_ils", sa.Numeric(10, 2), nullable=True),
        sa.Column("override_included_seats", sa.Integer(), nullable=True),
        sa.Column("price_lock_reason", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("source_type IN ('package','template','manual')", name="ck_tenant_subscription_module_source_type"),
        sa.CheckConstraint("status IN ('active','removed')", name="ck_tenant_subscription_module_status"),
        sa.CheckConstraint("pricing_mode IN ('catalog','override')", name="ck_tenant_subscription_module_pricing_mode"),
    )
    op.create_index(
        "ix_tenant_subscription_modules_subscription_id",
        "tenant_subscription_modules",
        ["tenant_subscription_id"],
    )

    op.execute(
        """
        INSERT INTO tenant_subscription_modules (
            tenant_subscription_id,
            module_slug,
            source_type,
            status,
            seats,
            pricing_mode,
            created_by
        )
        SELECT
            ts.id,
            module_slug,
            CASE WHEN ts.template_id IS NULL THEN 'manual' ELSE 'template' END,
            'active',
            COALESCE(ts.seat_count, 0),
            'catalog',
            ts.created_by
        FROM tenant_subscription ts
        CROSS JOIN LATERAL unnest(ts.selected_module_slugs) AS module_slug
        """
    )

    op.execute(
        """
        INSERT INTO tenant_subscription_modules (
            tenant_subscription_id,
            module_slug,
            source_type,
            status,
            seats,
            pricing_mode,
            created_by
        )
        SELECT
            ts.id,
            pm.module_slug,
            'package',
            CASE WHEN pm.is_included_by_default THEN 'active' ELSE 'removed' END,
            pm.default_seats,
            'catalog',
            ts.created_by
        FROM tenant_subscription ts
        JOIN packages p ON p.slug = ts.package_slug
        JOIN package_modules pm ON pm.package_id = p.id
        WHERE COALESCE(array_length(ts.selected_module_slugs, 1), 0) = 0
        """
    )

    op.alter_column("package_modules", "default_seats", server_default=None)
    op.alter_column("package_modules", "is_included_by_default", server_default=None)
    op.alter_column("package_modules", "is_mandatory", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_tenant_subscription_modules_subscription_id", table_name="tenant_subscription_modules")
    op.drop_table("tenant_subscription_modules")
    op.drop_column("package_modules", "is_mandatory")
    op.drop_column("package_modules", "is_included_by_default")
    op.drop_column("package_modules", "default_seats")
