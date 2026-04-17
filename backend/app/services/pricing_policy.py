from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP


TWO_PLACES = Decimal("0.01")


def _round_money(value: Decimal | int | float | str | None) -> Decimal:
    numeric = value if isinstance(value, Decimal) else Decimal(str(value or "0"))
    return numeric.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def _fmt_ils(value: Decimal | int | float | str | None) -> str:
    return f"₪{_round_money(value):,.2f}"


def pricing_policy_note(included_seats: int) -> str:
    threshold = max(int(included_seats or 0), 0)
    if threshold > 0:
        return f"חיוב מושבים חל רק מעבר ל-{threshold} המושבים הכלולים."
    return "חיוב מושבים חל מהמשתמש הראשון כי אין מושבים כלולים."


def pricing_summary_text(
    *,
    base_price_ils: Decimal | int | float | str | None,
    included_seats: int,
    overage_per_seat_ils: Decimal | int | float | str | None,
) -> str:
    base_text = f"{_fmt_ils(base_price_ils)} לחודש"
    threshold = max(int(included_seats or 0), 0)
    overage = _round_money(overage_per_seat_ils)

    if overage <= 0:
        if threshold > 0:
            return f"{base_text} כולל {threshold} מושבים, ללא חיוב נוסף למושב."
        return f"{base_text} ללא חיוב נוסף למושב."

    if threshold > 0:
        return f"{base_text} כולל {threshold} מושבים, ואז {_fmt_ils(overage)} לכל מושב נוסף."

    return f"{base_text}, ואז {_fmt_ils(overage)} לכל מושב."
