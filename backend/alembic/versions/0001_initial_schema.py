"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-03-26
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. tenants
    op.create_table(
        "tenants",
        sa.Column("tenant_id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # 2. admin_users (needs to exist before temporal tables reference it)
    op.create_table(
        "admin_users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("full_name", sa.Text, nullable=False),
        sa.Column("email", sa.Text, nullable=False, unique=True),
        sa.Column("role", sa.Text, nullable=False, server_default="admin"),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("true")),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.CheckConstraint("role IN ('super_admin','admin','support','billing')", name="ck_admin_users_role"),
    )

    # 3. tenant_identity
    op.create_table(
        "tenant_identity",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.tenant_id"), nullable=False),
        sa.Column("name_he", sa.Text, nullable=False),
        sa.Column("name_en", sa.Text, nullable=True),
        sa.Column("tax_id", sa.Text, nullable=False, unique=True),
        sa.Column("entity_type", sa.Text, nullable=False),
        sa.Column("logo_url", sa.Text, nullable=True),
        sa.Column("valid_from", sa.Date, nullable=False),
        sa.Column("valid_to", sa.Date, nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.CheckConstraint("entity_type IN ('company','self_employed','nonprofit','gov')", name="ck_tenant_identity_entity_type"),
    )

    # 4. tenant_contact
    op.create_table(
        "tenant_contact",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.tenant_id"), nullable=False),
        sa.Column("email", sa.Text, nullable=False),
        sa.Column("phone", sa.Text, nullable=False),
        sa.Column("contact_name", sa.Text, nullable=True),
        sa.Column("website", sa.Text, nullable=True),
        sa.Column("valid_from", sa.Date, nullable=False),
        sa.Column("valid_to", sa.Date, nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # 5. tenant_address
    op.create_table(
        "tenant_address",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.tenant_id"), nullable=False),
        sa.Column("street", sa.Text, nullable=False),
        sa.Column("city", sa.Text, nullable=False),
        sa.Column("zip_code", sa.Text, nullable=True),
        sa.Column("country", sa.Text, nullable=False, server_default="IL"),
        sa.Column("addr_type", sa.Text, nullable=False, server_default="main"),
        sa.Column("valid_from", sa.Date, nullable=False),
        sa.Column("valid_to", sa.Date, nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # 6. tenant_subscription
    op.create_table(
        "tenant_subscription",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.tenant_id"), nullable=False),
        sa.Column("package_slug", sa.Text, nullable=False),
        sa.Column("billing_cycle", sa.Text, nullable=False, server_default="monthly"),
        sa.Column("currency", sa.Text, nullable=False, server_default="ILS"),
        sa.Column("discount_pct", sa.Numeric(5, 2), server_default="0"),
        sa.Column("valid_from", sa.Date, nullable=False),
        sa.Column("valid_to", sa.Date, nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # 7. tenant_status
    op.create_table(
        "tenant_status",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.tenant_id"), nullable=False),
        sa.Column("status", sa.Text, nullable=False, server_default="trial"),
        sa.Column("reason", sa.Text, nullable=True),
        sa.Column("valid_from", sa.Date, nullable=False),
        sa.Column("valid_to", sa.Date, nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.CheckConstraint("status IN ('trial','active','suspended','cancelled')", name="ck_tenant_status_status"),
    )

    # 8. modules
    op.create_table(
        "modules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("slug", sa.Text, nullable=False, unique=True),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("icon", sa.Text, nullable=True),
        sa.Column("color_hex", sa.Text, nullable=True),
        sa.Column("is_required", sa.Boolean, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("true")),
        sa.Column("sort_order", sa.Integer, server_default="10"),
        sa.Column("depends_on", sa.ARRAY(sa.Text), server_default="{}"),
    )

    # 9. module_prices
    op.create_table(
        "module_prices",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("module_slug", sa.Text, sa.ForeignKey("modules.slug"), nullable=False),
        sa.Column("base_price_ils", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("per_seat_ils", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("included_seats", sa.Integer, nullable=False, server_default="0"),
        sa.Column("setup_fee_ils", sa.Numeric(10, 2), server_default="0"),
        sa.Column("valid_from", sa.Date, nullable=False),
        sa.Column("valid_to", sa.Date, nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("admin_users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # 10. packages
    op.create_table(
        "packages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("slug", sa.Text, nullable=False, unique=True),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("true")),
        sa.Column("is_featured", sa.Boolean, server_default=sa.text("false")),
        sa.Column("sort_order", sa.Integer, server_default="10"),
    )

    # 11. package_modules
    op.create_table(
        "package_modules",
        sa.Column("package_id", UUID(as_uuid=True), sa.ForeignKey("packages.id"), primary_key=True),
        sa.Column("module_slug", sa.Text, sa.ForeignKey("modules.slug"), primary_key=True),
    )

    # 12. org_templates
    op.create_table(
        "org_templates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("default_package_slug", sa.Text, sa.ForeignKey("packages.slug"), nullable=True),
        sa.Column("default_billing_cycle", sa.Text, server_default="monthly"),
        sa.Column("trial_days", sa.Integer, server_default="30"),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("true")),
        sa.Column("sort_order", sa.Integer, server_default="10"),
    )

    # 13. org_template_defaults
    op.create_table(
        "org_template_defaults",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("template_id", UUID(as_uuid=True), sa.ForeignKey("org_templates.id"), nullable=False),
        sa.Column("default_type", sa.Text, nullable=False),
        sa.Column("default_value", sa.Text, nullable=False),
        sa.Column("is_mandatory", sa.Boolean, server_default=sa.text("false")),
        sa.Column("note", sa.Text, nullable=True),
    )

    # 14. audit_log
    op.create_table(
        "audit_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=True),
        sa.Column("actor_id", UUID(as_uuid=True), nullable=False),
        sa.Column("actor_type", sa.Text, nullable=False),
        sa.Column("action", sa.Text, nullable=False),
        sa.Column("entity_type", sa.Text, nullable=False),
        sa.Column("entity_id", UUID(as_uuid=True), nullable=True),
        sa.Column("old_values", JSONB, nullable=True),
        sa.Column("new_values", JSONB, nullable=True),
        sa.Column("ip_address", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # Seed: modules
    op.execute("""
        INSERT INTO modules (slug, name, is_required, sort_order) VALUES
          ('core',     'CLICK Core',     true,  1),
          ('flow',     'CLICK Flow',     false, 2),
          ('docs',     'CLICK Docs',     false, 3),
          ('vision',   'CLICK Vision',   false, 4),
          ('assets',   'CLICK Assets',   false, 5),
          ('vibe',     'CLICK Vibe',     false, 6),
          ('grow',     'CLICK Grow',     false, 7),
          ('insights', 'CLICK Insights', false, 8)
    """)

    # Seed: packages
    op.execute("""
        INSERT INTO packages (slug, name, is_featured, sort_order) VALUES
          ('starter',      'Starter',      false, 1),
          ('professional', 'Professional', true,  2),
          ('enterprise',   'Enterprise',   false, 3)
    """)


def downgrade() -> None:
    op.drop_table("audit_log")
    op.drop_table("org_template_defaults")
    op.drop_table("org_templates")
    op.drop_table("package_modules")
    op.drop_table("packages")
    op.drop_table("module_prices")
    op.drop_table("modules")
    op.drop_table("tenant_status")
    op.drop_table("tenant_subscription")
    op.drop_table("tenant_address")
    op.drop_table("tenant_contact")
    op.drop_table("tenant_identity")
    op.drop_table("admin_users")
    op.drop_table("tenants")
