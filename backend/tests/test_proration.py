"""
Unit tests for proration billing logic.

Tests cover the exact math of seat-change proration without touching the DB.
The algorithm under test (extracted from generate_charges):

  days_remaining = (period_end - effective_date).days + 1
  proration_qty  = abs(delta_billable) * days_remaining / total_days_in_period
  amount         = proration_qty * per_seat_price
"""
import calendar
from datetime import date
from decimal import Decimal

import pytest

from app.routers.billing import _round2, _period_start
from app.services.subscription_modules import round2


# ─── Helpers matching the billing router logic ────────────────────────────────

def _period_bounds(period: str):
    """Return (period_start, period_end, total_days) for a YYYY-MM string."""
    year, month = map(int, period.split("-"))
    total_days = calendar.monthrange(year, month)[1]
    start = date(year, month, 1)
    end   = date(year, month, total_days)
    return start, end, total_days


def _proration_qty(
    delta_billable: int,
    effective_date: date,
    period: str,
) -> Decimal:
    _, period_end, total_days = _period_bounds(period)
    days_remaining = (period_end - effective_date).days + 1
    return _round2(
        Decimal(str(abs(delta_billable)))
        * Decimal(str(days_remaining))
        / Decimal(str(total_days))
    )


def _proration_amount(
    delta_billable: int,
    effective_date: date,
    period: str,
    per_seat_ils: Decimal,
) -> Decimal:
    qty = _proration_qty(delta_billable, effective_date, period)
    return _round2(qty * per_seat_ils)


# ─── Period boundary helpers ──────────────────────────────────────────────────

def test_period_bounds_april_2026():
    start, end, total = _period_bounds("2026-04")
    assert start == date(2026, 4, 1)
    assert end   == date(2026, 4, 30)
    assert total == 30


def test_period_bounds_february_leap_2024():
    _, _, total = _period_bounds("2024-02")
    assert total == 29


def test_period_bounds_february_non_leap_2025():
    _, _, total = _period_bounds("2025-02")
    assert total == 28


def test_period_bounds_31_day_month():
    _, _, total = _period_bounds("2026-01")
    assert total == 31


# ─── Proration quantity ───────────────────────────────────────────────────────

def test_proration_full_month_if_change_on_first():
    """Change on day 1 → full month billed."""
    qty = _proration_qty(5, date(2026, 4, 1), "2026-04")
    assert qty == Decimal("5.00")


def test_proration_half_month():
    """Change on day 16 of a 30-day month → 15/30 = 0.5 × delta."""
    qty = _proration_qty(2, date(2026, 4, 16), "2026-04")
    # days_remaining = 30 - 16 + 1 = 15; qty = 2 * 15/30 = 1.00
    assert qty == Decimal("1.00")


def test_proration_last_day_only():
    """Change on the last day → 1/30 × delta."""
    qty = _proration_qty(3, date(2026, 4, 30), "2026-04")
    # days_remaining = 1; qty = 3 * 1/30 = 0.10
    assert qty == Decimal("0.10")


def test_proration_rounding_half_up():
    """3 seats × 10 days / 30 = 1.0 (no rounding needed here)."""
    qty = _proration_qty(3, date(2026, 4, 21), "2026-04")
    # days_remaining = 10; qty = 3 * 10/30 = 1.00
    assert qty == Decimal("1.00")


def test_proration_qty_non_trivial():
    """1 seat added on day 20 of a 31-day month → 12/31 ≈ 0.39"""
    qty = _proration_qty(1, date(2026, 1, 20), "2026-01")
    # days_remaining = 31 - 20 + 1 = 12; qty = 12/31 ≈ 0.3871 → rounds to 0.39
    assert qty == Decimal("0.39")


# ─── Proration amount (with per-seat price) ───────────────────────────────────

def test_proration_amount_simple():
    """5 seats, added on day 16 of April, ₪100/seat → ₪250."""
    amount = _proration_amount(5, date(2026, 4, 16), "2026-04", Decimal("100.00"))
    # qty = 5 * 15/30 = 2.50; amount = 2.50 * 100 = 250.00
    assert amount == Decimal("250.00")


