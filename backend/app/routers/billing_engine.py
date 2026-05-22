from __future__ import annotations

import uuid
from datetime import date

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_enforced_tenant_id, CurrentUser, require_permission
from app.models.billing_engine import (
    BillingBillRun,
    BillingChangeEvent,
    BillingContract,
    BillingContractItem,
    BillingDocument,
    BillingLedgerEntry,
)
from app.schemas.billing_engine import (
    BillingBillRunCreate,
    BillingBillRunOut,
    BillingCancelContractRequest,
    BillingChangeApplyOut,
    BillingChangeRequest,
    BillingChangePreviewOut,
    BillingContractCreate,
    BillingContractItemOut,
    BillingContractListItem,
    BillingContractOut,
    BillingContractUpdate,
    BillingDocumentLineOut,
    BillingDocumentIssueCreditRequest,
    BillingDocumentListItem,
    BillingDocumentMarkPaidRequest,
    BillingDocumentOut,
    BillingPauseContractRequest,
)
from app.services.billing_engine import (
    build_initial_contract_entries,
    contract_documented_entries,
    create_document_from_entries,
    create_ledger_entries_for_preview,
    cycle_bounds,
    effective_contract_items,
    finalize_document,
    get_contract_item_or_404,
    get_contract_or_404,
    load_document_lines,
    now_utc,
    preview_change,
    refresh_contract_credit_balance,
    renewal_preview,
    tenant_name,
    to_decimal,
)

router = APIRouter(tags=["billing_engine"])


async def _serialize_contract(db: AsyncSession, contract: BillingContract) -> BillingContractOut:
    items = await effective_contract_items(db, contract.id, contract.next_renewal_at or contract.start_date)
    return BillingContractOut(
        id=contract.id,
        tenant_id=contract.tenant_id,
        status=contract.status,
        billing_cycle=contract.billing_cycle,
        anchor_day=contract.anchor_day,
        timezone=contract.timezone,
        payment_terms_days=contract.payment_terms_days,
        currency=contract.currency,
        credit_balance_ils=contract.credit_balance_ils,
        start_date=contract.start_date,
        end_date=contract.end_date,
        next_renewal_at=contract.next_renewal_at,
        items=[BillingContractItemOut.model_validate(item) for item in items],
        created_at=contract.created_at,
        updated_at=contract.updated_at,
    )


async def _serialize_document_list_item(db: AsyncSession, document: BillingDocument) -> BillingDocumentListItem:
    return BillingDocumentListItem(
        id=document.id,
        tenant_id=document.tenant_id,
        tenant_name=await tenant_name(db, document.tenant_id),
        contract_id=document.contract_id,
        document_type=document.document_type,
        status=document.status,
        document_number=document.document_number,
        issue_date=document.issue_date,
        due_date=document.due_date,
        total_ils=document.total_ils,
        paid_amount_ils=document.paid_amount_ils,
        created_at=document.created_at,
    )


async def _serialize_document(db: AsyncSession, document: BillingDocument) -> BillingDocumentOut:
    lines = await load_document_lines(db, document.id)
    return BillingDocumentOut(
        id=document.id,
        tenant_id=document.tenant_id,
        tenant_name=await tenant_name(db, document.tenant_id),
        contract_id=document.contract_id,
        document_type=document.document_type,
        status=document.status,
        document_number=document.document_number,
        issue_date=document.issue_date,
        due_date=document.due_date,
        subtotal_ils=document.subtotal_ils,
        discount_ils=document.discount_ils,
        credit_applied_ils=document.credit_applied_ils,
        vat_pct=document.vat_pct,
        vat_ils=document.vat_ils,
        total_ils=document.total_ils,
        paid_amount_ils=document.paid_amount_ils,
        notes=document.notes,
        payment_ref=document.payment_ref,
        paid_at=document.paid_at,
        created_at=document.created_at,
        updated_at=document.updated_at,
        lines=[BillingDocumentLineOut.model_validate(line) for line in lines],
    )


async def _find_effective_item(
    db: AsyncSession,
    contract_id: uuid.UUID,
    *,
    item_id: uuid.UUID | None,
    module_slug: str | None,
    effective_at: date,
) -> BillingContractItem | None:
    if item_id:
        return await get_contract_item_or_404(db, contract_id, item_id)
    if not module_slug:
        return None
    rows = await effective_contract_items(db, contract_id, effective_at)
    for row in rows:
        if row.module_slug == module_slug:
            return row
    return None


