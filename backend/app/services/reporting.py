import base64
import csv
import io
import uuid
from collections import defaultdict
from datetime import UTC, date, datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Any

from bidi.algorithm import get_display
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import select
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import CurrentUser
from app.models.admin_user import AdminUser
from app.models.module import Module, ModulePrice
from app.models.saved_report_view import SavedReportView
from app.models.tenant import Tenant, TenantIdentity, TenantStatus, TenantSubscription, TenantSubscriptionModule
from app.schemas.reporting import (
    ReportCatalogItem,
    ReportCatalogResponse,
    ReportDatasetDefinition,
    ReportDatasetsResponse,
    ReportDefinition,
    ReportExportRequest,
    ReportExportResponse,
    ReportFieldDefinition,
    ReportFilterOptions,
    ReportFilterOption,
    ReportMetricDefinition,
    ReportMetricRequest,
    ReportMetricValue,
    ReportQueryRequest,
    ReportResult,
    SavedReportViewCreate,
    SavedReportViewOut,
    SavedReportViewUpdate,
)

FONT_NAME = "NotoSansHebrew"
FONT_PATH = Path(__file__).resolve().parent.parent / "assets" / "fonts" / "NotoSansHebrew-Regular.ttf"
TENANT_STATUS_OPTIONS = [
    ReportFilterOption(value="active", label="Active"),
    ReportFilterOption(value="trial", label="Trial"),
    ReportFilterOption(value="suspended", label="Suspended"),
    ReportFilterOption(value="cancelled", label="Cancelled"),
]


def _register_font() -> None:
    try:
        pdfmetrics.getFont(FONT_NAME)
    except KeyError:
        pdfmetrics.registerFont(TTFont(FONT_NAME, str(FONT_PATH)))


def _rtl(text: str | None) -> str:
    value = str(text or "")
    return get_display(value) if any("\u0590" <= ch <= "\u05FF" for ch in value) else value


def _fmt_int(value: int | float) -> str:
    return f"{int(value):,}"


def _fmt_decimal(value: Decimal | int | float | None) -> str:
    if value is None:
        return "0"
    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    return f"{value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP):,}"


def _fmt_value(value: Any) -> str:
    if value is None:
        return "—"
    if isinstance(value, bool):
        return "כן" if value else "לא"
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return _fmt_decimal(value)
    return str(value)


def _seat_bucket(seat_count: int) -> str:
    if seat_count <= 10:
        return "0-10"
    if seat_count <= 25:
        return "11-25"
    if seat_count <= 50:
        return "26-50"
    if seat_count <= 100:
        return "51-100"
    return "101+"


def _metric_label(metric: ReportMetricRequest) -> str:
    if metric.label:
        return metric.label
    if metric.operation == "count":
        return "Rows"
    if metric.operation == "count_distinct":
        return f"Distinct {metric.field or 'value'}"
    return f"{metric.operation.upper()} {metric.field or ''}".strip()


