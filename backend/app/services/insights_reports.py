import base64
import csv
import io
from collections import Counter, defaultdict
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from bidi.algorithm import get_display
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.middleware.auth import CurrentUser
from app.models.admin_user import AdminUser
from app.models.audit_log import AuditLog
from app.models.module import Module
from app.models.tenant import (
    Tenant,
    TenantAddress,
    TenantIdentity,
    TenantStatus,
    TenantSubscription,
    TenantSubscriptionModule,
)
from app.schemas.insights import (
    InsightsCatalogResponse,
    InsightsFilterOptions,
    InsightsMetric,
    InsightsOption,
    InsightsReportCatalogItem,
    InsightsReportExportRequest,
    InsightsReportExportResponse,
    InsightsReportRequest,
    InsightsReportResponse,
    InsightsSection,
)
from app.services.subscription_modules import derive_subscription_snapshot

settings = get_settings()
FONT_NAME = "NotoSansHebrew"
FONT_PATH = Path(__file__).resolve().parent.parent / "assets" / "fonts" / "NotoSansHebrew-Regular.ttf"
REPORT_IDS = {"executive_overview", "tenant_portfolio", "module_adoption", "activity_audit", "billing_snapshot"}


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


def _fmt_currency(value: Decimal | int | float) -> str:
    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    return f"₪{value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP):,}"


def _fmt_pct(value: float) -> str:
    return f"{value:.0f}%"


def _fmt_date(value: date | datetime | None) -> str:
    if value is None:
        return "—"
    if isinstance(value, datetime):
        return value.date().isoformat()
    return value.isoformat()


def _status_label(value: str | None) -> str:
    labels = {
        "trial": "Trial",
        "active": "Active",
        "suspended": "Suspended",
        "cancelled": "Cancelled",
    }
    return labels.get(value or "", value or "Unknown")


async def build_catalog(db: AsyncSession, current_user: CurrentUser) -> InsightsCatalogResponse:
    module_result = await db.execute(
        select(Module).where(Module.is_active == True).order_by(Module.sort_order, Module.name)  # noqa: E712
    )
    modules = module_result.scalars().all()
    filter_options = InsightsFilterOptions(
        tenant_statuses=[
            InsightsOption(value="active", label="Active"),
            InsightsOption(value="trial", label="Trial"),
            InsightsOption(value="suspended", label="Suspended"),
            InsightsOption(value="cancelled", label="Cancelled"),
        ],
        modules=[InsightsOption(value=module.slug, label=module.name) for module in modules],
    )
    reports = [
        InsightsReportCatalogItem(
            id="executive_overview",
            title="Executive Overview",
            description="סיכום הנהלה עם סטטוס לקוחות, עומס חידושים ואימוץ מודולים.",
            audience="מנהלים ובעלי מערכת",
            supports_status_filter=True,
            supports_module_filter=True,
            default_row_limit=8,
        ),
        InsightsReportCatalogItem(
            id="tenant_portfolio",
            title="Tenant Portfolio",
            description="תמונה תפעולית מלאה של תיק הלקוחות, מושבים, מודולים וחידושים.",
            audience="Customer Success ו-Operations",
            supports_status_filter=True,
            supports_module_filter=True,
            default_row_limit=20,
        ),
        InsightsReportCatalogItem(
            id="module_adoption",
            title="Module Adoption",
            description="איזה מודולים מחזיקים הכי חזק, אצל מי, ובאיזה נפח שימוש.",
            audience="Product, Sales ו-CS",
            supports_status_filter=True,
            supports_module_filter=True,
            default_row_limit=15,
        ),
        InsightsReportCatalogItem(
            id="activity_audit",
            title="Activity & Audit",
            description="קצב פעילות, משתמשים מובילים, וישויות עם הכי הרבה שינויים.",
            audience="Admin ו-Compliance",
            supports_date_range=True,
            default_row_limit=15,
            is_available=current_user.is_super_admin() or current_user.can_view("audit"),
            availability_note=None
            if current_user.is_super_admin() or current_user.can_view("audit")
            else "דורש הרשאת Audit לצפייה.",
        ),
        InsightsReportCatalogItem(
            id="billing_snapshot",
            title="Billing Snapshot",
            description="תמונת גבייה וחיובים. מוכן להפעלה כשהמודול הפיננסי פעיל.",
            audience="Finance",
            supports_date_range=True,
            default_row_limit=15,
            is_available=settings.BILLING_ENABLED and (current_user.is_super_admin() or current_user.can_view("billing")),
            availability_note="Billing כבוי כרגע במערכת." if not settings.BILLING_ENABLED else None,
        ),
    ]
    return InsightsCatalogResponse(reports=reports, filter_options=filter_options)


