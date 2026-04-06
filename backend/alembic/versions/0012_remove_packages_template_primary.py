"""remove packages and make templates the primary subscription source

Revision ID: 0012
Revises: 0011
Create Date: 2026-04-06
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import UUID


revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO org_template_modules (template_id, module_slug)
        SELECT DISTINCT ot.id, pm.module_slug
        FROM org_templates ot
        JOIN packages p ON p.slug = ot.default_package_slug
        JOIN package_modules pm ON pm.package_id = p.id
        LEFT JOIN org_template_modules otm
          ON otm.template_id = ot.id
         AND otm.module_slug = pm.module_slug
        WHERE otm.template_id IS NULL
          AND COALESCE(pm.is_included_by_default, TRUE) = TRUE
        """
    )

    op.execute(
        """
        UPDATE tenant_subscription_modules tsm
        SET source_type = CASE
            WHEN ts.template_id IS NOT NULL
             AND EXISTS (
                SELECT 1
                FROM org_template_modules otm
                WHERE otm.template_id = ts.template_id
                  AND otm.module_slug = tsm.module_slug
             )
            THEN 'template'
            ELSE 'manual'
        END
        FROM tenant_subscription ts
        WHERE ts.id = tsm.tenant_subscription_id
          AND tsm.source_type = 'package'
        """
    )

    op.drop_constraint(
        "ck_tenant_subscription_module_source_type",
        "tenant_subscription_modules",
        type_="check",
    )
    op.create_check_constraint(
        "ck_tenant_subscription_module_source_type",
        "tenant_subscription_modules",
        "source_type IN ('template','manual')",
    )

    op.execute("ALTER TABLE org_templates DROP COLUMN default_package_slug")
    op.execute("ALTER TABLE tenant_subscription DROP COLUMN package_slug")

    op.drop_table("package_modules")
    op.drop_table("packages")


def downgrade() -> None:
    op.create_table(
        "packages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("slug", sa.Text(), nullable=False, unique=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("is_featured", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("sort_order", sa.Integer(), server_default="10"),
    )
    op.create_table(
        "package_modules",
        sa.Column("package_id", UUID(as_uuid=True), sa.ForeignKey("packages.id"), primary_key=True),
        sa.Column("module_slug", sa.Text(), sa.ForeignKey("modules.slug"), primary_key=True),
        sa.Column("default_seats", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_included_by_default", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_mandatory", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )

    op.add_column("org_templates", sa.Column("default_package_slug", sa.Text(), nullable=True))
    op.create_foreign_key(
        "fk_org_templates_default_package_slug_packages",
        "org_templates",
        "packages",
        ["default_package_slug"],
        ["slug"],
    )

    op.add_column("tenant_subscription", sa.Column("package_slug", sa.Text(), nullable=True))
    op.execute("UPDATE tenant_subscription SET package_slug = 'legacy'")
    op.alter_column("tenant_subscription", "package_slug", nullable=False)

    op.drop_constraint(
        "ck_tenant_subscription_module_source_type",
        "tenant_subscription_modules",
        type_="check",
    )
    op.create_check_constraint(
        "ck_tenant_subscription_module_source_type",
        "tenant_subscription_modules",
        "source_type IN ('package','template','manual')",
    )

