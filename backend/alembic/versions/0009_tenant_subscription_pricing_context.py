"""tenant_subscription: add pricing context fields

Revision ID: 0009
Revises: 0008
Create Date: 2026-04-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tenant_subscription",
        sa.Column("template_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "tenant_subscription",
        sa.Column("seat_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "tenant_subscription",
        sa.Column(
            "selected_module_slugs",
            postgresql.ARRAY(sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::text[]"),
        ),
    )
    op.create_foreign_key(
        "fk_tenant_subscription_template_id_org_templates",
        "tenant_subscription",
        "org_templates",
        ["template_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_tenant_subscription_template_id_org_templates",
        "tenant_subscription",
        type_="foreignkey",
    )
    op.drop_column("tenant_subscription", "selected_module_slugs")
    op.drop_column("tenant_subscription", "seat_count")
    op.drop_column("tenant_subscription", "template_id")
