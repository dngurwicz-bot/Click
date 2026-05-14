from __future__ import annotations

import calendar
import uuid
from copy import deepcopy
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Iterable, Sequence

import sqlalchemy as sa
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.billing import BillingSettings
from app.models.billing_engine import (
    BillingBillRun,
    BillingChangeEvent,
    BillingContract,
    BillingContractItem,
    BillingDocument,
    BillingDocumentLine,
    BillingLedgerEntry,
)
from app.models.module import ModulePrice
from app.models.tenant import TenantAddress, TenantIdentity
from app.schemas.billing_engine import BillingChangePreviewOut, BillingImpactLine
from app.services.temporal import get_active

TWO_PLACES = Decimal("0.01")
DEFAULT_VAT_PCT = Decimal("17.00")


def to_decimal(value: Decimal | int | float | str | None) -> Decimal:
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def round2(value: Decimal | int | float | str | None) -> Decimal:
    return to_decimal(value).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def sum_decimal(values: Iterable[Decimal | int | float | str | None]) -> Decimal:
    return sum((to_decimal(value) for value in values), Decimal("0"))


def now_utc() -> datetime:
    return datetime.now(UTC)


def end_of_month(year: int, month: int) -> date:
    return date(year, month, calendar.monthrange(year, month)[1])


