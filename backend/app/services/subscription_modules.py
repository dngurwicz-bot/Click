from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.module import Module, ModulePrice, OrgTemplateModule
from app.models.tenant import TenantSubscription, TenantSubscriptionModule

TWO_PLACES = Decimal("0.01")


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def round2(value: Decimal | int | float | None) -> Decimal:
    numeric = value if isinstance(value, Decimal) else Decimal(str(value or "0"))
    return numeric.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


@dataclass
class BlueprintModule:
    module_slug: str
    source_type: str
    seats: int
    status: str = "active"
    pricing_mode: str = "catalog"
    override_base_price_ils: Decimal | None = None
    override_per_seat_ils: Decimal | None = None
    override_setup_fee_ils: Decimal | None = None
    override_included_seats: int | None = None
    price_lock_reason: str | None = None
    notes: str | None = None


def _effective_window_clause(as_of: date):
    return sa.and_(
        TenantSubscriptionModule.valid_from <= as_of,
        sa.or_(
            TenantSubscriptionModule.valid_to.is_(None),
            TenantSubscriptionModule.valid_to >= as_of,
        ),
    )


async def load_template_module_slugs(db: AsyncSession, template_id: uuid.UUID | None) -> list[str]:
    if not template_id:
        return []
    result = await db.execute(
        sa.select(OrgTemplateModule.module_slug)
        .where(OrgTemplateModule.template_id == template_id)
    )
    return [row[0] for row in result.all()]


async def load_subscription_modules(
    db: AsyncSession,
    subscription_id: uuid.UUID,
    *,
    as_of: date | None = None,
) -> list[TenantSubscriptionModule]:
    effective_on = as_of or date.today()
    result = await db.execute(
        sa.select(TenantSubscriptionModule)
        .where(TenantSubscriptionModule.tenant_subscription_id == subscription_id)
        .where(_effective_window_clause(effective_on))
        .order_by(
            TenantSubscriptionModule.module_slug,
            TenantSubscriptionModule.valid_from.desc(),
            TenantSubscriptionModule.created_at.desc(),
        )
    )
    rows = result.scalars().all()
    effective_rows: dict[str, TenantSubscriptionModule] = {}
    for row in rows:
        effective_rows.setdefault(row.module_slug, row)
    return [effective_rows[key] for key in sorted(effective_rows)]


async def load_subscription_module_history(
    db: AsyncSession,
    subscription_id: uuid.UUID,
) -> list[TenantSubscriptionModule]:
    result = await db.execute(
        sa.select(TenantSubscriptionModule)
        .where(TenantSubscriptionModule.tenant_subscription_id == subscription_id)
        .order_by(
            TenantSubscriptionModule.valid_from.desc(),
            TenantSubscriptionModule.module_slug,
            TenantSubscriptionModule.created_at.desc(),
        )
    )
    return list(result.scalars().all())


async def load_tenant_subscription_module_history(
    db: AsyncSession,
    tenant_id: uuid.UUID,
) -> list[TenantSubscriptionModule]:
    result = await db.execute(
        sa.select(TenantSubscriptionModule)
        .join(TenantSubscription, TenantSubscription.id == TenantSubscriptionModule.tenant_subscription_id)
        .where(TenantSubscription.tenant_id == tenant_id)
        .order_by(
            TenantSubscriptionModule.valid_from.desc(),
            TenantSubscriptionModule.module_slug,
            TenantSubscriptionModule.created_at.desc(),
        )
    )
    return list(result.scalars().all())