DATASETS = [
    ReportDatasetDefinition(
        id="tenant_snapshot",
        label="לקוחות",
        description="שורה אחת לכל לקוח, כולל סטטוס, חידוש, מושבים ומספר מודולים.",
        fields=[
            ReportFieldDefinition(id="tenant_id", label="Tenant ID", type="uuid", operators=["equals", "not_equals"]),
            ReportFieldDefinition(id="org_number", label="מספר ארגון", type="number", operators=["equals", "greater_than", "less_than"], groupable=True),
            ReportFieldDefinition(id="tenant_name", label="לקוח", type="string", operators=["equals", "contains", "in"], groupable=True),
            ReportFieldDefinition(id="tax_id", label="ח.פ", type="string", operators=["equals", "contains"]),
            ReportFieldDefinition(id="tenant_status", label="סטטוס לקוח", type="string", operators=["equals", "not_equals", "in"], groupable=True),
            ReportFieldDefinition(id="seat_count", label="מושבים", type="number", operators=["equals", "greater_than", "greater_or_equal", "less_than", "less_or_equal"]),
            ReportFieldDefinition(id="module_count", label="כמות מודולים", type="number", operators=["equals", "greater_than", "less_than"]),
            ReportFieldDefinition(id="module_names", label="מודולים", type="string", operators=["contains"]),
            ReportFieldDefinition(id="billing_cycle", label="מחזור חיוב", type="string", operators=["equals", "not_equals"], groupable=True),
            ReportFieldDefinition(id="next_renewal_at", label="חידוש הבא", type="date", operators=["equals", "greater_than", "greater_or_equal", "less_than", "less_or_equal"], groupable=True),
        ],
        default_columns=["org_number", "tenant_name", "tenant_status", "seat_count", "module_count", "next_renewal_at"],
        groupable_fields=["tenant_status", "billing_cycle", "next_renewal_at"],
        metrics=[
            ReportMetricDefinition(operation="count", label="לקוחות"),
            ReportMetricDefinition(operation="sum", field="seat_count", label='סה"כ מושבים'),
            ReportMetricDefinition(operation="avg", field="seat_count", label="ממוצע מושבים"),
        ],
    ),
    ReportDatasetDefinition(
        id="tenant_module_snapshot",
        label="לקוחות לפי מודול",
        description="שורה לכל שיוך לקוח-מודול, כולל תאריך התחלה, סטטוס ומושבים.",
        fields=[
            ReportFieldDefinition(id="tenant_id", label="Tenant ID", type="uuid", operators=["equals", "not_equals"]),
            ReportFieldDefinition(id="org_number", label="מספר ארגון", type="number", operators=["equals", "greater_than", "less_than"]),
            ReportFieldDefinition(id="tenant_name", label="לקוח", type="string", operators=["equals", "contains", "in"], groupable=True),
            ReportFieldDefinition(id="tenant_status", label="סטטוס לקוח", type="string", operators=["equals", "not_equals", "in"], groupable=True),
            ReportFieldDefinition(id="module_slug", label="קוד מודול", type="string", operators=["equals", "not_equals", "in"], groupable=True),
            ReportFieldDefinition(id="module_name", label="מודול", type="string", operators=["equals", "contains", "in"], groupable=True),
            ReportFieldDefinition(id="module_seats", label="מושבי מודול", type="number", operators=["equals", "greater_than", "greater_or_equal", "less_than", "less_or_equal"]),
            ReportFieldDefinition(id="subscription_seat_count", label="מושבי לקוח", type="number", operators=["equals", "greater_than", "greater_or_equal", "less_than", "less_or_equal"]),
            ReportFieldDefinition(id="valid_from", label="מתאריך", type="date", operators=["equals", "greater_than", "greater_or_equal", "less_than", "less_or_equal"], groupable=True),
            ReportFieldDefinition(id="source_type", label="מקור", type="string", operators=["equals", "not_equals", "in"], groupable=True),
            ReportFieldDefinition(id="pricing_mode", label="תמחור", type="string", operators=["equals", "not_equals", "in"], groupable=True),
            ReportFieldDefinition(id="next_renewal_at", label="חידוש הבא", type="date", operators=["equals", "greater_than", "less_than"], groupable=True),
        ],
        default_columns=["tenant_name", "module_name", "module_seats", "tenant_status", "valid_from", "next_renewal_at"],
        groupable_fields=["module_name", "module_slug", "tenant_status", "source_type", "pricing_mode", "valid_from"],
        metrics=[
            ReportMetricDefinition(operation="count", label="שיוכי מודול"),
            ReportMetricDefinition(operation="count_distinct", field="tenant_id", label="לקוחות"),
            ReportMetricDefinition(operation="sum", field="module_seats", label='סה"כ מושבי מודול'),
            ReportMetricDefinition(operation="avg", field="module_seats", label="ממוצע מושבי מודול"),
        ],
    ),
    ReportDatasetDefinition(
        id="module_summary",
        label="סיכום מודולים",
        description="סיכום אגרגטיבי לפי מודול: כמה לקוחות, כמה מושבים ומתי הוקצה.",
        fields=[
            ReportFieldDefinition(id="module_slug", label="קוד מודול", type="string", operators=["equals", "not_equals", "in"], groupable=True),
            ReportFieldDefinition(id="module_name", label="מודול", type="string", operators=["equals", "contains", "in"], groupable=True),
            ReportFieldDefinition(id="tenant_count", label="לקוחות", type="number", operators=["equals", "greater_than", "less_than"]),
            ReportFieldDefinition(id="total_seats", label='סה"כ מושבים', type="number", operators=["equals", "greater_than", "less_than"]),
            ReportFieldDefinition(id="avg_seats", label="ממוצע מושבים", type="number", operators=["equals", "greater_than", "less_than"]),
            ReportFieldDefinition(id="first_assigned_at", label="שיוך ראשון", type="date", operators=["equals", "greater_than", "less_than"], groupable=True),
            ReportFieldDefinition(id="last_assigned_at", label="שיוך אחרון", type="date", operators=["equals", "greater_than", "less_than"], groupable=True),
        ],
        default_columns=["module_name", "tenant_count", "total_seats", "avg_seats", "first_assigned_at"],
        groupable_fields=["module_name", "first_assigned_at", "last_assigned_at"],
        metrics=[
            ReportMetricDefinition(operation="count", label="מודולים"),
            ReportMetricDefinition(operation="sum", field="tenant_count", label='סה"כ לקוחות'),
            ReportMetricDefinition(operation="sum", field="total_seats", label='סה"כ מושבים'),
        ],
    ),
    ReportDatasetDefinition(
        id="seat_distribution",
        label="פילוח מושבים",
        description="פילוח לקוחות לפי טווחי מושבים.",
        fields=[
            ReportFieldDefinition(id="seat_bucket", label="טווח מושבים", type="string", operators=["equals", "in"], groupable=True),
            ReportFieldDefinition(id="tenant_count", label="לקוחות", type="number", operators=["equals", "greater_than", "less_than"]),
            ReportFieldDefinition(id="total_seats", label='סה"כ מושבים', type="number", operators=["equals", "greater_than", "less_than"]),
            ReportFieldDefinition(id="avg_seats", label="ממוצע מושבים", type="number", operators=["equals", "greater_than", "less_than"]),
        ],
        default_columns=["seat_bucket", "tenant_count", "total_seats", "avg_seats"],
        groupable_fields=["seat_bucket"],
        metrics=[
            ReportMetricDefinition(operation="count", label="טווחים"),
            ReportMetricDefinition(operation="sum", field="tenant_count", label='סה"כ לקוחות'),
            ReportMetricDefinition(operation="sum", field="total_seats", label='סה"כ מושבים'),
        ],
    ),
]

