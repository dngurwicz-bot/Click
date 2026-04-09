import uuid
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete

from app.database import get_db
from app.middleware.auth import require_permission, CurrentUser
from app.models.module import OrgTemplate, OrgTemplateModule, OrgTemplateDefault, Module, ModulePrice
from app.schemas.template import (
    TemplateOut, TemplateCreate, TemplateActionBody,
    TemplateModulePricing, TemplatePricingSummary,
)

router = APIRouter(prefix="/api/admin/templates", tags=["templates"])

TWO_PLACES = Decimal("0.01")
DEFAULT_SEAT_COUNT = 0
DEFAULT_DISCOUNT_PCT = Decimal("0")


def _round2(value: Decimal) -> Decimal:
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _load_module_slugs(db: AsyncSession, template_id: uuid.UUID) -> list[str]:
    res = await db.execute(
        select(OrgTemplateModule.module_slug).where(OrgTemplateModule.template_id == template_id)
    )
    return [r[0] for r in res.all()]


async def _load_effective_module_slugs(db: AsyncSession, template: OrgTemplate) -> list[str]:
    return await _load_module_slugs(db, template.id)


async def _save_module_slugs(db: AsyncSession, template_id: uuid.UUID, slugs: list[str]) -> None:
    await db.execute(
        delete(OrgTemplateModule)
        .where(OrgTemplateModule.template_id == template_id)
        .execution_options(synchronize_session=False)
    )
    for s in slugs:
        db.add(OrgTemplateModule(template_id=template_id, module_slug=s))


async def _load_template_defaults(db: AsyncSession, template_id: uuid.UUID) -> dict[str, str]:
    res = await db.execute(
        select(OrgTemplateDefault.default_type, OrgTemplateDefault.default_value)
        .where(OrgTemplateDefault.template_id == template_id)
    )
    return {default_type: default_value for default_type, default_value in res.all()}


async def _delete_template_defaults(db: AsyncSession, template_id: uuid.UUID) -> None:
    await db.execute(
        delete(OrgTemplateDefault)
        .where(OrgTemplateDefault.template_id == template_id)
        .execution_options(synchronize_session=False)
    )


async def _save_template_defaults(
    db: AsyncSession,
    template_id: uuid.UUID,
    *,
    seat_count: int,
    discount_pct: Decimal,
    is_price_locked: bool,
) -> None:
    await _delete_template_defaults(db, template_id)
    defaults = [
        ("seat_count", str(seat_count), "ברירת מחדל למספר מושבים"),
        ("discount_pct", str(discount_pct), "ברירת מחדל לאחוז הנחה"),
        ("is_price_locked", "true" if is_price_locked else "false", "האם המחיר נעול כברירת מחדל"),
    ]
    for default_type, default_value, note in defaults:
        db.add(
            OrgTemplateDefault(
                template_id=template_id,
                default_type=default_type,
                default_value=default_value,
                is_mandatory=False,
                note=note,
            )
        )


def _default_seat_count(defaults: dict[str, str]) -> int:
    try:
        return max(int(defaults.get("seat_count", DEFAULT_SEAT_COUNT)), 0)
    except (TypeError, ValueError):
        return DEFAULT_SEAT_COUNT


def _default_discount_pct(defaults: dict[str, str]) -> Decimal:
    raw = defaults.get("discount_pct")
    try:
        value = Decimal(raw) if raw is not None else DEFAULT_DISCOUNT_PCT
    except Exception:
        value = DEFAULT_DISCOUNT_PCT
    return max(value, Decimal("0"))


def _default_price_locked(defaults: dict[str, str]) -> bool:
    return defaults.get("is_price_locked", "false").lower() in {"1", "true", "yes"}


