from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from app.services.subscription_modules import (
    calculate_next_subscription_renewal,
    calculate_module_totals,
    calculate_subscription_pricing,
    derive_subscription_snapshot,
    round2,
    sync_subscription_header,
)


def test_round2_handles_none():
    assert round2(None) == Decimal("0.00")


def test_calculate_module_totals_uses_catalog_prices():
    module_row = SimpleNamespace(
        seats=12,
        pricing_mode="catalog",
        override_base_price_ils=None,
        override_per_seat_ils=None,
        override_setup_fee_ils=None,
        override_included_seats=None,
    )
    catalog_price = SimpleNamespace(
        base_price_ils=Decimal("100.00"),
        per_seat_ils=Decimal("7.50"),
        included_seats=5,
        setup_fee_ils=Decimal("250.00"),
    )

    monthly, setup = calculate_module_totals(module_row, catalog_price)

    assert monthly == Decimal("152.50")
    assert setup == Decimal("250.00")


def test_calculate_module_totals_uses_overrides():
    module_row = SimpleNamespace(
        seats=9,
        pricing_mode="override",
        override_base_price_ils=Decimal("180.00"),
        override_per_seat_ils=Decimal("10.00"),
        override_setup_fee_ils=Decimal("99.00"),
        override_included_seats=4,
    )

    monthly, setup = calculate_module_totals(module_row, None)

    assert monthly == Decimal("230.00")
    assert setup == Decimal("99.00")


def test_calculate_subscription_pricing_monthly_applies_discount():
    subscription = SimpleNamespace(billing_cycle="monthly", discount_pct=Decimal("10.00"))
    module_rows = [
        SimpleNamespace(
            module_slug="core",
            seats=12,
            status="active",
            pricing_mode="catalog",
            override_base_price_ils=None,
            override_per_seat_ils=None,
            override_setup_fee_ils=None,
            override_included_seats=None,
        ),
        SimpleNamespace(
            module_slug="vision",
            seats=4,
            status="removed",
            pricing_mode="catalog",
            override_base_price_ils=None,
            override_per_seat_ils=None,
            override_setup_fee_ils=None,
            override_included_seats=None,
        ),
    ]
    catalog_prices = {
        "core": SimpleNamespace(
            base_price_ils=Decimal("100.00"),
            per_seat_ils=Decimal("7.50"),
            included_seats=5,
            setup_fee_ils=Decimal("250.00"),
        )
    }

    summary = calculate_subscription_pricing(subscription, module_rows, catalog_prices)

    assert summary["current_monthly_total_ils"] == Decimal("137.25")
    assert summary["current_yearly_total_ils"] == Decimal("1647.00")
    assert summary["current_cycle_total_ils"] == Decimal("137.25")
    assert summary["current_setup_total_ils"] == Decimal("225.00")
    assert summary["initial_charge_total_ils"] == Decimal("362.25")
    assert summary["next_charge_total_ils"] == Decimal("137.25")


def test_calculate_subscription_pricing_yearly_uses_annual_cycle_total():
    subscription = SimpleNamespace(billing_cycle="yearly", discount_pct=Decimal("0"))
    module_rows = [
        SimpleNamespace(
            module_slug="core",
            seats=9,
            status="active",
            pricing_mode="override",
            override_base_price_ils=Decimal("180.00"),
            override_per_seat_ils=Decimal("10.00"),
            override_setup_fee_ils=Decimal("99.00"),
            override_included_seats=4,
        ),
    ]

    summary = calculate_subscription_pricing(subscription, module_rows, {})

    assert summary["current_monthly_total_ils"] == Decimal("230.00")
    assert summary["current_yearly_total_ils"] == Decimal("2760.00")
    assert summary["current_cycle_total_ils"] == Decimal("2760.00")
    assert summary["current_setup_total_ils"] == Decimal("99.00")
    assert summary["initial_charge_total_ils"] == Decimal("2859.00")
    assert summary["next_charge_total_ils"] == Decimal("2760.00")


def test_sync_subscription_header_derives_snapshot_fields():
    subscription = SimpleNamespace(selected_module_slugs=[], seat_count=0)
    rows = [
        SimpleNamespace(id=uuid4(), module_slug="core", seats=15, status="active"),
        SimpleNamespace(id=uuid4(), module_slug="vision", seats=3, status="removed"),
        SimpleNamespace(id=uuid4(), module_slug="docs", seats=7, status="active"),
    ]

    sync_subscription_header(subscription, rows)

    assert subscription.selected_module_slugs == ["core", "docs"]
    assert subscription.seat_count == 15


def test_derive_subscription_snapshot_uses_active_rows_only():
    rows = [
        SimpleNamespace(id=uuid4(), module_slug="core", seats=12, status="active"),
        SimpleNamespace(id=uuid4(), module_slug="docs", seats=8, status="active"),
        SimpleNamespace(id=uuid4(), module_slug="vision", seats=99, status="removed"),
    ]

    seat_count, module_slugs = derive_subscription_snapshot(rows)

    assert seat_count == 12
    assert module_slugs == ["core", "docs"]


def test_calculate_next_subscription_renewal_uses_anchor_day_after_today():
    subscription = SimpleNamespace(
        valid_from=date(2026, 4, 1),
        billing_cycle="monthly",
        billing_anchor_day=1,
    )

    renewal = calculate_next_subscription_renewal(subscription, as_of=date(2026, 5, 2))

    assert renewal == date(2026, 6, 1)


def test_calculate_next_subscription_renewal_before_subscription_start_keeps_first_due_date():
    subscription = SimpleNamespace(
        valid_from=date(2026, 5, 1),
        billing_cycle="monthly",
        billing_anchor_day=1,
    )

    renewal = calculate_next_subscription_renewal(subscription, as_of=date(2026, 4, 20))

    assert renewal == date(2026, 5, 1)
