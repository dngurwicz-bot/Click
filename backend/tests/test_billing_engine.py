from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.services import billing_engine


def _contract(**overrides):
    payload = {
        "id": uuid4(),
        "tenant_id": uuid4(),
        "billing_cycle": "monthly",
        "anchor_day": 1,
        "start_date": date(2026, 4, 1),
        "next_renewal_at": date(2026, 5, 1),
    }
    payload.update(overrides)
    return SimpleNamespace(**payload)


def _item(**overrides):
    payload = {
        "id": uuid4(),
        "contract_id": uuid4(),
        "module_slug": "core",
        "rating_model": "flat",
        "quantity": 0,
        "base_amount_ils": Decimal("100.00"),
        "included_qty": 0,
        "per_unit_amount_ils": Decimal("0.00"),
        "tier_definition": None,
        "setup_fee_amount_ils": Decimal("0.00"),
        "discount_pct": Decimal("0.00"),
        "effective_from": date(2026, 4, 1),
        "status": "active",
    }
    payload.update(overrides)
    return SimpleNamespace(**payload)


def test_rate_contract_item_flat():
    item = _item(rating_model="flat", base_amount_ils=Decimal("199.00"))
    assert billing_engine.rate_contract_item(item) == Decimal("199.00")


def test_rate_contract_item_per_seat_with_included_qty():
    item = _item(
        rating_model="per_seat",
        base_amount_ils=Decimal("149.00"),
        quantity=18,
        included_qty=10,
        per_unit_amount_ils=Decimal("12.50"),
    )
    assert billing_engine.rate_contract_item(item) == Decimal("249.00")


def test_rate_contract_item_tiered():
    item = _item(
        rating_model="tiered",
        quantity=12,
        base_amount_ils=Decimal("50.00"),
        tier_definition=[
            {"up_to": 5, "unit_amount_ils": "10.00"},
            {"up_to": 10, "unit_amount_ils": "8.00"},
            {"up_to": None, "unit_amount_ils": "5.00"},
        ],
    )
    assert billing_engine.rate_contract_item(item) == Decimal("150.00")


def test_cycle_bounds_monthly_with_anchor_before_day():
    contract = _contract(anchor_day=15, start_date=date(2026, 1, 15))
    start, end = billing_engine.cycle_bounds(contract, date(2026, 4, 10))
    assert start == date(2026, 3, 15)
    assert end == date(2026, 4, 14)


def test_renewal_preview_creates_full_cycle_lines():
    contract = _contract(next_renewal_at=date(2026, 5, 1))
    item = _item(module_slug="core", base_amount_ils=Decimal("250.00"))

    preview = billing_engine.renewal_preview(contract, date(2026, 5, 1), [item])

    assert preview.bill_now_ils == Decimal("250.00")
    assert preview.next_invoice_impact_ils == Decimal("250.00")
    assert preview.credit_impact_ils == Decimal("0.00")
    assert len(preview.lines) == 1
    assert preview.lines[0].service_period_start == date(2026, 5, 1)
    assert preview.lines[0].service_period_end == date(2026, 5, 31)


@pytest.mark.asyncio
async def test_preview_change_add_module_bills_setup_once(monkeypatch):
    contract = _contract(start_date=date(2026, 4, 1))

    async def _never_billed(*_args, **_kwargs):
        return False

    monkeypatch.setattr(billing_engine, "setup_fee_already_billed", _never_billed)

    preview = await billing_engine.preview_change(
        None,
        contract=contract,
        event_type="add_module",
        effective_at=date(2026, 4, 10),
        item=None,
        module_slug="docs",
        quantity=12,
        rating_model="per_seat",
        base_amount_ils=Decimal("100.00"),
        included_qty=10,
        per_unit_amount_ils=Decimal("20.00"),
        tier_definition=None,
        setup_fee_amount_ils=Decimal("500.00"),
        discount_pct=Decimal("0.00"),
    )

    assert preview.bill_now_ils == Decimal("598.00")
    assert preview.next_invoice_impact_ils == Decimal("140.00")
    assert len(preview.lines) == 2
    assert {line.entry_type for line in preview.lines} == {"proration_debit", "setup_fee"}


@pytest.mark.asyncio
async def test_preview_change_quantity_mid_cycle_generates_proration_debit(monkeypatch):
    contract = _contract()
    item = _item(
        rating_model="per_seat",
        quantity=10,
        included_qty=5,
        per_unit_amount_ils=Decimal("50.00"),
        base_amount_ils=Decimal("0.00"),
    )

    preview = await billing_engine.preview_change(
        None,
        contract=contract,
        event_type="change_quantity",
        effective_at=date(2026, 4, 10),
        item=item,
        module_slug="core",
        quantity=15,
        rating_model="per_seat",
        base_amount_ils=Decimal("0.00"),
        included_qty=5,
        per_unit_amount_ils=Decimal("50.00"),
        tier_definition=None,
        setup_fee_amount_ils=Decimal("0.00"),
        discount_pct=Decimal("0.00"),
    )

    assert preview.bill_now_ils == Decimal("175.00")
    assert preview.next_invoice_impact_ils == Decimal("250.00")
    assert preview.credit_impact_ils == Decimal("0.00")
    assert preview.lines[0].entry_type == "proration_debit"


@pytest.mark.asyncio
async def test_preview_remove_module_creates_credit(monkeypatch):
    contract = _contract()
    item = _item(rating_model="flat", base_amount_ils=Decimal("300.00"))

    preview = await billing_engine.preview_change(
        None,
        contract=contract,
        event_type="remove_module",
        effective_at=date(2026, 4, 16),
        item=item,
        module_slug="core",
        quantity=None,
        rating_model=None,
        base_amount_ils=None,
        included_qty=None,
        per_unit_amount_ils=None,
        tier_definition=None,
        setup_fee_amount_ils=None,
        discount_pct=None,
    )

    assert preview.bill_now_ils == Decimal("-150.00")
    assert preview.credit_impact_ils == Decimal("150.00")
    assert preview.next_invoice_impact_ils == Decimal("-300.00")
    assert preview.lines[0].entry_type == "credit"


@pytest.mark.asyncio
async def test_start_contract_preview_skips_setup_after_first_activation(monkeypatch):
    contract = _contract()
    items = [_item(module_slug="core", base_amount_ils=Decimal("120.00"), setup_fee_amount_ils=Decimal("900.00"))]

    async def _items(*_args, **_kwargs):
        return items

    async def _already_billed(*_args, **_kwargs):
        return True

    monkeypatch.setattr(billing_engine, "effective_contract_items", _items)
    monkeypatch.setattr(billing_engine, "setup_fee_already_billed", _already_billed)

    preview = await billing_engine.preview_change(
        None,
        contract=contract,
        event_type="start_contract",
        effective_at=date(2026, 4, 1),
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

    assert preview.bill_now_ils == Decimal("120.00")
    assert len(preview.lines) == 1
    assert preview.lines[0].entry_type == "recurring"
