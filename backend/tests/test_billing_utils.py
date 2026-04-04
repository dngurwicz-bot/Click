from decimal import Decimal

from app.routers.billing import _round2, _sum_decimal


def test_round2_accepts_empty_sum_result():
    assert _round2(sum([])) == Decimal("0.00")


def test_sum_decimal_uses_decimal_zero_start():
    assert _sum_decimal([]) == Decimal("0")
    assert _sum_decimal([Decimal("10.25"), None, 0]) == Decimal("10.25")
