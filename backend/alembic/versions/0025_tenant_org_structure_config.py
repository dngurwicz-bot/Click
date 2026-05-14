"""tenant org structure config

Revision ID: 0025
Revises: 0024
Create Date: 2026-05-07
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tenant_org_structure_config",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("levels", postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("position_attachment_level", sa.String(), nullable=False),
        sa.Column("is_hierarchical", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("valid_from", sa.Date(), nullable=False),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "position_attachment_level IN ('division','department','section','team')",
            name="ck_tenant_org_structure_position_attachment_level",
        ),
        sa.CheckConstraint(
            "valid_to IS NULL OR valid_to >= valid_from",
            name="ck_tenant_org_structure_valid_window",
        ),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.tenant_id"]),
        sa.ForeignKeyConstraint(["created_by"], ["admin_users.id"]),
        sa.ForeignKeyConstraint(["updated_by"], ["admin_users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_tenant_org_structure_config_tenant_valid_from",
        "tenant_org_structure_config",
        ["tenant_id", "valid_from"],
    )

    op.execute(
        """
        INSERT INTO tenant_org_structure_config (
            id,
            tenant_id,
            levels,
            position_attachment_level,
            is_hierarchical,
            valid_from,
            valid_to,
            created_at
        )
        SELECT
            gen_random_uuid(),
            t.tenant_id,
            ARRAY['division','department','section','team']::text[],
            'team',
            TRUE,
            COALESCE(
                (
                    SELECT MIN(ts.valid_from)
                    FROM tenant_status ts
                    WHERE ts.tenant_id = t.tenant_id
                ),
                CURRENT_DATE
            ),
            NULL,
            NOW()
        FROM tenants t
        WHERE NOT EXISTS (
            SELECT 1
            FROM tenant_org_structure_config cfg
            WHERE cfg.tenant_id = t.tenant_id
        )
        """
    )


def downgrade() -> None:
    op.drop_index("ix_tenant_org_structure_config_tenant_valid_from", table_name="tenant_org_structure_config")
    op.drop_table("tenant_org_structure_config")
