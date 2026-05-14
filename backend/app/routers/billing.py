"""
Billing router — charges, invoices, quotes management.

Endpoints:
  POST /api/admin/billing/charges/generate   — auto-generate charges for a period
  GET  /api/admin/billing/charges            — list charges (filterable)
  POST /api/admin/billing/charges            — create manual charge
  GET  /api/admin/billing/charges/{id}       — get single charge
  PUT  /api/admin/billing/charges/{id}       — update charge
  DELETE /api/admin/billing/charges/{id}     — cancel charge

  GET  /api/admin/billing/invoices           — list invoices (filterable)
  POST /api/admin/billing/invoices           — create invoice from charges
  GET  /api/admin/billing/invoices/{id}      — get invoice + lines
  PUT  /api/admin/billing/invoices/{id}      — update invoice metadata
  POST /api/admin/billing/invoices/{id}/finalize      — draft → sent
  POST /api/admin/billing/invoices/{id}/mark-paid     — mark as paid
  POST /api/admin/billing/invoices/mark-overdue       — bulk mark overdue

  GET  /api/admin/billing/invoices/{id}/pdf           — download PDF

  GET  /api/admin/billing/quotes             — list quotes (filterable)
  POST /api/admin/billing/quotes             — create quote
  GET  /api/admin/billing/quotes/{id}        — get quote + lines
  PUT  /api/admin/billing/quotes/{id}        — update quote header
  POST /api/admin/billing/quotes/{id}/lines  — add line to quote
  PUT  /api/admin/billing/quotes/{id}/lines/{line_id}    — update line
  DELETE /api/admin/billing/quotes/{id}/lines/{line_id}  — remove line
  POST /api/admin/billing/quotes/{id}/send              — draft → sent
  POST /api/admin/billing/quotes/{id}/accept            — sent → accepted
  POST /api/admin/billing/quotes/{id}/decline           — sent → declined
  POST /api/admin/billing/quotes/{id}/convert-to-invoice — accepted → invoice
  GET  /api/admin/billing/quotes/{id}/pdf               — download PDF

  GET  /api/admin/tenants/{tenant_id}/billing         — tenant billing summary
  GET  /api/admin/tenants/{tenant_id}/seat-changes    — seat change history
"""
import calendar
import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Iterable, Optional

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.middleware.auth import require_permission, CurrentUser
from app.models.billing import BillingCharge, BillingSettings, Invoice, InvoiceLine, Quote, QuoteLine, TenantPaymentRecord
from app.models.billing_engine import BillingLedgerEntry, BillingDocument, BillingDocumentLine
from app.models.module import Module, ModulePrice
from app.models.seat_change_log import SeatChangeLog
from app.models.tenant import Tenant, TenantAddress, TenantIdentity, TenantSubscription, TenantStatus
from app.schemas.billing import (
    BillingSettingsOut, BillingSettingsUpdate,
    BillingChargeCreate, BillingChargeOut, BillingChargeUpdate,
    GenerateChargesRequest, GenerateChargesResult,
    InvoiceCreate, InvoiceListItem, InvoiceOut, InvoiceUpdate,
    MarkPaidRequest, SeatChangeLogOut, TenantBillingSummary,
    TenantPaymentRecordUpdate, TenantPaymentTrackingItem, TenantPaymentTrackingSummary,
    QuoteCreate, QuoteUpdate, QuoteOut, QuoteListItem,
    QuoteLineCreate, QuoteLineUpdate, QuoteLineOut,
)
from app.services.invoice_pdf import TaxInvoiceValidationError, render_invoice_pdf, render_quote_pdf
from app.services.subscription_modules import (
    calculate_next_subscription_renewal,
    get_effective_module_prices,
    get_effective_subscription_module,
    load_subscription_modules,
)
from app.services.temporal import get_active

router = APIRouter(tags=["billing"])

# ─── Helpers ──────────────────────────────────────────────────────────────────

TWO_PLACES = Decimal("0.01")


def _to_decimal(value: Decimal | int | float | None) -> Decimal:
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _round2(v: Decimal | int | float | None) -> Decimal:
    return _to_decimal(v).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def _sum_decimal(values: Iterable[Decimal | int | float | None]) -> Decimal:
    return sum((_to_decimal(value) for value in values), Decimal("0"))


def _period_start(period: str) -> date:
    year_str, month_str = period.split("-")
    return date(int(year_str), int(month_str), 1)


def _period_shift(period: str, months: int) -> str:
    start = _period_start(period)
    month = start.month - 1 + months
    year = start.year + month // 12
    month = month % 12 + 1
    return f"{year}-{month:02d}"


def _scheduled_charge_date(period: str, anchor_day: int) -> date:
    period_date = _period_start(period)
    last_day = calendar.monthrange(period_date.year, period_date.month)[1]
    return date(period_date.year, period_date.month, min(max(anchor_day, 1), last_day))


def _validate_billing_period(period: str) -> None:
    if len(period) != 7 or period[4] != "-":
        raise HTTPException(422, detail={"error": "billing_period must be in YYYY-MM format", "code": "INVALID_PERIOD"})
    try:
        _period_start(period)
    except ValueError as exc:
        raise HTTPException(422, detail={"error": "billing_period must be a valid calendar month", "code": "INVALID_PERIOD"}) from exc


def _period_label(period: str) -> tuple[str, str]:
    year_str, month_str = period.split("-")
    month_name = [
        "", "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
        "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
    ][int(month_str)]
    return year_str, month_name


def _is_missing_relation_error(exc: Exception, relation_names: set[str]) -> bool:
    message = str(exc).lower()
    if "undefinedtableerror" not in message and "relation" not in message:
        return False
    return any(relation.lower() in message for relation in relation_names)


