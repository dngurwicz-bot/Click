import uuid
import sqlalchemy as sa
import httpx
import re
from decimal import Decimal
from datetime import date, datetime, timedelta, timezone
from urllib.parse import unquote, urlsplit
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, select

from app.database import get_db
from app.config import get_settings
from app.middleware.auth import require_permission, require_super_admin, CurrentUser
from app.models.admin_user import AdminUser
from app.models.tenant import (
    Tenant, TenantIdentity, TenantContact, TenantAddress,
    TenantSubscription, TenantSubscriptionModule, TenantStatus,
)
from app.models.module import OrgTemplate, OrgTemplateDefault, OrgTemplateModule
from app.models.audit_log import AuditLog
from app.models.billing import BillingCharge, Invoice, InvoiceLine, Quote, QuoteLine
from app.models.billing_engine import (
    BillingBillRun,
    BillingChangeEvent,
    BillingContract,
    BillingContractItem,
    BillingDocument,
    BillingDocumentLine,
    BillingLedgerEntry,
)
from app.services.billing_engine import cycle_bounds, remaining_proration_ratio
from app.schemas.tenant import (
    TenantCreateRequest, TenantUpdateRequest, TenantOut,
    TenantListItem, TenantIdentityOut, TenantContactOut,
    TenantAddressOut, TenantSubscriptionModuleActionBody, TenantSubscriptionModuleCreate, TenantSubscriptionModuleOut, TenantSubscriptionModuleUpdate,
    TenantSubscriptionOut, TenantStatusOut, TenantApplySyncRequest, TenantApplyTemplateRequest, TenantDeleteImpactOut,
    TenantDeleteRequest, TenantSyncPreviewModuleDiff, TenantSyncPreviewOut,
)
from app.services.temporal import (
    close_and_create, get_active, get_history, update_in_place,
    check_date_overlap, kabiya, delete_specific_row, close_active_row,
)
from app.services.subscription_modules import (
    BlueprintModule,
    align_subscription_modules_to_subscription,
    build_subscription_blueprint,
    calculate_module_totals,
    calculate_subscription_pricing,
    clone_subscription_modules,
    derive_subscription_snapshot,
    get_effective_subscription_module,
    get_effective_module_prices,
    get_module_names,
    load_subscription_module_history,
    load_subscription_modules,
    load_tenant_subscription_module_history,
    replace_subscription_modules,
    sync_billing_contract_from_subscription,
    sync_subscription_header,
)
from app.services.tenant_status_windows import ensure_tenant_status_allows_range
from app.models.seat_change_log import SeatChangeLog

router = APIRouter(prefix="/api/admin/tenants", tags=["tenants"])
settings = get_settings()

_LOGO_BUCKET = "logos"
_LOGO_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
    "image/svg+xml",
}
_LOGO_MAX_BYTES = 5 * 1024 * 1024


def _resolve_user_label(user_lookup: dict[uuid.UUID, str], user_id: uuid.UUID | None) -> str | None:
    if user_id is None:
        return None
    return user_lookup.get(user_id, "—")


def _sanitize_storage_segment(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "-", value.strip())
    return cleaned.strip("-._") or uuid.uuid4().hex


def _sanitize_extension(value: str | None, content_type: str | None) -> str:
    if value:
        cleaned = re.sub(r"[^a-zA-Z0-9]+", "", value.lower())
        if cleaned:
            return cleaned
    if content_type == "image/png":
        return "png"
    if content_type in {"image/jpeg", "image/jpg"}:
        return "jpg"
    if content_type == "image/webp":
        return "webp"
    if content_type == "image/gif":
        return "gif"
    if content_type == "image/svg+xml":
        return "svg"
    return "png"


async def _ensure_public_logo_bucket() -> None:
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": "Supabase not configured", "code": "SUPABASE_NOT_CONFIGURED"},
        )

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            f"{settings.SUPABASE_URL}/storage/v1/bucket",
            headers={
                "apikey": settings.SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json",
            },
            json={"id": _LOGO_BUCKET, "name": _LOGO_BUCKET, "public": True},
        )
    if response.status_code in (200, 201, 409):
        return
    try:
        body = response.json()
    except ValueError:
        body = {}
        
    if body.get("message") == "The resource already exists" or body.get("error") == "Duplicate":
        return

    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail={
            "error": body.get("message") or body.get("error") or "Failed to ensure logo bucket",
            "code": "STORAGE_BUCKET_ERROR",
        },
    )


async def _upload_logo_to_storage(*, content: bytes, content_type: str, storage_key: str, extension: str) -> str:
    await _ensure_public_logo_bucket()

    object_path = f"tenants/{_sanitize_storage_segment(storage_key)}/logo.{_sanitize_extension(extension, content_type)}"
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{settings.SUPABASE_URL}/storage/v1/object/{_LOGO_BUCKET}/{object_path}",
            headers={
                "apikey": settings.SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                "Content-Type": content_type,
                "x-upsert": "true",
            },
            content=content,
        )
        if response.status_code not in (200, 201):
            if response.status_code == 400:
                response = await client.put(
                    f"{settings.SUPABASE_URL}/storage/v1/object/{_LOGO_BUCKET}/{object_path}",
                    headers={
                        "apikey": settings.SUPABASE_SERVICE_KEY,
                        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                        "Content-Type": content_type,
                        "x-upsert": "true",
                    },
                    content=content,
                )

    if response.status_code not in (200, 201):
        try:
            body = response.json()
        except ValueError:
            body = {}
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "error": body.get("message") or body.get("error") or "Failed to upload logo",
                "code": "STORAGE_UPLOAD_ERROR",
            },
        )

    return f"{settings.SUPABASE_URL}/storage/v1/object/public/{_LOGO_BUCKET}/{object_path}?t={int(datetime.now(timezone.utc).timestamp())}"


def _tenant_delete_confirmation_phrase(*, org_number: int, tax_id: str | None) -> str:
    normalized_tax_id = re.sub(r"\D+", "", tax_id or "")
    return f"DELETE {org_number} {normalized_tax_id or 'NO-TAX-ID'}"


def _extract_storage_object_path(public_url: str | None) -> str | None:
    if not public_url:
        return None

    parsed = urlsplit(public_url)
    prefix = f"/storage/v1/object/public/{_LOGO_BUCKET}/"
    if prefix not in parsed.path:
        return None

    _, _, path = parsed.path.partition(prefix)
    return unquote(path) or None


async def _delete_logo_from_storage(public_url: str | None) -> None:
    object_path = _extract_storage_object_path(public_url)
    if not object_path:
        return
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": "Supabase not configured", "code": "SUPABASE_NOT_CONFIGURED"},
        )

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.delete(
            f"{settings.SUPABASE_URL}/storage/v1/object/{_LOGO_BUCKET}/{object_path}",
            headers={
                "apikey": settings.SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
            },
        )

    if response.status_code in (200, 204, 404):
        return

    try:
        body = response.json()
    except ValueError:
        body = {}
    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail={
            "error": body.get("message") or body.get("error") or "Failed to delete tenant logo",
            "code": "STORAGE_DELETE_ERROR",
        },
    )