async def generate_report(
    db: AsyncSession,
    request: InsightsReportRequest,
    current_user: CurrentUser,
) -> InsightsReportResponse:
    if request.report_id not in REPORT_IDS:
        raise ValueError("Unsupported report id")
    if request.filters.date_from and request.filters.date_to and request.filters.date_to < request.filters.date_from:
        raise ValueError("date_to cannot be earlier than date_from")
    if request.report_id == "activity_audit" and not (current_user.is_super_admin() or current_user.can_view("audit")):
        raise PermissionError("Missing audit permission")
    if request.report_id == "billing_snapshot":
        if not settings.BILLING_ENABLED:
            raise RuntimeError("Billing is disabled")
        if not (current_user.is_super_admin() or current_user.can_view("billing")):
            raise PermissionError("Missing billing permission")

    if request.report_id == "activity_audit":
        return await _build_activity_audit_report(db, request)
    if request.report_id == "tenant_portfolio":
        return await _build_tenant_portfolio_report(db, request)
    if request.report_id == "module_adoption":
        return await _build_module_adoption_report(db, request)
    if request.report_id == "billing_snapshot":
        return InsightsReportResponse(
            report_id=request.report_id,
            title=request.title or "Billing Snapshot",
            subtitle="Billing פעיל אך הדוח עדיין לא חובר למנוע החיובים ב-workspace הזה.",
            generated_at=datetime.now(UTC),
            applied_filters=[],
            summary=[],
            highlights=["Billing זמין ברמת המוצר, אבל כרגע הייצוא לא מחובר כאן לנתוני הגבייה."],
            sections=[],
        )
    return await _build_executive_overview_report(db, request)


async def export_report(
    db: AsyncSession,
    request: InsightsReportExportRequest,
    current_user: CurrentUser,
) -> InsightsReportExportResponse:
    report = await generate_report(db, request, current_user)
    safe_name = report.title.lower().replace(" ", "-").replace("/", "-")
    if request.format == "csv":
        raw = _render_csv(report)
        return InsightsReportExportResponse(
            file_name=f"{safe_name}.csv",
            mime_type="text/csv; charset=utf-8",
            content_base64=base64.b64encode(raw.encode("utf-8-sig")).decode("ascii"),
        )
    raw = _render_pdf(report)
    return InsightsReportExportResponse(
        file_name=f"{safe_name}.pdf",
        mime_type="application/pdf",
        content_base64=base64.b64encode(raw).decode("ascii"),
    )