DATASET_MAP = {dataset.id: dataset for dataset in DATASETS}

CATALOG = [
    ReportCatalogItem(
        id="customers_by_module",
        title="לקוחות לפי מודול",
        description="אילו לקוחות מחזיקים כל מודול, מאיזה תאריך ובכמה מושבים.",
        dataset="tenant_module_snapshot",
        definition=ReportDefinition(
            dataset="tenant_module_snapshot",
            columns=["tenant_name", "module_name", "module_seats", "valid_from", "tenant_status"],
            sort=[{"field": "valid_from", "direction": "desc"}],
            metrics=[
                {"operation": "count_distinct", "field": "tenant_id", "label": "לקוחות"},
                {"operation": "sum", "field": "module_seats", "label": 'סה"כ מושבי מודול'},
            ],
        ),
    ),
    ReportCatalogItem(
        id="customers_with_large_seats",
        title="לקוחות מעל סף מושבים",
        description="רשימת לקוחות לפי היקף מושבים עם חידוש ומספר מודולים.",
        dataset="tenant_snapshot",
        definition=ReportDefinition(
            dataset="tenant_snapshot",
            columns=["tenant_name", "seat_count", "module_count", "tenant_status", "next_renewal_at"],
            sort=[{"field": "seat_count", "direction": "desc"}],
            metrics=[
                {"operation": "count", "label": "לקוחות"},
                {"operation": "sum", "field": "seat_count", "label": 'סה"כ מושבים'},
            ],
        ),
    ),
    ReportCatalogItem(
        id="module_customer_map",
        title="מפת מודולים ללקוחות",
        description="תצוגת detail מלאה של לקוח-מודול לצוותי CS, מכירות ותפעול.",
        dataset="tenant_module_snapshot",
        definition=ReportDefinition(
            dataset="tenant_module_snapshot",
            columns=["org_number", "tenant_name", "module_name", "module_seats", "source_type", "pricing_mode", "valid_from"],
            sort=[{"field": "tenant_name", "direction": "asc"}],
            metrics=[
                {"operation": "count", "label": "שיוכים"},
                {"operation": "count_distinct", "field": "tenant_id", "label": "לקוחות"},
            ],
        ),
    ),
    ReportCatalogItem(
        id="module_adoption_summary",
        title="סיכום אימוץ מודולים",
        description="כמה לקוחות וכמה מושבים יש לכל מודול במועד המבוקש.",
        dataset="module_summary",
        definition=ReportDefinition(
            dataset="module_summary",
            columns=["module_name", "tenant_count", "total_seats", "avg_seats", "last_assigned_at"],
            sort=[{"field": "tenant_count", "direction": "desc"}],
            metrics=[
                {"operation": "sum", "field": "tenant_count", "label": 'סה"כ לקוחות'},
                {"operation": "sum", "field": "total_seats", "label": 'סה"כ מושבים'},
            ],
        ),
    ),
    ReportCatalogItem(
        id="renewals_watchlist",
        title="לקוחות לחידוש קרוב",
        description="מעקב אחר לקוחות שמתקרבים לחידוש עם נפח מושבים ומודולים.",
        dataset="tenant_snapshot",
        definition=ReportDefinition(
            dataset="tenant_snapshot",
            columns=["tenant_name", "tenant_status", "seat_count", "module_count", "next_renewal_at"],
            sort=[{"field": "next_renewal_at", "direction": "asc"}],
            metrics=[
                {"operation": "count", "label": "לקוחות"},
                {"operation": "avg", "field": "seat_count", "label": "ממוצע מושבים"},
            ],
        ),
    ),
]