async def _build_tenant_delete_impact(
    db: AsyncSession,
    tenant: Tenant,
    *,
    include_audit_logs: bool,
    delete_logo: bool,
) -> TenantDeleteImpactOut:
    identity = await get_active(db, TenantIdentity, tenant.tenant_id)

    subscription_ids = list(
        (
            await db.execute(
                select(TenantSubscription.id).where(TenantSubscription.tenant_id == tenant.tenant_id)
            )
        ).scalars().all()
    )
    contract_ids = list(
        (
            await db.execute(
                select(BillingContract.id).where(BillingContract.tenant_id == tenant.tenant_id)
            )
        ).scalars().all()
    )
    invoice_ids = list(
        (
            await db.execute(select(Invoice.id).where(Invoice.tenant_id == tenant.tenant_id))
        ).scalars().all()
    )
    quote_ids = list(
        (
            await db.execute(select(Quote.id).where(Quote.tenant_id == tenant.tenant_id))
        ).scalars().all()
    )
    document_ids = list(
        (
            await db.execute(select(BillingDocument.id).where(BillingDocument.tenant_id == tenant.tenant_id))
        ).scalars().all()
    )

    counts: dict[str, int] = {
        "identity_rows": len((await db.execute(select(TenantIdentity.id).where(TenantIdentity.tenant_id == tenant.tenant_id))).scalars().all()),
        "contact_rows": len((await db.execute(select(TenantContact.id).where(TenantContact.tenant_id == tenant.tenant_id))).scalars().all()),
        "address_rows": len((await db.execute(select(TenantAddress.id).where(TenantAddress.tenant_id == tenant.tenant_id))).scalars().all()),
        "status_rows": len((await db.execute(select(TenantStatus.id).where(TenantStatus.tenant_id == tenant.tenant_id))).scalars().all()),
        "subscription_rows": len(subscription_ids),
        "subscription_module_rows": len(
            (
                await db.execute(
                    select(TenantSubscriptionModule.id).where(
                        TenantSubscriptionModule.tenant_subscription_id.in_(subscription_ids)
                    )
                )
            ).scalars().all()
        ) if subscription_ids else 0,
        "seat_change_logs": len((await db.execute(select(SeatChangeLog.id).where(SeatChangeLog.tenant_id == tenant.tenant_id))).scalars().all()),
        "billing_charges": len((await db.execute(select(BillingCharge.id).where(BillingCharge.tenant_id == tenant.tenant_id))).scalars().all()),
        "invoices": len(invoice_ids),
        "invoice_lines": len((await db.execute(select(InvoiceLine.id).where(InvoiceLine.invoice_id.in_(invoice_ids)))).scalars().all()) if invoice_ids else 0,
        "quotes": len(quote_ids),
        "quote_lines": len((await db.execute(select(QuoteLine.id).where(QuoteLine.quote_id.in_(quote_ids)))).scalars().all()) if quote_ids else 0,
        "billing_contracts": len(contract_ids),
        "billing_contract_items": len((await db.execute(select(BillingContractItem.id).where(BillingContractItem.contract_id.in_(contract_ids)))).scalars().all()) if contract_ids else 0,
        "billing_change_events": len((await db.execute(select(BillingChangeEvent.id).where(BillingChangeEvent.tenant_id == tenant.tenant_id))).scalars().all()),
        "billing_bill_runs": len((await db.execute(select(BillingBillRun.id).where(BillingBillRun.contract_id.in_(contract_ids)))).scalars().all()) if contract_ids else 0,
        "billing_documents": len(document_ids),
        "billing_document_lines": len((await db.execute(select(BillingDocumentLine.id).where(BillingDocumentLine.document_id.in_(document_ids)))).scalars().all()) if document_ids else 0,
        "billing_ledger_entries": len((await db.execute(select(BillingLedgerEntry.id).where(BillingLedgerEntry.tenant_id == tenant.tenant_id))).scalars().all()),
        "audit_logs": len((await db.execute(select(AuditLog.id).where(AuditLog.tenant_id == tenant.tenant_id))).scalars().all()) if include_audit_logs else 0,
    }

    return TenantDeleteImpactOut(
        tenant_id=tenant.tenant_id,
        org_number=tenant.org_number,
        tenant_name=identity.name_he if identity else None,
        tax_id=identity.tax_id if identity else None,
        confirmation_phrase=_tenant_delete_confirmation_phrase(org_number=tenant.org_number, tax_id=identity.tax_id if identity else None),
        delete_logo=delete_logo,
        logo_will_be_deleted=bool(delete_logo and _extract_storage_object_path(identity.logo_url if identity else None)),
        counts=counts,
    )


async def _load_user_lookup(db: AsyncSession, user_ids: set[uuid.UUID]) -> dict[uuid.UUID, str]:
    if not user_ids:
        return {}

    result = await db.execute(
        select(AdminUser.id, AdminUser.full_name, AdminUser.email)
        .where(AdminUser.id.in_(user_ids))
    )
    return {
        user_id: (full_name or email or "—")
        for user_id, full_name, email in result.all()
    }


def _collect_row_user_ids(*rows: object | None) -> set[uuid.UUID]:
    user_ids: set[uuid.UUID] = set()
    for row in rows:
        if row is None:
            continue
        for field_name in ("created_by", "updated_by"):
            user_id = getattr(row, field_name, None)
            if isinstance(user_id, uuid.UUID):
                user_ids.add(user_id)
    return user_ids


def _serialize_temporal_row(row: object | None, schema_cls, user_lookup: dict[uuid.UUID, str]):
    if row is None:
        return None

    payload = {}
    for field_name in schema_cls.model_fields:
        if field_name == "created_by":
            payload[field_name] = _resolve_user_label(user_lookup, getattr(row, "created_by", None))
        elif field_name == "updated_by":
            payload[field_name] = _resolve_user_label(user_lookup, getattr(row, "updated_by", None))
        else:
            payload[field_name] = getattr(row, field_name, None)
    return schema_cls(**payload)


def _latest_row_change(rows: list[object | None]) -> tuple[datetime | None, uuid.UUID | None]:
    latest_at: datetime | None = None
    latest_by: uuid.UUID | None = None

    for row in rows:
        if row is None:
            continue
        changed_at = getattr(row, "updated_at", None) or getattr(row, "created_at", None)
        changed_by = getattr(row, "updated_by", None) or getattr(row, "created_by", None)
        if changed_at is None:
            continue
        if latest_at is None or changed_at > latest_at:
            latest_at = changed_at
            latest_by = changed_by

    return latest_at, latest_by


def _extract_current_data(row: object, field_names: set[str]) -> dict[str, object]:
    return {field_name: getattr(row, field_name, None) for field_name in field_names}


def _subscription_header_payload(data: dict[str, object]) -> dict[str, object]:
    return {
        key: value
        for key, value in data.items()
        if key not in {"seat_count", "selected_module_slugs"}
    }


def _subscription_payload_from_row(
    row: TenantSubscription,
    module_rows: list[TenantSubscriptionModule],
    user_lookup: dict[uuid.UUID, str],
    pricing_summary: dict[str, Decimal] | None = None,
) -> dict[str, object]:
    seat_count, selected_module_slugs = derive_subscription_snapshot(module_rows)
    payload = {
        field_name: getattr(row, field_name, None)
        for field_name in TenantSubscriptionOut.model_fields
        if field_name not in {
            "created_by",
            "updated_by",
            "seat_count",
            "selected_module_slugs",
            "current_monthly_total_ils",
            "current_yearly_total_ils",
            "current_cycle_total_ils",
            "current_setup_total_ils",
            "initial_charge_total_ils",
            "next_charge_total_ils",
        }
    }
    payload["seat_count"] = seat_count
    payload["selected_module_slugs"] = selected_module_slugs
    payload.update(pricing_summary or {})
    payload["created_by"] = _resolve_user_label(user_lookup, getattr(row, "created_by", None))
    payload["updated_by"] = _resolve_user_label(user_lookup, getattr(row, "updated_by", None))
    return payload


async def _subscription_pricing_summary(
    db: AsyncSession,
    subscription: TenantSubscription,
    module_rows: list[TenantSubscriptionModule],
    *,
    as_of: date,
) -> dict[str, Decimal]:
    prices = await get_effective_module_prices(
        db,
        [row.module_slug for row in module_rows if row.status == "active"],
        as_of=as_of,
    )
    return calculate_subscription_pricing(subscription, module_rows, prices)


def _validate_temporal_range(valid_from: date | None, valid_to: date | None) -> None:
    if valid_from is None or valid_to is None:
        return
    if valid_to < valid_from:
        raise HTTPException(
            status_code=422,
            detail={
                "error": f"תאריך גמר תוקף ({valid_to}) לא יכול להיות לפני תאריך תחילת התקופה ({valid_from})",
                "code": "INVALID_DATE",
            },
        )


async def _upsert_subscription_for_effective_date(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    current_subscription: TenantSubscription | None,
    subscription_payload: dict[str, object],
    actor_id: uuid.UUID,
    effective_from: date,
) -> tuple[TenantSubscription, dict[str, int]]:
    if current_subscription:
        current_module_rows = await load_subscription_modules(db, current_subscription.id)
        existing_seats: dict[str, int] = {row.module_slug: row.seats for row in current_module_rows}

        if current_subscription.valid_from == effective_from:
            current_data = _extract_current_data(current_subscription, set(subscription_payload.keys()))
            if current_data != subscription_payload:
                await update_in_place(
                    db,
                    TenantSubscription,
                    tenant_id,
                    subscription_payload,
                    actor_id,
                    None,
                    target_valid_from=current_subscription.valid_from,
                    new_valid_to=current_subscription.valid_to,
                )
                await db.refresh(current_subscription)
            return current_subscription, existing_seats

        new_subscription = await close_and_create(
            db,
            TenantSubscription,
            tenant_id,
            subscription_payload,
            actor_id,
            new_valid_from=effective_from,
        )
        await align_subscription_modules_to_subscription(
            db,
            subscription_id=current_subscription.id,
            valid_to=effective_from - timedelta(days=1),
            actor_id=actor_id,
        )
        return new_subscription, existing_seats

    new_subscription = TenantSubscription(
        **subscription_payload,
        tenant_id=tenant_id,
        valid_from=effective_from,
        created_by=actor_id,
    )
    db.add(new_subscription)
    await db.flush()
    return new_subscription, {}


async def _ensure_tenant_operation_window(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    valid_from: date,
    valid_to: date | None = None,
) -> None:
    await ensure_tenant_status_allows_range(db, tenant_id, valid_from, valid_to)