def _item_payload_from_request(body: BillingChangeRequest, item: BillingContractItem | None) -> dict:
    payload = {
        "module_slug": body.module_slug or (item.module_slug if item else None),
        "rating_model": body.rating_model or (item.rating_model if item else "flat"),
        "quantity": body.quantity if body.quantity is not None else (item.quantity if item else 0),
        "base_amount_ils": to_decimal(body.base_amount_ils if body.base_amount_ils is not None else (item.base_amount_ils if item else 0)),
        "included_qty": body.included_qty if body.included_qty is not None else (item.included_qty if item else 0),
        "per_unit_amount_ils": to_decimal(body.per_unit_amount_ils if body.per_unit_amount_ils is not None else (item.per_unit_amount_ils if item else 0)),
        "tier_definition": [row.model_dump(mode="json") for row in body.tier_definition] if body.tier_definition is not None else (item.tier_definition if item else None),
        "setup_fee_amount_ils": to_decimal(body.setup_fee_amount_ils if body.setup_fee_amount_ils is not None else (item.setup_fee_amount_ils if item else 0)),
        "discount_pct": to_decimal(body.discount_pct if body.discount_pct is not None else (item.discount_pct if item else 0)),
    }
    return payload


@router.get("/api/admin/billing/contracts", response_model=list[BillingContractListItem])
async def list_billing_contracts(
    tenant_id: uuid.UUID | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "view")),
):
    tenant_id = get_enforced_tenant_id(tenant_id, _)
    query = sa.select(BillingContract).order_by(BillingContract.created_at.desc())
    if tenant_id:
        query = query.where(BillingContract.tenant_id == tenant_id)
    if status_filter:
        query = query.where(BillingContract.status == status_filter)
    result = await db.execute(query)
    contracts = result.scalars().all()
    return [
        BillingContractListItem(
            id=contract.id,
            tenant_id=contract.tenant_id,
            tenant_name=await tenant_name(db, contract.tenant_id),
            status=contract.status,
            billing_cycle=contract.billing_cycle,
            next_renewal_at=contract.next_renewal_at,
            credit_balance_ils=contract.credit_balance_ils,
            currency=contract.currency,
        )
        for contract in contracts
    ]


@router.post("/api/admin/billing/contracts", response_model=BillingContractOut, status_code=status.HTTP_201_CREATED)
async def create_billing_contract(
    body: BillingContractCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("billing", "edit")),
):
    body.tenant_id = get_enforced_tenant_id(body.tenant_id, current_user)
    contract = BillingContract(
        tenant_id=body.tenant_id,
        status=body.status,
        billing_cycle=body.billing_cycle,
        anchor_day=body.anchor_day,
        timezone=body.timezone,
        payment_terms_days=body.payment_terms_days,
        currency=body.currency,
        start_date=body.start_date,
        end_date=body.end_date,
        next_renewal_at=body.start_date,
        created_by=current_user.id,
        updated_by=current_user.id,
        updated_at=now_utc(),
    )
    db.add(contract)
    await db.flush()
    created_items: list[BillingContractItem] = []
    for item in body.items:
        row = BillingContractItem(
            contract_id=contract.id,
            module_slug=item.module_slug,
            rating_model=item.rating_model,
            quantity=item.quantity,
            base_amount_ils=item.base_amount_ils,
            included_qty=item.included_qty,
            per_unit_amount_ils=item.per_unit_amount_ils,
            tier_definition=[entry.model_dump(mode="json") for entry in item.tier_definition] if item.tier_definition else None,
            setup_fee_amount_ils=item.setup_fee_amount_ils,
            discount_pct=item.discount_pct,
            effective_from=item.effective_from,
            effective_to=item.effective_to,
            created_by=current_user.id,
            updated_by=current_user.id,
            updated_at=now_utc(),
        )
        db.add(row)
        created_items.append(row)
    await db.flush()
    if contract.status == "active":
        await build_initial_contract_entries(db, contract=contract, items=created_items, actor_id=current_user.id)
    await db.commit()
    await db.refresh(contract)
    return await _serialize_contract(db, contract)


@router.get("/api/admin/billing/contracts/{contract_id}", response_model=BillingContractOut)
async def get_billing_contract(
    contract_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "view")),
):
    contract = await get_contract_or_404(db, contract_id)
    return await _serialize_contract(db, contract)