async def _load_current_tenant_snapshots(db: AsyncSession, request: InsightsReportRequest) -> tuple[list[dict], dict[str, str]]:
    tenant_result = await db.execute(select(Tenant))
    identity_result = await db.execute(select(TenantIdentity).where(TenantIdentity.valid_to.is_(None)))
    status_result = await db.execute(select(TenantStatus).where(TenantStatus.valid_to.is_(None)))
    address_result = await db.execute(select(TenantAddress).where(TenantAddress.valid_to.is_(None)))
    subscription_result = await db.execute(select(TenantSubscription).where(TenantSubscription.valid_to.is_(None)))
    sub_module_result = await db.execute(
        select(TenantSubscriptionModule).where(
            TenantSubscriptionModule.valid_to.is_(None),
            TenantSubscriptionModule.status == "active",
        )
    )
    module_result = await db.execute(select(Module))

    identities = {row.tenant_id: row for row in identity_result.scalars().all()}
    statuses = {row.tenant_id: row for row in status_result.scalars().all()}
    addresses = {row.tenant_id: row for row in address_result.scalars().all()}
    subscriptions = {row.tenant_id: row for row in subscription_result.scalars().all()}
    module_map = {row.slug: row.name for row in module_result.scalars().all()}

    subscription_modules: dict[str, list[TenantSubscriptionModule]] = defaultdict(list)
    for row in sub_module_result.scalars().all():
        subscription_modules[str(row.tenant_subscription_id)].append(row)

    filtered_statuses = set(request.filters.tenant_statuses)
    filtered_modules = set(request.filters.module_slugs)

    snapshots: list[dict] = []
    for tenant in tenant_result.scalars().all():
        identity = identities.get(tenant.tenant_id)
        status = statuses.get(tenant.tenant_id)
        subscription = subscriptions.get(tenant.tenant_id)
        address = addresses.get(tenant.tenant_id)
        tenant_modules = subscription_modules.get(str(subscription.id), []) if subscription else []
        derived_seat_count, module_slugs = derive_subscription_snapshot(tenant_modules)
        if filtered_statuses and (status is None or status.status not in filtered_statuses):
            continue
        if filtered_modules and not filtered_modules.intersection(module_slugs):
            continue
        snapshots.append(
            {
                "tenant_id": tenant.tenant_id,
                "org_number": tenant.org_number,
                "name": getattr(identity, "name_he", None) or f"Tenant {tenant.org_number}",
                "status": getattr(status, "status", None) or "unknown",
                "industry_code": getattr(identity, "industry_code", None) or "—",
                "city": getattr(address, "city", None) or "—",
                "seat_count": derived_seat_count,
                "module_slugs": module_slugs,
                "module_names": [module_map.get(slug, slug) for slug in module_slugs],
                "module_count": len(module_slugs),
                "billing_cycle": getattr(subscription, "billing_cycle", None) or "—",
                "next_renewal_at": getattr(subscription, "next_renewal_at", None),
                "created_at": tenant.created_at,
            }
        )
    return snapshots, module_map


def _build_filter_metrics(request: InsightsReportRequest) -> list[InsightsMetric]:
    metrics = [InsightsMetric(label="Row limit", value=_fmt_int(request.filters.row_limit))]
    if request.filters.tenant_statuses:
        metrics.append(InsightsMetric(label="Statuses", value=", ".join(request.filters.tenant_statuses)))
    if request.filters.module_slugs:
        metrics.append(InsightsMetric(label="Modules", value=", ".join(request.filters.module_slugs)))
    if request.filters.date_from or request.filters.date_to:
        metrics.append(
            InsightsMetric(
                label="Date range",
                value=f"{_fmt_date(request.filters.date_from)} -> {_fmt_date(request.filters.date_to)}",
            )
        )
    return metrics