async def _build_tenant_out(tenant: Tenant, db: AsyncSession) -> TenantOut:
    identity = await get_active(db, TenantIdentity, tenant.tenant_id)
    contact = await get_active(db, TenantContact, tenant.tenant_id)
    address = await get_active(db, TenantAddress, tenant.tenant_id)
    subscription = await get_active(db, TenantSubscription, tenant.tenant_id)
    current_subscription_rows = await load_subscription_modules(db, subscription.id) if subscription else []
    subscription_modules = await _serialize_subscription_modules(db, subscription.id if subscription else None)
    status_row = await get_active(db, TenantStatus, tenant.tenant_id)
    user_lookup = await _load_user_lookup(
        db,
        _collect_row_user_ids(identity, contact, address, subscription, status_row, *current_subscription_rows),
    )
    latest_at, latest_actor_id = _latest_row_change([identity, contact, address, subscription, status_row, *current_subscription_rows])
    pricing_summary = (
        await _subscription_pricing_summary(db, subscription, current_subscription_rows, as_of=date.today())
        if subscription is not None
        else None
    )
    subscription_payload = (
        _subscription_payload_from_row(subscription, current_subscription_rows, user_lookup, pricing_summary)
        if subscription is not None
        else None
    )

    return TenantOut(
        tenant_id=tenant.tenant_id,
        org_number=tenant.org_number,
        created_at=tenant.created_at,
        created_by=_resolve_user_label(user_lookup, getattr(identity, "created_by", None))
        or _resolve_user_label(user_lookup, getattr(contact, "created_by", None))
        or _resolve_user_label(user_lookup, getattr(address, "created_by", None))
        or _resolve_user_label(user_lookup, getattr(subscription, "created_by", None))
        or _resolve_user_label(user_lookup, getattr(status_row, "created_by", None)),
        updated_at=latest_at,
        updated_by=_resolve_user_label(user_lookup, latest_actor_id) if latest_actor_id else None,
        identity=_serialize_temporal_row(identity, TenantIdentityOut, user_lookup),
        contact=_serialize_temporal_row(contact, TenantContactOut, user_lookup),
        address=_serialize_temporal_row(address, TenantAddressOut, user_lookup),
        subscription=TenantSubscriptionOut(**subscription_payload) if subscription_payload else None,
        subscription_modules=subscription_modules,
        status=_serialize_temporal_row(status_row, TenantStatusOut, user_lookup),
    )


async def _load_template_defaults(db: AsyncSession, template_id: uuid.UUID) -> dict[str, str]:
    result = await db.execute(
        select(OrgTemplateDefault.default_type, OrgTemplateDefault.default_value)
        .where(OrgTemplateDefault.template_id == template_id)
    )
    return {default_type: default_value for default_type, default_value in result.all()}


async def _load_template_modules(db: AsyncSession, template_id: uuid.UUID) -> list[str]:
    result = await db.execute(
        select(OrgTemplateModule.module_slug).where(OrgTemplateModule.template_id == template_id)
    )
    return [row[0] for row in result.all()]


def _parse_int_or_zero(value: str | None) -> int:
    try:
        return max(int(value or "0"), 0)
    except (TypeError, ValueError):
        return 0


async def _serialize_subscription_modules(
    db: AsyncSession,
    subscription_id: uuid.UUID | None,
) -> list[TenantSubscriptionModuleOut]:
    if subscription_id is None:
        return []
    rows = await load_subscription_modules(db, subscription_id)
    user_lookup = await _load_user_lookup(db, _collect_row_user_ids(*rows))
    return [_serialize_temporal_row(row, TenantSubscriptionModuleOut, user_lookup) for row in rows]


async def _serialize_tenant_subscription_module_history(
    db: AsyncSession,
    tenant_id: uuid.UUID,
) -> list[TenantSubscriptionModuleOut]:
    rows = await load_tenant_subscription_module_history(db, tenant_id)
    user_lookup = await _load_user_lookup(db, _collect_row_user_ids(*rows))
    return [_serialize_temporal_row(row, TenantSubscriptionModuleOut, user_lookup) for row in rows]


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


async def _sync_subscription_header_from_date(
    db: AsyncSession,
    subscription: TenantSubscription,
    *,
    as_of: date | None = None,
) -> list[TenantSubscriptionModule]:
    rows = await load_subscription_modules(db, subscription.id, as_of=as_of)
    sync_subscription_header(subscription, rows)
    return rows


async def _sync_subscription_to_billing(
    db: AsyncSession,
    subscription: TenantSubscription,
    *,
    actor_id: uuid.UUID | None,
    as_of: date | None = None,
) -> None:
    if getattr(subscription, "id", None) is None:
        return
    await sync_billing_contract_from_subscription(
        db,
        subscription=subscription,
        actor_id=actor_id,
        as_of=as_of or date.today(),
    )


async def _materialize_subscription_modules(
    db: AsyncSession,
    *,
    subscription: TenantSubscription,
    actor_id: uuid.UUID | None,
    template_defaults: dict[str, str] | None = None,
    explicit_module_slugs: list[str] | None = None,
    existing_seats: dict[str, int] | None = None,
) -> list[TenantSubscriptionModule]:
    """Create/replace subscription module rows from the template blueprint.

    Seat-count priority (per module):
      1. OrgTemplateModule.seats_default (per-module template override)
      2. template_defaults['seat_count'] if > 0 (template-level default)
      3. existing_seats[slug] if present (what the tenant already has)
      4. 0

    existing_seats enables Option-C behaviour: take max(template, existing)
    so tenants never lose seats when a template is applied.
    """
    defaults = template_defaults or {}

    # Determine the template-level seat default, with clear priority:
    # template['seat_count'] > 0 wins; otherwise fall back to the existing
    # snapshot so we do not silently zero-out a live tenant's seats.
    template_seat_count = _parse_int_or_zero(defaults.get("seat_count"))
    if template_seat_count > 0:
        default_seat_count = template_seat_count
    elif existing_seats:
        # Fall back to the max of existing seats to preserve tenant state
        default_seat_count = max(existing_seats.values(), default=0)
    else:
        # Last resort: use whatever the current subscription rows say
        current_rows = await load_subscription_modules(db, subscription.id, as_of=subscription.valid_from)
        derived_seat_count, _ = derive_subscription_snapshot(current_rows)
        default_seat_count = derived_seat_count

    blueprint = await build_subscription_blueprint(
        db,
        template_id=subscription.template_id,
        default_seat_count=default_seat_count,
        existing_seats=existing_seats,
    )

    if explicit_module_slugs:
        known = {item.module_slug for item in blueprint}
        for module_slug in explicit_module_slugs:
            if module_slug not in known:
                extra_seats = (existing_seats or {}).get(module_slug, default_seat_count)
                blueprint.append(
                    BlueprintModule(
                        module_slug=module_slug,
                        source_type="manual",
                        seats=extra_seats,
                    )
                )
    rows = await replace_subscription_modules(
        db,
        subscription_id=subscription.id,
        modules=sorted(blueprint, key=lambda item: item.module_slug),
        actor_id=actor_id,
        valid_from=subscription.valid_from,
        valid_to=subscription.valid_to,
    )
    sync_subscription_header(subscription, rows)
    return rows