async def _tenant_name(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    identity = await get_active(db, TenantIdentity, tenant_id)
    return identity.name_he if identity else str(tenant_id)


async def _module_name(db: AsyncSession, slug: str | None) -> str | None:
    if not slug:
        return None
    result = await db.execute(sa.select(Module.name).where(Module.slug == slug))
    return result.scalar_one_or_none()


async def _active_subscription(db: AsyncSession, tenant_id: uuid.UUID) -> TenantSubscription | None:
    return await get_active(db, TenantSubscription, tenant_id)


async def _payment_tracking_summary(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    months_back: int = 6,
    months_forward: int = 6,
) -> TenantPaymentTrackingSummary:
    subscription = await _active_subscription(db, tenant_id)
    anchor_day = subscription.billing_anchor_day if subscription else None
    next_renewal_at = (
        calculate_next_subscription_renewal(subscription, as_of=date.today())
        if subscription is not None
        else None
    )
    if subscription is None or anchor_day is None:
        return TenantPaymentTrackingSummary(
            billing_anchor_day=None,
            next_renewal_at=None,
            items=[],
        )

    current_period = date.today().strftime("%Y-%m")
    period_keys = [
        _period_shift(current_period, offset)
        for offset in range(-months_back, months_forward + 1)
    ]

    records_result = await db.execute(
        sa.select(TenantPaymentRecord)
        .where(TenantPaymentRecord.tenant_id == tenant_id)
        .where(TenantPaymentRecord.billing_period.in_(period_keys))
    )
    records_by_period = {
        row.billing_period: row
        for row in records_result.scalars().all()
    }

    items: list[TenantPaymentTrackingItem] = []
    today = date.today()
    for period_key in period_keys:
        scheduled_charge_date = _scheduled_charge_date(period_key, anchor_day)
        record = records_by_period.get(period_key)
        status = record.status if record else "unreported"
        is_overdue = (
            scheduled_charge_date < today
            and status not in {"paid", "waived"}
        )
        items.append(
            TenantPaymentTrackingItem(
                billing_period=period_key,
                scheduled_charge_date=record.scheduled_charge_date if record else scheduled_charge_date,
                status=status,
                amount_ils=record.amount_ils if record else None,
                paid_at=record.paid_at if record else None,
                external_ref=record.external_ref if record else None,
                notes=record.notes if record else None,
                source="manual" if record else "derived",
                is_overdue=is_overdue,
                updated_at=record.updated_at if record else None,
                updated_by=str(record.updated_by) if record and record.updated_by else None,
            )
        )

    return TenantPaymentTrackingSummary(
        billing_anchor_day=anchor_day,
        next_renewal_at=next_renewal_at,
        items=items,
    )


async def _enrich_charge(db: AsyncSession, c: BillingCharge) -> BillingChargeOut:
    out = BillingChargeOut.model_validate(c)
    out.tenant_name = await _tenant_name(db, c.tenant_id)
    out.module_name = await _module_name(db, c.module_slug)
    return out


async def _enrich_invoice_list(db: AsyncSession, inv: Invoice) -> InvoiceListItem:
    out = InvoiceListItem.model_validate(inv)
    out.tenant_name = await _tenant_name(db, inv.tenant_id)
    return out


async def _build_invoice_out(db: AsyncSession, inv: Invoice) -> InvoiceOut:
    from app.schemas.billing import InvoiceLineOut
    lines_result = await db.execute(
        sa.select(InvoiceLine)
        .where(InvoiceLine.invoice_id == inv.id)
        .order_by(InvoiceLine.sort_order)
    )
    lines = lines_result.scalars().all()
    out = InvoiceOut.model_validate(inv)
    out.lines = [InvoiceLineOut.model_validate(ln) for ln in lines]
    out.tenant_name = await _tenant_name(db, inv.tenant_id)
    return out


def _billing_settings_from_env() -> dict[str, str | None]:
    settings = get_settings()
    return {
        "issuer_name_he": settings.COMPANY_NAME_HE,
        "issuer_name_en": settings.COMPANY_NAME_EN or None,
        "issuer_tax_id": settings.COMPANY_TAX_ID or None,
        "issuer_address": settings.COMPANY_ADDRESS or None,
        "issuer_phone": settings.COMPANY_PHONE or None,
        "issuer_email": settings.COMPANY_EMAIL or None,
        "issuer_logo_url": None,
        "payment_instructions": None,
        "footer_text": None,
    }


def _missing_tax_fields(payload: dict[str, str | None]) -> list[str]:
    required = {
        "issuer_name_he": "שם מנפיק",
        "issuer_tax_id": "ח.פ / ע.מ",
        "issuer_address": "כתובת מנפיק",
    }
    return [label for key, label in required.items() if not (payload.get(key) or "").strip()]


async def _get_billing_settings_payload(db: AsyncSession) -> tuple[BillingSettings | None, dict[str, str | None], str]:
    result = await db.execute(
        sa.select(BillingSettings).order_by(BillingSettings.created_at.desc()).limit(1)
    )
    settings_row = result.scalar_one_or_none()
    if settings_row is None:
        return None, _billing_settings_from_env(), "env"

    return settings_row, {
        "issuer_name_he": settings_row.issuer_name_he,
        "issuer_name_en": settings_row.issuer_name_en,
        "issuer_tax_id": settings_row.issuer_tax_id,
        "issuer_address": settings_row.issuer_address,
        "issuer_phone": settings_row.issuer_phone,
        "issuer_email": settings_row.issuer_email,
        "issuer_logo_url": settings_row.issuer_logo_url,
        "payment_instructions": settings_row.payment_instructions,
        "footer_text": settings_row.footer_text,
    }, "database"


async def _serialize_billing_settings(db: AsyncSession) -> BillingSettingsOut:
    settings_row, payload, source = await _get_billing_settings_payload(db)
    missing_tax_fields = _missing_tax_fields(payload)
    return BillingSettingsOut(
        id=settings_row.id if settings_row else None,
        issuer_name_he=payload.get("issuer_name_he") or "",
        issuer_name_en=payload.get("issuer_name_en"),
        issuer_tax_id=payload.get("issuer_tax_id"),
        issuer_address=payload.get("issuer_address"),
        issuer_phone=payload.get("issuer_phone"),
        issuer_email=payload.get("issuer_email"),
        issuer_logo_url=payload.get("issuer_logo_url"),
        payment_instructions=payload.get("payment_instructions"),
        footer_text=payload.get("footer_text"),
        missing_tax_fields=missing_tax_fields,
        can_render_tax_invoice=len(missing_tax_fields) == 0,
        source=source,
        updated_at=settings_row.updated_at if settings_row else None,
    )


async def _get_active_module_price(db: AsyncSession, slug: str, today: date) -> ModulePrice | None:
    price_result = await db.execute(
        sa.select(ModulePrice)
        .where(ModulePrice.module_slug == slug)
        .where(ModulePrice.valid_from <= today)
        .where(sa.or_(ModulePrice.valid_to.is_(None), ModulePrice.valid_to >= today))
        .order_by(ModulePrice.valid_from.desc(), ModulePrice.created_at.desc())
        .limit(1)
    )
    return price_result.scalar_one_or_none()


async def _create_charge_if_missing(
    *,
    db: AsyncSession,
    tenant_id: uuid.UUID,
    billing_period: str,
    charge_type: str,
    module_slug: str,
    description: str,
    quantity: Decimal,
    unit_price_ils: Decimal,
    discount_pct: Decimal,
    current_user_id: uuid.UUID | None,
) -> bool:
    exists = await db.execute(
        sa.select(BillingCharge.id).where(
            BillingCharge.tenant_id == tenant_id,
            BillingCharge.billing_period == billing_period,
            BillingCharge.module_slug == module_slug,
            BillingCharge.charge_type == charge_type,
            BillingCharge.status != "cancelled",
        )
    )
    if exists.first():
        return False

    amount = _round2(unit_price_ils * quantity)
    after_discount = _round2(amount * (Decimal("1") - discount_pct / Decimal("100")))
    db.add(BillingCharge(
        tenant_id=tenant_id,
        billing_period=billing_period,
        charge_type=charge_type,
        module_slug=module_slug,
        description=description,
        quantity=quantity,
        unit_price_ils=unit_price_ils,
        amount_ils=amount,
        discount_pct=discount_pct,
        amount_after_discount_ils=after_discount,
        status="pending",
        created_by=current_user_id,
    ))
    return True


@router.get("/api/admin/billing/settings", response_model=BillingSettingsOut)
async def get_billing_settings(
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "view")),
):
    return await _serialize_billing_settings(db)


@router.put("/api/admin/billing/settings", response_model=BillingSettingsOut)
async def update_billing_settings(
    body: BillingSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("billing", "edit")),
):
    result = await db.execute(
        sa.select(BillingSettings).order_by(BillingSettings.created_at.desc()).limit(1)
    )
    settings_row = result.scalar_one_or_none()
    payload = body.model_dump()

    if settings_row is None:
        settings_row = BillingSettings(
            **payload,
            created_by=current_user.id,
            updated_by=current_user.id,
        )
        db.add(settings_row)
    else:
        for key, value in payload.items():
            setattr(settings_row, key, value)
        settings_row.updated_by = current_user.id
    settings_row.updated_at = datetime.now(UTC)

    await db.commit()
    return await _serialize_billing_settings(db)


# ─── Charges — Generate ───────────────────────────────────────────────────────