def _effective(record: Any, as_of: date) -> bool:
    valid_from = getattr(record, "valid_from", None)
    valid_to = getattr(record, "valid_to", None)
    if valid_from and valid_from > as_of:
        return False
    if valid_to and valid_to <= as_of:
        return False
    return True


def _pick_temporal(records: list[Any], key_attr: str, as_of: date) -> dict[Any, Any]:
    grouped: dict[Any, list[Any]] = defaultdict(list)
    for record in records:
        if _effective(record, as_of):
            grouped[getattr(record, key_attr)].append(record)
    selected: dict[Any, Any] = {}
    for key, items in grouped.items():
        selected[key] = max(items, key=lambda item: getattr(item, "valid_from", date.min) or date.min)
    return selected


async def _load_filter_options(db: AsyncSession) -> ReportFilterOptions:
    module_result = await db.execute(
        select(Module).where(Module.is_active == True).order_by(Module.sort_order, Module.name)  # noqa: E712
    )
    modules = module_result.scalars().all()
    return ReportFilterOptions(
        tenant_statuses=TENANT_STATUS_OPTIONS,
        modules=[ReportFilterOption(value=module.slug, label=module.name) for module in modules],
    )


async def get_catalog(db: AsyncSession) -> ReportCatalogResponse:
    return ReportCatalogResponse(reports=CATALOG, filter_options=await _load_filter_options(db))


async def get_datasets(db: AsyncSession) -> ReportDatasetsResponse:
    return ReportDatasetsResponse(datasets=DATASETS, filter_options=await _load_filter_options(db))


