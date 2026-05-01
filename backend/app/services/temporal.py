"""
Temporal data service.
All mutable data is append-only: closing the current row and inserting a new one.
"""
from datetime import date, datetime, timedelta, timezone
import uuid
from typing import Any, Type
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, inspect as sa_inspect

_UNSET = object()


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _with_update_audit(model: Type, values: dict[str, Any], actor_id: uuid.UUID | None) -> dict[str, Any]:
    if actor_id is None:
        return values
    if hasattr(model, "updated_at"):
        values["updated_at"] = _now_utc()
    if hasattr(model, "updated_by"):
        values["updated_by"] = actor_id
    return values


def _apply_extra_filters(stmt: Any, model: Type, extra_filters: dict[str, Any] | None) -> Any:
    """Apply additional WHERE conditions (e.g. contact_type='main') to a statement."""
    if extra_filters:
        for key, value in extra_filters.items():
            stmt = stmt.where(getattr(model, key) == value)
    return stmt


async def close_and_create(
    session: AsyncSession,
    model: Type,
    tenant_id: uuid.UUID,
    new_data: dict[str, Any],
    actor_id: uuid.UUID,
    new_valid_from: date | None = None,
    new_valid_to: date | None = None,
    extra_filters: dict[str, Any] | None = None,
) -> Any:
    """
    Close the currently-active row for the given tenant and model, then insert
    a new row with valid_from = new_valid_from (or today if not provided).

    Returns the newly created row.
    """
    today = date.today()
    from_date = new_valid_from or today
    # Always close the previous row the day before the new row starts
    close_date = from_date - timedelta(days=1)

    close_stmt = (
        update(model)
        .where(model.tenant_id == tenant_id)  # type: ignore[attr-defined]
        .where(model.valid_to.is_(None))       # type: ignore[attr-defined]
    )
    close_stmt = _apply_extra_filters(close_stmt, model, extra_filters)
    await session.execute(close_stmt.values(**_with_update_audit(model, {"valid_to": close_date}, actor_id)))

    new_row = model(
        **new_data,
        tenant_id=tenant_id,
        valid_from=from_date,
        valid_to=new_valid_to,
        created_by=actor_id,
    )
    session.add(new_row)
    await session.flush()
    await session.refresh(new_row)
    return new_row


async def update_in_place(
    session: AsyncSession,
    model: Type,
    tenant_id: uuid.UUID,
    new_data: dict[str, Any],
    actor_id: uuid.UUID | None,
    new_valid_from: date | None = None,
    *,
    target_valid_from: date | None = None,
    new_valid_to: Any = _UNSET,
    extra_filters: dict[str, Any] | None = None,
) -> None:
    """Update the current active row's fields and/or valid_from in-place (no new row created).

    If target_valid_from is given, filter WHERE valid_from == target_valid_from instead of
    WHERE valid_to IS NULL.

    If new_valid_to is provided (including None to clear the end date), it is included in
    the update. If new_valid_to is left as the _UNSET sentinel, valid_to is not touched.
    """
    update_dict = {**new_data}
    if new_valid_from:
        update_dict['valid_from'] = new_valid_from
    if new_valid_to is not _UNSET:
        update_dict['valid_to'] = new_valid_to
    update_dict = _with_update_audit(model, update_dict, actor_id)

    stmt = update(model).where(model.tenant_id == tenant_id)  # type: ignore[attr-defined]
    if target_valid_from is not None:
        stmt = stmt.where(model.valid_from == target_valid_from)  # type: ignore[attr-defined]
    else:
        stmt = stmt.where(model.valid_to.is_(None))  # type: ignore[attr-defined]
    stmt = _apply_extra_filters(stmt, model, extra_filters)

    await session.execute(stmt.values(**update_dict))