@router.post(
    "/api/admin/billing/charges/generate",
    response_model=GenerateChargesResult,
    status_code=status.HTTP_200_OK,
)
async def generate_charges(
    body: GenerateChargesRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("billing", "edit")),
):
    """
    Auto-generate pricing charges for every active/trial tenant for a given
    billing period. Idempotent per (tenant, period, module, type).
    """
    period = body.billing_period
    period_start = _period_start(period)

    # Compute period boundaries for proration
    p_year, p_month = map(int, period.split("-"))
    total_days_in_period = calendar.monthrange(p_year, p_month)[1]
    period_end = date(p_year, p_month, total_days_in_period)

    # ── Fetch tenants to process ──────────────────────────────────────────────
    if body.tenant_ids:
        t_result = await db.execute(
            sa.select(Tenant).where(Tenant.tenant_id.in_(body.tenant_ids))
        )
        tenants = t_result.scalars().all()
    else:
        t_result = await db.execute(sa.select(Tenant))
        tenants = t_result.scalars().all()

    created = 0
    skipped = 0
    processed = 0
    year_str, month_name = _period_label(period)

    # ── Pre-load all active modules once (avoids N×M queries in inner loop) ──
    all_modules_result = await db.execute(
        sa.select(Module).where(Module.is_active == True)   # noqa: E712
    )
    active_modules_map: dict[str, Module] = {
        m.slug: m for m in all_modules_result.scalars().all()
    }

    # ── Pre-load all unbilled seat changes for this period ────────────────────
    all_seat_changes_result = await db.execute(
        sa.select(SeatChangeLog)
        .where(
            SeatChangeLog.effective_date >= period_start,
            SeatChangeLog.effective_date <= period_end,
            SeatChangeLog.billed == False,   # noqa: E712
        )
        .order_by(SeatChangeLog.tenant_id, SeatChangeLog.module_slug, SeatChangeLog.effective_date)
    )
    # Group: (tenant_id, module_slug) → [SeatChangeLog, ...]
    from collections import defaultdict
    seat_changes_index: dict[tuple, list[SeatChangeLog]] = defaultdict(list)
    for sc in all_seat_changes_result.scalars().all():
        seat_changes_index[(sc.tenant_id, sc.module_slug)].append(sc)

    for tenant in tenants:
        # Skip tenants without active/trial status
        status_row = await get_active(db, TenantStatus, tenant.tenant_id, as_of=period_start)
        if not status_row or status_row.status not in ("active", "trial"):
            continue

        subscription = await get_active(db, TenantSubscription, tenant.tenant_id, as_of=period_start)
        if not subscription:
            continue

        subscription_modules = [
            row for row in await load_subscription_modules(db, subscription.id, as_of=period_start)
            if row.status == "active"
        ]
        if not subscription_modules:
            continue

        processed += 1
        discount = subscription.discount_pct or Decimal("0")
        module_prices = await get_effective_module_prices(
            db,
            [row.module_slug for row in subscription_modules],
            as_of=period_start,
        )

        for module_row in subscription_modules:
            slug = module_row.module_slug
            price = module_prices.get(slug)
            if not price:
                skipped += 1
                continue

            # Skip modules not in the active map (already filtered to is_active=True)
            module_obj = active_modules_map.get(slug)
            if not module_obj:
                skipped += 1
                continue
            mod_name = module_obj.name or slug

            effective_included = module_row.override_included_seats if module_row.pricing_mode == "override" else price.included_seats
            effective_per_seat = module_row.override_per_seat_ils if module_row.pricing_mode == "override" else price.per_seat_ils

            # ── Base fee ──────────────────────────────────────────────────────
            if await _create_charge_if_missing(
                db=db,
                tenant_id=tenant.tenant_id,
                billing_period=period,
                charge_type="base_fee",
                module_slug=slug,
                description=f"דמי מנוי — {mod_name} — {month_name} {year_str}",
                quantity=Decimal("1"),
                unit_price_ils=module_row.override_base_price_ils if module_row.pricing_mode == "override" else price.base_price_ils,
                discount_pct=discount,
                current_user_id=current_user.id,
            ):
                created += 1
            else:
                skipped += 1

            # ── Per-seat base charge (at period-start seat count) ─────────────
            if effective_per_seat and effective_per_seat > 0:
                # Use pre-loaded seat changes (no extra DB query)
                seat_changes = seat_changes_index.get((tenant.tenant_id, slug), [])

                # Seats at the start of the period (old_seats of first change, or current)
                period_start_seats = seat_changes[0].old_seats if seat_changes else (module_row.seats or 0)
                billable_at_start = max(period_start_seats - (effective_included or 0), 0)

                if billable_at_start > 0:
                    if await _create_charge_if_missing(
                        db=db,
                        tenant_id=tenant.tenant_id,
                        billing_period=period,
                        charge_type="per_seat",
                        module_slug=slug,
                        description=f"מושבים נוספים — {mod_name} — {month_name} {year_str}",
                        quantity=Decimal(str(billable_at_start)),
                        unit_price_ils=effective_per_seat,
                        discount_pct=discount,
                        current_user_id=current_user.id,
                    ):
                        created += 1
                    else:
                        skipped += 1

                # ── Proration charges for mid-period seat changes ─────────────
                for change in seat_changes:
                    effective_module_row = await get_effective_subscription_module(
                        db,
                        subscription.id,
                        slug,
                        as_of=change.effective_date,
                    )
                    if effective_module_row is None:
                        change.billed = True
                        change.billing_period = period
                        skipped += 1
                        continue

                    effective_price_map = await get_effective_module_prices(
                        db,
                        [slug],
                        as_of=change.effective_date,
                    )
                    effective_price = effective_price_map.get(slug)
                    if effective_module_row.pricing_mode == "override":
                        proration_included = effective_module_row.override_included_seats or 0
                        proration_per_seat = effective_module_row.override_per_seat_ils or Decimal("0")
                    else:
                        proration_included = effective_price.included_seats if effective_price else 0
                        proration_per_seat = effective_price.per_seat_ils if effective_price else Decimal("0")

                    new_billable = max(change.new_seats - proration_included, 0)
                    old_billable = max(change.old_seats - proration_included, 0)
                    delta_billable = new_billable - old_billable

                    if delta_billable == 0 or proration_per_seat <= 0:
                        change.billed = True
                        change.billing_period = period
                        continue

                    days_remaining = (period_end - change.effective_date).days + 1
                    proration_qty = _round2(
                        Decimal(str(abs(delta_billable)))
                        * Decimal(str(days_remaining))
                        / Decimal(str(total_days_in_period))
                    )

                    if delta_billable > 0:
                        ctype = "per_seat"
                        desc = (
                            f"השלמה יחסית — {mod_name} — "
                            f"{delta_billable} מושבים × {days_remaining}/{total_days_in_period} ימים"
                        )
                    else:
                        ctype = "credit"
                        desc = (
                            f"זיכוי יחסי — {mod_name} — "
                            f"{abs(delta_billable)} מושבים × {days_remaining}/{total_days_in_period} ימים"
                        )

                    amount = _round2(proration_qty * proration_per_seat)
                    after_discount = _round2(amount * (Decimal("1") - discount / Decimal("100")))
                    proration_charge = BillingCharge(
                        tenant_id=tenant.tenant_id,
                        billing_period=period,
                        charge_type=ctype,
                        module_slug=slug,
                        description=desc,
                        quantity=proration_qty,
                        unit_price_ils=proration_per_seat,
                        amount_ils=amount,
                        discount_pct=discount,
                        amount_after_discount_ils=after_discount,
                        status="pending",
                        created_by=current_user.id,
                    )
                    db.add(proration_charge)
                    await db.flush()  # need proration_charge.id
                    change.billed = True
                    change.billing_period = period
                    change.proration_charge_id = proration_charge.id
                    created += 1

            # ── Setup fee (one-time per module, billed on first charge run) ───
            effective_setup_fee = module_row.override_setup_fee_ils if module_row.pricing_mode == "override" else price.setup_fee_ils
            module_added_date = (
                module_row.valid_from or subscription.valid_from
            )
            should_bill_setup = (
                effective_setup_fee
                and effective_setup_fee > 0
                and module_added_date is not None
            )
            if should_bill_setup:
                setup_exists = await db.execute(
                    sa.select(BillingCharge.id).where(
                        BillingCharge.tenant_id == tenant.tenant_id,
                        BillingCharge.module_slug == slug,
                        BillingCharge.charge_type == "setup_fee",
                        BillingCharge.status != "cancelled",
                    )
                )
                if not setup_exists.first():
                    if await _create_charge_if_missing(
                        db=db,
                        tenant_id=tenant.tenant_id,
                        billing_period=period,
                        charge_type="setup_fee",
                        module_slug=slug,
                        description=f"דמי הקמה — {mod_name}",
                        quantity=Decimal("1"),
                        unit_price_ils=effective_setup_fee,
                        discount_pct=discount,
                        current_user_id=current_user.id,
                    ):
                        created += 1
                else:
                    skipped += 1

    await db.commit()
    return GenerateChargesResult(created=created, skipped=skipped, tenants_processed=processed)


# ─── Charges — CRUD ───────────────────────────────────────────────────────────

@router.get("/api/admin/billing/charges", response_model=list[BillingChargeOut])
async def list_charges(
    tenant_id: Optional[uuid.UUID] = Query(None),
    billing_period: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    module_slug: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "view")),
):
    q = sa.select(BillingCharge).order_by(
        BillingCharge.billing_period.desc(), BillingCharge.created_at.desc()
    )
    if tenant_id:
        q = q.where(BillingCharge.tenant_id == tenant_id)
    if billing_period:
        q = q.where(BillingCharge.billing_period == billing_period)
    if status_filter:
        q = q.where(BillingCharge.status == status_filter)
    if module_slug:
        q = q.where(BillingCharge.module_slug == module_slug)

    result = await db.execute(q)
    charges = result.scalars().all()
    return [await _enrich_charge(db, c) for c in charges]


@router.post("/api/admin/billing/charges", response_model=BillingChargeOut, status_code=201)
async def create_charge(
    body: BillingChargeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("billing", "edit")),
):
    amount = _round2(body.quantity * body.unit_price_ils)
    after_discount = _round2(amount * (1 - body.discount_pct / 100))

    charge = BillingCharge(
        tenant_id=body.tenant_id,
        billing_period=body.billing_period,
        charge_type=body.charge_type,
        module_slug=body.module_slug,
        description=body.description,
        quantity=body.quantity,
        unit_price_ils=body.unit_price_ils,
        amount_ils=amount,
        discount_pct=body.discount_pct,
        amount_after_discount_ils=after_discount,
        status="pending",
        notes=body.notes,
        created_by=current_user.id,
    )
    db.add(charge)
    await db.commit()
    await db.refresh(charge)
    return await _enrich_charge(db, charge)