async def _preview_template_sync(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    template: OrgTemplate,
    effective_from: date,
) -> TenantSyncPreviewOut:
    current_subscription = await get_active(db, TenantSubscription, tenant_id)
    if not current_subscription:
        raise HTTPException(status_code=409, detail={"error": "Tenant has no active subscription", "code": "NO_SUBSCRIPTION"})

    template_defaults = await _load_template_defaults(db, template.id)
    proposed_discount = Decimal(template_defaults.get("discount_pct", "0"))
    proposed_price_locked = template_defaults.get("is_price_locked", "false").lower() in {"1", "true", "yes"}

    # Build existing seat map for Option-C (take max of template vs existing)
    current_rows = await load_subscription_modules(db, current_subscription.id, as_of=effective_from)
    existing_seats: dict[str, int] = {row.module_slug: row.seats for row in current_rows}

    proposed_blueprint = await build_subscription_blueprint(
        db,
        template_id=template.id,
        default_seat_count=_parse_int_or_zero(template_defaults.get("seat_count")),
        existing_seats=existing_seats,
    )
    current_rows_map = {row.module_slug: row for row in current_rows}
    proposed_map = {row.module_slug: row for row in proposed_blueprint}

    all_slugs = sorted(set(current_rows_map) | set(proposed_map))
    names = await get_module_names(db, all_slugs)
    current_prices = await get_effective_module_prices(db, list(current_rows_map), as_of=effective_from)
    proposed_prices = await get_effective_module_prices(db, list(proposed_map), as_of=effective_from)

    diffs: list[TenantSyncPreviewModuleDiff] = []
    current_monthly_total = Decimal("0")
    current_setup_total = Decimal("0")
    proposed_monthly_total = Decimal("0")
    proposed_setup_total = Decimal("0")

    for slug in all_slugs:
        current_row = current_rows_map.get(slug)
        proposed_row = proposed_map.get(slug)
        if current_row:
            monthly, setup = calculate_module_totals(current_row, current_prices.get(slug))
            current_monthly_total += monthly
            current_setup_total += setup
        else:
            monthly = Decimal("0")
            setup = Decimal("0")
        if proposed_row:
            pseudo_row = TenantSubscriptionModule(
                tenant_subscription_id=current_subscription.id,
                module_slug=proposed_row.module_slug,
                source_type=proposed_row.source_type,
                status=proposed_row.status,
                seats=proposed_row.seats,
                pricing_mode=proposed_row.pricing_mode,
                override_base_price_ils=proposed_row.override_base_price_ils,
                override_per_seat_ils=proposed_row.override_per_seat_ils,
                override_setup_fee_ils=proposed_row.override_setup_fee_ils,
                override_included_seats=proposed_row.override_included_seats,
                valid_from=effective_from,
                valid_to=None,
            )
            proposed_monthly, proposed_setup = calculate_module_totals(pseudo_row, proposed_prices.get(slug))
            proposed_monthly_total += proposed_monthly
            proposed_setup_total += proposed_setup
        else:
            proposed_monthly = Decimal("0")
            proposed_setup = Decimal("0")

        if current_row and not proposed_row:
            action = "remove"
        elif proposed_row and not current_row:
            action = "add"
        elif current_row and proposed_row and (
            current_row.seats != proposed_row.seats or current_row.status != proposed_row.status or current_row.source_type != proposed_row.source_type
        ):
            action = "update"
        else:
            continue
        diffs.append(
            TenantSyncPreviewModuleDiff(
                module_slug=slug,
                module_name=names.get(slug, slug),
                action=action,
                current_seats=current_row.seats if current_row else 0,
                proposed_seats=proposed_row.seats if proposed_row else 0,
                pricing_mode=(current_row.pricing_mode if current_row else "catalog"),
                current_monthly_ils=monthly,
                proposed_monthly_ils=proposed_monthly,
                current_setup_ils=setup,
                proposed_setup_ils=proposed_setup,
            )
        )

    contract_res = await db.execute(select(BillingContract).where(BillingContract.tenant_id == tenant_id))
    contract = contract_res.scalar_one_or_none()
    proration_ratio = Decimal("1")
    if contract:
        cycle_start, cycle_end = cycle_bounds(contract, effective_from)
        proration_ratio = remaining_proration_ratio(effective_from, cycle_start, cycle_end)

    immediate_proration_total = Decimal("0")
    for d in diffs:
        monthly_diff = d.proposed_monthly_ils - d.current_monthly_ils
        immediate_proration_total += (monthly_diff * proration_ratio)

        setup_diff = d.proposed_setup_ils - d.current_setup_ils
        if setup_diff > 0:
            immediate_proration_total += setup_diff

    # apply discount ratio to proration
    discount_multiplier = Decimal("1") - (proposed_discount / Decimal("100"))
    immediate_proration_total = round(immediate_proration_total * discount_multiplier, 2)

    return TenantSyncPreviewOut(
        tenant_id=tenant_id,
        template_id=template.id,
        effective_from=effective_from,
        current_discount_pct=current_subscription.discount_pct,
        proposed_discount_pct=proposed_discount,
        current_is_price_locked=current_subscription.is_price_locked,
        proposed_is_price_locked=proposed_price_locked,
        module_diffs=diffs,
        current_monthly_total_ils=current_monthly_total,
        proposed_monthly_total_ils=proposed_monthly_total,
        current_setup_total_ils=current_setup_total,
        proposed_setup_total_ils=proposed_setup_total,
        immediate_proration_total_ils=immediate_proration_total,
    )


@router.get("", response_model=list[TenantListItem])
async def list_tenants(
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("tenants", "view")),
):
    result = await db.execute(select(Tenant).order_by(Tenant.created_at.desc()))
    tenants = result.scalars().all()
    tenant_ids = [t.tenant_id for t in tenants]

    if not tenant_ids:
        return []

    today = date.today()

    # ── BATCH LOAD: Identities ──
    identity_res = await db.execute(
        select(TenantIdentity).where(TenantIdentity.tenant_id.in_(tenant_ids))
        .where(TenantIdentity.valid_from <= today)
        .where((TenantIdentity.valid_to.is_(None)) | (TenantIdentity.valid_to >= today))
    )
    identity_map = {r.tenant_id: r for r in identity_res.scalars().all()}

    # ── BATCH LOAD: Statuses ──
    status_res = await db.execute(
        select(TenantStatus).where(TenantStatus.tenant_id.in_(tenant_ids))
        .where(TenantStatus.valid_from <= today)
        .where((TenantStatus.valid_to.is_(None)) | (TenantStatus.valid_to >= today))
    )
    status_map = {r.tenant_id: r for r in status_res.scalars().all()}

    # ── BATCH LOAD: Subscriptions ──
    sub_res = await db.execute(
        select(TenantSubscription).where(TenantSubscription.tenant_id.in_(tenant_ids))
        .where(TenantSubscription.valid_from <= today)
        .where((TenantSubscription.valid_to.is_(None)) | (TenantSubscription.valid_to >= today))
    )
    all_subs = sub_res.scalars().all()
    sub_map = {s.tenant_id: s for s in all_subs}

    # ── BATCH LOAD: Templates ──
    template_ids = {s.template_id for s in all_subs if s.template_id}
    template_map = {}
    if template_ids:
        template_res = await db.execute(select(OrgTemplate).where(OrgTemplate.id.in_(template_ids)))
        template_map = {t.id: t for t in template_res.scalars().all()}

    items = []
    for tenant in tenants:
        identity = identity_map.get(tenant.tenant_id)
        status_row = status_map.get(tenant.tenant_id)
        subscription = sub_map.get(tenant.tenant_id)
        template = template_map.get(subscription.template_id) if subscription and subscription.template_id else None

        items.append(TenantListItem(
            tenant_id=tenant.tenant_id,
            org_number=tenant.org_number,
            name_he=identity.name_he if identity else "—",
            status=status_row.status if status_row else "unknown",
            template_name=template.name if template else None,
            created_at=tenant.created_at,
        ))
    return items


@router.post("", response_model=TenantOut, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    body: TenantCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("tenants", "edit")),
):
    today = date.today()

    # Create the anchor tenant row
    tenant = Tenant()
    db.add(tenant)
    await db.flush()

    actor = current_user.id

    # Insert all temporal sub-tables in one transaction
    db.add(TenantIdentity(
        **body.identity.model_dump(),
        tenant_id=tenant.tenant_id,
        valid_from=today,
        created_by=actor,
    ))
    db.add(TenantContact(
        **body.contact.model_dump(),
        tenant_id=tenant.tenant_id,
        valid_from=today,
        created_by=actor,
    ))
    db.add(TenantAddress(
        **body.address.model_dump(),
        tenant_id=tenant.tenant_id,
        valid_from=today,
        created_by=actor,
    ))
    subscription = TenantSubscription(
        **_subscription_header_payload(body.subscription.model_dump()),
        tenant_id=tenant.tenant_id,
        valid_from=today,
        created_by=actor,
    )
    db.add(subscription)
    db.add(TenantStatus(
        **body.status.model_dump(),
        tenant_id=tenant.tenant_id,
        valid_from=today,
        created_by=actor,
    ))

    await db.flush()
    await _materialize_subscription_modules(
        db,
        subscription=subscription,
        actor_id=actor,
        explicit_module_slugs=body.subscription.selected_module_slugs,
    )
    await _sync_subscription_to_billing(db, subscription, actor_id=actor, as_of=today)

    await db.commit()
    await db.refresh(tenant)
    return await _build_tenant_out(tenant, db)


@router.post("/logo-upload")
async def upload_tenant_logo(
    file: UploadFile = File(...),
    storage_key: str = Form(...),
    extension: str | None = Form(default=None),
    _: CurrentUser = Depends(require_permission("tenants", "edit")),
):
    content_type = (file.content_type or "").lower()
    if content_type not in _LOGO_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "סוג קובץ לא נתמך", "code": "INVALID_FILE_TYPE"},
        )

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "הקובץ ריק", "code": "EMPTY_FILE"},
        )
    if len(content) > _LOGO_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "הקובץ גדול מדי", "code": "FILE_TOO_LARGE"},
        )

    public_url = await _upload_logo_to_storage(
        content=content,
        content_type=content_type,
        storage_key=storage_key,
        extension=extension or "",
    )
    return {"public_url": public_url}