async def _build_module_pricing(
    db: AsyncSession,
    module_slugs: list[str],
    seat_count: int,
) -> list[TemplateModulePricing]:
    if not module_slugs:
        return []

    today = date.today()
    modules_result = await db.execute(
        select(Module).where(Module.slug.in_(module_slugs))
    )
    module_map = {module.slug: module for module in modules_result.scalars().all()}

    price_result = await db.execute(
        select(ModulePrice)
        .where(ModulePrice.module_slug.in_(module_slugs))
        .where(ModulePrice.valid_from <= today)
        .where((ModulePrice.valid_to.is_(None)) | (ModulePrice.valid_to >= today))
        .order_by(ModulePrice.module_slug, ModulePrice.valid_from.desc())
    )
    price_map: dict[str, ModulePrice] = {}
    for price in price_result.scalars().all():
        price_map.setdefault(price.module_slug, price)

    items: list[TemplateModulePricing] = []
    for slug in module_slugs:
        module = module_map.get(slug)
        price = price_map.get(slug)
        included_seats = price.included_seats if price else 0
        billable_seats = max(seat_count - included_seats, 0)
        base_price = price.base_price_ils if price else Decimal("0")
        per_seat_price = price.per_seat_ils if price else Decimal("0")
        setup_fee = price.setup_fee_ils if price else Decimal("0")
        recurring_total = _round2(base_price + (per_seat_price * Decimal(billable_seats)))
        setup_total = _round2(setup_fee)
        items.append(
            TemplateModulePricing(
                module_slug=slug,
                module_name=module.name if module else slug,
                has_active_price=price is not None,
                base_price_ils=base_price,
                per_seat_ils=per_seat_price,
                included_seats=included_seats,
                setup_fee_ils=setup_fee,
                seat_count=seat_count,
                billable_seats=billable_seats,
                recurring_total_ils=recurring_total,
                setup_total_ils=setup_total,
            )
        )
    return items


def _build_pricing_summary(
    module_pricing: list[TemplateModulePricing],
    *,
    seat_count: int,
    discount_pct: Decimal,
    is_price_locked: bool,
) -> TemplatePricingSummary:
    recurring_before = _round2(sum((item.recurring_total_ils for item in module_pricing), Decimal("0")))
    setup_before = _round2(sum((item.setup_total_ils for item in module_pricing), Decimal("0")))
    discount_factor = Decimal("1") - (discount_pct / Decimal("100"))
    recurring_after = _round2(recurring_before * discount_factor)
    setup_after = _round2(setup_before * discount_factor)
    return TemplatePricingSummary(
        seat_count=seat_count,
        discount_pct=discount_pct,
        is_price_locked=is_price_locked,
        modules_count=len(module_pricing),
        recurring_before_discount_ils=recurring_before,
        recurring_after_discount_ils=recurring_after,
        setup_before_discount_ils=setup_before,
        setup_after_discount_ils=setup_after,
        total_before_discount_ils=_round2(recurring_before + setup_before),
        total_after_discount_ils=_round2(recurring_after + setup_after),
    )


async def _build_template_out(db: AsyncSession, template: OrgTemplate) -> TemplateOut:
    out = TemplateOut.model_validate(template)
    out.module_slugs = await _load_effective_module_slugs(db, template)
    defaults = await _load_template_defaults(db, template.id)
    out.seat_count = _default_seat_count(defaults)
    out.discount_pct = _default_discount_pct(defaults)
    out.is_price_locked = _default_price_locked(defaults)
    out.module_pricing = await _build_module_pricing(db, out.module_slugs, out.seat_count)
    out.pricing_summary = _build_pricing_summary(
        out.module_pricing,
        seat_count=out.seat_count,
        discount_pct=out.discount_pct,
        is_price_locked=out.is_price_locked,
    )
    return out


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[TemplateOut])
async def list_templates(
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("templates", "view")),
):
    """List all templates (active + history), ordered by valid_from DESC."""
    result = await db.execute(
        select(OrgTemplate).order_by(OrgTemplate.valid_from.desc())
    )
    templates = result.scalars().all()
    return [await _build_template_out(db, template) for template in templates]