@router.get("/api/admin/billing/charges/{charge_id}", response_model=BillingChargeOut)
async def get_charge(
    charge_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "view")),
):
    result = await db.execute(
        sa.select(BillingCharge).where(BillingCharge.id == charge_id)
    )
    charge = result.scalar_one_or_none()
    if not charge:
        raise HTTPException(404, detail={"error": "Charge not found", "code": "NOT_FOUND"})
    return await _enrich_charge(db, charge)


@router.put("/api/admin/billing/charges/{charge_id}", response_model=BillingChargeOut)
async def update_charge(
    charge_id: uuid.UUID,
    body: BillingChargeUpdate,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "edit")),
):
    result = await db.execute(
        sa.select(BillingCharge).where(BillingCharge.id == charge_id)
    )
    charge = result.scalar_one_or_none()
    if not charge:
        raise HTTPException(404, detail={"error": "Charge not found", "code": "NOT_FOUND"})
    if charge.status == "invoiced":
        raise HTTPException(409, detail={"error": "לא ניתן לערוך חיוב שכבר חויב בחשבונית", "code": "CHARGE_INVOICED"})

    updates: dict = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        qty = updates.get("quantity", charge.quantity)
        unit = updates.get("unit_price_ils", charge.unit_price_ils)
        disc = updates.get("discount_pct", charge.discount_pct)
        amount = _round2(qty * unit)
        after = _round2(amount * (1 - disc / 100))
        updates["amount_ils"] = amount
        updates["amount_after_discount_ils"] = after
        await db.execute(
            sa.update(BillingCharge)
            .where(BillingCharge.id == charge_id)
            .values(**updates)
            .execution_options(synchronize_session=False)
        )
        await db.commit()
        await db.refresh(charge)
    return await _enrich_charge(db, charge)


@router.delete("/api/admin/billing/charges/{charge_id}", status_code=204)
async def cancel_charge(
    charge_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "edit")),
):
    result = await db.execute(
        sa.select(BillingCharge).where(BillingCharge.id == charge_id)
    )
    charge = result.scalar_one_or_none()
    if not charge:
        raise HTTPException(404, detail={"error": "Charge not found", "code": "NOT_FOUND"})
    if charge.status == "invoiced":
        raise HTTPException(409, detail={"error": "לא ניתן לבטל חיוב שכבר חויב בחשבונית", "code": "CHARGE_INVOICED"})
    await db.execute(
        sa.update(BillingCharge)
        .where(BillingCharge.id == charge_id)
        .values(status="cancelled")
        .execution_options(synchronize_session=False)
    )
    await db.commit()


# ─── Invoices ─────────────────────────────────────────────────────────────────

@router.get("/api/admin/billing/invoices", response_model=list[InvoiceListItem])
async def list_invoices(
    tenant_id: Optional[uuid.UUID] = Query(None),
    billing_period: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "view")),
):
    q = sa.select(Invoice).order_by(Invoice.issue_date.desc(), Invoice.invoice_number.desc())
    if tenant_id:
        q = q.where(Invoice.tenant_id == tenant_id)
    if billing_period:
        q = q.where(Invoice.billing_period == billing_period)
    if status_filter:
        q = q.where(Invoice.status == status_filter)

    result = await db.execute(q)
    invoices = result.scalars().all()
    return [await _enrich_invoice_list(db, inv) for inv in invoices]


@router.post("/api/admin/billing/invoices", response_model=InvoiceOut, status_code=201)
async def create_invoice(
    body: InvoiceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("billing", "edit")),
):
    # ── Fetch charges ─────────────────────────────────────────────────────────
    if body.charge_ids:
        q = sa.select(BillingCharge).where(BillingCharge.id.in_(body.charge_ids))
    else:
        q = sa.select(BillingCharge).where(
            BillingCharge.tenant_id == body.tenant_id,
            BillingCharge.billing_period == body.billing_period,
            BillingCharge.status == "pending",
        )
    charges_result = await db.execute(q)
    charges = charges_result.scalars().all()

    if not charges:
        raise HTTPException(
            422,
            detail={"error": "אין חיובים ממתינים לתקופה ולארגון שנבחרו", "code": "NO_PENDING_CHARGES"},
        )

    # ── Verify all charges belong to the tenant ───────────────────────────────
    for c in charges:
        if c.tenant_id != body.tenant_id:
            raise HTTPException(
                422,
                detail={"error": f"חיוב {c.id} אינו שייך לארגון זה", "code": "CHARGE_TENANT_MISMATCH"},
            )
        if c.status != "pending":
            raise HTTPException(
                409,
                detail={"error": f"חיוב '{c.description}' כבר בסטטוס {c.status}", "code": "CHARGE_NOT_PENDING"},
            )

    # ── Calculate totals ──────────────────────────────────────────────────────
    subtotal = _round2(_sum_decimal(c.amount_after_discount_ils for c in charges))
    discount = _round2(_sum_decimal(c.amount_ils - c.amount_after_discount_ils for c in charges))
    vat = _round2(subtotal * body.vat_pct / 100)
    total = _round2(subtotal + vat)

    # ── Invoice number — INV-YYYY-NNNN via sequence ───────────────────────────
    seq_result = await db.execute(sa.text("SELECT nextval('invoice_number_seq')"))
    seq_num = seq_result.scalar()
    invoice_number = f"INV-{body.issue_date.year}-{seq_num:04d}"

    # ── Create invoice ────────────────────────────────────────────────────────
    invoice = Invoice(
        invoice_number=invoice_number,
        tenant_id=body.tenant_id,
        billing_period=body.billing_period,
        issue_date=body.issue_date,
        due_date=body.due_date,
        subtotal_ils=subtotal,
        discount_ils=discount,
        vat_pct=body.vat_pct,
        vat_ils=vat,
        total_ils=total,
        status="draft",
        notes=body.notes,
        created_by=current_user.id,
    )
    db.add(invoice)
    await db.flush()   # get invoice.id before inserting lines

    # ── Create invoice lines + update charges ─────────────────────────────────
    for i, charge in enumerate(charges):
        db.add(InvoiceLine(
            invoice_id=invoice.id,
            charge_id=charge.id,
            description=charge.description,
            quantity=charge.quantity,
            unit_price_ils=charge.unit_price_ils,
            amount_ils=charge.amount_after_discount_ils,
            sort_order=(i + 1) * 10,
        ))
        await db.execute(
            sa.update(BillingCharge)
            .where(BillingCharge.id == charge.id)
            .values(status="invoiced", invoice_id=invoice.id)
            .execution_options(synchronize_session=False)
        )

    await db.commit()
    await db.refresh(invoice)
    return await _build_invoice_out(db, invoice)


