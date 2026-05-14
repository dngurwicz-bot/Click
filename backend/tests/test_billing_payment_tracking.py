from datetime import UTC, date, datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest
import sqlalchemy as sa

from app.routers import billing as billing_router


class _ScalarResult:
    def __init__(self, rows):
        self._rows = rows

    def scalar_one_or_none(self):
        return self._rows[0] if self._rows else None

    def scalars(self):
        return self

    def all(self):
        return list(self._rows)


class _FakeSession:
    def __init__(self, execute_results):
        self.execute_results = list(execute_results)
        self.rollback_calls = 0

    async def execute(self, _query):
        rows = self.execute_results.pop(0) if self.execute_results else []
        if isinstance(rows, Exception):
            raise rows
        return _ScalarResult(rows)

    async def rollback(self):
        self.rollback_calls += 1


@pytest.mark.asyncio
async def test_payment_tracking_summary_builds_derived_rows(monkeypatch):
    tenant_id = uuid4()
    db = _FakeSession([[]])
    subscription = SimpleNamespace(
        tenant_id=tenant_id,
        valid_from=date(2026, 4, 1),
        billing_cycle="monthly",
        billing_anchor_day=1,
    )

    async def fake_active_subscription(_db, _tenant_id):
        return subscription

    monkeypatch.setattr(billing_router, "_active_subscription", fake_active_subscription)

    summary = await billing_router._payment_tracking_summary(
        db,
        tenant_id,
        months_back=0,
        months_forward=1,
    )

    assert summary.billing_anchor_day == 1
    assert [item.billing_period for item in summary.items] == ["2026-05", "2026-06"]
    assert summary.items[0].scheduled_charge_date == date(2026, 5, 1)
    assert summary.items[0].status == "unreported"
    assert summary.items[0].source == "derived"
    assert summary.items[0].is_overdue is True
    assert summary.items[1].scheduled_charge_date == date(2026, 6, 1)
    assert summary.next_renewal_at == date(2026, 6, 1)


@pytest.mark.asyncio
async def test_payment_tracking_summary_overlays_manual_record(monkeypatch):
    tenant_id = uuid4()
    manual_record = SimpleNamespace(
        billing_period="2026-05",
        scheduled_charge_date=date(2026, 5, 1),
        status="paid",
        amount_ils="4933.00",
        paid_at=date(2026, 5, 2),
        external_ref="EXT-123",
        notes="שולם חיצונית",
        updated_at=datetime.now(UTC),
        updated_by=uuid4(),
    )
    db = _FakeSession([[manual_record]])
    subscription = SimpleNamespace(
        tenant_id=tenant_id,
        valid_from=date(2026, 4, 1),
        billing_cycle="monthly",
        billing_anchor_day=1,
    )

    async def fake_active_subscription(_db, _tenant_id):
        return subscription

    monkeypatch.setattr(billing_router, "_active_subscription", fake_active_subscription)

    summary = await billing_router._payment_tracking_summary(
        db,
        tenant_id,
        months_back=0,
        months_forward=0,
    )

    assert len(summary.items) == 1
    assert summary.items[0].status == "paid"
    assert summary.items[0].source == "manual"
    assert summary.items[0].external_ref == "EXT-123"
    assert summary.items[0].is_overdue is False


@pytest.mark.asyncio
async def test_payment_tracking_summary_quarterly_only_returns_cycle_periods(monkeypatch):
    tenant_id = uuid4()
    db = _FakeSession([[]])
    subscription = SimpleNamespace(
        tenant_id=tenant_id,
        valid_from=date(2026, 4, 1),
        billing_cycle="quarterly",
        billing_anchor_day=1,
    )

    async def fake_active_subscription(_db, _tenant_id):
        return subscription

    monkeypatch.setattr(billing_router, "_active_subscription", fake_active_subscription)

    summary = await billing_router._payment_tracking_summary(
        db,
        tenant_id,
        months_back=0,
        months_forward=1,
    )

    assert [item.billing_period for item in summary.items] == ["2026-04", "2026-07"]
    assert summary.items[0].scheduled_charge_date == date(2026, 4, 1)
    assert summary.items[1].scheduled_charge_date == date(2026, 7, 1)
    assert summary.next_renewal_at == date(2026, 7, 1)


@pytest.mark.asyncio
async def test_get_tenant_billing_falls_back_to_legacy_tables(monkeypatch):
    tenant_id = uuid4()
    db = _FakeSession(
        [
            [SimpleNamespace(tenant_id=tenant_id)],
            sa.exc.ProgrammingError(
                "SELECT * FROM billing_ledger_entries",
                {},
                Exception('relation "billing_ledger_entries" does not exist'),
            ),
            [
                SimpleNamespace(
                    id=uuid4(),
                    tenant_id=tenant_id,
                    billing_period="2026-05",
                    charge_type="base_fee",
                    module_slug="core",
                    description="Core monthly",
                    quantity=1,
                    unit_price_ils="100.00",
                    amount_ils="100.00",
                    discount_pct="0.00",
                    amount_after_discount_ils="100.00",
                    status="pending",
                    invoice_id=None,
                    notes=None,
                    created_at=datetime.now(UTC),
                )
            ],
            [
                SimpleNamespace(
                    id=uuid4(),
                    invoice_number="INV-001",
                    tenant_id=tenant_id,
                    billing_period="2026-05",
                    issue_date=date(2026, 5, 1),
                    due_date=date(2026, 5, 10),
                    subtotal_ils="100.00",
                    discount_ils="0.00",
                    vat_ils="17.00",
                    total_ils="117.00",
                    status="paid",
                    payment_date=date(2026, 5, 3),
                    created_at=datetime.now(UTC),
                )
            ],
        ]
    )

    async def fake_tenant_name(_db, _tenant_id):
        return "Tenant name"

    async def fake_module_name(_db, _module_slug):
        return "Core"

    monkeypatch.setattr(billing_router, "_tenant_name", fake_tenant_name)
    monkeypatch.setattr(billing_router, "_module_name", fake_module_name)

    summary = await billing_router.get_tenant_billing(
        tenant_id,
        db=db,
        _=object(),
    )

    assert db.rollback_calls == 1
    assert len(summary.charges) == 1
    assert len(summary.invoices) == 1
    assert summary.charges[0].tenant_name == "Tenant name"
    assert summary.charges[0].module_name == "Core"
    assert summary.pending_total_ils == 100
    assert summary.invoiced_total_ils == 117
    assert summary.paid_total_ils == 117


def test_validate_billing_period_rejects_invalid_calendar_month():
    with pytest.raises(billing_router.HTTPException) as exc_info:
        billing_router._validate_billing_period("2026-13")

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail["code"] == "INVALID_PERIOD"