async def _build_executive_overview_report(db: AsyncSession, request: InsightsReportRequest) -> InsightsReportResponse:
    snapshots, module_map = await _load_current_tenant_snapshots(db, request)
    total_tenants = len(snapshots)
    status_counter = Counter(row["status"] for row in snapshots)
    adoption_counter = Counter(slug for row in snapshots for slug in row["module_slugs"])
    avg_seats = (sum(row["seat_count"] for row in snapshots) / total_tenants) if total_tenants else 0
    avg_modules = (sum(row["module_count"] for row in snapshots) / total_tenants) if total_tenants else 0
    active_ratio = (status_counter.get("active", 0) / total_tenants * 100) if total_tenants else 0
    upcoming = sorted(
        [row for row in snapshots if row["next_renewal_at"] is not None],
        key=lambda row: row["next_renewal_at"],
    )[: request.filters.row_limit]
    module_rows = [
        {
            "Module": module_map.get(slug, slug),
            "Tenants": _fmt_int(count),
            "Adoption": _fmt_pct((count / total_tenants * 100) if total_tenants else 0),
        }
        for slug, count in adoption_counter.most_common(request.filters.row_limit)
    ]
    status_rows = [
        {"Status": _status_label(status), "Tenants": _fmt_int(count)}
        for status, count in status_counter.most_common()
    ]
    renewal_rows = [
        {
            "Tenant": row["name"],
            "Status": _status_label(row["status"]),
            "Renewal": _fmt_date(row["next_renewal_at"]),
            "Modules": ", ".join(row["module_names"]) or "—",
        }
        for row in upcoming
    ]
    highlights = []
    if total_tenants:
        top_module = adoption_counter.most_common(1)[0] if adoption_counter else None
        if top_module:
            highlights.append(f"{module_map.get(top_module[0], top_module[0])} is currently the strongest module across {top_module[1]} tenants.")
        highlights.append(f"{_fmt_pct(active_ratio)} of the filtered portfolio is in Active status.")
        if upcoming:
            highlights.append(f"{upcoming[0]['name']} is the closest renewal on {_fmt_date(upcoming[0]['next_renewal_at'])}.")
    return InsightsReportResponse(
        report_id="executive_overview",
        title=request.title or "CLICK Insights Executive Overview",
        subtitle="Snapshot of customer health, adoption and renewal pressure.",
        generated_at=datetime.now(UTC),
        applied_filters=_build_filter_metrics(request),
        summary=[
            InsightsMetric(label="Filtered tenants", value=_fmt_int(total_tenants)),
            InsightsMetric(label="Active ratio", value=_fmt_pct(active_ratio)),
            InsightsMetric(label="Avg seats", value=f"{avg_seats:.1f}"),
            InsightsMetric(label="Avg modules", value=f"{avg_modules:.1f}"),
        ],
        highlights=highlights,
        sections=[
            InsightsSection(
                id="status_distribution",
                title="Portfolio Status",
                description="Current tenant status mix after filters.",
                columns=["Status", "Tenants"],
                rows=status_rows,
                empty_message="No tenants matched the selected filters.",
            ),
            InsightsSection(
                id="module_adoption",
                title="Module Adoption",
                description="Most adopted modules in the filtered portfolio.",
                columns=["Module", "Tenants", "Adoption"],
                rows=module_rows,
                empty_message="No module activity found for the current selection.",
            ),
            InsightsSection(
                id="renewal_watchlist",
                title="Renewal Watchlist",
                description="Closest upcoming renewals to inspect first.",
                columns=["Tenant", "Status", "Renewal", "Modules"],
                rows=renewal_rows,
                empty_message="No scheduled renewals are currently set.",
            ),
        ],
    )


