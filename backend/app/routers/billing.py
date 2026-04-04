"""
Billing router — charges & invoices management.

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
  POST /api/admin/billing/invoices/{id}/finalize   — draft → sent
  POST /api/admin/billing/invoices/{id}/mark-paid  — mark as paid

  GET  /api/admin/tenants/{tenant_id}/billing — tenant billing summary
"""
import uuid
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Iterable, Optional

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import require_admin, CurrentUser
from app.models.billing import BillingCharge, Invoice, InvoiceLine
from app.models.module import Module, ModulePrice, Package, PackageModule
from app.models.tenant import Tenant, TenantIdentity, TenantSubscription, TenantStatus
from app.schemas.billing import (
    BillingChargeCreate, BillingChargeOut, BillingChargeUpdate,
    GenerateChargesRequest, GenerateChargesResult,
    InvoiceCreate, InvoiceListItem, InvoiceOut, InvoiceUpdate,
    MarkPaidRequest, TenantBillingSummary,
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


def _period_label(period: str) -> tuple[str, str]:
    year_str, month_str = period.split("-")
    month_name = [
        "", "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
        "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
    ][int(month_str)]
    return year_str, month_name


async def _tenant_name(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    identity = await get_active(db, TenantIdentity, tenant_id)
    return identity.name_he if identity else str(tenant_id)


async def _module_name(db: AsyncSession, slug: str | None) -> str | None:
    if not slug:
        return None
    result = await db.execute(sa.select(Module.name).where(Module.slug == slug))
    return result.scalar_one_or_none()


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


# ─── Charges — Generate ───────────────────────────────────────────────────────

@router.post(
    "/api/admin/billing/charges/generate",
    response_model=GenerateChargesResult,
    status_code=status.HTTP_200_OK,
)
async def generate_charges(
    body: GenerateChargesRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin),
):
    """
    Auto-generate pricing charges for every active/trial tenant for a given
    billing period. Idempotent per (tenant, period, module, type).
    """
    today = date.today()
    period = body.billing_period
    period_start = _period_start(period)

    # ── Fetch tenants to process ──────────────────────────────────────────────
    if body.tenant_ids:
        t_result = await db.execute(
            sa.select(Tenant).where(Tenant.tenant_id.in_(body.tenant_ids))
        )
        tenants = t_result.scalars().all()
    else:
        # All tenants whose current status is active or trial
        t_result = await db.execute(sa.select(Tenant))
        tenants = t_result.scalars().all()

    created = 0
    skipped = 0
    processed = 0

    for tenant in tenants:
        # Skip tenants without active/trial status
        status_row = await get_active(db, TenantStatus, tenant.tenant_id)
        if not status_row or status_row.status not in ("active", "trial"):
            continue

        subscription = await get_active(db, TenantSubscription, tenant.tenant_id)
        if not subscription:
            continue

        module_slugs = list(subscription.selected_module_slugs or [])
        if not module_slugs:
            pkg_result = await db.execute(
                sa.select(PackageModule.module_slug)
                .join(Package, Package.id == PackageModule.package_id)
                .where(Package.slug == subscription.package_slug)
            )
            module_slugs = [row[0] for row in pkg_result.all()]

        if not module_slugs:
            continue

        processed += 1
        discount = subscription.discount_pct or Decimal("0")
        seat_count = max(subscription.seat_count or 0, 0)
        year_str, month_name = _period_label(period)

        for slug in module_slugs:
            price = await _get_active_module_price(db, slug, today)
            if not price:
                skipped += 1
                continue

            # Get module name for description
            mod_result = await db.execute(
                sa.select(Module.name).where(Module.slug == slug)
            )
            mod_name = mod_result.scalar_one_or_none() or slug

            if await _create_charge_if_missing(
                db=db,
                tenant_id=tenant.tenant_id,
                billing_period=period,
                charge_type="base_fee",
                module_slug=slug,
                description=f"דמי מנוי — {mod_name} — {month_name} {year_str}",
                quantity=Decimal("1"),
                unit_price_ils=price.base_price_ils,
                discount_pct=discount,
                current_user_id=current_user.id,
            ):
                created += 1
            else:
                skipped += 1

            billable_seats = max(seat_count - (price.included_seats or 0), 0)
            if price.per_seat_ils and price.per_seat_ils > 0 and billable_seats > 0:
                if await _create_charge_if_missing(
                    db=db,
                    tenant_id=tenant.tenant_id,
                    billing_period=period,
                    charge_type="per_seat",
                    module_slug=slug,
                    description=f"מושבים נוספים — {mod_name} — {month_name} {year_str}",
                    quantity=Decimal(str(billable_seats)),
                    unit_price_ils=price.per_seat_ils,
                    discount_pct=discount,
                    current_user_id=current_user.id,
                ):
                    created += 1
                else:
                    skipped += 1

            should_bill_setup = (
                price.setup_fee_ils
                and price.setup_fee_ils > 0
                and subscription.valid_from
                and subscription.valid_from <= period_start
            )
            if should_bill_setup:
                setup_exists = await db.execute(
                    sa.select(BillingCharge.id).where(
                        BillingCharge.tenant_id == tenant.tenant_id,
                        BillingCharge.module_slug == slug,
                        BillingCharge.charge_type == "setup_fee",
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
                        unit_price_ils=price.setup_fee_ils,
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
    _: CurrentUser = Depends(require_admin),
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
    current_user: CurrentUser = Depends(require_admin),
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
    _: CurrentUser = Depends(require_admin),
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
    _: CurrentUser = Depends(require_admin),
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
    _: CurrentUser = Depends(require_admin),
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
    _: CurrentUser = Depends(require_admin),
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
    current_user: CurrentUser = Depends(require_admin),
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
    _: CurrentUser = Depends(require_admin),
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
    _: CurrentUser = Depends(require_admin),
):
    result = await db.execute(sa.select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(404, detail={"error": "Invoice not found", "code": "NOT_FOUND"})
    if invoice.status in ("cancelled",):
        raise HTTPException(409, detail={"error": "לא ניתן לערוך חשבונית מבוטלת", "code": "INVOICE_CANCELLED"})

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
    _: CurrentUser = Depends(require_admin),
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
    _: CurrentUser = Depends(require_admin),
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


# ─── Tenant Billing Summary ────────────────────────────────────────────────────

@router.get(
    "/api/admin/tenants/{tenant_id}/billing",
    response_model=TenantBillingSummary,
)
async def get_tenant_billing(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
):
    # Verify tenant exists
    t_result = await db.execute(sa.select(Tenant).where(Tenant.tenant_id == tenant_id))
    if not t_result.scalar_one_or_none():
        raise HTTPException(404, detail={"error": "Tenant not found", "code": "NOT_FOUND"})

    charges_result = await db.execute(
        sa.select(BillingCharge)
        .where(BillingCharge.tenant_id == tenant_id)
        .order_by(BillingCharge.billing_period.desc(), BillingCharge.created_at.desc())
    )
    charges = charges_result.scalars().all()

    invoices_result = await db.execute(
        sa.select(Invoice)
        .where(Invoice.tenant_id == tenant_id)
        .order_by(Invoice.issue_date.desc())
    )
    invoices = invoices_result.scalars().all()

    charges_out = [await _enrich_charge(db, c) for c in charges]
    invoices_out = [await _enrich_invoice_list(db, inv) for inv in invoices]

    pending_total = _round2(_sum_decimal(
        c.amount_after_discount_ils for c in charges if c.status == "pending"
    ))
    invoiced_total = _round2(_sum_decimal(
        inv.total_ils for inv in invoices if inv.status not in ("cancelled",)
    ))
    paid_total = _round2(_sum_decimal(
        inv.total_ils for inv in invoices if inv.status == "paid"
    ))

    return TenantBillingSummary(
        charges=charges_out,
        invoices=invoices_out,
        pending_total_ils=pending_total,
        invoiced_total_ils=invoiced_total,
        paid_total_ils=paid_total,
    )
