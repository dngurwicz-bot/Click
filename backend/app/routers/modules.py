import uuid
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete

from app.database import get_db
from app.middleware.auth import require_super_admin, CurrentUser
from app.models.module import Module, ModulePrice
from app.schemas.module import (
    ModuleWithPrice, ModuleWithHistory, ModulePriceOut,
    ModulePriceActionBody,
    ModuleCreate, ModuleUpdate, ModuleOut,
)

router = APIRouter(prefix="/api/admin/modules", tags=["modules"])


@router.get("", response_model=list[ModuleWithPrice])
async def list_modules(
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_super_admin),
):
    result = await db.execute(select(Module).order_by(Module.sort_order))
    modules = result.scalars().all()

    items = []
    for module in modules:
        price_result = await db.execute(
            select(ModulePrice)
            .where(ModulePrice.module_slug == module.slug)
            .where(ModulePrice.valid_to.is_(None))
            .limit(1)
        )
        current_price = price_result.scalar_one_or_none()
        item = ModuleWithPrice.model_validate(module)
        item.current_price = ModulePriceOut.model_validate(current_price) if current_price else None
        items.append(item)

    return items


@router.post("", response_model=ModuleOut, status_code=201)
async def create_module(
    body: ModuleCreate,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_super_admin),
):
    existing = await db.execute(select(Module).where(Module.slug == body.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail={"error": "Slug already exists", "code": "SLUG_EXISTS"})

    new_module = Module(
        slug=body.slug,
        name=body.name,
        description=body.description,
        icon=body.icon,
        color_hex=body.color_hex,
        is_required=body.is_required,
        is_active=body.is_active,
        sort_order=body.sort_order,
        depends_on=[],
    )
    db.add(new_module)
    await db.commit()
    await db.refresh(new_module)
    return ModuleOut.model_validate(new_module)


@router.put("/{slug}", response_model=ModuleOut)
async def update_module(
    slug: str,
    body: ModuleUpdate,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_super_admin),
):
    result = await db.execute(select(Module).where(Module.slug == slug))
    module = result.scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail={"error": "Module not found", "code": "NOT_FOUND"})

    module.name        = body.name
    module.description = body.description
    module.icon        = body.icon
    module.color_hex   = body.color_hex
    module.is_required = body.is_required
    module.is_active   = body.is_active
    module.sort_order  = body.sort_order

    await db.commit()
    await db.refresh(module)
    return ModuleOut.model_validate(module)


@router.delete("/{slug}")
async def delete_module(
    slug: str,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_super_admin),
):
    result = await db.execute(select(Module).where(Module.slug == slug))
    module = result.scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail={"error": "Module not found", "code": "NOT_FOUND"})

    await db.execute(delete(ModulePrice).where(ModulePrice.module_slug == slug))
    await db.execute(delete(Module).where(Module.slug == slug))
    await db.commit()
    return {"ok": True}


@router.get("/{slug}", response_model=ModuleWithHistory)
async def get_module(
    slug: str,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_super_admin),
):
    result = await db.execute(select(Module).where(Module.slug == slug))
    module = result.scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail={"error": "Module not found", "code": "NOT_FOUND"})

    prices_result = await db.execute(
        select(ModulePrice)
        .where(ModulePrice.module_slug == slug)
        .order_by(ModulePrice.valid_from.desc())
    )
    prices = prices_result.scalars().all()

    item = ModuleWithHistory.model_validate(module)
    item.price_history = [ModulePriceOut.model_validate(p) for p in prices]
    item.current_price = next((ModulePriceOut.model_validate(p) for p in prices if p.valid_to is None), None)
    return item