@router.get("/api/admin/billing/invoices/{invoice_id}", response_model=InvoiceOut)
async def get_invoice(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "view")),
):
    result = await db.execute(sa.select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(404, detail={"error": "Invoice not found", "code": "NOT_FOUND"})
    return await _build_invoice_out(db, invoice)


@router.put("/api/admin/billing/invoices/{invoice_id}", response_model=InvoiceOut)
async def update_invoice(
    invoice_id: uuid.UUID,
    body: InvoiceUpdate,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "edit")),
):
    result = await db.execute(sa.select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(404, detail={"error": "Invoice not found", "code": "NOT_FOUND"})
    if invoice.status in ("cancelled", "paid", "overdue"):
        raise HTTPException(409, detail={"error": "לא ניתן לערוך חשבונית ששולמה, בפיגור, או מבוטלת", "code": "INVOICE_LOCKED"})

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        await db.execute(
            sa.update(Invoice)
            .where(Invoice.id == invoice_id)
            .values(**updates)
            .execution_options(synchronize_session=False)
        )
        await db.commit()
        await db.refresh(invoice)
    return await _build_invoice_out(db, invoice)


@router.post("/api/admin/billing/invoices/{invoice_id}/finalize", response_model=InvoiceOut)
async def finalize_invoice(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "edit")),
):
    """Advance invoice from draft → sent."""
    result = await db.execute(sa.select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(404, detail={"error": "Invoice not found", "code": "NOT_FOUND"})
    if invoice.status != "draft":
        raise HTTPException(409, detail={"error": "רק חשבוניות בסטטוס טיוטה ניתן לשלוח", "code": "INVALID_STATUS"})

    await db.execute(
        sa.update(Invoice)
        .where(Invoice.id == invoice_id)
        .values(status="sent")
        .execution_options(synchronize_session=False)
    )
    await db.commit()
    await db.refresh(invoice)
    return await _build_invoice_out(db, invoice)


@router.post("/api/admin/billing/invoices/{invoice_id}/mark-paid", response_model=InvoiceOut)
async def mark_paid(
    invoice_id: uuid.UUID,
    body: MarkPaidRequest,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "edit")),
):
    result = await db.execute(sa.select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(404, detail={"error": "Invoice not found", "code": "NOT_FOUND"})
    if invoice.status not in ("sent", "overdue"):
        raise HTTPException(
            409,
            detail={"error": "ניתן לסמן כשולם רק חשבוניות שנשלחו או בפיגור", "code": "INVALID_STATUS"},
        )

    await db.execute(
        sa.update(Invoice)
        .where(Invoice.id == invoice_id)
        .values(status="paid", payment_date=body.payment_date, payment_ref=body.payment_ref)
        .execution_options(synchronize_session=False)
    )
    await db.commit()
    await db.refresh(invoice)
    return await _build_invoice_out(db, invoice)


async def _load_document_render_payload(
    db: AsyncSession,
    document_id: uuid.UUID,
):
    result = await db.execute(sa.select(BillingDocument).where(BillingDocument.id == document_id))
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(404, detail={"error": "Document not found", "code": "NOT_FOUND"})

    lines_result = await db.execute(
        sa.select(BillingDocumentLine)
        .where(BillingDocumentLine.document_id == document.id)
        .order_by(BillingDocumentLine.sort_order)
    )
    lines = lines_result.scalars().all()
    tenant_identity = await get_active(db, TenantIdentity, document.tenant_id, as_of=document.issue_date)
    tenant_address_row = await get_active(db, TenantAddress, document.tenant_id, as_of=document.issue_date)
    _, issuer_payload, _ = await _get_billing_settings_payload(db)

    # Attach fake billing_period to satisfy render_invoice_pdf
    if not hasattr(document, "billing_period"):
        document.billing_period = (document.issue_date or document.created_at.date()).strftime("%Y-%m")

    # Rename unit_amount_ils to unit_price_ils for render_invoice_pdf backward compatibility
    for line in lines:
        if not hasattr(line, "unit_price_ils"):
            line.unit_price_ils = line.unit_amount_ils

    return {
        "invoice": document,
        "lines": lines,
        "tenant_name": tenant_identity.name_he if tenant_identity else str(document.tenant_id),
        "tenant_tax_id": tenant_identity.tax_id if tenant_identity else None,
        "tenant_address": (
            f"{tenant_address_row.street}, {tenant_address_row.city}"
            if tenant_address_row else None
        ),
        "issuer_payload": issuer_payload,
    }


@router.get("/api/admin/billing/invoices/{invoice_id}/preview")
async def preview_invoice_html(
    invoice_id: uuid.UUID,
    variant: str = Query("statement"),
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "view")),
):
    import os
    from jinja2 import Environment, FileSystemLoader, select_autoescape

    payload = await _load_invoice_render_payload(db, invoice_id)
    invoice = payload["invoice"]
    lines = payload["lines"]
    issuer_payload = payload["issuer_payload"]

    INVOICE_STATUS_LABELS_PDF = {
        "draft": "טיוטה", "sent": "נשלח",
        "paid": "שולם", "overdue": "בפיגור", "cancelled": "מבוטל",
    }
    HE_MONTHS = [
        "", "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
        "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
    ]

    def _fmt_date(d):
        if d is None:
            return "—"
        if isinstance(d, str):
            d = date.fromisoformat(d)
        return f"{d.day:02d}/{d.month:02d}/{d.year}"

    def _fmt_period(p: str) -> str:
        try:
            y, m = p.split("-")
            return f"{HE_MONTHS[int(m)]} {y}"
        except Exception:
            return p

    def _fmt_amount(v) -> str:
        try:
            return f"{float(str(v)):,.2f}"
        except Exception:
            return str(v)

    def _fmt_qty(v) -> str:
        try:
            f = float(str(v))
            return f"{f:.4f}".rstrip("0").rstrip(".")
        except Exception:
            return str(v)

    templates_dir = os.path.join(os.path.dirname(__file__), "..", "templates")
    env = Environment(
        loader=FileSystemLoader(os.path.abspath(templates_dir)),
        autoescape=select_autoescape(["html"]),
    )
    env.filters["format_date"] = _fmt_date
    env.filters["format_period"] = _fmt_period
    env.filters["format_amount"] = _fmt_amount
    env.filters["format_qty"] = _fmt_qty

    template = env.get_template("invoice.html")
    html_str = template.render(
        invoice=invoice,
        lines=lines,
        auto_print=True,
        variant=variant,
        status_label=INVOICE_STATUS_LABELS_PDF.get(invoice.status, invoice.status),
        tenant_name=payload["tenant_name"],
        tenant_tax_id=payload["tenant_tax_id"],
        tenant_address=payload["tenant_address"],
        company={
            "name_he": issuer_payload.get("issuer_name_he"),
            "name_en": issuer_payload.get("issuer_name_en"),
            "tax_id": issuer_payload.get("issuer_tax_id"),
            "address": issuer_payload.get("issuer_address"),
            "phone": issuer_payload.get("issuer_phone"),
            "email": issuer_payload.get("issuer_email"),
        },
    )

    return HTMLResponse(content=html_str)


@router.get("/api/admin/billing/documents/{document_id}/pdf")
async def download_document_pdf(
    document_id: uuid.UUID,
    variant: str = Query("statement"),
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "view")),
):
    payload = await _load_document_render_payload(db, document_id)
    try:
        pdf_bytes = render_invoice_pdf(
            invoice=payload["invoice"],
            lines=payload["lines"],
            tenant_name=payload["tenant_name"],
            tenant_tax_id=payload["tenant_tax_id"],
            tenant_address=payload["tenant_address"],
            issuer=payload["issuer_payload"],
            variant=variant,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail={"error": "סוג PDF לא נתמך", "code": "INVALID_VARIANT"},
        ) from exc
    except TaxInvoiceValidationError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "חסרים פרטי מנפיק נדרשים עבור חשבונית מס",
                "code": "MISSING_TAX_FIELDS",
                "missing_fields": exc.missing_fields,
            },
        ) from exc
    except Exception as exc:
        import traceback, logging
        logging.getLogger(__name__).error("PDF render error: %s", traceback.format_exc())
        raise HTTPException(500, detail={"error": str(exc), "code": "PDF_ERROR"}) from exc

    filename_suffix = "tax" if variant == "tax" else "statement"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{payload["invoice"].invoice_number or payload["invoice"].document_number}-{filename_suffix}.pdf"',
        },
    )


@router.post("/api/admin/billing/invoices/mark-overdue", response_model=dict)
async def mark_overdue(
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "edit")),
):
    """
    Mark all sent invoices whose due_date < today as overdue.
    Returns the count of invoices updated.
    """
    today = date.today()
    result = await db.execute(
        sa.update(Invoice)
        .where(Invoice.status == "sent", Invoice.due_date < today)
        .values(status="overdue")
        .execution_options(synchronize_session=False)
    )
    await db.commit()
    return {"updated": result.rowcount}


# ─── Tenant Billing Summary ────────────────────────────────────────────────────

@router.get(
    "/api/admin/tenants/{tenant_id}/seat-changes",
    response_model=list[SeatChangeLogOut],
)
async def list_seat_changes(
    tenant_id: uuid.UUID,
    module_slug: Optional[str] = Query(None),
    billed: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "view")),
):
    """Return seat-change history for a tenant, used to audit proration charges."""
    t_result = await db.execute(sa.select(Tenant).where(Tenant.tenant_id == tenant_id))
    if not t_result.scalar_one_or_none():
        raise HTTPException(404, detail={"error": "Tenant not found", "code": "NOT_FOUND"})

    q = (
        sa.select(SeatChangeLog)
        .where(SeatChangeLog.tenant_id == tenant_id)
        .order_by(SeatChangeLog.effective_date.desc(), SeatChangeLog.created_at.desc())
    )
    if module_slug:
        q = q.where(SeatChangeLog.module_slug == module_slug)
    if billed is not None:
        q = q.where(SeatChangeLog.billed == billed)
    result = await db.execute(q)
    return result.scalars().all()


