"""lookup_lists and lookup_items tables with seed data

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── lookup_lists ──────────────────────────────────────────────────────────
    op.create_table(
        "lookup_lists",
        sa.Column("id",          UUID(as_uuid=True), primary_key=True),
        sa.Column("list_key",    sa.String(),  nullable=False, unique=True),
        sa.Column("name_he",     sa.String(),  nullable=False),
        sa.Column("description", sa.String(),  nullable=True),
        sa.Column("is_system",   sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_active",   sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at",  sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── lookup_items ──────────────────────────────────────────────────────────
    op.create_table(
        "lookup_items",
        sa.Column("id",         UUID(as_uuid=True), primary_key=True),
        sa.Column("list_id",    UUID(as_uuid=True), sa.ForeignKey("lookup_lists.id"), nullable=False),
        sa.Column("item_key",   sa.String(), nullable=False),
        sa.Column("label_he",   sa.String(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_system",  sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_active",  sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_unique_constraint(
        "uq_lookup_items_list_key", "lookup_items", ["list_id", "item_key"]
    )

    # ── seed: entity_type ─────────────────────────────────────────────────────
    entity_list_id = str(uuid.uuid4())
    op.execute(f"""
        INSERT INTO lookup_lists (id, list_key, name_he, description, is_system, is_active)
        VALUES ('{entity_list_id}', 'entity_type', 'סוגי ישויות', 'סוג הישות המשפטית של הארגון', true, true)
    """)
    for sort_order, (item_key, label_he) in enumerate([
        ("company",       'חברה בע"מ'),
        ("self_employed", "עוסק מורשה"),
        ("nonprofit",     "עמותה"),
        ("gov",           "גוף ממשלתי"),
    ]):
        op.execute(f"""
            INSERT INTO lookup_items (id, list_id, item_key, label_he, sort_order, is_system, is_active)
            VALUES ('{uuid.uuid4()}', '{entity_list_id}', '{item_key}', '{label_he}', {sort_order}, true, true)
        """)

    # ── seed: contact_type ────────────────────────────────────────────────────
    contact_list_id = str(uuid.uuid4())
    op.execute(f"""
        INSERT INTO lookup_lists (id, list_key, name_he, description, is_system, is_active)
        VALUES ('{contact_list_id}', 'contact_type', 'סוגי קשרים', 'סוג איש הקשר של הארגון', true, true)
    """)
    for sort_order, (item_key, label_he) in enumerate([
        ("main",      "ראשי"),
        ("billing",   "חשבונאות"),
        ("technical", "טכני"),
        ("other",     "אחר"),
    ]):
        op.execute(f"""
            INSERT INTO lookup_items (id, list_id, item_key, label_he, sort_order, is_system, is_active)
            VALUES ('{uuid.uuid4()}', '{contact_list_id}', '{item_key}', '{label_he}', {sort_order}, true, true)
        """)

    # ── seed: package ─────────────────────────────────────────────────────────
    package_list_id = str(uuid.uuid4())
    op.execute(f"""
        INSERT INTO lookup_lists (id, list_key, name_he, description, is_system, is_active)
        VALUES ('{package_list_id}', 'package', 'חבילות', 'חבילות המנוי הזמינות', true, true)
    """)
    for sort_order, (item_key, label_he) in enumerate([
        ("starter",      "סטרטר"),
        ("professional", "פרופשיונל"),
        ("enterprise",   "אנטרפרייז"),
    ]):
        op.execute(f"""
            INSERT INTO lookup_items (id, list_id, item_key, label_he, sort_order, is_system, is_active)
            VALUES ('{uuid.uuid4()}', '{package_list_id}', '{item_key}', '{label_he}', {sort_order}, true, true)
        """)


def downgrade() -> None:
    op.drop_table("lookup_items")
    op.drop_table("lookup_lists")