@router.put("/api/admin/billing/contracts/{contract_id}", response_model=BillingContractOut)
async def update_billing_contract(
    contract_id: uuid.UUID,
    body: BillingContractUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("billing", "edit")),
):
    contract = await get_contract_or_404(db, contract_id)
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(contract, key, value)
    contract.updated_by = current_user.id
    contract.updated_at = now_utc()
    await db.commit()
    await db.refresh(contract)
    return await _serialize_contract(db, contract)


@router.post("/api/admin/billing/contracts/{contract_id}/pause", response_model=BillingContractOut)
async def pause_billing_contract(
    contract_id: uuid.UUID,
    body: BillingPauseContractRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("billing", "edit")),
):
    contract = await get_contract_or_404(db, contract_id)
    contract.status = "paused"
    contract.end_date = body.end_date or contract.end_date
    contract.updated_by = current_user.id
    contract.updated_at = now_utc()
    await db.commit()
    await db.refresh(contract)
    return await _serialize_contract(db, contract)


@router.post("/api/admin/billing/contracts/{contract_id}/cancel", response_model=BillingContractOut)
async def cancel_billing_contract(
    contract_id: uuid.UUID,
    body: BillingCancelContractRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("billing", "edit")),
):
    contract = await get_contract_or_404(db, contract_id)
    preview = await preview_change(
        db,
        contract=contract,
        event_type="cancel_contract",
        effective_at=body.effective_at,
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
        event_type="cancel_contract",
        status="applied",
        effective_at=body.effective_at,
        payload={},
        preview_snapshot=preview.model_dump(mode="json"),
        created_by=current_user.id,
        applied_at=now_utc(),
    )
    db.add(event)
    await db.flush()
    items = await effective_contract_items(db, contract.id, body.effective_at)
    await create_ledger_entries_for_preview(
        db,
        contract=contract,
        preview=preview,
        event=event,
        bill_run=None,
        item_lookup={item.module_slug: item for item in items},
    )
    for item in items:
        if body.effective_at <= item.effective_from:
            item.status = "removed"
            item.effective_to = item.effective_from
        else:
            item.effective_to = body.effective_at - date.resolution
    contract.status = "cancelled"
    contract.end_date = body.effective_at - date.resolution
    contract.updated_by = current_user.id
    contract.updated_at = now_utc()
    await refresh_contract_credit_balance(db, contract.id)
    await db.commit()
    await db.refresh(contract)
    return await _serialize_contract(db, contract)


@router.post("/api/admin/billing/changes/preview", response_model=BillingChangePreviewOut)
async def preview_billing_change(
    body: BillingChangeRequest,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "view")),
):
    contract = await get_contract_or_404(db, body.contract_id)
    item = await _find_effective_item(db, contract.id, item_id=body.contract_item_id, module_slug=body.module_slug, effective_at=body.effective_at)
    payload = _item_payload_from_request(body, item)
    return await preview_change(
        db,
        contract=contract,
        event_type=body.event_type,
        effective_at=body.effective_at,
        item=item,
        module_slug=payload["module_slug"],
        quantity=payload["quantity"],
        rating_model=payload["rating_model"],
        base_amount_ils=payload["base_amount_ils"],
        included_qty=payload["included_qty"],
        per_unit_amount_ils=payload["per_unit_amount_ils"],
        tier_definition=payload["tier_definition"],
        setup_fee_amount_ils=payload["setup_fee_amount_ils"],
        discount_pct=payload["discount_pct"],
    )