@router.get(
    "/api/admin/tenants/{tenant_id}/billing",
    response_model=TenantBillingSummary,
)
async def get_tenant_billing(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "view")),
):
    # Verify tenant exists
    t_result = await db.execute(sa.select(Tenant).where(Tenant.tenant_id == tenant_id))
    if not t_result.scalar_one_or_none():
        raise HTTPException(404, detail={"error": "Tenant not found", "code": "NOT_FOUND"})

    charges_out: list[BillingChargeOut] = []
    invoices_out: list[InvoiceListItem] = []
    pending_total = Decimal("0")
    invoiced_total = Decimal("0")
    paid_total = Decimal("0")

    try:
        entries_result = await db.execute(
            sa.select(BillingLedgerEntry)
            .where(BillingLedgerEntry.tenant_id == tenant_id)
            .order_by(BillingLedgerEntry.created_at.desc())
        )
        entries = entries_result.scalars().all()

        documents_result = await db.execute(
            sa.select(BillingDocument)
            .where(BillingDocument.tenant_id == tenant_id)
            .order_by(BillingDocument.issue_date.desc().nulls_last())
        )
        documents = documents_result.scalars().all()

        status_map = {"open": "pending", "documented": "invoiced", "void": "cancelled"}
        for entry in entries:
            period_str = entry.service_period_start.strftime("%Y-%m") if entry.service_period_start else entry.created_at.strftime("%Y-%m")
            charge_out = BillingChargeOut(
                id=entry.id,
                tenant_id=entry.tenant_id,
                billing_period=period_str,
                charge_type=entry.entry_type,
                module_slug=entry.module_slug,
                description=entry.description,
                quantity=entry.quantity,
                unit_price_ils=entry.unit_amount_ils,
                amount_ils=entry.gross_amount_ils,
                discount_pct=entry.discount_pct,
                amount_after_discount_ils=entry.net_amount_ils,
                status=status_map.get(entry.status, "pending"),
                invoice_id=entry.document_id,
                notes=None,
                created_at=entry.created_at,
            )
            charge_out.tenant_name = await _tenant_name(db, entry.tenant_id)
            charge_out.module_name = await _module_name(db, entry.module_slug)
            charges_out.append(charge_out)

        for doc in documents:
            period_str = doc.issue_date.strftime("%Y-%m") if doc.issue_date else doc.created_at.strftime("%Y-%m")
            inv_item = InvoiceListItem(
                id=doc.id,
                invoice_number=doc.document_number or "טיוטה",
                tenant_id=doc.tenant_id,
                billing_period=period_str,
                issue_date=doc.issue_date or doc.created_at.date(),
                due_date=doc.due_date or doc.created_at.date(),
                subtotal_ils=doc.subtotal_ils,
                discount_ils=doc.discount_ils,
                vat_ils=doc.vat_ils,
                total_ils=doc.total_ils,
                status=doc.status,
                payment_date=doc.paid_at,
            )
            inv_item.tenant_name = await _tenant_name(db, doc.tenant_id)
            invoices_out.append(inv_item)

        pending_total = _round2(_sum_decimal(
            e.net_amount_ils for e in entries if e.status == "open"
        ))
        invoiced_total = _round2(_sum_decimal(
            doc.total_ils for doc in documents if doc.status not in ("void", "draft_blocked")
        ))
        paid_total = _round2(_sum_decimal(
            doc.total_ils for doc in documents if doc.status == "paid"
        ))
    except sa.exc.ProgrammingError as exc:
        if not _is_missing_relation_error(exc, {"billing_ledger_entries", "billing_documents"}):
            raise
        await db.rollback()

        legacy_charges_result = await db.execute(
            sa.select(BillingCharge)
            .where(BillingCharge.tenant_id == tenant_id)
            .order_by(BillingCharge.created_at.desc())
        )
        legacy_charges = legacy_charges_result.scalars().all()

        legacy_invoices_result = await db.execute(
            sa.select(Invoice)
            .where(Invoice.tenant_id == tenant_id)
            .order_by(Invoice.issue_date.desc(), Invoice.created_at.desc())
        )
        legacy_invoices = legacy_invoices_result.scalars().all()

        for charge in legacy_charges:
            charge_out = BillingChargeOut.model_validate(charge)
            charge_out.tenant_name = await _tenant_name(db, charge.tenant_id)
            charge_out.module_name = await _module_name(db, charge.module_slug)
            charges_out.append(charge_out)

        for invoice in legacy_invoices:
            inv_item = InvoiceListItem(
                id=invoice.id,
                invoice_number=invoice.invoice_number,
                tenant_id=invoice.tenant_id,
                billing_period=invoice.billing_period,
                issue_date=invoice.issue_date,
                due_date=invoice.due_date,
                subtotal_ils=invoice.subtotal_ils,
                discount_ils=invoice.discount_ils,
                vat_ils=invoice.vat_ils,
                total_ils=invoice.total_ils,
                status=invoice.status,
                payment_date=invoice.payment_date,
            )
            inv_item.tenant_name = await _tenant_name(db, invoice.tenant_id)
            invoices_out.append(inv_item)

        pending_total = _round2(_sum_decimal(
            charge.amount_after_discount_ils for charge in legacy_charges if charge.status == "pending"
        ))
        invoiced_total = _round2(_sum_decimal(
            invoice.total_ils for invoice in legacy_invoices if invoice.status != "cancelled"
        ))
        paid_total = _round2(_sum_decimal(
            invoice.total_ils for invoice in legacy_invoices if invoice.status == "paid"
        ))

    return TenantBillingSummary(
        charges=charges_out,
        invoices=invoices_out,
        pending_total_ils=pending_total,
        invoiced_total_ils=invoiced_total,
        paid_total_ils=paid_total,
    )


@router.get(
    "/api/admin/tenants/{tenant_id}/payment-tracking",
    response_model=TenantPaymentTrackingSummary,
)
async def get_tenant_payment_tracking(
    tenant_id: uuid.UUID,
    months_back: int = Query(6, ge=0, le=24),
    months_forward: int = Query(6, ge=0, le=24),
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("tenants", "view")),
):
    t_result = await db.execute(sa.select(Tenant).where(Tenant.tenant_id == tenant_id))
    if not t_result.scalar_one_or_none():
        raise HTTPException(404, detail={"error": "Tenant not found", "code": "NOT_FOUND"})
    return await _payment_tracking_summary(
        db,
        tenant_id,
        months_back=months_back,
        months_forward=months_forward,
    )


@router.put(
    "/api/admin/tenants/{tenant_id}/payment-tracking/{billing_period}",
    response_model=TenantPaymentTrackingSummary,
)
async def upsert_tenant_payment_tracking(
    tenant_id: uuid.UUID,
    billing_period: str,
    body: TenantPaymentRecordUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("tenants", "edit")),
):
    _validate_billing_period(billing_period)

    t_result = await db.execute(sa.select(Tenant).where(Tenant.tenant_id == tenant_id))
    if not t_result.scalar_one_or_none():
        raise HTTPException(404, detail={"error": "Tenant not found", "code": "NOT_FOUND"})

    subscription = await _active_subscription(db, tenant_id)
    if subscription is None:
        raise HTTPException(409, detail={"error": "Active subscription not found", "code": "NO_ACTIVE_SUBSCRIPTION"})

    scheduled_charge_date = _scheduled_charge_date(billing_period, subscription.billing_anchor_day)
    record_result = await db.execute(
        sa.select(TenantPaymentRecord).where(
            TenantPaymentRecord.tenant_id == tenant_id,
            TenantPaymentRecord.billing_period == billing_period,
        )
    )
    record = record_result.scalar_one_or_none()

    normalized_paid_at = body.paid_at
    if body.status == "paid" and normalized_paid_at is None:
        normalized_paid_at = date.today()

    clear_record = (
        body.status == "unreported"
        and body.amount_ils is None
        and normalized_paid_at is None
        and not (body.external_ref or "").strip()
        and not (body.notes or "").strip()
    )

    if clear_record and record is not None:
        await db.delete(record)
    elif record is None:
        record = TenantPaymentRecord(
            tenant_id=tenant_id,
            billing_period=billing_period,
            scheduled_charge_date=scheduled_charge_date,
            status=body.status,
            amount_ils=body.amount_ils,
            paid_at=normalized_paid_at,
            external_ref=body.external_ref,
            notes=body.notes,
            created_by=current_user.id,
            updated_by=current_user.id,
            updated_at=datetime.now(UTC),
        )
        db.add(record)
    else:
        record.scheduled_charge_date = scheduled_charge_date
        record.status = body.status
        record.amount_ils = body.amount_ils
        record.paid_at = normalized_paid_at
        record.external_ref = body.external_ref
        record.notes = body.notes
        record.updated_by = current_user.id
        record.updated_at = datetime.now(UTC)

    await db.commit()
    return await _payment_tracking_summary(db, tenant_id)