async def _load_snapshot_rows(db: AsyncSession, as_of: date) -> dict[str, list[dict[str, Any]]]:
    tenant_result = await db.execute(select(Tenant))
    identity_result = await db.execute(select(TenantIdentity))
    status_result = await db.execute(select(TenantStatus))
    subscription_result = await db.execute(select(TenantSubscription))
    module_result = await db.execute(select(Module))
    module_price_result = await db.execute(select(ModulePrice))
    subscription_module_result = await db.execute(select(TenantSubscriptionModule))

    tenants = tenant_result.scalars().all()
    identities = _pick_temporal(identity_result.scalars().all(), "tenant_id", as_of)
    statuses = _pick_temporal(status_result.scalars().all(), "tenant_id", as_of)
    subscriptions = _pick_temporal(subscription_result.scalars().all(), "tenant_id", as_of)
    modules = {row.slug: row for row in module_result.scalars().all()}
    prices = _pick_temporal(module_price_result.scalars().all(), "module_slug", as_of)

    module_rows_by_subscription: dict[uuid.UUID, list[TenantSubscriptionModule]] = defaultdict(list)
    effective_modules: dict[tuple[uuid.UUID, str], TenantSubscriptionModule] = {}
    for row in subscription_module_result.scalars().all():
        if not _effective(row, as_of) or row.status != "active":
            continue
        key = (row.tenant_subscription_id, row.module_slug)
        current = effective_modules.get(key)
        if current is None or (current.valid_from or date.min) < (row.valid_from or date.min):
            effective_modules[key] = row
    for row in effective_modules.values():
        module_rows_by_subscription[row.tenant_subscription_id].append(row)

    tenant_snapshot_rows: list[dict[str, Any]] = []
    tenant_module_rows: list[dict[str, Any]] = []

    for tenant in tenants:
        identity = identities.get(tenant.tenant_id)
        status = statuses.get(tenant.tenant_id)
        subscription = subscriptions.get(tenant.tenant_id)
        subscription_modules = module_rows_by_subscription.get(subscription.id, []) if subscription else []
        module_names = [modules[row.module_slug].name if row.module_slug in modules else row.module_slug for row in subscription_modules]
        tenant_snapshot_rows.append(
            {
                "tenant_id": tenant.tenant_id,
                "org_number": tenant.org_number,
                "tenant_name": getattr(identity, "name_he", None) or f"Tenant {tenant.org_number}",
                "tax_id": getattr(identity, "tax_id", None),
                "tenant_status": getattr(status, "status", None) or "unknown",
                "seat_count": int(getattr(subscription, "seat_count", 0) or 0),
                "module_count": len(subscription_modules),
                "module_names": ", ".join(module_names),
                "billing_cycle": getattr(subscription, "billing_cycle", None),
                "next_renewal_at": getattr(subscription, "next_renewal_at", None),
            }
        )
        for row in subscription_modules:
            price = prices.get(row.module_slug)
            tenant_module_rows.append(
                {
                    "tenant_id": tenant.tenant_id,
                    "org_number": tenant.org_number,
                    "tenant_name": getattr(identity, "name_he", None) or f"Tenant {tenant.org_number}",
                    "tenant_status": getattr(status, "status", None) or "unknown",
                    "module_slug": row.module_slug,
                    "module_name": modules[row.module_slug].name if row.module_slug in modules else row.module_slug,
                    "module_seats": int(row.seats or 0),
                    "subscription_seat_count": int(getattr(subscription, "seat_count", 0) or 0),
                    "valid_from": row.valid_from,
                    "source_type": row.source_type,
                    "pricing_mode": row.pricing_mode,
                    "next_renewal_at": getattr(subscription, "next_renewal_at", None),
                    "base_price_ils": getattr(price, "base_price_ils", None),
                    "per_seat_ils": getattr(price, "per_seat_ils", None),
                }
            )

    grouped_modules: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in tenant_module_rows:
        grouped_modules[row["module_slug"]].append(row)

    module_summary_rows = []
    for slug, rows in grouped_modules.items():
        seats = [int(item["module_seats"] or 0) for item in rows]
        module_summary_rows.append(
            {
                "module_slug": slug,
                "module_name": rows[0]["module_name"],
                "tenant_count": len({item["tenant_id"] for item in rows}),
                "total_seats": sum(seats),
                "avg_seats": round(sum(seats) / len(seats), 2) if seats else 0,
                "first_assigned_at": min(item["valid_from"] for item in rows if item["valid_from"]),
                "last_assigned_at": max(item["valid_from"] for item in rows if item["valid_from"]),
            }
        )

    seat_distribution_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in tenant_snapshot_rows:
        seat_distribution_groups[_seat_bucket(int(row["seat_count"] or 0))].append(row)

    bucket_order = {"0-10": 1, "11-25": 2, "26-50": 3, "51-100": 4, "101+": 5}
    seat_distribution_rows = []
    for bucket, rows in seat_distribution_groups.items():
        seats = [int(item["seat_count"] or 0) for item in rows]
        seat_distribution_rows.append(
            {
                "seat_bucket": bucket,
                "tenant_count": len(rows),
                "total_seats": sum(seats),
                "avg_seats": round(sum(seats) / len(seats), 2) if seats else 0,
                "bucket_order": bucket_order[bucket],
            }
        )

    return {
        "tenant_snapshot": tenant_snapshot_rows,
        "tenant_module_snapshot": tenant_module_rows,
        "module_summary": module_summary_rows,
        "seat_distribution": seat_distribution_rows,
    }


def _normalize_compare_value(value: Any) -> Any:
    if isinstance(value, str):
        return value.strip()
    return value


