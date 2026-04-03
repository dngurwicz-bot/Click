import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.middleware.auth import require_admin, CurrentUser
from app.models.tenant import (
    Tenant, TenantIdentity, TenantContact, TenantAddress,
    TenantSubscription, TenantStatus,
)
from app.schemas.tenant import (
    TenantCreateRequest, TenantUpdateRequest, TenantOut,
    TenantListItem, TenantIdentityOut, TenantContactOut,
    TenantAddressOut, TenantSubscriptionOut, TenantStatusOut,
)
from app.services.temporal import (
    close_and_create, get_active, get_history, update_in_place,
    check_date_overlap, kabiya, delete_specific_row, close_active_row,
)

router = APIRouter(prefix="/api/admin/tenants", tags=["tenants"])


async def _build_tenant_out(tenant: Tenant, db: AsyncSession) -> TenantOut:
    identity = await get_active(db, TenantIdentity, tenant.tenant_id)
    contact = await get_active(db, TenantContact, tenant.tenant_id)
    address = await get_active(db, TenantAddress, tenant.tenant_id)
    subscription = await get_active(db, TenantSubscription, tenant.tenant_id)
    status_row = await get_active(db, TenantStatus, tenant.tenant_id)

    return TenantOut(
        tenant_id=tenant.tenant_id,
        org_number=tenant.org_number,
        created_at=tenant.created_at,
        identity=TenantIdentityOut.model_validate(identity) if identity else None,
        contact=TenantContactOut.model_validate(contact) if contact else None,
        address=TenantAddressOut.model_validate(address) if address else None,
        subscription=TenantSubscriptionOut.model_validate(subscription) if subscription else None,
        status=TenantStatusOut.model_validate(status_row) if status_row else None,
    )


@router.get("", response_model=list[TenantListItem])
async def list_tenants(
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
):
    result = await db.execute(select(Tenant).order_by(Tenant.created_at.desc()))
    tenants = result.scalars().all()

    items = []
    for tenant in tenants:
        identity = await get_active(db, TenantIdentity, tenant.tenant_id)
        status_row = await get_active(db, TenantStatus, tenant.tenant_id)
        subscription = await get_active(db, TenantSubscription, tenant.tenant_id)
        items.append(TenantListItem(
            tenant_id=tenant.tenant_id,
            org_number=tenant.org_number,
            name_he=identity.name_he if identity else "—",
            status=status_row.status if status_row else "unknown",
            package_slug=subscription.package_slug if subscription else "—",
            created_at=tenant.created_at,
        ))
    return items


@router.post("", response_model=TenantOut, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    body: TenantCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin),
):
    today = date.today()

    # Create the anchor tenant row
    tenant = Tenant()
    db.add(tenant)
    await db.flush()

    actor = current_user.id

    # Insert all temporal sub-tables in one transaction
    db.add(TenantIdentity(
        **body.identity.model_dump(),
        tenant_id=tenant.tenant_id,
        valid_from=today,
        created_by=actor,
    ))
    db.add(TenantContact(
        **body.contact.model_dump(),
        tenant_id=tenant.tenant_id,
        valid_from=today,
        created_by=actor,
    ))
    db.add(TenantAddress(
        **body.address.model_dump(),
        tenant_id=tenant.tenant_id,
        valid_from=today,
        created_by=actor,
    ))
    db.add(TenantSubscription(
        **body.subscription.model_dump(),
        tenant_id=tenant.tenant_id,
        valid_from=today,
        created_by=actor,
    ))
    db.add(TenantStatus(
        **body.status.model_dump(),
        tenant_id=tenant.tenant_id,
        valid_from=today,
        created_by=actor,
    ))

    await db.commit()
    await db.refresh(tenant)
    return await _build_tenant_out(tenant, db)


