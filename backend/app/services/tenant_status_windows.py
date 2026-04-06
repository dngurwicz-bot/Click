from __future__ import annotations

from dataclasses import dataclass
from datetime import date
import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import TenantStatus

ACTIVE_TENANT_STATUSES = {"active", "trial"}
TENANT_STATUS_DATE_BLOCK_CODE = "TENANT_INACTIVE_FOR_DATE"


@dataclass(frozen=True)
class TenantStatusWindow:
    status: str
    valid_from: date
    valid_to: date | None


def build_active_status_windows(status_rows: list[TenantStatus]) -> list[TenantStatusWindow]:
    return [
        TenantStatusWindow(
            status=row.status,
            valid_from=row.valid_from,
            valid_to=row.valid_to,
        )
        for row in status_rows
        if row.status in ACTIVE_TENANT_STATUSES
    ]


def find_window_covering_range(
    windows: list[TenantStatusWindow],
    valid_from: date,
    valid_to: date | None = None,
) -> TenantStatusWindow | None:
    for window in windows:
        if window.valid_from > valid_from:
            continue
        if window.valid_to is not None and valid_from > window.valid_to:
            continue
        if valid_to is None:
            if window.valid_to is None:
                return window
            continue
        if window.valid_to is None or valid_to <= window.valid_to:
            return window
    return None


def range_is_within_active_status(
    status_rows: list[TenantStatus],
    valid_from: date,
    valid_to: date | None = None,
) -> bool:
    windows = build_active_status_windows(status_rows)
    return find_window_covering_range(windows, valid_from, valid_to) is not None


async def load_tenant_status_rows(db: AsyncSession, tenant_id: uuid.UUID) -> list[TenantStatus]:
    result = await db.execute(
        select(TenantStatus)
        .where(TenantStatus.tenant_id == tenant_id)
        .order_by(TenantStatus.valid_from)
    )
    return list(result.scalars().all())


def _format_date(value: date) -> str:
    return value.strftime("%d.%m.%Y")


def _windows_hint(windows: list[TenantStatusWindow]) -> str:
    if not windows:
        return " ללקוח אין תקופות סטטוס פעילות."
    formatted = ", ".join(
        f"{_format_date(window.valid_from)}"
        + (f"–{_format_date(window.valid_to)}" if window.valid_to else "–ללא סוף")
        for window in windows
    )
    return f" תקופות פעילות זמינות: {formatted}."


def build_inactive_range_error(
    valid_from: date,
    valid_to: date | None,
    windows: list[TenantStatusWindow],
) -> dict[str, str]:
    if valid_to is None:
        error = f"לא ניתן לבצע פעולה מתאריך {_format_date(valid_from)} כי הלקוח אינו פעיל בתאריך זה."
    else:
        error = (
            "לא ניתן לבצע פעולה בטווח "
            f"{_format_date(valid_from)}–{_format_date(valid_to)} כי כל הטווח חייב להיות בתוך תקופת סטטוס פעילה."
        )
    return {
        "error": error + _windows_hint(windows),
        "code": TENANT_STATUS_DATE_BLOCK_CODE,
    }


async def ensure_tenant_status_allows_range(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    valid_from: date,
    valid_to: date | None = None,
) -> TenantStatusWindow:
    status_rows = await load_tenant_status_rows(db, tenant_id)
    windows = build_active_status_windows(status_rows)
    window = find_window_covering_range(windows, valid_from, valid_to)
    if window is None:
        raise HTTPException(
            status_code=409,
            detail=build_inactive_range_error(valid_from, valid_to, windows),
        )
    return window