def _coerce_filter_value(field_type: str, value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, list):
        return [_coerce_filter_value(field_type, item) for item in value]
    if field_type == "number":
        if value == "":
            return None
        if "." in str(value):
            return Decimal(str(value))
        return int(value)
    if field_type in {"date", "datetime"} and isinstance(value, str) and value:
        return date.fromisoformat(value[:10])
    if field_type == "uuid" and isinstance(value, str) and value:
        return uuid.UUID(value)
    return value


def _match_filter(row_value: Any, operator: str, expected: Any) -> bool:
    row_value = _normalize_compare_value(row_value)
    expected = _normalize_compare_value(expected)
    if operator == "is_null":
        return row_value is None
    if operator == "is_not_null":
        return row_value is not None
    if operator in {"in", "not_in"} and isinstance(expected, str):
        expected = [part.strip() for part in expected.split(",") if part.strip()]
    if operator == "equals":
        return row_value == expected
    if operator == "not_equals":
        return row_value != expected
    if operator == "contains":
        if row_value is None:
            return False
        return str(expected).lower() in str(row_value).lower()
    if operator == "greater_than":
        return row_value is not None and row_value > expected
    if operator == "greater_or_equal":
        return row_value is not None and row_value >= expected
    if operator == "less_than":
        return row_value is not None and row_value < expected
    if operator == "less_or_equal":
        return row_value is not None and row_value <= expected
    if operator == "in":
        return row_value in expected if isinstance(expected, list) else False
    if operator == "not_in":
        return row_value not in expected if isinstance(expected, list) else True
    return True


def _apply_filters(rows: list[dict[str, Any]], definition: ReportDefinition) -> list[dict[str, Any]]:
    field_types = {field.id: field.type for field in DATASET_MAP[definition.dataset].fields}
    filtered = rows
    for rule in definition.filters:
        expected = _coerce_filter_value(field_types.get(rule.field, "string"), rule.value)
        filtered = [row for row in filtered if _match_filter(row.get(rule.field), rule.operator, expected)]
    return filtered


def _apply_sort(rows: list[dict[str, Any]], definition: ReportDefinition) -> list[dict[str, Any]]:
    sorted_rows = list(rows)
    for sort_rule in reversed(definition.sort):
        sorted_rows.sort(
            key=lambda row: (row.get(sort_rule.field) is None, row.get(sort_rule.field)),
            reverse=sort_rule.direction == "desc",
        )
    return sorted_rows


def _metric_value(rows: list[dict[str, Any]], metric: ReportMetricRequest) -> Any:
    if metric.operation == "count":
        return len(rows)
    if metric.operation == "count_distinct":
        return len({row.get(metric.field) for row in rows if row.get(metric.field) is not None})
    numeric_values = [Decimal(str(row.get(metric.field) or 0)) for row in rows if row.get(metric.field) is not None]
    if metric.operation == "sum":
        return sum(numeric_values, Decimal("0"))
    if metric.operation == "avg":
        return (sum(numeric_values, Decimal("0")) / Decimal(len(numeric_values))) if numeric_values else Decimal("0")
    return Decimal("0")


def _build_summary(rows: list[dict[str, Any]], definition: ReportDefinition) -> list[ReportMetricValue]:
    metric_requests = definition.metrics
    if not metric_requests:
        metric_requests = [
            ReportMetricRequest(operation=metric.operation, field=metric.field, label=metric.label)
            for metric in DATASET_MAP[definition.dataset].metrics
        ]
    return [ReportMetricValue(label=_metric_label(metric), value=_fmt_value(_metric_value(rows, metric))) for metric in metric_requests]