async def _build_tenant_portfolio_report(db: AsyncSession, request: InsightsReportRequest) -> InsightsReportResponse:
    snapshots, _ = await _load_current_tenant_snapshots(db, request)
    total_tenants = len(snapshots)
    renewals_30 = sum(
        1
        for row in snapshots
        if row["next_renewal_at"] and row["next_renewal_at"] <= date.today() + timedelta(days=30)
    )
    status_counter = Counter(row["status"] for row in snapshots)
    tenant_rows = [
        {
            "Org": str(row["org_number"]),
            "Tenant": row["name"],
            "Status": _status_label(row["status"]),
            "Seats": _fmt_int(row["seat_count"]),
            "Modules": ", ".join(row["module_names"]) or "—",
            "Renewal": _fmt_date(row["next_renewal_at"]),
        }
        for row in sorted(
            snapshots,
            key=lambda item: (
                item["next_renewal_at"] or date.max,
                -item["seat_count"],
                item["name"],
            ),
        )[: request.filters.row_limit]
    ]
    seat_rows = [
        {
            "Tenant": row["name"],
            "Seats": _fmt_int(row["seat_count"]),
            "Status": _status_label(row["status"]),
            "City": row["city"],
        }
        for row in sorted(snapshots, key=lambda item: (-item["seat_count"], item["name"]))[: request.filters.row_limit]
    ]
    status_rows = [
        {"Status": _status_label(status), "Tenants": _fmt_int(count)}
        for status, count in status_counter.most_common()
    ]
    highlights = [
        f"{renewals_30} tenants renew in the next 30 days.",
        f"{status_counter.get('trial', 0)} tenants are still in Trial.",
    ] if total_tenants else []
    return InsightsReportResponse(
        report_id="tenant_portfolio",
        title=request.title or "CLICK Insights Tenant Portfolio",
        subtitle="Operational view of the current customer book.",
        generated_at=datetime.now(UTC),
        applied_filters=_build_filter_metrics(request),
        summary=[
            InsightsMetric(label="Filtered tenants", value=_fmt_int(total_tenants)),
            InsightsMetric(label="Renewals in 30d", value=_fmt_int(renewals_30)),
            InsightsMetric(label="Active tenants", value=_fmt_int(status_counter.get("active", 0))),
            InsightsMetric(label="Trial tenants", value=_fmt_int(status_counter.get("trial", 0))),
        ],
        highlights=highlights,
        sections=[
            InsightsSection(
                id="tenant_registry",
                title="Tenant Registry",
                description="Closest renewals and highest-signal account details.",
                columns=["Org", "Tenant", "Status", "Seats", "Modules", "Renewal"],
                rows=tenant_rows,
                empty_message="No tenants matched the selected filters.",
            ),
            InsightsSection(
                id="seat_leaders",
                title="Seat Leaders",
                description="Largest customer footprints in the current selection.",
                columns=["Tenant", "Seats", "Status", "City"],
                rows=seat_rows,
                empty_message="No seat data is currently available.",
            ),
            InsightsSection(
                id="status_breakdown",
                title="Status Breakdown",
                description="Distribution of tenant lifecycle stages.",
                columns=["Status", "Tenants"],
                rows=status_rows,
                empty_message="No status data found.",
            ),
        ],
    )


async def _build_module_adoption_report(db: AsyncSession, request: InsightsReportRequest) -> InsightsReportResponse:
    snapshots, module_map = await _load_current_tenant_snapshots(db, request)
    total_tenants = len(snapshots)
    adoption_counter = Counter(slug for row in snapshots for slug in row["module_slugs"])
    seat_counter: dict[str, int] = defaultdict(int)
    for row in snapshots:
        for slug in row["module_slugs"]:
            seat_counter[slug] += row["seat_count"]
    module_rows = [
        {
            "Module": module_map.get(slug, slug),
            "Tenants": _fmt_int(count),
            "Adoption": _fmt_pct((count / total_tenants * 100) if total_tenants else 0),
            "Seats": _fmt_int(seat_counter.get(slug, 0)),
        }
        for slug, count in adoption_counter.most_common(request.filters.row_limit)
    ]
    tenant_rows = [
        {
            "Tenant": row["name"],
            "Modules": ", ".join(row["module_names"]) or "—",
            "Seats": _fmt_int(row["seat_count"]),
            "Status": _status_label(row["status"]),
        }
        for row in sorted(snapshots, key=lambda item: (-item["module_count"], -item["seat_count"], item["name"]))[
            : request.filters.row_limit
        ]
    ]
    top_module = adoption_counter.most_common(1)[0] if adoption_counter else None
    total_module_assignments = sum(adoption_counter.values())
    return InsightsReportResponse(
        report_id="module_adoption",
        title=request.title or "CLICK Insights Module Adoption",
        subtitle="Where product adoption is strongest, and by how much.",
        generated_at=datetime.now(UTC),
        applied_filters=_build_filter_metrics(request),
        summary=[
            InsightsMetric(label="Tracked modules", value=_fmt_int(len(adoption_counter))),
            InsightsMetric(label="Assignments", value=_fmt_int(total_module_assignments)),
            InsightsMetric(label="Top module", value=module_map.get(top_module[0], top_module[0]) if top_module else "—"),
            InsightsMetric(label="Top adoption", value=_fmt_int(top_module[1]) if top_module else "0"),
        ],
        highlights=[
            f"{module_map.get(top_module[0], top_module[0])} leads adoption across {top_module[1]} tenants."
            for _ in [0]
            if top_module
        ],
        sections=[
            InsightsSection(
                id="module_scores",
                title="Module Scores",
                description="Adoption and seat footprint per module.",
                columns=["Module", "Tenants", "Adoption", "Seats"],
                rows=module_rows,
                empty_message="No module assignments matched the current filters.",
            ),
            InsightsSection(
                id="tenant_module_mix",
                title="Tenant Module Mix",
                description="Accounts with the broadest current module footprint.",
                columns=["Tenant", "Modules", "Seats", "Status"],
                rows=tenant_rows,
                empty_message="No tenant/module combinations are available.",
            ),
        ],
    )