# ─── Quote Helpers ─────────────────────────────────────────────────────────────

def _calc_line_amounts(qty: Decimal, unit_price: Decimal, discount_pct: Decimal) -> tuple[Decimal, Decimal]:
    """Return (amount_ils, amount_after_discount_ils)."""
    amount = _round2(qty * unit_price)
    after_discount = _round2(amount * (1 - discount_pct / 100))
    return amount, after_discount


async def _recalc_quote_totals(db: AsyncSession, quote: Quote) -> None:
    """Recalculate and save quote totals from its lines."""
    lines_result = await db.execute(
        sa.select(QuoteLine).where(QuoteLine.quote_id == quote.id)
    )
    lines = lines_result.scalars().all()
    subtotal = _round2(_sum_decimal(ln.amount_after_discount_ils for ln in lines))
    discount = _round2(_sum_decimal(
        _to_decimal(ln.amount_ils) - _to_decimal(ln.amount_after_discount_ils) for ln in lines
    ))
    vat = _round2(subtotal * _to_decimal(quote.vat_pct) / 100)
    total = _round2(subtotal + vat)
    await db.execute(
        sa.update(Quote).where(Quote.id == quote.id).values(
            subtotal_ils=subtotal,
            discount_ils=discount,
            vat_ils=vat,
            total_ils=total,
        ).execution_options(synchronize_session=False)
    )
    quote.subtotal_ils = subtotal
    quote.discount_ils = discount
    quote.vat_ils = vat
    quote.total_ils = total


async def _build_quote_out(db: AsyncSession, quote: Quote) -> QuoteOut:
    lines_result = await db.execute(
        sa.select(QuoteLine)
        .where(QuoteLine.quote_id == quote.id)
        .order_by(QuoteLine.sort_order, QuoteLine.id)
    )
    lines = lines_result.scalars().all()
    out = QuoteOut.model_validate(quote)
    out.lines = [QuoteLineOut.model_validate(ln) for ln in lines]
    if quote.tenant_id:
        out.tenant_name = await _tenant_name(db, quote.tenant_id)
    return out


async def _get_quote_or_404(db: AsyncSession, quote_id: uuid.UUID) -> Quote:
    result = await db.execute(sa.select(Quote).where(Quote.id == quote_id))
    quote = result.scalar_one_or_none()
    if not quote:
        raise HTTPException(404, detail={"error": "Quote not found", "code": "NOT_FOUND"})
    return quote


# ─── Quotes CRUD ───────────────────────────────────────────────────────────────

@router.get("/api/admin/billing/quotes", response_model=list[QuoteListItem])
async def list_quotes(
    tenant_id: Optional[uuid.UUID] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "view")),
):
    q = sa.select(Quote).order_by(Quote.created_at.desc())
    if tenant_id:
        q = q.where(Quote.tenant_id == tenant_id)
    if status:
        q = q.where(Quote.status == status)
    if search:
        q = q.where(
            sa.or_(
                Quote.title.ilike(f"%{search}%"),
                Quote.prospect_name.ilike(f"%{search}%"),
                Quote.quote_number.ilike(f"%{search}%"),
            )
        )
    result = await db.execute(q)
    quotes = result.scalars().all()
    out = []
    for quote in quotes:
        item = QuoteListItem.model_validate(quote)
        if quote.tenant_id:
            item.tenant_name = await _tenant_name(db, quote.tenant_id)
        out.append(item)
    return out


@router.post("/api/admin/billing/quotes", response_model=QuoteOut, status_code=201)
async def create_quote(
    body: QuoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("billing", "edit")),
):
    quote = Quote(
        tenant_id=body.tenant_id,
        prospect_name=body.prospect_name,
        prospect_email=body.prospect_email,
        title=body.title,
        valid_until=body.valid_until,
        status="draft",
        notes=body.notes,
        discount_pct=body.discount_pct,
        vat_pct=body.vat_pct,
        created_by=current_user.id,
    )
    db.add(quote)
    await db.flush()

    for i, line_data in enumerate(body.lines):
        amount, after_discount = _calc_line_amounts(
            line_data.quantity, line_data.unit_price_ils, line_data.discount_pct
        )
        line = QuoteLine(
            quote_id=quote.id,
            description=line_data.description,
            quantity=line_data.quantity,
            unit_price_ils=line_data.unit_price_ils,
            amount_ils=amount,
            discount_pct=line_data.discount_pct,
            amount_after_discount_ils=after_discount,
            module_slug=line_data.module_slug,
            charge_type=line_data.charge_type,
            notes=line_data.notes,
            sort_order=line_data.sort_order if line_data.sort_order else (i + 1) * 10,
        )
        db.add(line)

    await db.flush()
    await _recalc_quote_totals(db, quote)
    await db.commit()
    await db.refresh(quote)
    return await _build_quote_out(db, quote)


@router.get("/api/admin/billing/quotes/{quote_id}", response_model=QuoteOut)
async def get_quote(
    quote_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "view")),
):
    quote = await _get_quote_or_404(db, quote_id)
    return await _build_quote_out(db, quote)


@router.put("/api/admin/billing/quotes/{quote_id}", response_model=QuoteOut)
async def update_quote(
    quote_id: uuid.UUID,
    body: QuoteUpdate,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "edit")),
):
    quote = await _get_quote_or_404(db, quote_id)
    if quote.status not in ("draft",):
        raise HTTPException(409, detail={"error": "Only draft quotes can be edited", "code": "INVALID_STATUS"})

    updates: dict = {}
    if body.title is not None:
        updates["title"] = body.title
    if body.valid_until is not None:
        updates["valid_until"] = body.valid_until
    if body.tenant_id is not None:
        updates["tenant_id"] = body.tenant_id
    if body.prospect_name is not None:
        updates["prospect_name"] = body.prospect_name
    if body.prospect_email is not None:
        updates["prospect_email"] = body.prospect_email
    if body.notes is not None:
        updates["notes"] = body.notes
    if body.discount_pct is not None:
        updates["discount_pct"] = body.discount_pct
    if body.vat_pct is not None:
        updates["vat_pct"] = body.vat_pct

    if updates:
        await db.execute(
            sa.update(Quote).where(Quote.id == quote_id).values(**updates)
            .execution_options(synchronize_session=False)
        )
        await db.flush()
        await db.refresh(quote)

    await _recalc_quote_totals(db, quote)
    await db.commit()
    await db.refresh(quote)
    return await _build_quote_out(db, quote)


# ─── Quote Lines ───────────────────────────────────────────────────────────────

@router.post("/api/admin/billing/quotes/{quote_id}/lines", response_model=QuoteOut, status_code=201)
async def add_quote_line(
    quote_id: uuid.UUID,
    body: QuoteLineCreate,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "edit")),
):
    quote = await _get_quote_or_404(db, quote_id)
    if quote.status not in ("draft",):
        raise HTTPException(409, detail={"error": "Only draft quotes can be modified", "code": "INVALID_STATUS"})

    amount, after_discount = _calc_line_amounts(body.quantity, body.unit_price_ils, body.discount_pct)
    line = QuoteLine(
        quote_id=quote.id,
        description=body.description,
        quantity=body.quantity,
        unit_price_ils=body.unit_price_ils,
        amount_ils=amount,
        discount_pct=body.discount_pct,
        amount_after_discount_ils=after_discount,
        module_slug=body.module_slug,
        charge_type=body.charge_type,
        notes=body.notes,
        sort_order=body.sort_order,
    )
    db.add(line)
    await db.flush()
    await _recalc_quote_totals(db, quote)
    await db.commit()
    await db.refresh(quote)
    return await _build_quote_out(db, quote)