def _build_grouped_rows(rows: list[dict[str, Any]], definition: ReportDefinition) -> tuple[list[str], list[dict[str, Any]]]:
    metrics = definition.metrics or [
        ReportMetricRequest(operation=metric.operation, field=metric.field, label=metric.label)
        for metric in DATASET_MAP[definition.dataset].metrics
    ]
    if not definition.group_by:
        grouped_row = {(_metric_label(metric)): _metric_value(rows, metric) for metric in metrics}
        columns = list(grouped_row.keys())
        return columns, [grouped_row]

    grouped: dict[tuple[Any, ...], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        grouped[tuple(row.get(field) for field in definition.group_by)].append(row)

    result_rows: list[dict[str, Any]] = []
    columns = [*definition.group_by, *[_metric_label(metric) for metric in metrics]]
    for key, group_rows in grouped.items():
        item = {field: key[idx] for idx, field in enumerate(definition.group_by)}
        for metric in metrics:
            item[_metric_label(metric)] = _metric_value(group_rows, metric)
        result_rows.append(item)
    return columns, result_rows


def _project_rows(rows: list[dict[str, Any]], columns: list[str]) -> list[dict[str, Any]]:
    return [{column: row.get(column) for column in columns} for row in rows]


async def execute_report_query(db: AsyncSession, request: ReportQueryRequest) -> ReportResult:
    definition = request.definition
    if definition.dataset not in DATASET_MAP:
        raise ValueError("Unknown dataset")
    if definition.limit < 1:
        raise ValueError("Limit must be positive")
    as_of = definition.as_of_date or date.today()
    source_rows = (await _load_snapshot_rows(db, as_of))[definition.dataset]
    filtered_rows = _apply_filters(source_rows, definition)
    filtered_rows = _apply_sort(filtered_rows, definition)
    summary = _build_summary(filtered_rows, definition)

    if definition.view_mode == "summary":
        columns, grouped_rows = _build_grouped_rows(filtered_rows, definition)
        grouped_rows = _apply_sort(grouped_rows, ReportDefinition(dataset=definition.dataset, sort=definition.sort))
        total = len(grouped_rows)
        paged_rows = grouped_rows[definition.offset:definition.offset + min(definition.limit, 1000)]
        return ReportResult(
            columns=columns,
            rows=[{key: _fmt_value(value) for key, value in row.items()} for row in paged_rows],
            total=total,
            summary=summary,
            applied_definition=definition,
        )

    columns = definition.columns or DATASET_MAP[definition.dataset].default_columns
    total = len(filtered_rows)
    paged_rows = _project_rows(filtered_rows[definition.offset:definition.offset + min(definition.limit, 1000)], columns)
    return ReportResult(
        columns=columns,
        rows=[{key: _fmt_value(value) for key, value in row.items()} for row in paged_rows],
        total=total,
        summary=summary,
        applied_definition=definition,
    )


def _render_csv(title: str | None, result: ReportResult) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([title or "CLICK Reports"])
    writer.writerow(["Generated at", datetime.now(UTC).isoformat()])
    writer.writerow(["Dataset", result.applied_definition.dataset])
    writer.writerow(["Total", result.total])
    writer.writerow([])
    if result.summary:
        writer.writerow(["Summary"])
        for metric in result.summary:
            writer.writerow([metric.label, metric.value])
        writer.writerow([])
    if result.columns:
        writer.writerow(result.columns)
    for row in result.rows:
        writer.writerow([row.get(column, "") for column in result.columns])
    return output.getvalue()


def _render_pdf(title: str | None, result: ReportResult) -> bytes:
    _register_font()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=14 * mm,
        leftMargin=14 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
    )
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="ReportBody", parent=styles["BodyText"], fontName=FONT_NAME, fontSize=9, leading=12, alignment=TA_RIGHT))
    styles.add(ParagraphStyle(name="ReportTitle", parent=styles["Heading1"], fontName=FONT_NAME, fontSize=18, leading=22, alignment=TA_RIGHT, textColor=colors.HexColor("#0f172a")))
    story = [
        Paragraph(_rtl(title or "CLICK Reports"), styles["ReportTitle"]),
        Spacer(1, 4),
        Paragraph(_rtl(f"Dataset: {result.applied_definition.dataset}"), styles["ReportBody"]),
        Spacer(1, 8),
    ]
    if result.summary:
        summary_table = Table(
            [[Paragraph(_rtl(metric.label), styles["ReportBody"]), Paragraph(_rtl(metric.value), styles["ReportBody"])] for metric in result.summary],
            colWidths=[55 * mm, 115 * mm],
            hAlign="RIGHT",
        )
        summary_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
        ]))
        story.extend([summary_table, Spacer(1, 10)])
    if result.rows:
        data = [[Paragraph(_rtl(column), styles["ReportBody"]) for column in result.columns]]
        for row in result.rows:
            data.append([Paragraph(_rtl(str(row.get(column, "—"))), styles["ReportBody"]) for column in result.columns])
        width = 180 * mm / max(len(result.columns), 1)
        table = Table(data, colWidths=[width] * len(result.columns), repeatRows=1, hAlign="RIGHT")
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
        ]))
        story.append(table)
    doc.build(story)
    return buffer.getvalue()