@router.post("", response_model=TemplateOut, status_code=201)
async def create_template(
    body: TemplateCreate,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("templates", "edit")),
):
    """Create a new template record."""
    new_template = OrgTemplate(
        name=body.name,
        description=body.description,
        default_billing_cycle=body.default_billing_cycle,
        trial_days=body.trial_days,
        is_active=body.is_active,
        sort_order=body.sort_order,
        target_industry=body.target_industry,
        recommended_size=body.recommended_size,
        valid_from=body.valid_from or date.today(),
        valid_to=body.valid_to,
    )
    db.add(new_template)
    await db.flush()
    await db.refresh(new_template)
    await _save_module_slugs(db, new_template.id, body.module_slugs)
    await _save_template_defaults(
        db,
        new_template.id,
        seat_count=body.seat_count,
        discount_pct=body.discount_pct,
        is_price_locked=body.is_price_locked,
    )
    await db.commit()
    return await _build_template_out(db, new_template)


@router.put("/{template_id}", response_model=TemplateOut)
async def update_template(
    template_id: uuid.UUID,
    body: TemplateCreate,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("templates", "edit")),
):
    """Update template metadata (name, description, non-temporal fields)."""
    result = await db.execute(select(OrgTemplate).where(OrgTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail={"error": "Template not found", "code": "NOT_FOUND"})

    template.name = body.name
    template.description = body.description
    template.default_billing_cycle = body.default_billing_cycle
    template.trial_days = body.trial_days
    template.is_active = body.is_active
    template.sort_order = body.sort_order
    template.target_industry = body.target_industry
    template.recommended_size = body.recommended_size
    if body.valid_from is not None:
        template.valid_from = body.valid_from
    if body.valid_to is not None:
        template.valid_to = body.valid_to

    # TemplateCreate.module_slugs defaults to [] — treat as "replace with provided list"
    await _save_module_slugs(db, template_id, body.module_slugs)
    await _save_template_defaults(
        db,
        template_id,
        seat_count=body.seat_count,
        discount_pct=body.discount_pct,
        is_price_locked=body.is_price_locked,
    )
    await db.commit()
    await db.refresh(template)
    return await _build_template_out(db, template)


@router.delete("/{template_id}")
async def delete_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("templates", "edit")),
):
    """Hard delete a template by id."""
    result = await db.execute(select(OrgTemplate).where(OrgTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail={"error": "Template not found", "code": "NOT_FOUND"})

    await _delete_template_defaults(db, template_id)
    await db.execute(
        delete(OrgTemplate)
        .where(OrgTemplate.id == template_id)
        .execution_options(synchronize_session=False)
    )
    await db.commit()
    return {"ok": True}


@router.get("/{template_id}", response_model=list[TemplateOut])
async def get_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("templates", "view")),
):
    """Get a single template with its full history (all rows sharing the same name)."""
    result = await db.execute(select(OrgTemplate).where(OrgTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail={"error": "Template not found", "code": "NOT_FOUND"})

    history_result = await db.execute(
        select(OrgTemplate)
        .where(OrgTemplate.name == template.name)
        .order_by(OrgTemplate.valid_from.desc())
    )
    history = history_result.scalars().all()
    return [await _build_template_out(db, row) for row in history]


@router.put("/{template_id}/record", response_model=TemplateOut)
async def template_record_action(
    template_id: uuid.UUID,
    body: TemplateActionBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("templates", "edit")),
):
    """Temporal record actions: delete | close | update | add | set (kabiya)."""

    # Validate date range when both dates provided
    if body.valid_from and body.valid_to and body.valid_to < body.valid_from:
        raise HTTPException(
            status_code=422,
            detail={"error": "valid_to cannot be before valid_from", "code": "INVALID_DATE_RANGE"},
        )

    # Load the anchor row (the row identified by template_id in the URL)
    result = await db.execute(select(OrgTemplate).where(OrgTemplate.id == template_id))
    anchor = result.scalar_one_or_none()
    if not anchor:
        raise HTTPException(status_code=404, detail={"error": "Template not found", "code": "NOT_FOUND"})

    # The name used to scope history rows
    template_name = anchor.name

    action = body.action or "update"

    # ── Action: delete — hard-delete this specific row ───────────────────────
    if action == "delete":
        await _delete_template_defaults(db, template_id)
        await db.execute(
            delete(OrgTemplate)
            .where(OrgTemplate.id == template_id)
            .execution_options(synchronize_session=False)
        )
        await db.commit()
        return {"ok": True}

    # ── Action: close — set valid_to on this row ─────────────────────────────
    if action == "close":
        if not body.valid_to:
            raise HTTPException(
                status_code=422,
                detail={"error": "Close action requires valid_to", "code": "MISSING_DATE"},
            )
        await db.execute(
            update(OrgTemplate)
            .where(OrgTemplate.id == template_id)
            .values(valid_to=body.valid_to)
            .execution_options(synchronize_session=False)
        )
        await db.commit()
        refreshed = await db.execute(select(OrgTemplate).where(OrgTemplate.id == template_id))
        updated = refreshed.scalar_one()
        return await _build_template_out(db, updated)

    # ── Action: update ────────────────────────────────────────────────────────
    # same valid_from → in-place update of all fields
    # new valid_from  → close old row (valid_to = new_from - 1) + insert new row
    if action == "update":
        if not body.valid_from:
            raise HTTPException(
                status_code=422,
                detail={"error": "Update action requires valid_from", "code": "MISSING_DATE"},
            )

        # Load original as plain tuple to avoid ORM identity map issues
        orig_res = await db.execute(
            select(
                OrgTemplate.id,
                OrgTemplate.valid_from,
                OrgTemplate.valid_to,
                OrgTemplate.name,
            )
            .where(OrgTemplate.id == template_id)
        )
        orig = orig_res.one_or_none()
        if orig is None:
            raise HTTPException(status_code=404, detail={"error": "Template not found", "code": "NOT_FOUND"})

        date_changed = orig.valid_from != body.valid_from

        def _field_values(body: TemplateActionBody, anchor: OrgTemplate) -> dict:
            return {
                "name": body.name if body.name is not None else anchor.name,
                "description": body.description if body.description is not None else anchor.description,
                "default_billing_cycle": body.default_billing_cycle if body.default_billing_cycle is not None else anchor.default_billing_cycle,
                "trial_days": body.trial_days if body.trial_days is not None else anchor.trial_days,
                "is_active": body.is_active if body.is_active is not None else anchor.is_active,
                "sort_order": body.sort_order if body.sort_order is not None else anchor.sort_order,
                "target_industry": body.target_industry if body.target_industry is not None else anchor.target_industry,
                "recommended_size": body.recommended_size if body.recommended_size is not None else anchor.recommended_size,
            }

        if not date_changed:
            # In-place update
            field_vals = _field_values(body, anchor)
            field_vals["valid_to"] = body.valid_to
            await db.execute(
                update(OrgTemplate)
                .where(OrgTemplate.id == template_id)
                .values(**field_vals)
                .execution_options(synchronize_session=False)
            )
            if body.module_slugs is not None:
                await _save_module_slugs(db, template_id, body.module_slugs)
            current_defaults = await _load_template_defaults(db, template_id)
            await _save_template_defaults(
                db,
                template_id,
                seat_count=body.seat_count if body.seat_count is not None else _default_seat_count(current_defaults),
                discount_pct=body.discount_pct if body.discount_pct is not None else _default_discount_pct(current_defaults),
                is_price_locked=body.is_price_locked if body.is_price_locked is not None else _default_price_locked(current_defaults),
            )
            await db.commit()
            refreshed = await db.execute(select(OrgTemplate).where(OrgTemplate.id == template_id))
            updated = refreshed.scalar_one()
            return await _build_template_out(db, updated)
        else:
            # Date changed: close original + insert new row
            close_to = body.valid_from - timedelta(days=1)
            await db.execute(
                update(OrgTemplate)
                .where(OrgTemplate.id == template_id)
                .values(valid_to=close_to)
                .execution_options(synchronize_session=False)
            )
            field_vals = _field_values(body, anchor)
            new_row = OrgTemplate(
                **field_vals,
                valid_from=body.valid_from,
                valid_to=body.valid_to,
            )
            db.add(new_row)
            await db.flush()
            await db.refresh(new_row)
            # Copy module_slugs from old row unless new ones are provided
            if body.module_slugs is not None:
                slugs_to_copy = body.module_slugs
            else:
                slugs_to_copy = await _load_module_slugs(db, template_id)
            await _save_module_slugs(db, new_row.id, slugs_to_copy)
            anchor_defaults = await _load_template_defaults(db, template_id)
            await _save_template_defaults(
                db,
                new_row.id,
                seat_count=body.seat_count if body.seat_count is not None else _default_seat_count(anchor_defaults),
                discount_pct=body.discount_pct if body.discount_pct is not None else _default_discount_pct(anchor_defaults),
                is_price_locked=body.is_price_locked if body.is_price_locked is not None else _default_price_locked(anchor_defaults),
            )
            await db.commit()
            return await _build_template_out(db, new_row)

    # ── Action: add — insert a new record ────────────────────────────────────
    if action == "add":
        if not body.valid_from:
            raise HTTPException(
                status_code=422,
                detail={"error": "Add action requires valid_from", "code": "MISSING_DATE"},
            )
        if not body.name:
            raise HTTPException(
                status_code=422,
                detail={"error": "Add action requires name", "code": "MISSING_NAME"},
            )
        new_row = OrgTemplate(
            name=body.name,
            description=body.description,
            default_billing_cycle=body.default_billing_cycle or "monthly",
            trial_days=body.trial_days if body.trial_days is not None else 30,
            is_active=body.is_active if body.is_active is not None else True,
            sort_order=body.sort_order if body.sort_order is not None else 10,
            target_industry=body.target_industry,
            recommended_size=body.recommended_size,
            valid_from=body.valid_from,
            valid_to=body.valid_to,
        )
        db.add(new_row)
        await db.flush()
        await db.refresh(new_row)
        await _save_module_slugs(db, new_row.id, body.module_slugs or [])
        await _save_template_defaults(
            db,
            new_row.id,
            seat_count=body.seat_count if body.seat_count is not None else DEFAULT_SEAT_COUNT,
            discount_pct=body.discount_pct if body.discount_pct is not None else DEFAULT_DISCOUNT_PCT,
            is_price_locked=body.is_price_locked if body.is_price_locked is not None else False,
        )
        await db.commit()
        return await _build_template_out(db, new_row)

    # ── Action: set (kabiya) ──────────────────────────────────────────────────
    # Load all rows for this template name as plain tuples (NOT ORM objects),
    # implement full split/trim/delete/keep logic, then insert the new record.
    if action == "set":
        if not body.valid_from:
            raise HTTPException(
                status_code=422,
                detail={"error": "Set action requires valid_from", "code": "MISSING_DATE"},
            )
        new_from: date = body.valid_from
        new_to: date | None = body.valid_to

        # Load as plain Row tuples — NO ORM objects enter the identity map
        rows_res = await db.execute(
            select(
                OrgTemplate.id,
                OrgTemplate.valid_from,
                OrgTemplate.valid_to,
                OrgTemplate.name,
                OrgTemplate.description,
                OrgTemplate.default_billing_cycle,
                OrgTemplate.trial_days,
                OrgTemplate.is_active,
                OrgTemplate.sort_order,
                OrgTemplate.target_industry,
                OrgTemplate.recommended_size,
            )
            .where(OrgTemplate.name == template_name)
            .order_by(OrgTemplate.valid_from)
        )
        existing = rows_res.all()  # list of plain Row namedtuples, NOT ORM objects

        for row in existing:
            rec_id = row.id
            rec_from: date = row.valid_from
            rec_to: date | None = row.valid_to

            # Completely BEFORE new period → keep (preserve history)
            if rec_to is not None and rec_to < new_from:
                continue

            # Completely AFTER new period (only when new period has end) → keep
            if new_to is not None and rec_from > new_to:
                continue

            starts_before = rec_from < new_from
            ends_after = new_to is not None and (rec_to is None or rec_to > new_to)

            if starts_before and ends_after:
                # SPLIT: trim left half, create right half
                right_row = OrgTemplate(
                    name=row.name,
                    description=row.description,
                    default_billing_cycle=row.default_billing_cycle,
                    trial_days=row.trial_days,
                    is_active=row.is_active,
                    sort_order=row.sort_order,
                    target_industry=row.target_industry,
                    recommended_size=row.recommended_size,
                    valid_from=new_to + timedelta(days=1),  # type: ignore[operator]
                    valid_to=rec_to,
                )
                db.add(right_row)
                row_defaults = await _load_template_defaults(db, rec_id)
                await db.flush()
                await _save_template_defaults(
                    db,
                    right_row.id,
                    seat_count=_default_seat_count(row_defaults),
                    discount_pct=_default_discount_pct(row_defaults),
                    is_price_locked=_default_price_locked(row_defaults),
                )
                await db.execute(
                    update(OrgTemplate)
                    .where(OrgTemplate.id == rec_id)
                    .values(valid_to=new_from - timedelta(days=1))
                    .execution_options(synchronize_session=False)
                )

            elif starts_before:
                # LEFT TRIM
                await db.execute(
                    update(OrgTemplate)
                    .where(OrgTemplate.id == rec_id)
                    .values(valid_to=new_from - timedelta(days=1))
                    .execution_options(synchronize_session=False)
                )

            elif ends_after:
                # RIGHT PUSH
                await db.execute(
                    update(OrgTemplate)
                    .where(OrgTemplate.id == rec_id)
                    .values(valid_from=new_to + timedelta(days=1))  # type: ignore[operator]
                    .execution_options(synchronize_session=False)
                )

            else:
                # COMPLETELY WITHIN new period → delete
                await _delete_template_defaults(db, rec_id)
                await db.execute(
                    delete(OrgTemplate)
                    .where(OrgTemplate.id == rec_id)
                    .execution_options(synchronize_session=False)
                )

        # Determine new record field values (fall back to anchor row values)
        new_row = OrgTemplate(
            name=body.name if body.name is not None else anchor.name,
            description=body.description if body.description is not None else anchor.description,
            default_billing_cycle=body.default_billing_cycle if body.default_billing_cycle is not None else anchor.default_billing_cycle,
            trial_days=body.trial_days if body.trial_days is not None else anchor.trial_days,
            is_active=body.is_active if body.is_active is not None else anchor.is_active,
            sort_order=body.sort_order if body.sort_order is not None else anchor.sort_order,
            target_industry=body.target_industry if body.target_industry is not None else anchor.target_industry,
            recommended_size=body.recommended_size if body.recommended_size is not None else anchor.recommended_size,
            valid_from=new_from,
            valid_to=new_to,
        )
        db.add(new_row)
        await db.flush()
        await db.refresh(new_row)
        await _save_module_slugs(db, new_row.id, body.module_slugs or [])
        anchor_defaults = await _load_template_defaults(db, template_id)
        await _save_template_defaults(
            db,
            new_row.id,
            seat_count=body.seat_count if body.seat_count is not None else _default_seat_count(anchor_defaults),
            discount_pct=body.discount_pct if body.discount_pct is not None else _default_discount_pct(anchor_defaults),
            is_price_locked=body.is_price_locked if body.is_price_locked is not None else _default_price_locked(anchor_defaults),
        )
        await db.commit()
        return await _build_template_out(db, new_row)

    raise HTTPException(
        status_code=422,
        detail={"error": f"Unknown action: {action}", "code": "UNKNOWN_ACTION"},
    )