async def _build_activity_audit_report(db: AsyncSession, request: InsightsReportRequest) -> InsightsReportResponse:
    date_to = request.filters.date_to or date.today()
    date_from = request.filters.date_from or (date_to - timedelta(days=30))
    query: Select = (
        select(AuditLog, AdminUser.full_name, AdminUser.email)
        .outerjoin(AdminUser, AdminUser.id == AuditLog.actor_id)
        .where(func.date(AuditLog.created_at) >= date_from)
        .where(func.date(AuditLog.created_at) <= date_to)
        .order_by(AuditLog.created_at.desc())
    )
    result = await db.execute(query)
    rows = result.all()
    total_events = len(rows)
    action_counter = Counter(audit.action for audit, _, _ in rows)
    entity_counter = Counter(audit.entity_type for audit, _, _ in rows)
    actor_counter = Counter((full_name or email or str(audit.actor_id)) for audit, full_name, email in rows)
    day_counter = Counter(audit.created_at.date().isoformat() for audit, _, _ in rows)
    busiest_day = day_counter.most_common(1)[0] if day_counter else None
    recent_rows = [
        {
            "When": audit.created_at.strftime("%Y-%m-%d %H:%M"),
            "Actor": full_name or email or str(audit.actor_id),
            "Action": audit.action,
            "Entity": audit.entity_type,
        }
        for audit, full_name, email in rows[: request.filters.row_limit]
    ]
    action_rows = [
        {"Action": action, "Events": _fmt_int(count)}
        for action, count in action_counter.most_common(request.filters.row_limit)
    ]
    entity_rows = [
        {"Entity": entity, "Events": _fmt_int(count)}
        for entity, count in entity_counter.most_common(request.filters.row_limit)
    ]
    highlights = []
    if busiest_day:
        highlights.append(f"Busiest day in range: {busiest_day[0]} with {busiest_day[1]} events.")
    if actor_counter:
        top_actor, top_count = actor_counter.most_common(1)[0]
        highlights.append(f"Top actor: {top_actor} with {top_count} actions.")
    return InsightsReportResponse(
        report_id="activity_audit",
        title=request.title or "CLICK Insights Activity & Audit",
        subtitle="Change volume, actor concentration and recent operational activity.",
        generated_at=datetime.now(UTC),
        applied_filters=_build_filter_metrics(
            InsightsReportRequest(
                report_id=request.report_id,
                title=request.title,
                filters=request.filters.model_copy(update={"date_from": date_from, "date_to": date_to}),
            )
        ),
        summary=[
            InsightsMetric(label="Events", value=_fmt_int(total_events)),
            InsightsMetric(label="Actors", value=_fmt_int(len(actor_counter))),
            InsightsMetric(label="Actions", value=_fmt_int(len(action_counter))),
            InsightsMetric(label="Entities", value=_fmt_int(len(entity_counter))),
        ],
        highlights=highlights,
        sections=[
            InsightsSection(
                id="action_volume",
                title="Action Volume",
                description="Most common actions in the selected period.",
                columns=["Action", "Events"],
                rows=action_rows,
                empty_message="No audit events were recorded in the selected period.",
            ),
            InsightsSection(
                id="entity_volume",
                title="Entity Volume",
                description="Which object types changed the most.",
                columns=["Entity", "Events"],
                rows=entity_rows,
                empty_message="No entity activity was recorded in the selected period.",
            ),
            InsightsSection(
                id="recent_activity",
                title="Recent Activity",
                description="Newest audit events in descending order.",
                columns=["When", "Actor", "Action", "Entity"],
                rows=recent_rows,
                empty_message="No recent audit events were found.",
            ),
        ],
    )