@router.post("/api/admin/billing/changes/apply", response_model=BillingChangeApplyOut)
async def apply_billing_change(
    body: BillingChangeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("billing", "edit")),
):
    contract = await get_contract_or_404(db, body.contract_id)
    existing_event = None
    if body.idempotency_key:
        result = await db.execute(sa.select(BillingChangeEvent).where(BillingChangeEvent.idempotency_key == body.idempotency_key))
        existing_event = result.scalar_one_or_none()
    if existing_event:
        preview = BillingChangePreviewOut(**existing_event.preview_snapshot)
        await refresh_contract_credit_balance(db, contract.id)
        return BillingChangeApplyOut(
            event_id=existing_event.id,
            preview=preview,
            document_id=None,
            credit_balance_ils=contract.credit_balance_ils,
        )

    item = await _find_effective_item(db, contract.id, item_id=body.contract_item_id, module_slug=body.module_slug, effective_at=body.effective_at)
    payload = _item_payload_from_request(body, item)
    preview = await preview_change(
        db,
        contract=contract,
        event_type=body.event_type,
        effective_at=body.effective_at,
        item=item,
        module_slug=payload["module_slug"],
        quantity=payload["quantity"],
        rating_model=payload["rating_model"],
        base_amount_ils=payload["base_amount_ils"],
        included_qty=payload["included_qty"],
        per_unit_amount_ils=payload["per_unit_amount_ils"],
        tier_definition=payload["tier_definition"],
        setup_fee_amount_ils=payload["setup_fee_amount_ils"],
        discount_pct=payload["discount_pct"],
    )
    event = BillingChangeEvent(
        contract_id=contract.id,
        contract_item_id=item.id if item else None,
        tenant_id=contract.tenant_id,
        module_slug=payload["module_slug"],
        event_type=body.event_type,
        status="applied",
        effective_at=body.effective_at,
        payload={**payload, "notes": body.notes},
        preview_snapshot=preview.model_dump(mode="json"),
        idempotency_key=body.idempotency_key,
        applied_at=now_utc(),
        created_by=current_user.id,
    )
    db.add(event)
    await db.flush()

    item_lookup: dict[str, BillingContractItem] = {}
    if body.event_type == "add_module":
        new_item = BillingContractItem(
            contract_id=contract.id,
            module_slug=payload["module_slug"],
            rating_model=payload["rating_model"],
            quantity=payload["quantity"],
            base_amount_ils=payload["base_amount_ils"],
            included_qty=payload["included_qty"],
            per_unit_amount_ils=payload["per_unit_amount_ils"],
            tier_definition=payload["tier_definition"],
            setup_fee_amount_ils=payload["setup_fee_amount_ils"],
            discount_pct=payload["discount_pct"],
            effective_from=body.effective_at,
            created_by=current_user.id,
            updated_by=current_user.id,
            updated_at=now_utc(),
        )
        db.add(new_item)
        await db.flush()
        item_lookup[new_item.module_slug] = new_item
    elif body.event_type in {"change_quantity", "override_price"} and item is not None:
        if body.effective_at <= item.effective_from:
            item.quantity = payload["quantity"]
            item.rating_model = payload["rating_model"]
            item.base_amount_ils = payload["base_amount_ils"]
            item.included_qty = payload["included_qty"]
            item.per_unit_amount_ils = payload["per_unit_amount_ils"]
            item.tier_definition = payload["tier_definition"]
            item.setup_fee_amount_ils = payload["setup_fee_amount_ils"]
            item.discount_pct = payload["discount_pct"]
            item.updated_by = current_user.id
            item.updated_at = now_utc()
            item_lookup[item.module_slug] = item
        else:
            item.effective_to = body.effective_at - date.resolution
            item.updated_by = current_user.id
            item.updated_at = now_utc()
            new_item = BillingContractItem(
                contract_id=contract.id,
                module_slug=item.module_slug,
                rating_model=payload["rating_model"],
                quantity=payload["quantity"],
                base_amount_ils=payload["base_amount_ils"],
                included_qty=payload["included_qty"],
                per_unit_amount_ils=payload["per_unit_amount_ils"],
                tier_definition=payload["tier_definition"],
                setup_fee_amount_ils=payload["setup_fee_amount_ils"],
                discount_pct=payload["discount_pct"],
                effective_from=body.effective_at,
                created_by=current_user.id,
                updated_by=current_user.id,
                updated_at=now_utc(),
            )
            db.add(new_item)
            await db.flush()
            item_lookup[new_item.module_slug] = new_item
    elif body.event_type == "remove_module" and item is not None:
        if body.effective_at <= item.effective_from:
            item.status = "removed"
            item.effective_to = item.effective_from
        else:
            item.effective_to = body.effective_at - date.resolution
        item.updated_by = current_user.id
        item.updated_at = now_utc()
        item_lookup[item.module_slug] = item
    elif body.event_type == "cancel_contract":
        items = await effective_contract_items(db, contract.id, body.effective_at)
        for active_item in items:
            if body.effective_at <= active_item.effective_from:
                active_item.status = "removed"
                active_item.effective_to = active_item.effective_from
            else:
                active_item.effective_to = body.effective_at - date.resolution
            active_item.updated_by = current_user.id
            active_item.updated_at = now_utc()
            item_lookup[active_item.module_slug] = active_item
        contract.status = "cancelled"
        contract.end_date = body.effective_at - date.resolution
    if not item_lookup:
        items = await effective_contract_items(db, contract.id, body.effective_at)
        item_lookup = {entry.module_slug: entry for entry in items}
    entries = await create_ledger_entries_for_preview(
        db,
        contract=contract,
        preview=preview,
        event=event,
        bill_run=None,
        item_lookup=item_lookup,
    )
    document = await create_document_from_entries(
        db,
        contract=contract,
        entries=[entry for entry in entries if entry.net_amount_ils != 0],
        actor_id=current_user.id,
        notes=body.notes,
    )
    contract.updated_by = current_user.id
    contract.updated_at = now_utc()
    await db.commit()
    await db.refresh(contract)
    return BillingChangeApplyOut(
        event_id=event.id,
        preview=preview,
        document_id=document.id if document else None,
        credit_balance_ils=contract.credit_balance_ils,
    )