@router.get("/{tenant_id}", response_model=TenantOut)
async def get_tenant(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
):
    result = await db.execute(select(Tenant).where(Tenant.tenant_id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail={"error": "Tenant not found", "code": "NOT_FOUND"})
    return await _build_tenant_out(tenant, db)


@router.put("/{tenant_id}", response_model=TenantOut)
async def update_tenant(
    tenant_id: uuid.UUID,
    body: TenantUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin),
):
    result = await db.execute(select(Tenant).where(Tenant.tenant_id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail={"error": "Tenant not found", "code": "NOT_FOUND"})

    actor = current_user.id

    async def _maybe_update(model, new_data_obj, schema_out, extra_filter_key: str | None = None):
        if not new_data_obj:
            return
        new_data = new_data_obj.model_dump()
        extra_filters = {extra_filter_key: new_data[extra_filter_key]} if extra_filter_key else None

        # ── Action '2': עדכון ────────────────────────────────────────────
        # Case 2.1 — row found at this valid_from → update fields in-place, no history
        # Case 2.2 — no row at this valid_from → close current + create new (history)
        if body.action == "update":
            if body.valid_from:
                # Find the row the user actually edited (by valid_from key)
                res = await db.execute(
                    select(model)
                    .where(model.tenant_id == tenant_id)
                    .where(model.valid_from == body.valid_from)
                    .limit(1)
                )
                target = res.scalar_one_or_none()
                if target:
                    # Case 2.1 — row found at this date, update its fields in-place
                    current_data = schema_out.model_validate(target).model_dump(
                        exclude={"id", "tenant_id", "valid_from", "valid_to", "created_at"}
                    )
                    new_valid_to_arg = body.valid_to  # May be None (= clear end date) or a date
                    if current_data != new_data or target.valid_to != body.valid_to:
                        await update_in_place(
                            db, model, tenant_id, new_data, None,
                            target_valid_from=body.valid_from,
                            new_valid_to=new_valid_to_arg,
                            extra_filters=extra_filters,
                        )
                else:
                    # Case 2.2 — no row at this date, close the active row and open new period
                    current = await get_active(db, model, tenant_id, extra_filters=extra_filters)
                    if current:
                        await close_and_create(
                            db, model, tenant_id, new_data, actor,
                            new_valid_from=body.valid_from,
                            new_valid_to=body.valid_to,
                            extra_filters=extra_filters,
                        )
                    else:
                        await close_and_create(
                            db, model, tenant_id, new_data, actor,
                            new_valid_from=body.valid_from,
                            new_valid_to=body.valid_to,
                            extra_filters=extra_filters,
                        )
            else:
                # No valid_from provided → operate on active row
                current = await get_active(db, model, tenant_id, extra_filters=extra_filters)
                if current:
                    current_data = schema_out.model_validate(current).model_dump(
                        exclude={"id", "tenant_id", "valid_from", "valid_to", "created_at"}
                    )
                    if current_data != new_data or current.valid_to != body.valid_to:
                        await update_in_place(
                            db, model, tenant_id, new_data, None,
                            target_valid_from=current.valid_from,
                            new_valid_to=body.valid_to,
                            extra_filters=extra_filters,
                        )
                else:
                    await close_and_create(
                        db, model, tenant_id, new_data, actor,
                        new_valid_from=date.today(),
                        new_valid_to=body.valid_to,
                        extra_filters=extra_filters,
                    )

        # ── Action 'הוסף': הוסף — allowed ONLY when no active row exists (per type) ─
        elif body.action == "add":
            current = await get_active(db, model, tenant_id, extra_filters=extra_filters)
            if current is not None:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "error": "לא ניתן להוסיף רשומה חדשה כשקיימת רשומה פעילה — "
                                 "השתמש בשמור עם תאריך חדש כדי לפתוח תקופה חדשה.",
                        "code": "ACTIVE_ROW_EXISTS",
                    }
                )
            effective_from = body.valid_from or date.today()
            overlaps, conflict = await check_date_overlap(db, model, tenant_id, effective_from, extra_filters=extra_filters)
            if overlaps:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "error": f"תאריך {effective_from} נמצא בטווח רשומה קיימת "
                                 f"({conflict.valid_from} – {conflict.valid_to})",
                        "code": "DATE_OVERLAP",
                    }
                )
            await close_and_create(
                db, model, tenant_id, new_data, actor,
                new_valid_from=effective_from,
                new_valid_to=body.valid_to,
                extra_filters=extra_filters,
            )

        # ── Action '4': קביעה — overwrite overlapping records in period ──
        elif body.action == "set":
            if not body.valid_from:
                raise HTTPException(
                    status_code=422,
                    detail={"error": "קביעה דורשת תאריך תחילה", "code": "MISSING_DATE"}
                )
            await kabiya(
                db, model, tenant_id, new_data, actor,
                new_valid_from=body.valid_from,
                new_valid_to=body.valid_to,
                extra_filters=extra_filters,
            )

        # ── Action '3a': ביטול מחיקה — hard-delete a specific row ────────
        elif body.action == "delete":
            if not body.valid_from:
                raise HTTPException(
                    status_code=422,
                    detail={"error": "ביטול מחיקה דורש תאריך התחלה לזיהוי השורה", "code": "MISSING_DATE"}
                )
            await delete_specific_row(db, model, tenant_id, body.valid_from)

        # ── Action '3b': ביטול גמר תוקף — close the active row ──────────
        elif body.action == "close":
            if not body.valid_to:
                raise HTTPException(
                    status_code=422,
                    detail={"error": "סגירת תקופה דורשת תאריך גמר תוקף", "code": "MISSING_DATE"}
                )
            current = await get_active(db, model, tenant_id, extra_filters=extra_filters)
            if current is None:
                raise HTTPException(
                    status_code=409,
                    detail={"error": "אין שורה פעילה לסגירה", "code": "NO_ACTIVE_ROW"}
                )
            if body.valid_to < current.valid_from:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "error": f"תאריך גמר תוקף ({body.valid_to}) לא יכול להיות לפני תאריך תחילת השורה הפעילה ({current.valid_from})",
                        "code": "INVALID_DATE",
                    }
                )
            await close_active_row(db, model, tenant_id, body.valid_to, extra_filters=extra_filters)

    await _maybe_update(TenantIdentity, body.identity, TenantIdentityOut)
    await _maybe_update(TenantContact, body.contact, TenantContactOut, extra_filter_key="contact_type")
    await _maybe_update(TenantAddress, body.address, TenantAddressOut)
    await _maybe_update(TenantSubscription, body.subscription, TenantSubscriptionOut)
    await _maybe_update(TenantStatus, body.status, TenantStatusOut)

    await db.commit()
    return await _build_tenant_out(tenant, db)


@router.get("/{tenant_id}/history")
async def get_tenant_history(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
):
    result = await db.execute(select(Tenant).where(Tenant.tenant_id == tenant_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail={"error": "Tenant not found", "code": "NOT_FOUND"})

    return {
        "identity": [TenantIdentityOut.model_validate(r) for r in await get_history(db, TenantIdentity, tenant_id)],
        "contact": [TenantContactOut.model_validate(r) for r in await get_history(db, TenantContact, tenant_id)],
        "address": [TenantAddressOut.model_validate(r) for r in await get_history(db, TenantAddress, tenant_id)],
        "subscription": [TenantSubscriptionOut.model_validate(r) for r in await get_history(db, TenantSubscription, tenant_id)],
        "status": [TenantStatusOut.model_validate(r) for r in await get_history(db, TenantStatus, tenant_id)],
    }