def _render_csv(report: InsightsReportResponse) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([report.title])
    writer.writerow([report.subtitle])
    writer.writerow(["Generated at", report.generated_at.isoformat()])
    writer.writerow([])
    if report.summary:
        writer.writerow(["Summary"])
        for metric in report.summary:
            writer.writerow([metric.label, metric.value, metric.hint or ""])
        writer.writerow([])
    for section in report.sections:
        writer.writerow([section.title])
        if section.description:
            writer.writerow([section.description])
        if section.columns:
            writer.writerow(section.columns)
        for row in section.rows:
            writer.writerow([row.get(column, "") for column in section.columns])
        writer.writerow([])
    return output.getvalue()


def _render_pdf(report: InsightsReportResponse) -> bytes:
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
    styles.add(
        ParagraphStyle(
            name="InsightsBody",
            parent=styles["BodyText"],
            fontName=FONT_NAME,
            fontSize=9,
            leading=12,
            alignment=TA_RIGHT,
        )
    )
    styles.add(
        ParagraphStyle(
            name="InsightsTitle",
            parent=styles["Heading1"],
            fontName=FONT_NAME,
            fontSize=18,
            leading=22,
            alignment=TA_RIGHT,
            textColor=colors.HexColor("#0f172a"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="InsightsSubTitle",
            parent=styles["BodyText"],
            fontName=FONT_NAME,
            fontSize=10,
            leading=13,
            alignment=TA_RIGHT,
            textColor=colors.HexColor("#475569"),
        )
    )

    story = [
        Paragraph(_rtl(report.title), styles["InsightsTitle"]),
        Spacer(1, 4),
        Paragraph(_rtl(report.subtitle), styles["InsightsSubTitle"]),
        Spacer(1, 10),
    ]
    if report.summary:
        summary_table = Table(
            [[Paragraph(_rtl(metric.label), styles["InsightsBody"]), Paragraph(_rtl(metric.value), styles["InsightsBody"])] for metric in report.summary],
            colWidths=[55 * mm, 115 * mm],
            hAlign="RIGHT",
        )
        summary_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        story.extend([summary_table, Spacer(1, 10)])

    for section in report.sections:
        story.append(Paragraph(_rtl(section.title), styles["InsightsBody"]))
        if section.description:
            story.append(Paragraph(_rtl(section.description), styles["InsightsSubTitle"]))
        if section.rows:
            data = [[Paragraph(_rtl(column), styles["InsightsBody"]) for column in section.columns]]
            for row in section.rows:
                data.append([Paragraph(_rtl(row.get(column, "")), styles["InsightsBody"]) for column in section.columns])
            col_width = 180 * mm / max(len(section.columns), 1)
            table = Table(data, colWidths=[col_width] * len(section.columns), repeatRows=1, hAlign="RIGHT")
            table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                        ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                        ("LEFTPADDING", (0, 0), (-1, -1), 6),
                        ("TOPPADDING", (0, 0), (-1, -1), 5),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ]
                )
            )
            story.append(table)
        elif section.empty_message:
            story.append(Paragraph(_rtl(section.empty_message), styles["InsightsSubTitle"]))
        story.append(Spacer(1, 10))

    doc.build(story)
    return buffer.getvalue()
