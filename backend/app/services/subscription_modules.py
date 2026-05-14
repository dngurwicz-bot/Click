from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.module import Module, ModulePrice, OrgTemplateModule
from app.models.billing_engine import BillingContract, BillingContractItem
from app.models.tenant import TenantSubscription, TenantSubscriptionModule
from app.services.billing_engine import add_months, clamp_anchor_day
from app.services.billing_engine import effective_contract_items

TWO_PLACES = Decimal("0.01")


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def round2(value: Decimal | int | float | None) -> Decimal:
    numeric = value if isinstance(value, Decimal) else Decimal(str(value or "0"))
    return numeric.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def derive_subscription_snapshot(modules: list[TenantSubscriptionModule]) -> tuple[int, list[str]]:
    active_rows = [row for row in modules if row.status == "active"]
    active_module_slugs = [row.module_slug for row in active_rows]
    seat_count = max((row.seats for row in active_rows), default=0)
    return seat_count, active_module_slugs


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
    """Return a flat list of module slugs for a template (backward-compatible)."""
    if not template_id:
        return []
    result = await db.execute(
        sa.select(OrgTemplateModule.module_slug)
        .where(OrgTemplateModule.template_id == template_id)
    )
    return [row[0] for row in result.all()]


async def load_template_modules_with_seats(
    db: AsyncSession,
    template_id: uuid.UUID | None,
) -> list[tuple[str, int | None]]:
    """Return (module_slug, seats_default) tuples for a template.
    seats_default is None when no per-module override is set.
    """
    if not template_id:
        return []
    result = await db.execute(
        sa.select(OrgTemplateModule.module_slug, OrgTemplateModule.seats_default)
        .where(OrgTemplateModule.template_id == template_id)
    )
    return [(row.module_slug, row.seats_default) for row in result.all()]


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
    existing_seats: dict[str, int] | None = None,
) -> list[BlueprintModule]:
    """Build the module blueprint for a subscription.

    Seat count priority per module (highest to lowest):
      1. OrgTemplateModule.seats_default  (per-module override in the template)
      2. template-level default_seat_count (from OrgTemplateDefault['seat_count'])
      3. existing_seats[module_slug]       (what the tenant already has — option C: take max)
      4. 0

    When existing_seats is provided (apply-template / sync flows), we take the
    MAX between the template-derived value and the existing value so a tenant
    never loses seats they already had.
    """
    blueprint: dict[str, BlueprintModule] = {}

    for module_slug, seats_default in await load_template_modules_with_seats(db, template_id):
        # Determine what the template wants for this module
        template_seats = seats_default if seats_default is not None else default_seat_count
        template_seats = max(template_seats, 0)

        # Option C: take max(template, existing) so tenants never lose seats
        if existing_seats is not None:
            current = existing_seats.get(module_slug, 0)
            effective_seats = max(template_seats, current)
        else:
            effective_seats = template_seats

        blueprint[module_slug] = BlueprintModule(
            module_slug=module_slug,
            source_type="template",
            seats=effective_seats,
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
    seat_count, active_module_slugs = derive_subscription_snapshot(modules)
    subscription.selected_module_slugs = active_module_slugs
    subscription.seat_count = seat_count


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


def calculate_subscription_pricing(
    subscription: TenantSubscription,
    module_rows: list[TenantSubscriptionModule],
    catalog_prices: dict[str, ModulePrice],
) -> dict[str, Decimal]:
    active_rows = [row for row in module_rows if row.status == "active"]
    monthly_subtotal = Decimal("0")
    setup_subtotal = Decimal("0")
    discount_ratio = Decimal("1") - (round2(subscription.discount_pct) / Decimal("100"))

    for row in active_rows:
        monthly_total, setup_total = calculate_module_totals(row, catalog_prices.get(row.module_slug))
        monthly_subtotal += monthly_total
        setup_subtotal += setup_total

    current_monthly_total = round2(monthly_subtotal * discount_ratio)
    current_yearly_total = round2(current_monthly_total * Decimal("12"))
    current_setup_total = round2(setup_subtotal * discount_ratio)
    current_cycle_total = (
        current_yearly_total
        if _contract_cycle(subscription.billing_cycle) == "yearly"
        else current_monthly_total
    )
    initial_charge_total = round2(current_cycle_total + current_setup_total)
    return {
        "current_monthly_total_ils": current_monthly_total,
        "current_yearly_total_ils": current_yearly_total,
        "current_cycle_total_ils": current_cycle_total,
        "current_setup_total_ils": current_setup_total,
        "initial_charge_total_ils": initial_charge_total,
        "next_charge_total_ils": current_cycle_total,
    }


def _contract_cycle(subscription_cycle: str) -> str:
    return "yearly" if subscription_cycle == "yearly" else "monthly"


def _subscription_cycle_step_months(subscription_cycle: str) -> int:
    if subscription_cycle == "yearly":
        return 12
    if subscription_cycle == "quarterly":
        return 3
    return 1


def calculate_next_subscription_renewal(
    subscription: TenantSubscription,
    *,
    as_of: date | None = None,
) -> date:
    """Return the next scheduled renewal date strictly after the reference point."""
    reference = as_of or date.today()
    if reference < subscription.valid_from:
        reference = subscription.valid_from - date.resolution

    anchor_day = max(1, min(int(subscription.billing_anchor_day or 1), 31))
    step_months = _subscription_cycle_step_months(subscription.billing_cycle)
    candidate = clamp_anchor_day(subscription.valid_from.year, subscription.valid_from.month, anchor_day)

    while candidate < subscription.valid_from:
        next_month = add_months(date(candidate.year, candidate.month, 1), step_months)
        candidate = clamp_anchor_day(next_month.year, next_month.month, anchor_day)

    while candidate <= reference:
        next_month = add_months(date(candidate.year, candidate.month, 1), step_months)
        candidate = clamp_anchor_day(next_month.year, next_month.month, anchor_day)

    return candidate


def _contract_item_values(
    row: TenantSubscriptionModule,
    catalog_price: ModulePrice | None,
    *,
    discount_pct: Decimal,
) -> dict[str, object]:
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
    return {
        "status": row.status,
        "rating_model": "per_seat",
        "quantity": max(row.seats, 0),
        "base_amount_ils": round2(base_price),
        "included_qty": max(included, 0),
        "per_unit_amount_ils": round2(per_seat),
        "tier_definition": None,
        "setup_fee_amount_ils": round2(setup),
        "discount_pct": round2(discount_pct),
    }


def _contract_item_changed(item: BillingContractItem, values: dict[str, object]) -> bool:
    comparable_fields = [
        "status",
        "rating_model",
        "quantity",
        "base_amount_ils",
        "included_qty",
        "per_unit_amount_ils",
        "tier_definition",
        "setup_fee_amount_ils",
        "discount_pct",
    ]
    return any(getattr(item, field) != values[field] for field in comparable_fields)


async def sync_billing_contract_from_subscription(
    db: AsyncSession,
    *,
    subscription: TenantSubscription,
    actor_id: uuid.UUID | None,
    as_of: date | None = None,
) -> BillingContract:
    """Mirror the customer-file subscription modules into billing contract items.

    The customer file remains the source of truth. BillingContractItem rows are
    maintained as the billable timeline used by the billing engine.
    """
    effective_on = as_of or subscription.valid_from
    contract_result = await db.execute(
        sa.select(BillingContract)
        .where(BillingContract.tenant_id == subscription.tenant_id)
        .where(BillingContract.status.in_(["active", "draft"]))
        .order_by(BillingContract.status, BillingContract.start_date.desc(), BillingContract.created_at.desc())
        .limit(1)
    )
    contract = contract_result.scalar_one_or_none()
    if contract is None:
        contract = BillingContract(
            tenant_id=subscription.tenant_id,
            status="active",
            billing_cycle=_contract_cycle(subscription.billing_cycle),
            anchor_day=subscription.billing_anchor_day,
            currency=subscription.currency,
            start_date=subscription.valid_from,
            next_renewal_at=calculate_next_subscription_renewal(subscription, as_of=effective_on),
            created_by=actor_id,
            updated_by=actor_id,
            updated_at=_now_utc(),
        )
        db.add(contract)
        await db.flush()
    else:
        contract.billing_cycle = _contract_cycle(subscription.billing_cycle)
        contract.anchor_day = subscription.billing_anchor_day
        contract.currency = subscription.currency
        contract.next_renewal_at = calculate_next_subscription_renewal(subscription, as_of=effective_on)
        contract.updated_by = actor_id
        contract.updated_at = _now_utc()

    if contract.next_renewal_at is None:
        contract.next_renewal_at = calculate_next_subscription_renewal(subscription, as_of=effective_on)
    subscription.next_renewal_at = contract.next_renewal_at
    subscription.updated_by = actor_id
    subscription.updated_at = _now_utc()

    module_rows = await load_subscription_modules(db, subscription.id, as_of=effective_on)
    prices = await get_effective_module_prices(db, [row.module_slug for row in module_rows], as_of=effective_on)
    current_items = {
        item.module_slug: item
        for item in await effective_contract_items(db, contract.id, effective_on)
    }
    seen_slugs: set[str] = set()

    for row in module_rows:
        seen_slugs.add(row.module_slug)
        values = _contract_item_values(row, prices.get(row.module_slug), discount_pct=subscription.discount_pct)
        item = current_items.get(row.module_slug)
        if item is None:
            db.add(BillingContractItem(
                contract_id=contract.id,
                module_slug=row.module_slug,
                effective_from=max(row.valid_from, effective_on),
                effective_to=row.valid_to,
                created_by=actor_id,
                updated_by=actor_id,
                updated_at=_now_utc(),
                **values,
            ))
            continue
        if not _contract_item_changed(item, values):
            continue
        if effective_on <= item.effective_from:
            for key, value in values.items():
                setattr(item, key, value)
            item.effective_to = row.valid_to
            item.updated_by = actor_id
            item.updated_at = _now_utc()
        else:
            item.effective_to = effective_on - date.resolution
            item.updated_by = actor_id
            item.updated_at = _now_utc()
            db.add(BillingContractItem(
                contract_id=contract.id,
                module_slug=row.module_slug,
                effective_from=effective_on,
                effective_to=row.valid_to,
                created_by=actor_id,
                updated_by=actor_id,
                updated_at=_now_utc(),
                **values,
            ))

    for slug, item in current_items.items():
        if slug in seen_slugs:
            continue
        if effective_on <= item.effective_from:
            item.status = "removed"
            item.effective_to = item.effective_from
        else:
            item.effective_to = effective_on - date.resolution
        item.updated_by = actor_id
        item.updated_at = _now_utc()

    await db.flush()
    return contract