def add_months(source: date, months: int) -> date:
    month = source.month - 1 + months
    year = source.year + month // 12
    month = month % 12 + 1
    day = min(source.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def clamp_anchor_day(year: int, month: int, anchor_day: int) -> date:
    return date(year, month, min(anchor_day, calendar.monthrange(year, month)[1]))


def cycle_step_months(billing_cycle: str) -> int:
    if billing_cycle == "yearly":
        return 12
    if billing_cycle == "quarterly":
        return 3
    return 1


def cycle_bounds(contract: BillingContract, as_of: date) -> tuple[date, date]:
    step_months = cycle_step_months(contract.billing_cycle)
    candidate = clamp_anchor_day(
        contract.start_date.year,
        contract.start_date.month,
        contract.anchor_day,
    )

    while candidate > as_of:
        prev_month = add_months(date(candidate.year, candidate.month, 1), -step_months)
        candidate = clamp_anchor_day(prev_month.year, prev_month.month, contract.anchor_day)

    while True:
        next_month = add_months(date(candidate.year, candidate.month, 1), step_months)
        next_candidate = clamp_anchor_day(next_month.year, next_month.month, contract.anchor_day)
        if next_candidate > as_of:
            break
        candidate = next_candidate

    return candidate, add_months(candidate, step_months) - timedelta(days=1)


def remaining_proration_ratio(effective_at: date, period_start: date, period_end: date) -> Decimal:
    if effective_at <= period_start:
        return Decimal("1")
    if effective_at > period_end:
        return Decimal("0")
    total_days = Decimal(str((period_end - period_start).days + 1))
    remaining_days = Decimal(str((period_end - effective_at).days + 1))
    return remaining_days / total_days


def billable_units(quantity: int, included_qty: int) -> int:
    return max(quantity - included_qty, 0)


def rate_tiered(quantity: int, tiers: Sequence[dict] | None) -> Decimal:
    if quantity <= 0 or not tiers:
        return Decimal("0")
    remaining = quantity
    total = Decimal("0")
    previous_cap = 0
    for row in tiers:
        up_to = row.get("up_to")
        unit_amount = to_decimal(row.get("unit_amount_ils"))
        if up_to is None:
            total += Decimal(str(remaining)) * unit_amount
            remaining = 0
            break
        bracket = max(min(up_to - previous_cap, remaining), 0)
        total += Decimal(str(bracket)) * unit_amount
        remaining -= bracket
        previous_cap = up_to
        if remaining <= 0:
            break
    if remaining > 0:
        last_price = to_decimal(tiers[-1].get("unit_amount_ils"))
        total += Decimal(str(remaining)) * last_price
    return round2(total)


def rate_contract_item(item: BillingContractItem) -> Decimal:
    if item.rating_model == "flat":
        return round2(item.base_amount_ils)
    if item.rating_model == "per_seat":
        recurring = to_decimal(item.base_amount_ils) + (
            to_decimal(item.per_unit_amount_ils) * Decimal(str(billable_units(item.quantity, item.included_qty)))
        )
        return round2(recurring)
    recurring = to_decimal(item.base_amount_ils) + rate_tiered(item.quantity, item.tier_definition)
    return round2(recurring)


def discount_amount(amount: Decimal, discount_pct: Decimal) -> Decimal:
    if amount == 0:
        return Decimal("0")
    return round2(amount * (Decimal("1") - to_decimal(discount_pct) / Decimal("100")))


async def tenant_name(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    identity = await get_active(db, TenantIdentity, tenant_id)
    return identity.name_he if identity else str(tenant_id)


async def effective_contract_items(db: AsyncSession, contract_id: uuid.UUID, as_of: date) -> list[BillingContractItem]:
    result = await db.execute(
        sa.select(BillingContractItem)
        .where(BillingContractItem.contract_id == contract_id)
        .where(BillingContractItem.effective_from <= as_of)
        .where(sa.or_(BillingContractItem.effective_to.is_(None), BillingContractItem.effective_to >= as_of))
        .order_by(BillingContractItem.module_slug, BillingContractItem.effective_from.desc(), BillingContractItem.created_at.desc())
    )
    rows = result.scalars().all()
    latest_by_slug: dict[str, BillingContractItem] = {}
    for row in rows:
        latest_by_slug.setdefault(row.module_slug, row)
    return [row for row in latest_by_slug.values() if row.status == "active"]


async def get_contract_or_404(db: AsyncSession, contract_id: uuid.UUID) -> BillingContract:
    result = await db.execute(sa.select(BillingContract).where(BillingContract.id == contract_id))
    contract = result.scalar_one_or_none()
    if contract is None:
        raise HTTPException(404, detail={"error": "Billing contract not found", "code": "NOT_FOUND"})
    return contract


async def get_contract_item_or_404(db: AsyncSession, contract_id: uuid.UUID, item_id: uuid.UUID) -> BillingContractItem:
    result = await db.execute(
        sa.select(BillingContractItem).where(
            BillingContractItem.id == item_id,
            BillingContractItem.contract_id == contract_id,
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(404, detail={"error": "Billing contract item not found", "code": "NOT_FOUND"})
    return item


async def refresh_contract_credit_balance(db: AsyncSession, contract_id: uuid.UUID) -> Decimal:
    result = await db.execute(
        sa.select(sa.func.coalesce(sa.func.sum(BillingLedgerEntry.net_amount_ils), 0))
        .where(BillingLedgerEntry.contract_id == contract_id)
        .where(BillingLedgerEntry.status == "open")
        .where(BillingLedgerEntry.net_amount_ils < 0)
    )
    open_credits = abs(to_decimal(result.scalar_one()))
    await db.execute(
        sa.update(BillingContract)
        .where(BillingContract.id == contract_id)
        .values(credit_balance_ils=open_credits, updated_at=now_utc())
        .execution_options(synchronize_session=False)
    )
    return round2(open_credits)


async def setup_fee_already_billed(db: AsyncSession, tenant_id: uuid.UUID, module_slug: str) -> bool:
    result = await db.execute(
        sa.select(BillingLedgerEntry.id).where(
            BillingLedgerEntry.tenant_id == tenant_id,
            BillingLedgerEntry.module_slug == module_slug,
            BillingLedgerEntry.entry_type == "setup_fee",
            BillingLedgerEntry.status != "void",
        )
    )
    return result.first() is not None


def build_impact_line(
    *,
    entry_type: str,
    module_slug: str | None,
    description: str,
    quantity: Decimal,
    amount_ils: Decimal,
    service_period_start: date | None = None,
    service_period_end: date | None = None,
) -> BillingImpactLine:
    return BillingImpactLine(
        entry_type=entry_type,
        module_slug=module_slug,
        description=description,
        quantity=quantity,
        amount_ils=round2(amount_ils),
        service_period_start=service_period_start,
        service_period_end=service_period_end,
    )


@dataclass
class ChangePreviewContext:
    contract: BillingContract
    effective_item: BillingContractItem | None
    cycle_start: date
    cycle_end: date


async def preview_change(
    db: AsyncSession,
    *,
    contract: BillingContract,
    event_type: str,
    effective_at: date,
    item: BillingContractItem | None,
    module_slug: str | None,
    quantity: int | None,
    rating_model: str | None,
    base_amount_ils: Decimal | None,
    included_qty: int | None,
    per_unit_amount_ils: Decimal | None,
    tier_definition: list[dict] | None,
    setup_fee_amount_ils: Decimal | None,
    discount_pct: Decimal | None,
) -> BillingChangePreviewOut:
    cycle_start, cycle_end = cycle_bounds(contract, effective_at)
    ratio = remaining_proration_ratio(effective_at, cycle_start, cycle_end)
    lines: list[BillingImpactLine] = []
    bill_now = Decimal("0")
    next_invoice_impact = Decimal("0")

    if event_type == "start_contract":
        active_items = await effective_contract_items(db, contract.id, effective_at)
        for active_item in active_items:
            recurring = discount_amount(rate_contract_item(active_item), active_item.discount_pct)
            prorated = round2(recurring * ratio)
            if prorated:
                lines.append(
                    build_impact_line(
                        entry_type="recurring",
                        module_slug=active_item.module_slug,
                        description=f"פתיחת מנוי עבור {active_item.module_slug}",
                        quantity=Decimal("1"),
                        amount_ils=prorated,
                        service_period_start=effective_at,
                        service_period_end=cycle_end,
                    )
                )
                bill_now += prorated
            if active_item.setup_fee_amount_ils > 0 and not await setup_fee_already_billed(db, contract.tenant_id, active_item.module_slug):
                setup_amount = discount_amount(active_item.setup_fee_amount_ils, active_item.discount_pct)
                lines.append(
                    build_impact_line(
                        entry_type="setup_fee",
                        module_slug=active_item.module_slug,
                        description=f"דמי הקמה עבור {active_item.module_slug}",
                        quantity=Decimal("1"),
                        amount_ils=setup_amount,
                        service_period_start=effective_at,
                        service_period_end=effective_at,
                    )
                )
                bill_now += setup_amount
            next_invoice_impact += recurring
    elif event_type == "add_module":
        if module_slug is None or rating_model is None:
            raise HTTPException(422, detail={"error": "Add module requires module and rating model", "code": "INVALID_REQUEST"})
        draft_item = BillingContractItem(
            contract_id=contract.id,
            module_slug=module_slug,
            rating_model=rating_model,
            quantity=max(quantity or 0, 0),
            base_amount_ils=to_decimal(base_amount_ils),
            included_qty=max(included_qty or 0, 0),
            per_unit_amount_ils=to_decimal(per_unit_amount_ils),
            tier_definition=tier_definition,
            setup_fee_amount_ils=to_decimal(setup_fee_amount_ils),
            discount_pct=to_decimal(discount_pct),
            effective_from=effective_at,
            status="active",
        )
        recurring = discount_amount(rate_contract_item(draft_item), draft_item.discount_pct)
        prorated = round2(recurring * ratio)
        if prorated:
            lines.append(
                build_impact_line(
                    entry_type="proration_debit",
                    module_slug=module_slug,
                    description=f"הוספת מודול {module_slug} - חיוב יחסי",
                    quantity=Decimal("1"),
                    amount_ils=prorated,
                    service_period_start=effective_at,
                    service_period_end=cycle_end,
                )
            )
            bill_now += prorated
        if draft_item.setup_fee_amount_ils > 0 and not await setup_fee_already_billed(db, contract.tenant_id, module_slug):
            setup_amount = discount_amount(draft_item.setup_fee_amount_ils, draft_item.discount_pct)
            lines.append(
                build_impact_line(
                    entry_type="setup_fee",
                    module_slug=module_slug,
                    description=f"דמי הקמה עבור {module_slug}",
                    quantity=Decimal("1"),
                    amount_ils=setup_amount,
                    service_period_start=effective_at,
                    service_period_end=effective_at,
                )
            )
            bill_now += setup_amount
        next_invoice_impact += recurring
    elif event_type in {"remove_module", "change_quantity", "override_price"}:
        if item is None:
            raise HTTPException(422, detail={"error": "Change requires contract item", "code": "INVALID_REQUEST"})
        old_recurring = discount_amount(rate_contract_item(item), item.discount_pct)
        new_item = deepcopy(item)
        if event_type == "remove_module":
            new_item.status = "removed"
            new_recurring = Decimal("0")
            delta = old_recurring
            credit_amount = round2(delta * ratio)
            if credit_amount:
                lines.append(
                    build_impact_line(
                        entry_type="credit",
                        module_slug=item.module_slug,
                        description=f"הסרת מודול {item.module_slug} - זיכוי יחסי",
                        quantity=Decimal("1"),
                        amount_ils=-credit_amount,
                        service_period_start=effective_at,
                        service_period_end=cycle_end,
                    )
                )
                bill_now -= credit_amount
            next_invoice_impact -= old_recurring
        else:
            if quantity is not None:
                new_item.quantity = max(quantity, 0)
            if rating_model is not None:
                new_item.rating_model = rating_model
            if base_amount_ils is not None:
                new_item.base_amount_ils = to_decimal(base_amount_ils)
            if included_qty is not None:
                new_item.included_qty = max(included_qty, 0)
            if per_unit_amount_ils is not None:
                new_item.per_unit_amount_ils = to_decimal(per_unit_amount_ils)
            if tier_definition is not None:
                new_item.tier_definition = tier_definition
            if setup_fee_amount_ils is not None:
                new_item.setup_fee_amount_ils = to_decimal(setup_fee_amount_ils)
            if discount_pct is not None:
                new_item.discount_pct = to_decimal(discount_pct)
            new_recurring = discount_amount(rate_contract_item(new_item), new_item.discount_pct)
            delta = new_recurring - old_recurring
            prorated_delta = round2(abs(delta) * ratio)
            if prorated_delta:
                entry_type = "proration_debit" if delta > 0 else "credit"
                sign = Decimal("1") if delta > 0 else Decimal("-1")
                lines.append(
                    build_impact_line(
                        entry_type=entry_type,
                        module_slug=item.module_slug,
                        description=f"עדכון מודול {item.module_slug} - התאמה יחסית",
                        quantity=Decimal("1"),
                        amount_ils=sign * prorated_delta,
                        service_period_start=effective_at,
                        service_period_end=cycle_end,
                    )
                )
                bill_now += sign * prorated_delta
            next_invoice_impact += new_recurring - old_recurring
    elif event_type == "cancel_contract":
        active_items = await effective_contract_items(db, contract.id, effective_at)
        for active_item in active_items:
            recurring = discount_amount(rate_contract_item(active_item), active_item.discount_pct)
            credit_amount = round2(recurring * ratio)
            if credit_amount:
                lines.append(
                    build_impact_line(
                        entry_type="credit",
                        module_slug=active_item.module_slug,
                        description=f"ביטול מנוי {active_item.module_slug} - זיכוי יחסי",
                        quantity=Decimal("1"),
                        amount_ils=-credit_amount,
                        service_period_start=effective_at,
                        service_period_end=cycle_end,
                    )
                )
                bill_now -= credit_amount
            next_invoice_impact -= recurring
    else:
        raise HTTPException(422, detail={"error": "Unsupported billing event type", "code": "INVALID_EVENT"})

    credit_impact = abs(sum_decimal(line.amount_ils for line in lines if line.amount_ils < 0))
    return BillingChangePreviewOut(
        event_type=event_type,
        effective_at=effective_at,
        bill_now_ils=round2(bill_now),
        next_invoice_impact_ils=round2(next_invoice_impact),
        credit_impact_ils=round2(credit_impact),
        lines=lines,
    )


def line_source_key(event: BillingChangeEvent | None, run: BillingBillRun | None, module_slug: str | None, entry_type: str, service_start: date | None) -> str | None:
    if event is not None:
        return f"event:{event.id}:{module_slug or 'na'}:{entry_type}:{service_start}"
    if run is not None:
        return f"run:{run.id}:{module_slug or 'na'}:{entry_type}:{service_start}"
    return None


async def create_ledger_entries_for_preview(
    db: AsyncSession,
    *,
    contract: BillingContract,
    preview: BillingChangePreviewOut,
    event: BillingChangeEvent | None,
    bill_run: BillingBillRun | None,
    item_lookup: dict[str, BillingContractItem] | None = None,
) -> list[BillingLedgerEntry]:
    created: list[BillingLedgerEntry] = []
    lookup = item_lookup or {}
    for line in preview.lines:
        source_key = line_source_key(event, bill_run, line.module_slug, line.entry_type, line.service_period_start)
        if source_key:
            existing = await db.execute(sa.select(BillingLedgerEntry.id).where(BillingLedgerEntry.source_key == source_key))
            if existing.first():
                continue
        amount = round2(line.amount_ils)
        gross = abs(amount)
        discount_pct = Decimal("0")
        if line.module_slug and line.module_slug in lookup:
            discount_pct = lookup[line.module_slug].discount_pct
        entry = BillingLedgerEntry(
            contract_id=contract.id,
            contract_item_id=lookup.get(line.module_slug).id if line.module_slug and line.module_slug in lookup else None,
            tenant_id=contract.tenant_id,
            module_slug=line.module_slug,
            change_event_id=event.id if event else None,
            bill_run_id=bill_run.id if bill_run else None,
            entry_type=line.entry_type,
            status="open",
            source_key=source_key,
            description=line.description,
            service_period_start=line.service_period_start,
            service_period_end=line.service_period_end,
            quantity=line.quantity,
            unit_amount_ils=abs(amount / line.quantity) if line.quantity else abs(amount),
            gross_amount_ils=gross,
            discount_pct=discount_pct,
            net_amount_ils=amount,
            metadata_json={"effective_at": preview.effective_at.isoformat(), "event_type": preview.event_type},
        )
        db.add(entry)
        created.append(entry)
    await db.flush()
    await refresh_contract_credit_balance(db, contract.id)
    return created


async def create_document_from_entries(
    db: AsyncSession,
    *,
    contract: BillingContract,
    entries: Sequence[BillingLedgerEntry],
    actor_id: uuid.UUID | None,
    bill_run_id: uuid.UUID | None = None,
    notes: str | None = None,
) -> BillingDocument | None:
    if not entries:
        return None
    subtotal = round2(sum_decimal(entry.net_amount_ils for entry in entries))
    document_type = "credit_note" if subtotal < 0 else "invoice"
    discount_ils = Decimal("0")
    credit_applied = abs(sum_decimal(entry.net_amount_ils for entry in entries if entry.net_amount_ils < 0)) if document_type == "invoice" else Decimal("0")
    vat_base = subtotal
    vat = round2(vat_base * DEFAULT_VAT_PCT / Decimal("100"))
    total = round2(subtotal + vat)
    document = BillingDocument(
        tenant_id=contract.tenant_id,
        contract_id=contract.id,
        bill_run_id=bill_run_id,
        document_type=document_type,
        status="draft",
        subtotal_ils=subtotal,
        discount_ils=discount_ils,
        credit_applied_ils=round2(credit_applied),
        vat_pct=DEFAULT_VAT_PCT,
        vat_ils=vat,
        total_ils=total,
        notes=notes,
        created_by=actor_id,
    )
    db.add(document)
    await db.flush()
    for index, entry in enumerate(entries, start=1):
        db.add(
            BillingDocumentLine(
                document_id=document.id,
                ledger_entry_id=entry.id,
                description=entry.description,
                quantity=entry.quantity,
                unit_amount_ils=entry.unit_amount_ils,
                amount_ils=entry.net_amount_ils,
                sort_order=index * 10,
            )
        )
        entry.document_id = document.id
        entry.status = "documented"
    await db.flush()
    await refresh_contract_credit_balance(db, contract.id)
    return document


async def load_document_lines(db: AsyncSession, document_id: uuid.UUID) -> list[BillingDocumentLine]:
    result = await db.execute(
        sa.select(BillingDocumentLine)
        .where(BillingDocumentLine.document_id == document_id)
        .order_by(BillingDocumentLine.sort_order)
    )
    return list(result.scalars().all())


def billing_settings_from_env() -> dict[str, str | None]:
    settings = get_settings()
    return {
        "issuer_name_he": settings.COMPANY_NAME_HE,
        "issuer_name_en": settings.COMPANY_NAME_EN or None,
        "issuer_tax_id": settings.COMPANY_TAX_ID or None,
        "issuer_address": settings.COMPANY_ADDRESS or None,
        "issuer_phone": settings.COMPANY_PHONE or None,
        "issuer_email": settings.COMPANY_EMAIL or None,
    }


async def load_billing_settings_payload(db: AsyncSession) -> dict[str, str | None]:
    result = await db.execute(sa.select(BillingSettings).order_by(BillingSettings.created_at.desc()).limit(1))
    row = result.scalar_one_or_none()
    if row is None:
        return billing_settings_from_env()
    return {
        "issuer_name_he": row.issuer_name_he,
        "issuer_name_en": row.issuer_name_en,
        "issuer_tax_id": row.issuer_tax_id,
        "issuer_address": row.issuer_address,
        "issuer_phone": row.issuer_phone,
        "issuer_email": row.issuer_email,
    }


def missing_document_fields(payload: dict[str, str | None]) -> list[str]:
    required = {
        "issuer_name_he": "שם מנפיק",
        "issuer_tax_id": "ח.פ / ע.מ",
        "issuer_address": "כתובת מנפיק",
    }
    return [label for key, label in required.items() if not (payload.get(key) or "").strip()]


async def finalize_document(db: AsyncSession, document: BillingDocument) -> BillingDocument:
    if document.status not in ("draft", "draft_blocked"):
        raise HTTPException(409, detail={"error": "Only draft documents can be finalized", "code": "INVALID_STATUS"})
    issue_date = date.today()
    tenant_identity = await get_active(db, TenantIdentity, document.tenant_id, as_of=issue_date)
    tenant_address = await get_active(db, TenantAddress, document.tenant_id, as_of=issue_date)
    issuer = await load_billing_settings_payload(db)
    missing = missing_document_fields(issuer)
    if tenant_identity is None or tenant_address is None or missing:
        document.status = "draft_blocked"
        await db.flush()
        raise HTTPException(
            409,
            detail={
                "error": "Document is missing issuer or tenant billing details",
                "code": "DOCUMENT_BLOCKED",
                "missing_issuer_fields": missing,
                "missing_tenant_identity": tenant_identity is None,
                "missing_tenant_address": tenant_address is None,
            },
        )
    seq_result = await db.execute(sa.text("SELECT nextval('billing_document_number_seq')"))
    seq_num = seq_result.scalar_one()
    prefix = "CRN" if document.document_type == "credit_note" else "INV"
    document.document_number = f"{prefix}-{issue_date.year}-{seq_num:04d}"
    document.issue_date = issue_date
    if document.document_type == "invoice":
        contract = await get_contract_or_404(db, document.contract_id) if document.contract_id else None
        due_in_days = contract.payment_terms_days if contract else 30
        document.due_date = issue_date + timedelta(days=due_in_days)
    else:
        document.due_date = issue_date
    document.status = "issued"
    await db.flush()
    return document


async def build_initial_contract_entries(
    db: AsyncSession,
    *,
    contract: BillingContract,
    items: Sequence[BillingContractItem],
    actor_id: uuid.UUID | None,
) -> BillingDocument | None:
    preview = await preview_change(
        db,
        contract=contract,
        event_type="start_contract",
        effective_at=contract.start_date,
        item=None,
        module_slug=None,
        quantity=None,
        rating_model=None,
        base_amount_ils=None,
        included_qty=None,
        per_unit_amount_ils=None,
        tier_definition=None,
        setup_fee_amount_ils=None,
        discount_pct=None,
    )
    event = BillingChangeEvent(
        contract_id=contract.id,
        tenant_id=contract.tenant_id,
        event_type="start_contract",
        status="applied",
        effective_at=contract.start_date,
        payload={},
        preview_snapshot=preview.model_dump(mode="json"),
        applied_at=now_utc(),
        created_by=actor_id,
    )
    db.add(event)
    await db.flush()
    lookup = {item.module_slug: item for item in items}
    entries = await create_ledger_entries_for_preview(db, contract=contract, preview=preview, event=event, bill_run=None, item_lookup=lookup)
    document = await create_document_from_entries(db, contract=contract, entries=entries, actor_id=actor_id, notes="פתיחת חוזה")
    contract.next_renewal_at = cycle_bounds(contract, contract.start_date)[1] + timedelta(days=1)
    contract.updated_by = actor_id
    contract.updated_at = now_utc()
    return document


async def contract_documented_entries(db: AsyncSession, document_id: uuid.UUID) -> list[BillingLedgerEntry]:
    result = await db.execute(sa.select(BillingLedgerEntry).where(BillingLedgerEntry.document_id == document_id))
    return list(result.scalars().all())


def renewal_preview(contract: BillingContract, target_date: date, items: Sequence[BillingContractItem]) -> BillingChangePreviewOut:
    cycle_start = contract.next_renewal_at or target_date
    cycle_end = cycle_bounds(contract, cycle_start)[1]
    lines: list[BillingImpactLine] = []
    total = Decimal("0")
    for item in items:
        recurring = discount_amount(rate_contract_item(item), item.discount_pct)
        if recurring == 0:
            continue
        total += recurring
        lines.append(
            build_impact_line(
                entry_type="recurring",
                module_slug=item.module_slug,
                description=f"חידוש מחזור עבור {item.module_slug}",
                quantity=Decimal("1"),
                amount_ils=recurring,
                service_period_start=cycle_start,
                service_period_end=cycle_end,
            )
        )
    return BillingChangePreviewOut(
        event_type="start_contract",
        effective_at=cycle_start,
        bill_now_ils=round2(total),
        next_invoice_impact_ils=round2(total),
        credit_impact_ils=Decimal("0"),
        lines=lines,
    )