async def check_date_overlap(
    session: AsyncSession,
    model: Type,
    tenant_id: uuid.UUID,
    new_valid_from: date,
    extra_filters: dict[str, Any] | None = None,
) -> tuple[bool, Any]:
    """
    Returns (True, conflicting_row) if new_valid_from falls within any existing
    CLOSED period for this tenant. Active rows (valid_to IS NULL) are excluded
    because they will be superseded by close_and_create.
    """
    stmt = (
        select(model)
        .where(model.tenant_id == tenant_id)   # type: ignore[attr-defined]
        .where(model.valid_to.is_not(None))     # type: ignore[attr-defined]
        .where(model.valid_from <= new_valid_from)  # type: ignore[attr-defined]
        .where(model.valid_to >= new_valid_from)    # type: ignore[attr-defined]
    )
    stmt = _apply_extra_filters(stmt, model, extra_filters)
    result = await session.execute(stmt.limit(1))
    row = result.scalar_one_or_none()
    return (row is not None, row)


async def kabiya(
    session: AsyncSession,
    model: Type,
    tenant_id: uuid.UUID,
    new_data: dict[str, Any],
    actor_id: uuid.UUID,
    new_valid_from: date,
    new_valid_to: date | None = None,
    extra_filters: dict[str, Any] | None = None,
) -> Any:
    """
    Action '4' (קביעה) — set data for a period, overwriting ALL overlapping records:

    • Records entirely within [new_valid_from, new_valid_to]  → deleted
    • Records that START before and END after (contain new period) → SPLIT into two:
        left part  keeps original data with valid_to  = new_valid_from - 1
        right part keeps original data with valid_from = new_valid_to  + 1
    • Records overlapping the LEFT boundary (start before, end inside) → trimmed:
        valid_to = new_valid_from - 1
    • Records overlapping the RIGHT boundary (start inside, end after) → pushed:
        valid_from = new_valid_to + 1
    • Records completely outside the period (right side only) → untouched
    • Records entirely BEFORE the period → deleted (overwrite backward)

    When new_valid_to is None the new period extends to infinity, so there is no
    right boundary and no split / right-push is possible.
    """

    def _copy_fields(rec: Any) -> dict[str, Any]:
        """Extract only the data fields from an existing row (no system keys)."""
        exclude = {"id", "tenant_id", "valid_from", "valid_to", "created_at", "created_by"}
        mapper = sa_inspect(type(rec))
        return {
            col.key: getattr(rec, col.key)
            for col in mapper.column_attrs   # type: ignore[union-attr]
            if col.key not in exclude
        }

    kabiya_stmt = (
        select(model)
        .where(model.tenant_id == tenant_id)   # type: ignore[attr-defined]
        .order_by(model.valid_from)            # type: ignore[attr-defined]
    )
    kabiya_stmt = _apply_extra_filters(kabiya_stmt, model, extra_filters)
    result = await session.execute(kabiya_stmt)
    existing = list(result.scalars().all())

    for rec in existing:
        rec_from: date = rec.valid_from
        rec_to: date | None = rec.valid_to  # None = open / active

        # ── Completely BEFORE new period → delete (overwrite backward) ──
        if rec_to is not None and rec_to < new_valid_from:
            await session.execute(
                delete(model).where(model.id == rec.id)   # type: ignore[attr-defined]
            )
            continue

        # ── Completely AFTER new period (only when new period has an end) ─
        if new_valid_to is not None and rec_from > new_valid_to:
            continue

        # ── At this point the record overlaps with the new period ─────────
        starts_before = rec_from < new_valid_from
        ends_after = (
            new_valid_to is not None
            and (rec_to is None or rec_to > new_valid_to)
        )

        if starts_before and ends_after:
            # ── SPLIT ──────────────────────────────────────────────────────
            orig_fields = _copy_fields(rec)
            # Right half: original data from new_valid_to+1 to original end
            right = model(
                tenant_id=tenant_id,
                valid_from=new_valid_to + timedelta(days=1),  # type: ignore[operator]
                valid_to=rec_to,
                created_by=actor_id,
                **orig_fields,
            )
            session.add(right)
            # Left half: trim original record
            await session.execute(
                update(model).where(model.id == rec.id)   # type: ignore[attr-defined]
                .values(**_with_update_audit(
                    model,
                    {"valid_to": new_valid_from - timedelta(days=1)},
                    actor_id,
                ))
            )

        elif starts_before:
            # ── LEFT TRIM ──────────────────────────────────────────────────
            await session.execute(
                update(model).where(model.id == rec.id)   # type: ignore[attr-defined]
                .values(**_with_update_audit(
                    model,
                    {"valid_to": new_valid_from - timedelta(days=1)},
                    actor_id,
                ))
            )

        elif ends_after:
            # ── RIGHT PUSH ─────────────────────────────────────────────────
            await session.execute(
                update(model).where(model.id == rec.id)   # type: ignore[attr-defined]
                .values(**_with_update_audit(
                    model,
                    {"valid_from": new_valid_to + timedelta(days=1)},  # type: ignore[operator]
                    actor_id,
                ))
            )

        else:
            # ── COMPLETELY WITHIN → delete ─────────────────────────────────
            await session.execute(
                delete(model).where(model.id == rec.id)   # type: ignore[attr-defined]
            )

    # ── Insert the new record ─────────────────────────────────────────────
    new_rec = model(
        **new_data,
        tenant_id=tenant_id,
        valid_from=new_valid_from,
        valid_to=new_valid_to,
        created_by=actor_id,
    )
    session.add(new_rec)
    await session.flush()
    await session.refresh(new_rec)
    return new_rec