@router.put("/api/admin/billing/quotes/{quote_id}/lines/{line_id}", response_model=QuoteOut)
async def update_quote_line(
    quote_id: uuid.UUID,
    line_id: uuid.UUID,
    body: QuoteLineUpdate,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "edit")),
):
    quote = await _get_quote_or_404(db, quote_id)
    if quote.status not in ("draft",):
        raise HTTPException(409, detail={"error": "Only draft quotes can be modified", "code": "INVALID_STATUS"})

    result = await db.execute(
        sa.select(QuoteLine).where(QuoteLine.id == line_id, QuoteLine.quote_id == quote_id)
    )
    line = result.scalar_one_or_none()
    if not line:
        raise HTTPException(404, detail={"error": "Line not found", "code": "NOT_FOUND"})

    if body.description is not None:
        line.description = body.description
    if body.quantity is not None:
        line.quantity = body.quantity
    if body.unit_price_ils is not None:
        line.unit_price_ils = body.unit_price_ils
    if body.discount_pct is not None:
        line.discount_pct = body.discount_pct
    if body.module_slug is not None:
        line.module_slug = body.module_slug
    if body.charge_type is not None:
        line.charge_type = body.charge_type
    if body.notes is not None:
        line.notes = body.notes
    if body.sort_order is not None:
        line.sort_order = body.sort_order

    amount, after_discount = _calc_line_amounts(line.quantity, line.unit_price_ils, line.discount_pct)
    line.amount_ils = amount
    line.amount_after_discount_ils = after_discount

    await db.flush()
    await _recalc_quote_totals(db, quote)
    await db.commit()
    await db.refresh(quote)
    return await _build_quote_out(db, quote)


@router.delete("/api/admin/billing/quotes/{quote_id}/lines/{line_id}", response_model=QuoteOut)
async def delete_quote_line(
    quote_id: uuid.UUID,
    line_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "edit")),
):
    quote = await _get_quote_or_404(db, quote_id)
    if quote.status not in ("draft",):
        raise HTTPException(409, detail={"error": "Only draft quotes can be modified", "code": "INVALID_STATUS"})

    await db.execute(
        sa.delete(QuoteLine).where(QuoteLine.id == line_id, QuoteLine.quote_id == quote_id)
    )
    await db.flush()
    await _recalc_quote_totals(db, quote)
    await db.commit()
    await db.refresh(quote)
    return await _build_quote_out(db, quote)


# ─── Quote Lifecycle ───────────────────────────────────────────────────────────

@router.post("/api/admin/billing/quotes/{quote_id}/send", response_model=QuoteOut)
async def send_quote(
    quote_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("billing", "edit")),
):
    quote = await _get_quote_or_404(db, quote_id)
    if quote.status != "draft":
        raise HTTPException(409, detail={"error": "Only draft quotes can be sent", "code": "INVALID_STATUS"})

    seq_result = await db.execute(sa.text("SELECT nextval('quote_number_seq')"))
    seq_num = seq_result.scalar_one()
    year = datetime.now(UTC).year
    quote_number = f"QUO-{year}-{seq_num:04d}"

    await db.execute(
        sa.update(Quote).where(Quote.id == quote_id)
        .values(status="sent", quote_number=quote_number)
        .execution_options(synchronize_session=False)
    )
    await db.commit()
    await db.refresh(quote)
    return await _build_quote_out(db, quote)


@router.post("/api/admin/billing/quotes/{quote_id}/accept", response_model=QuoteOut)
async def accept_quote(
    quote_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "edit")),
):
    quote = await _get_quote_or_404(db, quote_id)
    if quote.status != "sent":
        raise HTTPException(409, detail={"error": "Only sent quotes can be accepted", "code": "INVALID_STATUS"})
    await db.execute(
        sa.update(Quote).where(Quote.id == quote_id).values(status="accepted")
        .execution_options(synchronize_session=False)
    )
    await db.commit()
    await db.refresh(quote)
    return await _build_quote_out(db, quote)


@router.post("/api/admin/billing/quotes/{quote_id}/decline", response_model=QuoteOut)
async def decline_quote(
    quote_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "edit")),
):
    quote = await _get_quote_or_404(db, quote_id)
    if quote.status != "sent":
        raise HTTPException(409, detail={"error": "Only sent quotes can be declined", "code": "INVALID_STATUS"})
    await db.execute(
        sa.update(Quote).where(Quote.id == quote_id).values(status="declined")
        .execution_options(synchronize_session=False)
    )
    await db.commit()
    await db.refresh(quote)
    return await _build_quote_out(db, quote)


@router.post("/api/admin/billing/quotes/{quote_id}/convert-to-invoice", response_model=InvoiceOut, status_code=201)
async def convert_quote_to_invoice(
    quote_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("billing", "edit")),
):
    quote = await _get_quote_or_404(db, quote_id)
    if quote.status != "accepted":
        raise HTTPException(409, detail={"error": "Only accepted quotes can be converted", "code": "INVALID_STATUS"})
    if not quote.tenant_id:
        raise HTTPException(422, detail={"error": "Quote must be linked to a tenant to convert to invoice", "code": "NO_TENANT"})
    if quote.converted_invoice_id:
        raise HTTPException(409, detail={"error": "Quote already converted", "code": "ALREADY_CONVERTED"})

    lines_result = await db.execute(
        sa.select(QuoteLine).where(QuoteLine.quote_id == quote.id).order_by(QuoteLine.sort_order)
    )
    lines = lines_result.scalars().all()
    if not lines:
        raise HTTPException(422, detail={"error": "Quote has no lines", "code": "NO_LINES"})

    today = date.today()
    billing_period = f"{today.year}-{today.month:02d}"

    created_charges: list[BillingCharge] = []
    for line in lines:
        charge = BillingCharge(
            tenant_id=quote.tenant_id,
            billing_period=billing_period,
            charge_type=line.charge_type,
            module_slug=line.module_slug,
            description=line.description,
            quantity=line.quantity,
            unit_price_ils=line.unit_price_ils,
            amount_ils=line.amount_ils,
            discount_pct=line.discount_pct,
            amount_after_discount_ils=line.amount_after_discount_ils,
            status="pending",
            notes=line.notes,
            created_by=current_user.id,
        )
        db.add(charge)
        created_charges.append(charge)

    await db.flush()

    subtotal = _round2(_sum_decimal(c.amount_after_discount_ils for c in created_charges))
    discount = _round2(_sum_decimal(
        _to_decimal(c.amount_ils) - _to_decimal(c.amount_after_discount_ils) for c in created_charges
    ))
    vat = _round2(subtotal * _to_decimal(quote.vat_pct) / 100)
    total = _round2(subtotal + vat)

    seq_result = await db.execute(sa.text("SELECT nextval('invoice_number_seq')"))
    seq_num = seq_result.scalar_one()
    invoice_number = f"INV-{today.year}-{seq_num:04d}"

    due_date = today + timedelta(days=30)
    invoice = Invoice(
        invoice_number=invoice_number,
        tenant_id=quote.tenant_id,
        billing_period=billing_period,
        issue_date=today,
        due_date=due_date,
        subtotal_ils=subtotal,
        discount_ils=discount,
        vat_pct=quote.vat_pct,
        vat_ils=vat,
        total_ils=total,
        status="draft",
        notes=f"המרה מהצעת מחיר {quote.quote_number or str(quote.id)[:8]}",
        created_by=current_user.id,
    )
    db.add(invoice)
    await db.flush()

    for sort_order, charge in enumerate(created_charges, start=1):
        line_item = InvoiceLine(
            invoice_id=invoice.id,
            charge_id=charge.id,
            description=charge.description,
            quantity=charge.quantity,
            unit_price_ils=charge.unit_price_ils,
            amount_ils=charge.amount_after_discount_ils,
            sort_order=sort_order * 10,
        )
        db.add(line_item)
        charge.status = "invoiced"
        charge.invoice_id = invoice.id

    await db.execute(
        sa.update(Quote).where(Quote.id == quote_id)
        .values(converted_invoice_id=invoice.id)
        .execution_options(synchronize_session=False)
    )

    await db.commit()
    await db.refresh(invoice)
    return await _build_invoice_out(db, invoice)


# ─── Quote PDF ─────────────────────────────────────────────────────────────────

@router.get("/api/admin/billing/quotes/{quote_id}/pdf")
async def download_quote_pdf(
    quote_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "view")),
):
    quote = await _get_quote_or_404(db, quote_id)
    lines_result = await db.execute(
        sa.select(QuoteLine).where(QuoteLine.quote_id == quote.id).order_by(QuoteLine.sort_order)
    )
    lines = lines_result.scalars().all()

    _, issuer_payload, _ = await _get_billing_settings_payload(db)

    if quote.tenant_id:
        recipient_name = await _tenant_name(db, quote.tenant_id)
    elif quote.prospect_name:
        recipient_name = quote.prospect_name
    else:
        recipient_name = "לקוח פוטנציאלי"

    try:
        pdf_bytes = render_quote_pdf(
            quote=quote,
            lines=lines,
            recipient_name=recipient_name,
            recipient_email=quote.prospect_email,
            issuer=issuer_payload,
        )
    except Exception as exc:
        raise HTTPException(500, detail={"error": str(exc), "code": "PDF_ERROR"})

    filename = f"quote-{quote.quote_number or str(quote.id)[:8]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