@router.get("/{tenant_id}", response_model=TenantOut)
async def get_tenant(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("tenants", "view")),
):
    result = await db.execute(select(Tenant).where(Tenant.tenant_id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail={"error": "Tenant not found", "code": "NOT_FOUND"})
    return await _build_tenant_out(tenant, db)


@router.get("/{tenant_id}/delete-impact", response_model=TenantDeleteImpactOut)
async def get_tenant_delete_impact(
    tenant_id: uuid.UUID,
    purge_audit_logs: bool = False,
    delete_logo: bool = True,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_super_admin),
):
    result = await db.execute(select(Tenant).where(Tenant.tenant_id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail={"error": "Tenant not found", "code": "NOT_FOUND"})
    return await _build_tenant_delete_impact(
        db,
        tenant,
        include_audit_logs=purge_audit_logs,
        delete_logo=delete_logo,
    )


@router.post("/{tenant_id}/hard-delete", status_code=status.HTTP_204_NO_CONTENT)
async def hard_delete_tenant(
    tenant_id: uuid.UUID,
    body: TenantDeleteRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_super_admin),
):
    result = await db.execute(select(Tenant).where(Tenant.tenant_id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail={"error": "Tenant not found", "code": "NOT_FOUND"})
    identity = await get_active(db, TenantIdentity, tenant.tenant_id)

    impact = await _build_tenant_delete_impact(
        db,
        tenant,
        include_audit_logs=body.purge_audit_logs,
        delete_logo=body.delete_logo,
    )
    if body.confirmation_phrase.strip() != impact.confirmation_phrase:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "נדרש להזין את ביטוי האישור המדויק כדי למחוק את הארגון", "code": "INVALID_CONFIRMATION"},
        )

    if body.delete_logo and impact.logo_will_be_deleted:
        await _delete_logo_from_storage(identity.logo_url if identity else None)

    subscription_ids = list(
        (
            await db.execute(select(TenantSubscription.id).where(TenantSubscription.tenant_id == tenant.tenant_id))
        ).scalars().all()
    )
    contract_ids = list(
        (
            await db.execute(select(BillingContract.id).where(BillingContract.tenant_id == tenant.tenant_id))
        ).scalars().all()
    )
    invoice_ids = list(
        (
            await db.execute(select(Invoice.id).where(Invoice.tenant_id == tenant.tenant_id))
        ).scalars().all()
    )
    quote_ids = list(
        (
            await db.execute(select(Quote.id).where(Quote.tenant_id == tenant.tenant_id))
        ).scalars().all()
    )
    document_ids = list(
        (
            await db.execute(select(BillingDocument.id).where(BillingDocument.tenant_id == tenant.tenant_id))
        ).scalars().all()
    )

    if invoice_ids:
        await db.execute(
            sa.update(Quote)
            .where(Quote.converted_invoice_id.in_(invoice_ids))
            .values(converted_invoice_id=None)
        )
        await db.execute(delete(InvoiceLine).where(InvoiceLine.invoice_id.in_(invoice_ids)))
    if quote_ids:
        await db.execute(delete(QuoteLine).where(QuoteLine.quote_id.in_(quote_ids)))
    if document_ids:
        await db.execute(delete(BillingDocumentLine).where(BillingDocumentLine.document_id.in_(document_ids)))

    await db.execute(delete(SeatChangeLog).where(SeatChangeLog.tenant_id == tenant.tenant_id))
    await db.execute(delete(BillingLedgerEntry).where(BillingLedgerEntry.tenant_id == tenant.tenant_id))
    await db.execute(delete(BillingChangeEvent).where(BillingChangeEvent.tenant_id == tenant.tenant_id))
    await db.execute(delete(BillingCharge).where(BillingCharge.tenant_id == tenant.tenant_id))
    await db.execute(delete(Quote).where(Quote.tenant_id == tenant.tenant_id))
    await db.execute(delete(BillingDocument).where(BillingDocument.tenant_id == tenant.tenant_id))
    await db.execute(delete(Invoice).where(Invoice.tenant_id == tenant.tenant_id))

    if contract_ids:
        await db.execute(delete(BillingBillRun).where(BillingBillRun.contract_id.in_(contract_ids)))
        await db.execute(delete(BillingContractItem).where(BillingContractItem.contract_id.in_(contract_ids)))
    await db.execute(delete(BillingContract).where(BillingContract.tenant_id == tenant.tenant_id))

    if subscription_ids:
        await db.execute(
            delete(TenantSubscriptionModule).where(TenantSubscriptionModule.tenant_subscription_id.in_(subscription_ids))
        )
    await db.execute(delete(TenantSubscription).where(TenantSubscription.tenant_id == tenant.tenant_id))
    await db.execute(delete(TenantStatus).where(TenantStatus.tenant_id == tenant.tenant_id))
    await db.execute(delete(TenantAddress).where(TenantAddress.tenant_id == tenant.tenant_id))
    await db.execute(delete(TenantContact).where(TenantContact.tenant_id == tenant.tenant_id))
    await db.execute(delete(TenantIdentity).where(TenantIdentity.tenant_id == tenant.tenant_id))
    if body.purge_audit_logs:
        await db.execute(delete(AuditLog).where(AuditLog.tenant_id == tenant.tenant_id))
    await db.execute(delete(Tenant).where(Tenant.tenant_id == tenant.tenant_id))

    request.state.tenant_id = None if body.purge_audit_logs else tenant_id
    await db.commit()


@router.put("/{tenant_id}", response_model=TenantOut)
async def update_tenant(
    tenant_id: uuid.UUID,
    body: TenantUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("tenants", "edit")),
):
    result = await db.execute(select(Tenant).where(Tenant.tenant_id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail={"error": "Tenant not found", "code": "NOT_FOUND"})

    actor = current_user.id
    previous_subscription = await get_active(db, TenantSubscription, tenant_id)

    async def _maybe_update(model, new_data_obj, schema_out, extra_filter_key: str | None = None):
        if not new_data_obj:
            return
        new_data = new_data_obj.model_dump()
        if model is TenantSubscription:
            new_data = _subscription_header_payload(new_data)
        extra_filters = {extra_filter_key: new_data[extra_filter_key]} if extra_filter_key else None
        target_valid_from: date | None = None
        target_valid_to: date | None = None

        if model is not TenantStatus:
            if body.action == "add":
                target_valid_from = body.valid_from or date.today()
                target_valid_to = body.valid_to
            elif body.action == "set":
                if body.valid_from:
                    target_valid_from = body.valid_from
                    target_valid_to = body.valid_to
            elif body.action == "update":
                if body.valid_from:
                    target_valid_from = body.valid_from
                    target_valid_to = body.valid_to
                else:
                    current = await get_active(db, model, tenant_id, extra_filters=extra_filters)
                    if current is not None:
                        target_valid_from = current.valid_from
                        target_valid_to = body.valid_to
                    else:
                        target_valid_from = date.today()
                        target_valid_to = body.valid_to

            if target_valid_from is not None:
                _validate_temporal_range(target_valid_from, target_valid_to)
                await _ensure_tenant_operation_window(
                    db,
                    tenant_id,
                    target_valid_from,
                    target_valid_to,
                )

        # ── Action '2': עדכון ────────────────────────────────────────────
        # Case 2.1 — row found at this valid_from → update fields in-place, no history
        # Case 2.2 — no row at this valid_from → close current + create new (history)
        if body.action == "update":
            if body.valid_from:
                # Find the row the user actually edited (by valid_from key)
                stmt = (
                    select(model)
                    .where(model.tenant_id == tenant_id)
                    .where(model.valid_from == body.valid_from)
                    .limit(1)
                )
                stmt = _apply_extra_filters(stmt, model, extra_filters)
                res = await db.execute(stmt)
                target = res.scalar_one_or_none()
                if target:
                    # Case 2.1 — row found at this date, update its fields in-place
                    current_data = _extract_current_data(target, set(new_data.keys()))
                    new_valid_to_arg = body.valid_to  # May be None (= clear end date) or a date
                    if current_data != new_data or target.valid_to != body.valid_to:
                        await update_in_place(
                            db, model, tenant_id, new_data, actor, None,
                            target_valid_from=body.valid_from,
                            new_valid_to=new_valid_to_arg,
                            extra_filters=extra_filters,
                        )
                else:
                    # Case 2.2 — no row at this date, close the active row and open new period
                    current = await get_active(db, model, tenant_id, extra_filters=extra_filters)
                    if current:
                        await close_and_create(
                            db, model, tenant_id, new_data, actor,
                            new_valid_from=body.valid_from,
                            new_valid_to=body.valid_to,
                            extra_filters=extra_filters,
                        )
                    else:
                        await close_and_create(
                            db, model, tenant_id, new_data, actor,
                            new_valid_from=body.valid_from,
                            new_valid_to=body.valid_to,
                            extra_filters=extra_filters,
                        )
            else:
                # No valid_from provided → operate on active row
                current = await get_active(db, model, tenant_id, extra_filters=extra_filters)
                if current:
                    current_data = _extract_current_data(current, set(new_data.keys()))
                    if current_data != new_data or current.valid_to != body.valid_to:
                        await update_in_place(
                            db, model, tenant_id, new_data, actor, None,
                            target_valid_from=current.valid_from,
                            new_valid_to=body.valid_to,
                            extra_filters=extra_filters,
                        )
                else:
                    await close_and_create(
                        db, model, tenant_id, new_data, actor,
                        new_valid_from=date.today(),
                        new_valid_to=body.valid_to,
                        extra_filters=extra_filters,
                    )

        # ── Action 'הוסף': הוסף — allowed ONLY when no active row exists (per type) ─
        elif body.action == "add":
            current = await get_active(db, model, tenant_id, extra_filters=extra_filters)
            if current is not None:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "error": "לא ניתן להוסיף רשומה חדשה כשקיימת רשומה פעילה — "
                                 "השתמש בשמור עם תאריך חדש כדי לפתוח תקופה חדשה.",
                        "code": "ACTIVE_ROW_EXISTS",
                    }
                )
            effective_from = body.valid_from or date.today()
            overlaps, conflict = await check_date_overlap(db, model, tenant_id, effective_from, extra_filters=extra_filters)
            if overlaps:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "error": f"תאריך {effective_from} נמצא בטווח רשומה קיימת "
                                 f"({conflict.valid_from} – {conflict.valid_to})",
                        "code": "DATE_OVERLAP",
                    }
                )
            await close_and_create(
                db, model, tenant_id, new_data, actor,
                new_valid_from=effective_from,
                new_valid_to=body.valid_to,
                extra_filters=extra_filters,
            )

        # ── Action '4': קביעה — overwrite overlapping records in period ──
        elif body.action == "set":
            if not body.valid_from:
                raise HTTPException(
                    status_code=422,
                    detail={"error": "קביעה דורשת תאריך תחילה", "code": "MISSING_DATE"}
                )
            await kabiya(
                db, model, tenant_id, new_data, actor,
                new_valid_from=body.valid_from,
                new_valid_to=body.valid_to,
                extra_filters=extra_filters,
            )

        # ── Action '3a': ביטול מחיקה — hard-delete a specific row ────────
        elif body.action == "delete":
            if not body.valid_from:
                raise HTTPException(
                    status_code=422,
                    detail={"error": "ביטול מחיקה דורש תאריך התחלה לזיהוי השורה", "code": "MISSING_DATE"}
                )
            await delete_specific_row(db, model, tenant_id, body.valid_from, extra_filters=extra_filters)

        # ── Action '3b': ביטול גמר תוקף — close the active row ──────────
        elif body.action == "close":
            if not body.valid_to:
                raise HTTPException(
                    status_code=422,
                    detail={"error": "סגירת תקופה דורשת תאריך גמר תוקף", "code": "MISSING_DATE"}
                )
            current = await get_active(db, model, tenant_id, extra_filters=extra_filters)
            if current is None:
                raise HTTPException(
                    status_code=409,
                    detail={"error": "אין שורה פעילה לסגירה", "code": "NO_ACTIVE_ROW"}
                )
            if body.valid_to < current.valid_from:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "error": f"תאריך גמר תוקף ({body.valid_to}) לא יכול להיות לפני תאריך תחילת השורה הפעילה ({current.valid_from})",
                        "code": "INVALID_DATE",
                    }
                )
            await close_active_row(db, model, tenant_id, body.valid_to, actor_id=actor, extra_filters=extra_filters)

    await _maybe_update(TenantIdentity, body.identity, TenantIdentityOut)
    await _maybe_update(TenantContact, body.contact, TenantContactOut, extra_filter_key="contact_type")
    await _maybe_update(TenantAddress, body.address, TenantAddressOut)
    await _maybe_update(TenantSubscription, body.subscription, TenantSubscriptionOut)
    await _maybe_update(TenantStatus, body.status, TenantStatusOut)

    if body.subscription is not None:
        if previous_subscription is not None and body.action in {"update", "close", "set", "add"}:
            refreshed_previous = await db.get(TenantSubscription, previous_subscription.id)
            if refreshed_previous and refreshed_previous.valid_to is not None:
                await align_subscription_modules_to_subscription(
                    db,
                    subscription_id=refreshed_previous.id,
                    valid_to=refreshed_previous.valid_to,
                    actor_id=actor,
                )

        active_subscription = await get_active(db, TenantSubscription, tenant_id)
        if active_subscription is not None:
            rows = await load_subscription_modules(db, active_subscription.id, as_of=active_subscription.valid_from)
            if not rows:
                if previous_subscription and previous_subscription.id != active_subscription.id:
                    rows = await clone_subscription_modules(
                        db,
                        source_subscription_id=previous_subscription.id,
                        target_subscription_id=active_subscription.id,
                        actor_id=actor,
                        target_valid_from=active_subscription.valid_from,
                        target_valid_to=active_subscription.valid_to,
                        source_as_of=active_subscription.valid_from - timedelta(days=1),
                    )
                else:
                    rows = await _materialize_subscription_modules(
                        db,
                        subscription=active_subscription,
                        actor_id=actor,
                        explicit_module_slugs=body.subscription.selected_module_slugs,
                    )
            await _sync_subscription_header_from_date(db, active_subscription, as_of=date.today())
            await _sync_subscription_to_billing(db, active_subscription, actor_id=actor, as_of=date.today())

    await db.commit()
    return await _build_tenant_out(tenant, db)


