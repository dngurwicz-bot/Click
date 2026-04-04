from __future__ import annotations

from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from app.models.module import ModulePrice
from app.schemas.module import (
    MarketPriceAnchor,
    ModulePriceOut,
    ModulePricingRecommendationOut,
    ModulePricingResearchOut,
    RecommendedModulePrice,
)

BENCHMARK_TEAM_SIZE = 10
USD_ILS = Decimal("3.1650")
EUR_ILS = Decimal("3.6360")
AS_OF = date(2026, 3, 31)
POSITIONING = "Value Leader ל-SMB בישראל, כ-10%-25% מתחת לעוגני השוק הרלוונטיים."
METHODOLOGY = (
    "ההשוואה מנורמלת לחיוב חודשי עבור צוות benchmark של 10 משתמשים. "
    "מוצרים שמחייבים פר משתמש תורגמו למבנה של בסיס + מושבים + דמי הקמה, "
    "כדי לשמור מחיר כניסה נגיש בלי לאבד יכולת scale."
)


def _round2(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _monthly_total(base_price: Decimal, per_seat_price: Decimal, included_seats: int, seat_count: int) -> Decimal:
    billable_seats = max(seat_count - included_seats, 0)
    return _round2(base_price + (per_seat_price * Decimal(billable_seats)))


RECOMMENDATION_CATALOG: dict[str, dict] = {
    "core": {
        "module_name": "CLICK Core",
        "market_category": "HRIS / HR + Payroll Core",
        "benchmark_window_ils": "₪345-₪633 לחודש לצוות של 10 משתמשים",
        "action": "העלאה מתונה",
        "rationale": "המחיר הנוכחי נמוך מדי מול HR core עם payroll. ההמלצה משאירה כניסה נגישה, אבל מעלה את הרצפה העסקית לרמה סבירה.",
        "recommended_price": {"base_price_ils": "349.00", "per_seat_ils": "24.00", "included_seats": 10, "setup_fee_ils": "1890.00"},
        "anchors": [
            {
                "vendor": "Gusto",
                "product": "Simple",
                "price_display": "$49/mo + $6/user/mo",
                "normalized_monthly_ils": "344.99",
                "basis": "10 users, official plan pricing",
                "source_url": "https://gusto.com/product/pricing",
            },
            {
                "vendor": "Gusto",
                "product": "Plus",
                "price_display": "$80/mo + $12/user/mo",
                "normalized_monthly_ils": "633.00",
                "basis": "10 users, official plan pricing",
                "source_url": "https://gusto.com/product/pricing",
            },
            {
                "vendor": "BambooHR",
                "product": "HR Software",
                "price_display": "Custom quote",
                "normalized_monthly_ils": "0.00",
                "basis": "Official pricing page, no transparent public list price",
                "source_url": "https://www.bamboohr.com/pricing/",
            },
        ],
    },
    "flow": {
        "module_name": "CLICK Flow",
        "market_category": "Workflow / Process Automation",
        "benchmark_window_ils": "₪436-₪691 לחודש לצוות של 10 משתמשים",
        "action": "העלאה ואריזה מחדש",
        "rationale": "תמחור workflow בשוק יושב גבוה יותר. ההמלצה נשארת מתחת ל-monday Standard ל-10 משתמשים, אך משקפת ערך של אוטומציה ותהליכים.",
        "recommended_price": {"base_price_ils": "199.00", "per_seat_ils": "26.00", "included_seats": 5, "setup_fee_ils": "790.00"},
        "anchors": [
            {
                "vendor": "monday.com",
                "product": "Standard",
                "price_display": "€12 seat/month",
                "normalized_monthly_ils": "436.32",
                "basis": "10 seats, billed annually",
                "source_url": "https://monday.com/work-management/pricing",
            },
            {
                "vendor": "monday.com",
                "product": "Pro",
                "price_display": "€19 seat/month",
                "normalized_monthly_ils": "690.84",
                "basis": "10 seats, billed annually",
                "source_url": "https://monday.com/work-management/pricing",
            },
        ],
    },
    "docs": {
        "module_name": "CLICK Docs",
        "market_category": "Document Workflow / eSignature / HR Docs",
        "benchmark_window_ils": "₪601-₪1,551 לחודש לצוות של 10 משתמשים",
        "action": "העלאה ואריזה מחדש",
        "rationale": "מסמכים, חתימות ותהליכי אישור מתומחרים גבוה משמעותית בשוק. ההמלצה נשארת עמוק מתחת ל-PandaDoc Starter אך כבר לא מוכרת מודול תיעוד במחיר חסר.",
        "recommended_price": {"base_price_ils": "159.00", "per_seat_ils": "24.00", "included_seats": 5, "setup_fee_ils": "590.00"},
        "anchors": [
            {
                "vendor": "PandaDoc",
                "product": "Starter",
                "price_display": "$19 seat/month",
                "normalized_monthly_ils": "601.35",
                "basis": "10 seats, official seat pricing",
                "source_url": "https://www.pandadoc.com/pricing/",
            },
            {
                "vendor": "PandaDoc",
                "product": "Business",
                "price_display": "$49 seat/month",
                "normalized_monthly_ils": "1550.85",
                "basis": "10 seats, official seat pricing",
                "source_url": "https://www.pandadoc.com/pricing/",
            },
        ],
    },
    "vision": {
        "module_name": "CLICK Vision",
        "market_category": "Dashboards / Goals / Performance Visibility",
        "benchmark_window_ils": "₪158-₪348 לחודש לצוות של 10 משתמשים",
        "action": "הוזלה ובידול",
        "rationale": "כדי להבדיל את Vision מ-Insights, כדאי למקם אותו ככלי visibility וניהול ביצועים קליל יותר. ההמלצה מורידה מחיר ומתיישרת עם Workleap/Lattice entry-level.",
        "recommended_price": {"base_price_ils": "129.00", "per_seat_ils": "18.00", "included_seats": 5, "setup_fee_ils": "690.00"},
        "anchors": [
            {
                "vendor": "Workleap",
                "product": "Performance",
                "price_display": "$5 user/month",
                "normalized_monthly_ils": "158.25",
                "basis": "10 users minimum",
                "source_url": "https://workleap.com/pricing",
            },
            {
                "vendor": "Lattice",
                "product": "Performance / Goals (unbundled)",
                "price_display": "$8 seat/month",
                "normalized_monthly_ils": "253.20",
                "basis": "10 seats, official pricing FAQ",
                "source_url": "https://lattice.com/pricing",
            },
            {
                "vendor": "Lattice",
                "product": "Foundations / Talent Management",
                "price_display": "$11 seat/month",
                "normalized_monthly_ils": "348.15",
                "basis": "10 seats, official pricing page",
                "source_url": "https://lattice.com/pricing",
            },
        ],
    },
    "assets": {
        "module_name": "CLICK Assets",
        "market_category": "Asset / Inventory Management",
        "benchmark_window_ils": "₪234-₪471 לחודש לחבילות SMB קטנות",
        "action": "העלאה מתונה",
        "rationale": "המודול לא חייב מחיר למושב אגרסיבי, אבל בסיס חודשי נמוך מדי משדר כלי משני. ההמלצה מעלה מעט את הבסיס ושומרת מודל כמעט ללא תשלום פר משתמש.",
        "recommended_price": {"base_price_ils": "149.00", "per_seat_ils": "0.00", "included_seats": 50, "setup_fee_ils": "490.00"},
        "anchors": [
            {
                "vendor": "Sortly",
                "product": "Advanced",
                "price_display": "$24/mo for 2 licenses",
                "normalized_monthly_ils": "75.96",
                "basis": "SMB entry plan",
                "source_url": "https://www.sortly.com/pricing/",
            },
            {
                "vendor": "Sortly",
                "product": "Ultra",
                "price_display": "$74/mo for 5 licenses",
                "normalized_monthly_ils": "234.21",
                "basis": "Popular SMB plan",
                "source_url": "https://www.sortly.com/pricing/",
            },
            {
                "vendor": "Sortly",
                "product": "Premium",
                "price_display": "$149/mo for 8 licenses",
                "normalized_monthly_ils": "471.59",
                "basis": "Advanced SMB plan",
                "source_url": "https://www.sortly.com/pricing/",
            },
        ],
    },
    "vibe": {
        "module_name": "CLICK Vibe",
        "market_category": "Employee Engagement",
        "benchmark_window_ils": "₪126-₪158 לחודש לצוות של 10 משתמשים",
        "action": "הוזלה",
        "rationale": "שוק ה-engagement נמוך יותר ממה שמחירון המודול משדר היום. ההמלצה שומרת Vibe זול מ-Grow וממקמת אותו ככלי adoption רחב.",
        "recommended_price": {"base_price_ils": "149.00", "per_seat_ils": "9.00", "included_seats": 10, "setup_fee_ils": "590.00"},
        "anchors": [
            {
                "vendor": "Workleap",
                "product": "Officevibe",
                "price_display": "$5 user/month",
                "normalized_monthly_ils": "158.25",
                "basis": "10 users minimum",
                "source_url": "https://workleap.com/pricing",
            },
            {
                "vendor": "Lattice",
                "product": "Engagement add-on",
                "price_display": "$4 seat/month",
                "normalized_monthly_ils": "126.60",
                "basis": "10 seats, official pricing page",
                "source_url": "https://lattice.com/pricing",
            },
        ],
    },
    "grow": {
        "module_name": "CLICK Grow",
        "market_category": "Career Growth / Development / Performance Enablement",
        "benchmark_window_ils": "₪127-₪348 לחודש לצוות של 10 משתמשים",
        "action": "הוזלה",
        "rationale": "כדי לעודד adoption, Grow צריך לשבת מעל Vibe אבל מתחת לפלטפורמות talent-management מלאות. ההמלצה מורידה מחיר ועדיין שומרת פרימיום מתון.",
        "recommended_price": {"base_price_ils": "199.00", "per_seat_ils": "14.00", "included_seats": 10, "setup_fee_ils": "890.00"},
        "anchors": [
            {
                "vendor": "Lattice",
                "product": "Grow",
                "price_display": "$4 seat/month",
                "normalized_monthly_ils": "126.60",
                "basis": "10 seats, add-on pricing",
                "source_url": "https://lattice.com/pricing",
            },
            {
                "vendor": "15Five",
                "product": "Perform",
                "price_display": "$11 user/month",
                "normalized_monthly_ils": "348.15",
                "basis": "10 users, billed annually",
                "source_url": "https://www.15five.com/pricing",
            },
        ],
    },
    "insights": {
        "module_name": "CLICK Insights",
        "market_category": "Advanced BI / Analytics",
        "benchmark_window_ils": "₪443-₪760 לחודש לצוות של 10 משתמשים",
        "action": "הוזלה מתונה",
        "rationale": "Insights צריך להישאר המודול האנליטי היקר במערכת, אבל המחיר הנוכחי קרוב מדי לקצה העליון של השוק. ההמלצה מורידה בסיס ודמי הקמה בלי לפגוע במיצוב.",
        "recommended_price": {"base_price_ils": "299.00", "per_seat_ils": "34.00", "included_seats": 3, "setup_fee_ils": "1490.00"},
        "anchors": [
            {
                "vendor": "Microsoft",
                "product": "Power BI Pro",
                "price_display": "$14 user/month",
                "normalized_monthly_ils": "443.10",
                "basis": "10 users, paid yearly",
                "source_url": "https://www.microsoft.com/en-us/power-platform/products/power-bi/pricing",
            },
            {
                "vendor": "Microsoft",
                "product": "Power BI Premium Per User",
                "price_display": "$24 user/month",
                "normalized_monthly_ils": "759.60",
                "basis": "10 users, paid yearly",
                "source_url": "https://www.microsoft.com/en-us/power-platform/products/power-bi/pricing",
            },
        ],
    },
}


def build_module_pricing_research(current_prices: dict[str, ModulePrice | None]) -> ModulePricingResearchOut:
    items: list[ModulePricingRecommendationOut] = []

    for slug, config in RECOMMENDATION_CATALOG.items():
        current_row = current_prices.get(slug)
        current_out = ModulePriceOut.model_validate(current_row) if current_row else None
        current_monthly = (
            _monthly_total(
                current_row.base_price_ils,
                current_row.per_seat_ils,
                current_row.included_seats,
                BENCHMARK_TEAM_SIZE,
            )
            if current_row
            else Decimal("0")
        )

        recommended_price = RecommendedModulePrice(
            base_price_ils=Decimal(config["recommended_price"]["base_price_ils"]),
            per_seat_ils=Decimal(config["recommended_price"]["per_seat_ils"]),
            included_seats=config["recommended_price"]["included_seats"],
            setup_fee_ils=Decimal(config["recommended_price"]["setup_fee_ils"]),
        )
        recommended_monthly = _monthly_total(
            recommended_price.base_price_ils,
            recommended_price.per_seat_ils,
            recommended_price.included_seats,
            BENCHMARK_TEAM_SIZE,
        )

        anchors = [
            MarketPriceAnchor(
                vendor=anchor["vendor"],
                product=anchor["product"],
                price_display=anchor["price_display"],
                normalized_monthly_ils=Decimal(anchor["normalized_monthly_ils"]),
                basis=anchor["basis"],
                source_url=anchor["source_url"],
            )
            for anchor in config["anchors"]
        ]

        items.append(
            ModulePricingRecommendationOut(
                module_slug=slug,
                module_name=config["module_name"],
                market_category=config["market_category"],
                benchmark_team_size=BENCHMARK_TEAM_SIZE,
                benchmark_window_ils=config["benchmark_window_ils"],
                action=config["action"],
                rationale=config["rationale"],
                current_price=current_out,
                recommended_price=recommended_price,
                current_monthly_at_benchmark_ils=current_monthly,
                recommended_monthly_at_benchmark_ils=recommended_monthly,
                monthly_delta_ils=_round2(recommended_monthly - current_monthly),
                setup_delta_ils=_round2(
                    recommended_price.setup_fee_ils - (current_row.setup_fee_ils if current_row else Decimal("0"))
                ),
                anchors=anchors,
            )
        )

    return ModulePricingResearchOut(
        as_of=AS_OF,
        exchange_rate_usd_ils=USD_ILS,
        exchange_rate_eur_ils=EUR_ILS,
        positioning=POSITIONING,
        methodology=METHODOLOGY,
        modules=items,
    )