@router.put("/{slug}/price")
async def update_module_price(
    slug: str,
    body: ModulePriceActionBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_super_admin),
):
    """Temporal price management — 5 actions matching the Hilan/tenant pattern."""
    result = await db.execute(select(Module).where(Module.slug == slug))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail={"error": "Module not found", "code": "NOT_FOUND"})

    action = body.action or "add"

    # ── General date-range validation ─────────────────────────────────────────
    if body.valid_from and body.valid_to and body.valid_to < body.valid_from:
        raise HTTPException(
            status_code=422,
            detail={"error": "תאריך גמר תוקף לא יכול להיות לפני תאריך תחילה", "code": "INVALID_DATE_RANGE"},
        )

    # ── Helper: fetch active row as plain tuple (no ORM identity map) ─────────
    async def get_active_row() -> tuple | None:
        """Returns (id, valid_from, valid_to) or None — plain Row, not ORM object."""
        r = await db.execute(
            select(ModulePrice.id, ModulePrice.valid_from, ModulePrice.valid_to)
            .where(ModulePrice.module_slug == slug)
            .where(ModulePrice.valid_to.is_(None))
            .limit(1)
        )
        return r.one_or_none()

    # ── Action: מחק שורה — hard-delete a specific row by valid_from ───────────
    if action == "delete":
        if not body.valid_from:
            raise HTTPException(
                status_code=422,
                detail={"error": "מחיקה דורשת תאריך תחילה לזיהוי השורה", "code": "MISSING_DATE"},
            )
        await db.execute(
            delete(ModulePrice)
            .where(ModulePrice.module_slug == slug)
            .where(ModulePrice.valid_from == body.valid_from)
            .execution_options(synchronize_session=False)
        )
        await db.commit()
        return {"ok": True, "action": "delete"}

    # ── Action: סגור תקופה — set valid_to on the active row ──────────────────
    if action == "close":
        if not body.valid_to:
            raise HTTPException(
                status_code=422,
                detail={"error": "סגירת תקופה דורשת תאריך גמר תוקף", "code": "MISSING_DATE"},
            )
        active_row = await get_active_row()
        if active_row is None:
            raise HTTPException(
                status_code=409,
                detail={"error": "אין שורה פעילה לסגירה", "code": "NO_ACTIVE_ROW"},
            )
        active_valid_from = active_row[1]
        if body.valid_to < active_valid_from:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": f"תאריך סגירה ({body.valid_to}) לא יכול להיות לפני תאריך תחילת השורה הפעילה ({active_valid_from})",
                    "code": "INVALID_DATE",
                },
            )
        await db.execute(
            update(ModulePrice)
            .where(ModulePrice.module_slug == slug)
            .where(ModulePrice.valid_to.is_(None))
            .values(valid_to=body.valid_to)
            .execution_options(synchronize_session=False)
        )
        await db.commit()
        return {"ok": True, "action": "close"}

    # ── Action: עדכון ─────────────────────────────────────────────────────────
    # • same valid_from  → update values in-place
    # • new  valid_from  → close original row (valid_to = new_from - 1) + insert new row
    if action == "update":
        if not body.price_id:
            raise HTTPException(
                status_code=422,
                detail={"error": "עדכון דורש מזהה שורה (price_id)", "code": "MISSING_ID"},
            )
        if not body.valid_from:
            raise HTTPException(
                status_code=422,
                detail={"error": "עדכון דורש תאריך תחילה", "code": "MISSING_DATE"},
            )

        # Load original row as plain tuple (avoid ORM identity map)
        orig_res = await db.execute(
            select(ModulePrice.id, ModulePrice.valid_from, ModulePrice.valid_to)
            .where(ModulePrice.id == body.price_id)
            .where(ModulePrice.module_slug == slug)
        )
        orig = orig_res.one_or_none()
        if orig is None:
            raise HTTPException(status_code=404, detail={"error": "שורה לא נמצאה", "code": "NOT_FOUND"})

        date_changed = orig.valid_from != body.valid_from

        if not date_changed:
            # ── Simple in-place update ──────────────────────────────────────
            await db.execute(
                update(ModulePrice)
                .where(ModulePrice.id == body.price_id)
                .values(
                    base_price_ils=body.base_price_ils,
                    per_seat_ils=body.per_seat_ils,
                    included_seats=body.included_seats,
                    setup_fee_ils=body.setup_fee_ils,
                    valid_to=body.valid_to,
                )
                .execution_options(synchronize_session=False)
            )
            await db.commit()
            row_res = await db.execute(
                select(ModulePrice).where(ModulePrice.id == body.price_id).limit(1)
            )
            updated = row_res.scalar_one_or_none()
            if updated:
                return ModulePriceOut.model_validate(updated)
            return {"ok": True, "action": "update"}

        else:
            # ── Date changed: close original row + insert new row ───────────
            close_to = body.valid_from - timedelta(days=1)
            await db.execute(
                update(ModulePrice)
                .where(ModulePrice.id == body.price_id)
                .values(valid_to=close_to)
                .execution_options(synchronize_session=False)
            )
            new_row = ModulePrice(
                module_slug=slug,
                base_price_ils=body.base_price_ils,
                per_seat_ils=body.per_seat_ils,
                included_seats=body.included_seats,
                setup_fee_ils=body.setup_fee_ils,
                valid_from=body.valid_from,
                valid_to=body.valid_to,
                created_by=current_user.id,
            )
            db.add(new_row)
            await db.flush()
            await db.refresh(new_row)
            await db.commit()
            return ModulePriceOut.model_validate(new_row)

    # ── Action: הוסף — insert new period (no active row allowed) ─────────────
    if action == "add":
        if not body.valid_from:
            raise HTTPException(
                status_code=422,
                detail={"error": "הוספה דורשת תאריך תחילת תוקף", "code": "MISSING_DATE"},
            )
        active_row = await get_active_row()
        if active_row is not None:
            raise HTTPException(
                status_code=409,
                detail={"error": "קיימת רשומה פעילה — השתמש בשמור עם תאריך חדש", "code": "ACTIVE_ROW_EXISTS"},
            )
        new_price = ModulePrice(
            module_slug=slug,
            base_price_ils=body.base_price_ils,
            per_seat_ils=body.per_seat_ils,
            included_seats=body.included_seats,
            setup_fee_ils=body.setup_fee_ils,
            valid_from=body.valid_from,
            valid_to=body.valid_to,
            created_by=current_user.id,
        )
        db.add(new_price)
        await db.flush()
        await db.refresh(new_price)
        await db.commit()
        return ModulePriceOut.model_validate(new_price)

    # ── Action: קבע תקופה — kabiya ────────────────────────────────────────────
    # Uses PURE Core SQL row loading (plain tuples, NOT ORM objects) to completely
    # avoid the SQLAlchemy identity map — this is the root cause fix.
    # Without this, scalars().all() loads ORM objects into the identity map; later
    # Core SQL deletes bypass the ORM unit-of-work, so those objects remain in the
    # identity map as "persistent" and can be re-flushed or cause constraint errors
    # when flush() is called to insert the new record.
    if action == "set":
        if not body.valid_from:
            raise HTTPException(
                status_code=422,
                detail={"error": "קביעה דורשת תאריך תחילה", "code": "MISSING_DATE"},
            )
        new_from: date      = body.valid_from
        new_to:   date | None = body.valid_to

        # Load as plain Row tuples — NO ORM objects enter the identity map
        prices_res = await db.execute(
            select(
                ModulePrice.id,
                ModulePrice.valid_from,
                ModulePrice.valid_to,
                ModulePrice.base_price_ils,
                ModulePrice.per_seat_ils,
                ModulePrice.included_seats,
                ModulePrice.setup_fee_ils,
            )
            .where(ModulePrice.module_slug == slug)
            .order_by(ModulePrice.valid_from)
        )
        existing = prices_res.all()  # list of plain Row namedtuples, NOT ORM objects

        for row in existing:
            rec_id    = row.id
            rec_from: date      = row.valid_from
            rec_to:   date | None = row.valid_to

            # ── Completely BEFORE new period → keep (historical record) ───
            if rec_to is not None and rec_to < new_from:
                continue  # untouched — preserve history

            # ── Completely AFTER new period (only when new period has end) ─
            if new_to is not None and rec_from > new_to:
                continue  # untouched

            # ── Overlapping ────────────────────────────────────────────────
            starts_before = rec_from < new_from
            ends_after    = new_to is not None and (rec_to is None or rec_to > new_to)

            if starts_before and ends_after:
                # SPLIT: right half keeps original data; left half trimmed
                right = ModulePrice(
                    module_slug    = slug,
                    valid_from     = new_to + timedelta(days=1),  # type: ignore[operator]
                    valid_to       = rec_to,
                    base_price_ils = row.base_price_ils,
                    per_seat_ils   = row.per_seat_ils,
                    included_seats = row.included_seats,
                    setup_fee_ils  = row.setup_fee_ils,
                    created_by     = current_user.id,
                )
                db.add(right)
                await db.execute(
                    update(ModulePrice)
                    .where(ModulePrice.id == rec_id)
                    .values(valid_to=new_from - timedelta(days=1))
                    .execution_options(synchronize_session=False)
                )

            elif starts_before:
                # LEFT TRIM
                await db.execute(
                    update(ModulePrice)
                    .where(ModulePrice.id == rec_id)
                    .values(valid_to=new_from - timedelta(days=1))
                    .execution_options(synchronize_session=False)
                )

            elif ends_after:
                # RIGHT PUSH
                await db.execute(
                    update(ModulePrice)
                    .where(ModulePrice.id == rec_id)
                    .values(valid_from=new_to + timedelta(days=1))  # type: ignore[operator]
                    .execution_options(synchronize_session=False)
                )

            else:
                # COMPLETELY WITHIN new period → delete
                await db.execute(
                    delete(ModulePrice)
                    .where(ModulePrice.id == rec_id)
                    .execution_options(synchronize_session=False)
                )

        # Insert the new record
        new_price = ModulePrice(
            module_slug    = slug,
            base_price_ils = body.base_price_ils,
            per_seat_ils   = body.per_seat_ils,
            included_seats = body.included_seats,
            setup_fee_ils  = body.setup_fee_ils,
            valid_from     = new_from,
            valid_to       = new_to,
            created_by     = current_user.id,
        )
        db.add(new_price)
        await db.flush()
        await db.refresh(new_price)
        await db.commit()
        return ModulePriceOut.model_validate(new_price)

    raise HTTPException(
        status_code=422,
        detail={"error": f"פעולה לא מוכרת: {action}", "code": "UNKNOWN_ACTION"},
    )