@router.post("/{tenant_id}/apply-template", response_model=TenantOut)
async def apply_template_to_tenant(
    tenant_id: uuid.UUID,
    body: TenantApplyTemplateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("tenants", "edit")),
):
    result = await db.execute(select(Tenant).where(Tenant.tenant_id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail={"error": "Tenant not found", "code": "NOT_FOUND"})

    template_result = await db.execute(select(OrgTemplate).where(OrgTemplate.id == body.template_id))
    template = template_result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail={"error": "Template not found", "code": "NOT_FOUND"})

    effective_from = body.valid_from or date.today()
    await _ensure_tenant_operation_window(db, tenant_id, effective_from)
    template_defaults = await _load_template_defaults(db, template.id)
    module_slugs = await _load_template_modules(db, template.id)

    subscription_payload = {
        "template_id": template.id,
        "billing_cycle": template.default_billing_cycle,
        "currency": "ILS",
        "discount_pct": Decimal(template_defaults.get("discount_pct", "0")),
        "is_price_locked": template_defaults.get("is_price_locked", "false").lower() in {"1", "true", "yes"},
    }

    # Build existing seat map so apply-template uses Option-C (take max)
    current_subscription = await get_active(db, TenantSubscription, tenant_id)
    new_subscription, existing_seats = await _upsert_subscription_for_effective_date(
        db,
        tenant_id=tenant_id,
        current_subscription=current_subscription,
        subscription_payload=subscription_payload,
        actor_id=current_user.id,
        effective_from=effective_from,
    )

    await _materialize_subscription_modules(
        db,
        subscription=new_subscription,
        actor_id=current_user.id,
        template_defaults=template_defaults,
        explicit_module_slugs=module_slugs,
        existing_seats=existing_seats,
    )
    await _sync_subscription_to_billing(db, new_subscription, actor_id=current_user.id, as_of=effective_from)

    await db.commit()
    return await _build_tenant_out(tenant, db)


@router.get("/{tenant_id}/subscription-modules", response_model=list[TenantSubscriptionModuleOut])
async def list_tenant_subscription_modules(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("tenants", "view")),
):
    subscription = await get_active(db, TenantSubscription, tenant_id)
    if not subscription:
        raise HTTPException(status_code=404, detail={"error": "Active subscription not found", "code": "NOT_FOUND"})
    return await _serialize_subscription_modules(db, subscription.id)