async def export_report(db: AsyncSession, request: ReportExportRequest) -> ReportExportResponse:
    result = await execute_report_query(db, ReportQueryRequest(title=request.title, definition=request.definition))
    safe_name = (request.title or request.definition.dataset).lower().replace(" ", "-").replace("/", "-")
    if request.format == "csv":
        raw = _render_csv(request.title, result)
        return ReportExportResponse(
            file_name=f"{safe_name}.csv",
            mime_type="text/csv; charset=utf-8",
            content_base64=base64.b64encode(raw.encode("utf-8-sig")).decode("ascii"),
        )
    raw = _render_pdf(request.title, result)
    return ReportExportResponse(
        file_name=f"{safe_name}.pdf",
        mime_type="application/pdf",
        content_base64=base64.b64encode(raw).decode("ascii"),
    )


def _saved_to_out(row: SavedReportView, owner_name: str | None) -> SavedReportViewOut:
    definition = ReportDefinition.model_validate(row.definition_json)
    return SavedReportViewOut(
        id=row.id,
        name=row.name,
        description=row.description,
        dataset=row.dataset,
        visibility=row.visibility,
        owner_id=row.owner_id,
        owner_name=owner_name,
        created_at=row.created_at,
        updated_at=row.updated_at,
        definition=definition,
    )


async def list_saved_reports(db: AsyncSession, current_user: CurrentUser) -> list[SavedReportViewOut]:
    try:
        result = await db.execute(
            select(SavedReportView, AdminUser.full_name)
            .join(AdminUser, AdminUser.id == SavedReportView.owner_id)
            .where((SavedReportView.owner_id == current_user.id) | (SavedReportView.visibility == "shared"))
            .order_by(SavedReportView.updated_at.desc().nullslast(), SavedReportView.created_at.desc())
        )
    except ProgrammingError as exc:
        if "saved_report_views" in str(exc).lower():
            return []
        raise
    return [_saved_to_out(row, owner_name) for row, owner_name in result.all()]


async def create_saved_report(db: AsyncSession, body: SavedReportViewCreate, current_user: CurrentUser) -> SavedReportViewOut:
    if body.definition.dataset not in DATASET_MAP:
        raise ValueError("Unknown dataset")
    row = SavedReportView(
        name=body.name,
        description=body.description,
        dataset=body.definition.dataset,
        definition_json=body.definition.model_dump(mode="json"),
        visibility=body.visibility,
        owner_id=current_user.id,
    )
    db.add(row)
    await db.flush()
    await db.refresh(row)
    result = await db.execute(select(AdminUser.full_name).where(AdminUser.id == current_user.id))
    return _saved_to_out(row, result.scalar_one_or_none())


async def update_saved_report(
    db: AsyncSession,
    report_id: uuid.UUID,
    body: SavedReportViewUpdate,
    current_user: CurrentUser,
) -> SavedReportViewOut:
    result = await db.execute(select(SavedReportView).where(SavedReportView.id == report_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise ValueError("Saved report not found")
    if row.owner_id != current_user.id:
        raise PermissionError("Only the owner can edit this saved report")
    if body.name is not None:
        row.name = body.name
    if body.description is not None:
        row.description = body.description
    if body.visibility is not None:
        row.visibility = body.visibility
    if body.definition is not None:
        if body.definition.dataset not in DATASET_MAP:
            raise ValueError("Unknown dataset")
        row.dataset = body.definition.dataset
        row.definition_json = body.definition.model_dump(mode="json")
    row.updated_at = datetime.now(UTC)
    await db.flush()
    await db.refresh(row)
    owner_name_result = await db.execute(select(AdminUser.full_name).where(AdminUser.id == row.owner_id))
    return _saved_to_out(row, owner_name_result.scalar_one_or_none())


async def run_saved_report(db: AsyncSession, report_id: uuid.UUID, current_user: CurrentUser) -> ReportResult:
    result = await db.execute(select(SavedReportView).where(SavedReportView.id == report_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise ValueError("Saved report not found")
    if row.visibility != "shared" and row.owner_id != current_user.id:
        raise PermissionError("Saved report is not available")
    definition = ReportDefinition.model_validate(row.definition_json)
    return await execute_report_query(db, ReportQueryRequest(title=row.name, definition=definition))