async def get_effective_subscription_module(
    db: AsyncSession,
    subscription_id: uuid.UUID,
    module_slug: str,
    *,
    as_of: date,
) -> TenantSubscriptionModule | None:
    result = await db.execute(
        sa.select(TenantSubscriptionModule)
        .where(TenantSubscriptionModule.tenant_subscription_id == subscription_id)
        .where(TenantSubscriptionModule.module_slug == module_slug)
        .where(_effective_window_clause(as_of))
        .order_by(TenantSubscriptionModule.valid_from.desc(), TenantSubscriptionModule.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def build_subscription_blueprint(
    db: AsyncSession,
    *,
    template_id: uuid.UUID | None,
    default_seat_count: int,
) -> list[BlueprintModule]:
    blueprint: dict[str, BlueprintModule] = {}

    for module_slug in await load_template_module_slugs(db, template_id):
        blueprint[module_slug] = BlueprintModule(
            module_slug=module_slug,
            source_type="template",
            seats=max(default_seat_count, 0),
        )

    return [blueprint[key] for key in sorted(blueprint)]


async def replace_subscription_modules(
    db: AsyncSession,
    *,
    subscription_id: uuid.UUID,
    modules: list[BlueprintModule],
    actor_id: uuid.UUID | None,
    valid_from: date,
    valid_to: date | None,
) -> list[TenantSubscriptionModule]:
    await db.execute(
        sa.delete(TenantSubscriptionModule)
        .where(TenantSubscriptionModule.tenant_subscription_id == subscription_id)
        .execution_options(synchronize_session=False)
    )
    created_rows: list[TenantSubscriptionModule] = []
    for item in modules:
        row = TenantSubscriptionModule(
            tenant_subscription_id=subscription_id,
            module_slug=item.module_slug,
            source_type=item.source_type,
            status=item.status,
            seats=max(item.seats, 0),
            pricing_mode=item.pricing_mode,
            override_base_price_ils=item.override_base_price_ils,
            override_per_seat_ils=item.override_per_seat_ils,
            override_setup_fee_ils=item.override_setup_fee_ils,
            override_included_seats=item.override_included_seats,
            price_lock_reason=item.price_lock_reason,
            notes=item.notes,
            valid_from=valid_from,
            valid_to=valid_to,
            created_by=actor_id,
        )
        db.add(row)
        created_rows.append(row)
    await db.flush()
    return created_rows


async def clone_subscription_modules(
    db: AsyncSession,
    *,
    source_subscription_id: uuid.UUID,
    target_subscription_id: uuid.UUID,
    actor_id: uuid.UUID | None,
    target_valid_from: date,
    target_valid_to: date | None,
    source_as_of: date | None = None,
) -> list[TenantSubscriptionModule]:
    source_rows = await load_subscription_modules(
        db,
        source_subscription_id,
        as_of=source_as_of or target_valid_from,
    )
    return await replace_subscription_modules(
        db,
        subscription_id=target_subscription_id,
        modules=[
            BlueprintModule(
                module_slug=row.module_slug,
                source_type=row.source_type,
                status=row.status,
                seats=row.seats,
                pricing_mode=row.pricing_mode,
                override_base_price_ils=row.override_base_price_ils,
                override_per_seat_ils=row.override_per_seat_ils,
                override_setup_fee_ils=row.override_setup_fee_ils,
                override_included_seats=row.override_included_seats,
                price_lock_reason=row.price_lock_reason,
                notes=row.notes,
            )
            for row in source_rows
        ],
        actor_id=actor_id,
        valid_from=target_valid_from,
        valid_to=target_valid_to,
    )


async def align_subscription_modules_to_subscription(
    db: AsyncSession,
    *,
    subscription_id: uuid.UUID,
    valid_to: date | None,
    actor_id: uuid.UUID | None,
) -> None:
    if valid_to is None:
        return
    await db.execute(
        sa.update(TenantSubscriptionModule)
        .where(TenantSubscriptionModule.tenant_subscription_id == subscription_id)
        .where(
            sa.or_(
                TenantSubscriptionModule.valid_to.is_(None),
                TenantSubscriptionModule.valid_to > valid_to,
            )
        )
        .where(TenantSubscriptionModule.valid_from <= valid_to)
        .values(
            valid_to=valid_to,
            updated_by=actor_id,
            updated_at=_now_utc(),
        )
        .execution_options(synchronize_session=False)
    )


def sync_subscription_header(subscription: TenantSubscription, modules: list[TenantSubscriptionModule]) -> None:
    active_module_slugs = [row.module_slug for row in modules if row.status == "active"]
    subscription.selected_module_slugs = active_module_slugs
    subscription.seat_count = max((row.seats for row in modules if row.status == "active"), default=0)


async def get_effective_module_prices(
    db: AsyncSession,
    module_slugs: list[str],
    *,
    as_of,
) -> dict[str, ModulePrice]:
    if not module_slugs:
        return {}
    result = await db.execute(
        sa.select(ModulePrice)
        .where(ModulePrice.module_slug.in_(module_slugs))
        .where(ModulePrice.valid_from <= as_of)
        .where(sa.or_(ModulePrice.valid_to.is_(None), ModulePrice.valid_to >= as_of))
        .order_by(ModulePrice.module_slug, ModulePrice.valid_from.desc(), ModulePrice.created_at.desc())
    )
    prices: dict[str, ModulePrice] = {}
    for row in result.scalars().all():
        prices.setdefault(row.module_slug, row)
    return prices


async def get_module_names(db: AsyncSession, module_slugs: list[str]) -> dict[str, str]:
    if not module_slugs:
        return {}
    result = await db.execute(sa.select(Module.slug, Module.name).where(Module.slug.in_(module_slugs)))
    return {slug: name for slug, name in result.all()}


def calculate_module_totals(
    row: TenantSubscriptionModule,
    catalog_price: ModulePrice | None,
) -> tuple[Decimal, Decimal]:
    if row.pricing_mode == "override":
        base_price = row.override_base_price_ils or Decimal("0")
        per_seat = row.override_per_seat_ils or Decimal("0")
        included = row.override_included_seats or 0
        setup = row.override_setup_fee_ils or Decimal("0")
    else:
        base_price = catalog_price.base_price_ils if catalog_price else Decimal("0")
        per_seat = catalog_price.per_seat_ils if catalog_price else Decimal("0")
        included = catalog_price.included_seats if catalog_price else 0
        setup = catalog_price.setup_fee_ils if catalog_price else Decimal("0")
    billable_seats = max(row.seats - included, 0)
    monthly_total = round2(base_price + (per_seat * Decimal(billable_seats)))
    setup_total = round2(setup)
    return monthly_total, setup_total