@router.get("/{tenant_id}/subscription-modules/history", response_model=list[TenantSubscriptionModuleOut])
async def list_tenant_subscription_module_history(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("tenants", "view")),
):
    result = await db.execute(select(Tenant).where(Tenant.tenant_id == tenant_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail={"error": "Tenant not found", "code": "NOT_FOUND"})
    return await _serialize_tenant_subscription_module_history(db, tenant_id)


async def _get_active_subscription_or_404(db: AsyncSession, tenant_id: uuid.UUID) -> TenantSubscription:
    subscription = await get_active(db, TenantSubscription, tenant_id)
    if not subscription:
        raise HTTPException(status_code=404, detail={"error": "Active subscription not found", "code": "NOT_FOUND"})
    return subscription


async def _build_subscription_module_out(
    db: AsyncSession,
    row: TenantSubscriptionModule,
) -> TenantSubscriptionModuleOut:
    user_lookup = await _load_user_lookup(db, _collect_row_user_ids(row))
    return _serialize_temporal_row(row, TenantSubscriptionModuleOut, user_lookup)


async def _find_subscription_module_row(
    db: AsyncSession,
    *,
    subscription_id: uuid.UUID,
    module_id: uuid.UUID | None = None,
    module_slug: str | None = None,
    valid_from: date | None = None,
) -> TenantSubscriptionModule | None:
    stmt = select(TenantSubscriptionModule).where(
        TenantSubscriptionModule.tenant_subscription_id == subscription_id
    )
    if module_id is not None:
        stmt = stmt.where(TenantSubscriptionModule.id == module_id)
    if module_slug is not None:
        stmt = stmt.where(TenantSubscriptionModule.module_slug == module_slug)
    if valid_from is not None:
        stmt = stmt.where(TenantSubscriptionModule.valid_from == valid_from)
    stmt = stmt.order_by(TenantSubscriptionModule.valid_from.desc(), TenantSubscriptionModule.created_at.desc())
    result = await db.execute(stmt.limit(1))
    return result.scalar_one_or_none()


async def _module_period_overlap_exists(
    db: AsyncSession,
    *,
    subscription_id: uuid.UUID,
    module_slug: str,
    valid_from: date,
    valid_to: date | None,
    exclude_id: uuid.UUID | None = None,
) -> bool:
    stmt = select(TenantSubscriptionModule.id).where(
        TenantSubscriptionModule.tenant_subscription_id == subscription_id,
        TenantSubscriptionModule.module_slug == module_slug,
        TenantSubscriptionModule.valid_from <= (valid_to or date.max),
        sa.or_(TenantSubscriptionModule.valid_to.is_(None), TenantSubscriptionModule.valid_to >= valid_from),
    )
    if exclude_id is not None:
        stmt = stmt.where(TenantSubscriptionModule.id != exclude_id)
    result = await db.execute(stmt.limit(1))
    return result.first() is not None


def _subscription_module_payload(
    body: TenantSubscriptionModuleActionBody,
    *,
    module_slug: str | None = None,
) -> dict[str, object]:
    payload = body.model_dump(exclude={"action", "module_id", "valid_from", "valid_to"}, exclude_none=True)
    if module_slug is not None:
        payload["module_slug"] = module_slug
    payload.setdefault("source_type", "manual")
    payload.setdefault("status", "active")
    payload.setdefault("seats", 0)
    payload.setdefault("pricing_mode", "catalog")
    return payload


def _copy_subscription_module_fields(row: TenantSubscriptionModule) -> dict[str, object]:
    return {
        "module_slug": row.module_slug,
        "source_type": row.source_type,
        "status": row.status,
        "seats": row.seats,
        "pricing_mode": row.pricing_mode,
        "override_base_price_ils": row.override_base_price_ils,
        "override_per_seat_ils": row.override_per_seat_ils,
        "override_setup_fee_ils": row.override_setup_fee_ils,
        "override_included_seats": row.override_included_seats,
        "price_lock_reason": row.price_lock_reason,
        "notes": row.notes,
    }


async def _log_seat_change_if_needed(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    actor_id: uuid.UUID,
    source_row: TenantSubscriptionModule,
    new_row: TenantSubscriptionModule,
    effective_date: date,
) -> None:
    if source_row.seats == new_row.seats:
        return
    db.add(SeatChangeLog(
        subscription_module_id=new_row.id,
        tenant_id=tenant_id,
        module_slug=new_row.module_slug,
        old_seats=source_row.seats,
        new_seats=new_row.seats,
        effective_date=effective_date,
        created_by=actor_id,
    ))


async def _execute_subscription_module_action(
    tenant_id: uuid.UUID,
    body: TenantSubscriptionModuleActionBody,
    *,
    db: AsyncSession,
    current_user: CurrentUser,
) -> TenantSubscriptionModuleOut | None:
    subscription = await _get_active_subscription_or_404(db, tenant_id)
    actor_id = current_user.id
    action = body.action

    if action in {"add", "set", "update"}:
        effective_from = body.valid_from or date.today()
        await _ensure_tenant_operation_window(db, tenant_id, effective_from, body.valid_to)
    elif action == "close":
        if not body.valid_to:
            raise HTTPException(status_code=422, detail={"error": "סגירת תקופה דורשת תאריך גמר תוקף", "code": "MISSING_DATE"})
        await _ensure_tenant_operation_window(db, tenant_id, body.valid_to, body.valid_to)
    elif action == "delete":
        effective_on = body.valid_to or body.valid_from or date.today()
        await _ensure_tenant_operation_window(db, tenant_id, effective_on, effective_on)

    target = None
    if body.module_id:
        target = await _find_subscription_module_row(
            db,
            subscription_id=subscription.id,
            module_id=body.module_id,
        )
        if target is None:
            raise HTTPException(status_code=404, detail={"error": "Subscription module not found", "code": "NOT_FOUND"})

    module_slug = body.module_slug or (target.module_slug if target else None)

    if action in {"add", "set"} and not module_slug:
        raise HTTPException(status_code=422, detail={"error": "יש לבחור מודול", "code": "MISSING_MODULE"})

    if action == "delete":
        if target is None and module_slug and body.valid_from:
            target = await _find_subscription_module_row(
                db,
                subscription_id=subscription.id,
                module_slug=module_slug,
                valid_from=body.valid_from,
            )
        if target is None:
            raise HTTPException(status_code=404, detail={"error": "Subscription module row not found", "code": "NOT_FOUND"})
        await db.delete(target)
        await _sync_subscription_header_from_date(db, subscription, as_of=date.today())
        await _sync_subscription_to_billing(db, subscription, actor_id=actor_id, as_of=date.today())
        await db.commit()
        return None

    if action == "close":
        if target is None:
            raise HTTPException(status_code=422, detail={"error": "סגירת תקופה דורשת שורת מודול", "code": "MISSING_ID"})
        if body.valid_to is None or body.valid_to < target.valid_from:
            raise HTTPException(status_code=422, detail={"error": "תאריך סיום אינו תקין", "code": "INVALID_DATE"})
        target.valid_to = body.valid_to
        target.updated_by = actor_id
        target.updated_at = _now_utc()
        await _sync_subscription_header_from_date(db, subscription, as_of=date.today())
        await _sync_subscription_to_billing(db, subscription, actor_id=actor_id, as_of=date.today())
        await db.commit()
        await db.refresh(target)
        return await _build_subscription_module_out(db, target)

    if action == "add":
        effective_from = body.valid_from or date.today()
        if await _module_period_overlap_exists(
            db,
            subscription_id=subscription.id,
            module_slug=module_slug,
            valid_from=effective_from,
            valid_to=body.valid_to,
        ):
            raise HTTPException(status_code=409, detail={"error": "כבר קיימת רשומת מודול חופפת עבור התקופה", "code": "DATE_OVERLAP"})
        row = TenantSubscriptionModule(
            tenant_subscription_id=subscription.id,
            created_by=actor_id,
            valid_from=effective_from,
            valid_to=body.valid_to,
            **_subscription_module_payload(body, module_slug=module_slug),
        )
        db.add(row)
        await db.flush()
        await _sync_subscription_header_from_date(db, subscription, as_of=date.today())
        await _sync_subscription_to_billing(db, subscription, actor_id=actor_id, as_of=date.today())
        await db.commit()
        await db.refresh(row)
        return await _build_subscription_module_out(db, row)

    if action == "update":
        if target is None:
            raise HTTPException(status_code=422, detail={"error": "עדכון דורש שורת מודול", "code": "MISSING_ID"})
        effective_from = body.valid_from or target.valid_from
        if effective_from == target.valid_from:
            old_snapshot = TenantSubscriptionModule(
                tenant_subscription_id=target.tenant_subscription_id,
                module_slug=target.module_slug,
                source_type=target.source_type,
                status=target.status,
                seats=target.seats,
                pricing_mode=target.pricing_mode,
                override_base_price_ils=target.override_base_price_ils,
                override_per_seat_ils=target.override_per_seat_ils,
                override_setup_fee_ils=target.override_setup_fee_ils,
                override_included_seats=target.override_included_seats,
                price_lock_reason=target.price_lock_reason,
                notes=target.notes,
                valid_from=target.valid_from,
                valid_to=target.valid_to,
            )
            for key, value in _subscription_module_payload(body, module_slug=target.module_slug).items():
                setattr(target, key, value)
            target.valid_to = body.valid_to
            target.updated_by = actor_id
            target.updated_at = _now_utc()
            await db.flush()
            await _log_seat_change_if_needed(
                db,
                tenant_id=tenant_id,
                actor_id=actor_id,
                source_row=old_snapshot,
                new_row=target,
                effective_date=effective_from,
            )
            await _sync_subscription_header_from_date(db, subscription, as_of=date.today())
            await _sync_subscription_to_billing(db, subscription, actor_id=actor_id, as_of=date.today())
            await db.commit()
            await db.refresh(target)
            return await _build_subscription_module_out(db, target)

        if await _module_period_overlap_exists(
            db,
            subscription_id=subscription.id,
            module_slug=target.module_slug,
            valid_from=effective_from,
            valid_to=body.valid_to,
            exclude_id=target.id,
        ):
            raise HTTPException(
                status_code=409,
                detail={"error": "תאריך תחילת התוקף החדש חופף לשורת מודול אחרת", "code": "DATE_OVERLAP"},
            )

        target.valid_to = effective_from - timedelta(days=1)
        target.updated_by = actor_id
        target.updated_at = _now_utc()

        new_row = TenantSubscriptionModule(
            tenant_subscription_id=subscription.id,
            created_by=actor_id,
            valid_from=effective_from,
            valid_to=body.valid_to,
            **_subscription_module_payload(body, module_slug=target.module_slug),
        )
        db.add(new_row)
        await db.flush()
        await _log_seat_change_if_needed(
            db,
            tenant_id=tenant_id,
            actor_id=actor_id,
            source_row=target,
            new_row=new_row,
            effective_date=effective_from,
        )
        await _sync_subscription_header_from_date(db, subscription, as_of=date.today())
        await _sync_subscription_to_billing(db, subscription, actor_id=actor_id, as_of=date.today())
        await db.commit()
        await db.refresh(new_row)
        return await _build_subscription_module_out(db, new_row)

    if action == "set":
        effective_from = body.valid_from or date.today()
        new_valid_to = body.valid_to
        reference_row = await get_effective_subscription_module(
            db,
            subscription.id,
            module_slug,
            as_of=effective_from,
        )
        rows = await load_subscription_module_history(db, subscription.id)
        same_module_rows = [row for row in rows if row.module_slug == module_slug]

        for row in same_module_rows:
            rec_from = row.valid_from
            rec_to = row.valid_to

            if rec_to is not None and rec_to < effective_from:
                continue

            if new_valid_to is not None and rec_from > new_valid_to:
                continue

            starts_before = rec_from < effective_from
            ends_after = new_valid_to is not None and (rec_to is None or rec_to > new_valid_to)

            if starts_before and ends_after:
                right = TenantSubscriptionModule(
                    tenant_subscription_id=subscription.id,
                    created_by=actor_id,
                    valid_from=new_valid_to + timedelta(days=1),
                    valid_to=rec_to,
                    **_copy_subscription_module_fields(row),
                )
                db.add(right)
                row.valid_to = effective_from - timedelta(days=1)
                row.updated_by = actor_id
                row.updated_at = _now_utc()
            elif starts_before:
                row.valid_to = effective_from - timedelta(days=1)
                row.updated_by = actor_id
                row.updated_at = _now_utc()
            elif ends_after:
                row.valid_from = new_valid_to + timedelta(days=1)
                row.updated_by = actor_id
                row.updated_at = _now_utc()
            else:
                await db.execute(
                    delete(TenantSubscriptionModule)
                    .where(TenantSubscriptionModule.id == row.id)
                    .execution_options(synchronize_session=False)
                )

        new_row = TenantSubscriptionModule(
            tenant_subscription_id=subscription.id,
            created_by=actor_id,
            valid_from=effective_from,
            valid_to=new_valid_to,
            **_subscription_module_payload(body, module_slug=module_slug),
        )
        db.add(new_row)
        await db.flush()
        if reference_row is not None:
            await _log_seat_change_if_needed(
                db,
                tenant_id=tenant_id,
                actor_id=actor_id,
                source_row=reference_row,
                new_row=new_row,
                effective_date=effective_from,
            )
        await _sync_subscription_header_from_date(db, subscription, as_of=date.today())
        await _sync_subscription_to_billing(db, subscription, actor_id=actor_id, as_of=date.today())
        await db.commit()
        await db.refresh(new_row)
        return await _build_subscription_module_out(db, new_row)

    raise HTTPException(status_code=422, detail={"error": "Unsupported action", "code": "INVALID_ACTION"})


@router.put("/{tenant_id}/subscription-modules/temporal", response_model=TenantSubscriptionModuleOut | None)
async def temporal_tenant_subscription_module(
    tenant_id: uuid.UUID,
    body: TenantSubscriptionModuleActionBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("tenants", "edit")),
):
    return await _execute_subscription_module_action(
        tenant_id,
        body,
        db=db,
        current_user=current_user,
    )