async def delete_specific_row(
    session: AsyncSession,
    model: Type,
    tenant_id: uuid.UUID,
    row_valid_from: date,
    extra_filters: dict[str, Any] | None = None,
) -> None:
    """
    Action '3' (ביטול — מחיקה): hard-delete the row whose valid_from matches.
    The row disappears completely — no trace remains in the database.
    """
    stmt = (
        delete(model)
        .where(model.tenant_id == tenant_id)   # type: ignore[attr-defined]
        .where(model.valid_from == row_valid_from)   # type: ignore[attr-defined]
    )
    stmt = _apply_extra_filters(stmt, model, extra_filters)
    await session.execute(stmt)


async def close_active_row(
    session: AsyncSession,
    model: Type,
    tenant_id: uuid.UUID,
    end_date: date,
    actor_id: uuid.UUID | None = None,
    extra_filters: dict[str, Any] | None = None,
) -> None:
    """
    Action '3' (ביטול — גמר תוקף): set valid_to on the currently active row.
    The row stays in history but is no longer effective after end_date.
    Per Hilan spec: the caller passes the LAST valid day (valid_to = end_date).
    """
    close_row_stmt = (
        update(model)
        .where(model.tenant_id == tenant_id)   # type: ignore[attr-defined]
        .where(model.valid_to.is_(None))        # type: ignore[attr-defined]
    )
    close_row_stmt = _apply_extra_filters(close_row_stmt, model, extra_filters)
    await session.execute(close_row_stmt.values(**_with_update_audit(model, {"valid_to": end_date}, actor_id)))


async def get_active(
    session: AsyncSession,
    model: Type,
    tenant_id: uuid.UUID,
    extra_filters: dict[str, Any] | None = None,
    as_of: date | None = None,
) -> Any | None:
    """Return the currently active temporal row for a tenant."""
    effective_on = as_of or date.today()
    stmt = (
        select(model)
        .where(model.tenant_id == tenant_id)  # type: ignore[attr-defined]
        .where(model.valid_from <= effective_on)  # type: ignore[attr-defined]
        .where(  # type: ignore[attr-defined]
            (model.valid_to.is_(None)) | (model.valid_to >= effective_on)
        )
        .order_by(model.valid_from.desc())  # type: ignore[attr-defined]
    )
    stmt = _apply_extra_filters(stmt, model, extra_filters)
    result = await session.execute(stmt.limit(1))
    return result.scalar_one_or_none()


async def get_history(
    session: AsyncSession,
    model: Type,
    tenant_id: uuid.UUID,
    extra_filters: dict[str, Any] | None = None,
) -> list[Any]:
    """Return full history (all rows) for a tenant, newest first."""
    stmt = (
        select(model)
        .where(model.tenant_id == tenant_id)  # type: ignore[attr-defined]
        .order_by(model.valid_from.desc())     # type: ignore[attr-defined]
    )
    stmt = _apply_extra_filters(stmt, model, extra_filters)
    result = await session.execute(stmt)
    return list(result.scalars().all())