@router.post("/api/admin/billing/bill-runs", response_model=BillingBillRunOut, status_code=status.HTTP_201_CREATED)
async def create_billing_bill_run(
    body: BillingBillRunCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("billing", "edit")),
):
    if body.idempotency_key:
        existing = await db.execute(sa.select(BillingBillRun).where(BillingBillRun.idempotency_key == body.idempotency_key))
        row = existing.scalar_one_or_none()
        if row:
            return BillingBillRunOut.model_validate(row)
    run = BillingBillRun(
        contract_id=body.contract_id,
        run_type=body.run_type,
        target_date=body.target_date,
        status="pending",
        idempotency_key=body.idempotency_key,
        created_by=current_user.id,
    )
    db.add(run)
    await db.flush()

    query = sa.select(BillingContract).where(BillingContract.status == "active")
    if body.contract_id:
        query = query.where(BillingContract.id == body.contract_id)
    query = query.where(BillingContract.next_renewal_at.is_not(None)).where(BillingContract.next_renewal_at <= body.target_date)
    result = await db.execute(query.order_by(BillingContract.next_renewal_at))
    contracts = result.scalars().all()
    processed = 0
    created_entries = 0
    created_documents = 0
    for contract in contracts:
        items = await effective_contract_items(db, contract.id, contract.next_renewal_at or body.target_date)
        if not items:
            continue
        preview = renewal_preview(contract, body.target_date, items)
        entries = await create_ledger_entries_for_preview(
            db,
            contract=contract,
            preview=preview,
            event=None,
            bill_run=run,
            item_lookup={item.module_slug: item for item in items},
        )
        document = await create_document_from_entries(
            db,
            contract=contract,
            entries=entries,
            actor_id=current_user.id,
            bill_run_id=run.id,
            notes="ריצת חידוש",
        )
        cycle_end = cycle_bounds(contract, contract.next_renewal_at or body.target_date)[1]
        contract.next_renewal_at = cycle_end + date.resolution
        contract.updated_by = current_user.id
        contract.updated_at = now_utc()
        processed += 1
        created_entries += len(entries)
        created_documents += 1 if document else 0
    run.status = "completed"
    run.summary = {
        "contracts_processed": processed,
        "ledger_entries_created": created_entries,
        "documents_created": created_documents,
    }
    await db.commit()
    await db.refresh(run)
    return BillingBillRunOut.model_validate(run)


@router.get("/api/admin/billing/bill-runs", response_model=list[BillingBillRunOut])
async def list_billing_bill_runs(
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "view")),
):
    result = await db.execute(sa.select(BillingBillRun).order_by(BillingBillRun.created_at.desc()))
    return [BillingBillRunOut.model_validate(row) for row in result.scalars().all()]


@router.get("/api/admin/billing/documents", response_model=list[BillingDocumentListItem])
async def list_billing_documents(
    tenant_id: uuid.UUID | None = Query(None),
    contract_id: uuid.UUID | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "view")),
):
    tenant_id = get_enforced_tenant_id(tenant_id, _)
    query = sa.select(BillingDocument).order_by(BillingDocument.created_at.desc())
    if tenant_id:
        query = query.where(BillingDocument.tenant_id == tenant_id)
    if contract_id:
        query = query.where(BillingDocument.contract_id == contract_id)
    if status_filter:
        query = query.where(BillingDocument.status == status_filter)
    result = await db.execute(query)
    docs = result.scalars().all()
    return [await _serialize_document_list_item(db, doc) for doc in docs]