@router.post("/{tenant_id}/subscription-modules", response_model=TenantSubscriptionModuleOut, status_code=status.HTTP_201_CREATED)
async def add_tenant_subscription_module(
    tenant_id: uuid.UUID,
    body: TenantSubscriptionModuleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("tenants", "edit")),
):
    result = await _execute_subscription_module_action(
        tenant_id,
        TenantSubscriptionModuleActionBody(action="add", valid_from=date.today(), **body.model_dump()),
        db=db,
        current_user=current_user,
    )
    if result is None:
        raise HTTPException(status_code=500, detail={"error": "Failed to create module", "code": "INTERNAL_ERROR"})
    return result


@router.put("/{tenant_id}/subscription-modules/{module_id}", response_model=TenantSubscriptionModuleOut)
async def update_tenant_subscription_module(
    tenant_id: uuid.UUID,
    module_id: uuid.UUID,
    body: TenantSubscriptionModuleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("tenants", "edit")),
):
    result = await _execute_subscription_module_action(
        tenant_id,
        TenantSubscriptionModuleActionBody(action="update", module_id=module_id, **body.model_dump(exclude_none=True)),
        db=db,
        current_user=current_user,
    )
    if result is None:
        raise HTTPException(status_code=500, detail={"error": "Failed to update module", "code": "INTERNAL_ERROR"})
    return result


@router.delete("/{tenant_id}/subscription-modules/{module_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tenant_subscription_module(
    tenant_id: uuid.UUID,
    module_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("tenants", "edit")),
):
    await _execute_subscription_module_action(
        tenant_id,
        TenantSubscriptionModuleActionBody(action="delete", module_id=module_id),
        db=db,
        current_user=current_user,
    )


@router.get("/{tenant_id}/sync-preview", response_model=TenantSyncPreviewOut)
async def preview_tenant_sync(
    tenant_id: uuid.UUID,
    template_id: uuid.UUID,
    effective_from: date | None = None,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("tenants", "view")),
):
    template_result = await db.execute(select(OrgTemplate).where(OrgTemplate.id == template_id))
    template = template_result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail={"error": "Template not found", "code": "NOT_FOUND"})
    await _ensure_tenant_operation_window(db, tenant_id, effective_from or date.today())
    return await _preview_template_sync(
        db,
        tenant_id=tenant_id,
        template=template,
        effective_from=effective_from or date.today(),
    )


@router.post("/{tenant_id}/sync-preview/apply", response_model=TenantOut)
async def apply_tenant_sync(
    tenant_id: uuid.UUID,
    body: TenantApplySyncRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("tenants", "edit")),
):
    tenant_result = await db.execute(select(Tenant).where(Tenant.tenant_id == tenant_id))
    tenant = tenant_result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail={"error": "Tenant not found", "code": "NOT_FOUND"})
    template_result = await db.execute(select(OrgTemplate).where(OrgTemplate.id == body.template_id))
    template = template_result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail={"error": "Template not found", "code": "NOT_FOUND"})

    current_subscription = await get_active(db, TenantSubscription, tenant_id)
    if not current_subscription:
        raise HTTPException(status_code=409, detail={"error": "Tenant has no active subscription", "code": "NO_SUBSCRIPTION"})

    effective_from = body.valid_from or date.today()
    await _ensure_tenant_operation_window(db, tenant_id, effective_from)
    template_defaults = await _load_template_defaults(db, template.id)
    # Build existing seat map for Option-C (take max of template vs existing)
    new_subscription, existing_seats = await _upsert_subscription_for_effective_date(
        db,
        tenant_id=tenant_id,
        current_subscription=current_subscription,
        subscription_payload={
            "template_id": template.id,
            "billing_cycle": template.default_billing_cycle,
            "currency": current_subscription.currency,
            "discount_pct": Decimal(template_defaults.get("discount_pct", "0")),
            "is_price_locked": template_defaults.get("is_price_locked", "false").lower() in {"1", "true", "yes"},
        },
        actor_id=current_user.id,
        effective_from=effective_from,
    )
    module_slugs = await _load_template_modules(db, template.id)
    await _materialize_subscription_modules(
        db,
        subscription=new_subscription,
        actor_id=current_user.id,
        template_defaults=template_defaults,
        explicit_module_slugs=module_slugs,
        existing_seats=existing_seats,
    )
    await _sync_subscription_to_billing(db, new_subscription, actor_id=current_user.id, as_of=effective_from)
    await db.commit()
    return await _build_tenant_out(tenant, db)


@router.get("/{tenant_id}/history")
async def get_tenant_history(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_permission("tenants", "view")),
):
    result = await db.execute(select(Tenant).where(Tenant.tenant_id == tenant_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail={"error": "Tenant not found", "code": "NOT_FOUND"})

    identity_rows = await get_history(db, TenantIdentity, tenant_id)
    contact_rows = await get_history(db, TenantContact, tenant_id)
    address_rows = await get_history(db, TenantAddress, tenant_id)
    subscription_rows = await get_history(db, TenantSubscription, tenant_id)
    subscription_module_rows = await load_tenant_subscription_module_history(db, tenant_id)
    status_rows = await get_history(db, TenantStatus, tenant_id)

    user_lookup = await _load_user_lookup(
        db,
        _collect_row_user_ids(
            *identity_rows,
            *contact_rows,
            *address_rows,
            *subscription_rows,
            *subscription_module_rows,
            *status_rows,
        ),
    )

    return {
        "identity": [_serialize_temporal_row(r, TenantIdentityOut, user_lookup) for r in identity_rows],
        "contact": [_serialize_temporal_row(r, TenantContactOut, user_lookup) for r in contact_rows],
        "address": [_serialize_temporal_row(r, TenantAddressOut, user_lookup) for r in address_rows],
        "subscription": [
            TenantSubscriptionOut(
                **_subscription_payload_from_row(
                    r,
                    effective_rows,
                    user_lookup,
                    await _subscription_pricing_summary(db, r, effective_rows, as_of=r.valid_from),
                )
            )
            for r in subscription_rows
            for effective_rows in [[
                module_row
                for module_row in subscription_module_rows
                if module_row.tenant_subscription_id == r.id
                and module_row.valid_from <= r.valid_from
                and (module_row.valid_to is None or module_row.valid_to >= r.valid_from)
            ]]
        ],
        "subscription_modules": [_serialize_temporal_row(r, TenantSubscriptionModuleOut, user_lookup) for r in subscription_module_rows],
        "status": [_serialize_temporal_row(r, TenantStatusOut, user_lookup) for r in status_rows],
    }
