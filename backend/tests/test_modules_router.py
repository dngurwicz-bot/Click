from datetime import UTC, date, datetime
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.middleware.auth import CurrentUser
from app.routers import modules as modules_router
from app.schemas.module import ModulePriceActionBody


class _ScalarResult:
    def __init__(self, row):
        self._row = row

    def scalar_one_or_none(self):
        return self._row


class _OneResult:
    def __init__(self, row):
        self._row = row

    def one_or_none(self):
        return self._row


class _FakeSession:
    def __init__(self, execute_results: list[object] | None = None):
        self.execute_results = list(execute_results or [])
        self.executed_queries: list[object] = []
        self.committed = False

    async def execute(self, query):
        self.executed_queries.append(query)
        if self.execute_results:
            return self.execute_results.pop(0)
        return _ScalarResult(None)

    async def commit(self):
        self.committed = True


def _current_user() -> CurrentUser:
    return CurrentUser(
        id=uuid4(),
        email="admin@example.com",
        role="admin",
        permissions={"modules": {"can_view": True, "can_edit": True}},
    )


@pytest.mark.asyncio
async def test_update_module_price_allows_clearing_valid_to():
    price_id = uuid4()
    updated_row = SimpleNamespace(
        id=price_id,
        module_slug="core",
        base_price_ils=Decimal("100.00"),
        per_seat_ils=Decimal("20.00"),
        included_seats=25,
        setup_fee_ils=Decimal("0.00"),
        valid_from=date(2026, 5, 1),
        valid_to=None,
        created_at=datetime(2026, 5, 1, tzinfo=UTC),
    )
    db = _FakeSession(
        [
            _ScalarResult(SimpleNamespace(slug="core")),
            _OneResult(SimpleNamespace(id=price_id, valid_from=date(2026, 5, 1), valid_to=date(2026, 5, 31))),
            _ScalarResult(None),
            _ScalarResult(updated_row),
        ]
    )

    result = await modules_router.update_module_price(
        "core",
        ModulePriceActionBody(
            action="update",
            price_id=price_id,
            base_price_ils=Decimal("100.00"),
            per_seat_ils=Decimal("20.00"),
            included_seats=25,
            setup_fee_ils=Decimal("0.00"),
            valid_from=date(2026, 5, 1),
            valid_to=None,
        ),
        db=db,
        current_user=_current_user(),
    )

    update_stmt = db.executed_queries[2]

    assert result.valid_to is None
    assert db.committed is True
    assert "valid_to" in update_stmt.compile().params
    assert update_stmt.compile().params["valid_to"] is None