@router.get("/api/admin/billing/documents/{document_id}", response_model=BillingDocumentOut)
async def get_billing_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "view")),
):
    result = await db.execute(sa.select(BillingDocument).where(BillingDocument.id == document_id))
    document = result.scalar_one_or_none()
    if document is None:
        raise HTTPException(404, detail={"error": "Billing document not found", "code": "NOT_FOUND"})
    return await _serialize_document(db, document)


@router.post("/api/admin/billing/documents/{document_id}/finalize", response_model=BillingDocumentOut)
async def finalize_billing_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "edit")),
):
    result = await db.execute(sa.select(BillingDocument).where(BillingDocument.id == document_id))
    document = result.scalar_one_or_none()
    if document is None:
        raise HTTPException(404, detail={"error": "Billing document not found", "code": "NOT_FOUND"})
    await finalize_document(db, document)
    await db.commit()
    await db.refresh(document)
    return await _serialize_document(db, document)


@router.post("/api/admin/billing/documents/{document_id}/mark-paid", response_model=BillingDocumentOut)
async def mark_billing_document_paid(
    document_id: uuid.UUID,
    body: BillingDocumentMarkPaidRequest,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "edit")),
):
    result = await db.execute(sa.select(BillingDocument).where(BillingDocument.id == document_id))
    document = result.scalar_one_or_none()
    if document is None:
        raise HTTPException(404, detail={"error": "Billing document not found", "code": "NOT_FOUND"})
    if document.status not in ("issued", "overdue"):
        raise HTTPException(409, detail={"error": "Only issued documents can be marked paid", "code": "INVALID_STATUS"})
    document.status = "paid"
    document.paid_at = body.payment_date
    document.payment_ref = body.payment_ref
    document.paid_amount_ils = body.paid_amount_ils if body.paid_amount_ils is not None else document.total_ils
    await db.commit()
    await db.refresh(document)
    return await _serialize_document(db, document)


@router.post("/api/admin/billing/documents/{document_id}/void", response_model=BillingDocumentOut)
async def void_billing_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("billing", "edit")),
):
    result = await db.execute(sa.select(BillingDocument).where(BillingDocument.id == document_id))
    document = result.scalar_one_or_none()
    if document is None:
        raise HTTPException(404, detail={"error": "Billing document not found", "code": "NOT_FOUND"})
    if document.status == "paid":
        raise HTTPException(409, detail={"error": "Paid documents cannot be voided", "code": "INVALID_STATUS"})
    entries = await contract_documented_entries(db, document.id)
    for entry in entries:
        entry.document_id = None
        entry.status = "open"
    document.status = "void"
    if document.contract_id:
        await refresh_contract_credit_balance(db, document.contract_id)
    await db.commit()
    await db.refresh(document)
    return await _serialize_document(db, document)


@router.post("/api/admin/billing/documents/{document_id}/issue-credit", response_model=BillingDocumentOut)
async def issue_credit_note(
    document_id: uuid.UUID,
    body: BillingDocumentIssueCreditRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("billing", "edit")),
):
    result = await db.execute(sa.select(BillingDocument).where(BillingDocument.id == document_id))
    document = result.scalar_one_or_none()
    if document is None:
        raise HTTPException(404, detail={"error": "Billing document not found", "code": "NOT_FOUND"})
    if document.contract_id is None:
        raise HTTPException(409, detail={"error": "Cannot issue credit without contract context", "code": "INVALID_DOCUMENT"})
    contract = await get_contract_or_404(db, document.contract_id)
    entry = BillingLedgerEntry(
        contract_id=contract.id,
        tenant_id=contract.tenant_id,
        document_id=None,
        entry_type="credit",
        status="open",
        description=body.reason,
        quantity=1,
        unit_amount_ils=abs(body.amount_ils),
        gross_amount_ils=abs(body.amount_ils),
        discount_pct=0,
        net_amount_ils=-abs(body.amount_ils),
        metadata_json={"source_document_id": str(document.id)},
    )
    db.add(entry)
    await db.flush()
    credit_doc = await create_document_from_entries(
        db,
        contract=contract,
        entries=[entry],
        actor_id=current_user.id,
        notes=f"זיכוי עבור {document.document_number or document.id}",
    )
    if credit_doc is None:
        raise HTTPException(422, detail={"error": "Credit document was not created", "code": "CREDIT_CREATE_FAILED"})
    await db.commit()
    await db.refresh(credit_doc)
    return await _serialize_document(db, credit_doc)
