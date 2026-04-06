from datetime import date
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.services.tenant_status_windows import (
    build_active_status_windows,
    ensure_tenant_status_allows_range,
    range_is_within_active_status,
)


def _status_row(status: str, valid_from: date, valid_to: date | None = None):
    return SimpleNamespace(
        id=uuid4(),
        tenant_id=uuid4(),
        status=status,
        valid_from=valid_from,
        valid_to=valid_to,
    )


class _ScalarResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _ExecuteResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return _ScalarResult(self._rows)


class _FakeSession:
    def __init__(self, rows):
        self.rows = rows

    async def execute(self, _query):
        return _ExecuteResult(self.rows)


def test_build_active_status_windows_keeps_only_active_and_trial():
    rows = [
        _status_row("trial", date(2026, 1, 1), date(2026, 1, 31)),
        _status_row("suspended", date(2026, 2, 1), date(2026, 2, 28)),
        _status_row("active", date(2026, 3, 1), None),
    ]

    windows = build_active_status_windows(rows)

    assert [(window.status, window.valid_from, window.valid_to) for window in windows] == [
        ("trial", date(2026, 1, 1), date(2026, 1, 31)),
        ("active", date(2026, 3, 1), None),
    ]


def test_range_is_within_active_status_for_trial_and_active_windows():
    rows = [
        _status_row("trial", date(2026, 1, 1), date(2026, 1, 31)),
        _status_row("active", date(2026, 3, 1), None),
    ]

    assert range_is_within_active_status(rows, date(2026, 1, 15), date(2026, 1, 15)) is True
    assert range_is_within_active_status(rows, date(2026, 3, 15)) is True
    assert range_is_within_active_status(rows, date(2026, 3, 15), date(2026, 3, 20)) is True


def test_range_is_rejected_when_it_spills_outside_active_window():
    rows = [
        _status_row("active", date(2026, 3, 1), date(2026, 3, 31)),
        _status_row("cancelled", date(2026, 4, 1), None),
    ]

    assert range_is_within_active_status(rows, date(2026, 3, 15), date(2026, 3, 20)) is True
    assert range_is_within_active_status(rows, date(2026, 3, 15), date(2026, 4, 2)) is False
    assert range_is_within_active_status(rows, date(2026, 4, 2)) is False


def test_range_is_allowed_in_any_matching_active_window():
    rows = [
        _status_row("active", date(2026, 1, 1), date(2026, 1, 31)),
        _status_row("suspended", date(2026, 2, 1), date(2026, 2, 28)),
        _status_row("trial", date(2026, 3, 1), date(2026, 3, 31)),
    ]

    assert range_is_within_active_status(rows, date(2026, 3, 10), date(2026, 3, 12)) is True
    assert range_is_within_active_status(rows, date(2026, 2, 10), date(2026, 2, 12)) is False


@pytest.mark.asyncio
async def test_ensure_tenant_status_allows_range_raises_with_hint():
    tenant_id = uuid4()
    db = _FakeSession([
        _status_row("active", date(2026, 1, 1), date(2026, 1, 31)),
        _status_row("cancelled", date(2026, 2, 1), None),
    ])

    with pytest.raises(HTTPException) as exc_info:
        await ensure_tenant_status_allows_range(db, tenant_id, date(2026, 2, 5))

    detail = exc_info.value.detail
    assert detail["code"] == "TENANT_INACTIVE_FOR_DATE"
    assert "הלקוח אינו פעיל" in detail["error"]
    assert "תקופות פעילות זמינות" in detail["error"]