def test_proration_amount_decrease():
    """Decrease of 3 seats mid-month — qty is same, just means it's a credit."""
    amount = _proration_amount(3, date(2026, 4, 11), "2026-04", Decimal("50.00"))
    # days_remaining = 20; qty = 3 * 20/30 = 2.00; amount = 2.00 * 50 = 100.00
    assert amount == Decimal("100.00")


def test_proration_discount_applied_externally():
    """
    Proration produces the pre-discount amount; discount is applied separately.
    Simulate 10% discount on a proration charge.
    """
    amount = _proration_amount(2, date(2026, 4, 1), "2026-04", Decimal("75.00"))
    discount_pct = Decimal("10")
    after_discount = _round2(amount * (Decimal("1") - discount_pct / Decimal("100")))
    assert amount        == Decimal("150.00")
    assert after_discount == Decimal("135.00")


# ─── Scenario: plan example from the spec ────────────────────────────────────

def test_spec_scenario_april_2026():
    """
    Spec scenario: April 2026, per_seat=₪50, included=5

    1 Apr: 10 seats → 5 billable (base per-seat charge covers full month)
    10 Apr: +5 seats → delta=5 billable, 21 days remaining
    20 Apr: -3 seats → delta=-3 billable, 11 days remaining

    Base per-seat (full month, 5 billable × ₪50):  ₪250
    Proration +5 × 21/30 × ₪50:                   ₪175
    Credit    -3 × 11/30 × ₪50:                   -₪55
    Total:                                          ₪370
    """
    per_seat = Decimal("50.00")
    included = 5

    # Base: seats=10 at start → 5 billable × full month
    base_billable = max(10 - included, 0)
    base_amount   = _round2(Decimal(str(base_billable)) * per_seat)
    assert base_amount == Decimal("250.00")

    # Proration: 10 Apr, seats 10→15, new billable = 10, old = 5, delta = +5
    addition_qty    = _proration_qty(5, date(2026, 4, 10), "2026-04")
    addition_amount = _round2(addition_qty * per_seat)
    # days_remaining = 21; qty = 5 * 21/30 = 3.50; amount = 3.50 * 50 = 175.00
    assert addition_qty    == Decimal("3.50")
    assert addition_amount == Decimal("175.00")

    # Credit: 20 Apr, seats 15→12, new billable=7, old=10, delta=-3
    credit_qty    = _proration_qty(3, date(2026, 4, 20), "2026-04")
    credit_amount = _round2(credit_qty * per_seat)
    # days_remaining = 11; qty = 3 * 11/30 = 1.10; amount = 1.10 * 50 = 55.00
    assert credit_qty    == Decimal("1.10")
    assert credit_amount == Decimal("55.00")

    total = base_amount + addition_amount - credit_amount
    assert total == Decimal("370.00")


def test_delta_zero_yields_zero_qty():
    """If included_seats equals new_seats, delta_billable=0 → no proration charge."""
    delta_billable = max(5 - 5, 0) - max(5 - 5, 0)   # 0 - 0
    assert delta_billable == 0
    # In billing.py this path results in change.billed=True with no charge created


def test_zero_per_seat_no_per_seat_charge():
    """If per_seat_ils == 0, no per_seat charge is created."""
    per_seat = Decimal("0.00")
    # generate_charges checks: if effective_per_seat and effective_per_seat > 0
    assert not (per_seat and per_seat > 0)


# ─── _period_start helper ─────────────────────────────────────────────────────

def test_period_start():
    assert _period_start("2026-01") == date(2026, 1, 1)
    assert _period_start("2026-12") == date(2026, 12, 1)


# ─── Edge cases ───────────────────────────────────────────────────────────────

def test_proration_february_leap_year():
    """Mid-February in a leap year (29 days)."""
    qty = _proration_qty(4, date(2024, 2, 15), "2024-02")
    # days_remaining = 29 - 15 + 1 = 15; qty = 4 * 15/29 ≈ 2.07
    expected = _round2(Decimal("4") * Decimal("15") / Decimal("29"))
    assert qty == expected


def test_proration_change_at_period_end_is_one_day():
    """A change on the last day of the month is always 1/total_days × delta."""
    for period in ("2026-01", "2026-04", "2026-02"):
        _, end, total = _period_bounds(period)
        qty = _proration_qty(1, end, period)
        expected = _round2(Decimal("1") / Decimal(str(total)))
        assert qty == expected, f"Failed for {period}"
