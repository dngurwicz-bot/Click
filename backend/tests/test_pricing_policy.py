from decimal import Decimal

from app.services.pricing_policy import pricing_policy_note, pricing_summary_text


def test_pricing_summary_text_with_included_seats_and_overage():
    assert pricing_summary_text(
        base_price_ils=Decimal("149"),
        included_seats=10,
        overage_per_seat_ils=Decimal("12.5"),
    ) == "₪149.00 לחודש כולל 10 מושבים, ואז ₪12.50 לכל מושב נוסף."


def test_pricing_summary_text_without_overage():
    assert pricing_summary_text(
        base_price_ils=Decimal("199"),
        included_seats=25,
        overage_per_seat_ils=Decimal("0"),
    ) == "₪199.00 לחודש כולל 25 מושבים, ללא חיוב נוסף למושב."


def test_pricing_policy_note_changes_when_no_included_seats():
    assert pricing_policy_note(5) == "חיוב מושבים חל רק מעבר ל-5 המושבים הכלולים."
    assert pricing_policy_note(0) == "חיוב מושבים חל מהמשתמש הראשון כי אין מושבים כלולים."
