from datetime import datetime
from typing import Any
from sqlalchemy import Select, select, desc, asc, cast, String
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.tenant import Tenant, TenantIdentity, TenantStatus, TenantSubscription, TenantSubscriptionModule
from app.models.module import Module
from app.models.audit_log import AuditLog
from app.models.admin_user import AdminUser
from app.schemas.dynamic_reports import (
    DynamicReportSchemaResponse,
    EntityDefinition,
    FieldDefinition,
    DynamicReportQuery,
    DynamicReportResult,
)


AVAILABLE_ENTITIES = [
    EntityDefinition(
        id="tenants",
        label="Tenants",
        description="Core records of customers including identity, status, and subscriptions.",
        fields=[
            FieldDefinition(id="tenant_id", label="Tenant ID", type="uuid", operators=["equals", "not_equals"]),
            FieldDefinition(id="org_number", label="Org Number", type="number", operators=["equals", "not_equals", "greater_than", "less_than"]),
            FieldDefinition(id="created_at", label="Created At", type="datetime", operators=["greater_than", "less_than"]),
            FieldDefinition(id="name_he", label="Name (HE)", type="string", operators=["equals", "contains"]),
            FieldDefinition(id="tax_id", label="Tax ID", type="string", operators=["equals", "contains"]),
            FieldDefinition(id="status", label="Status", type="string", operators=["equals", "not_equals", "in"]),
            FieldDefinition(id="seat_count", label="Seats", type="number", operators=["equals", "greater_than", "less_than"]),
            FieldDefinition(id="next_renewal_at", label="Next Renewal Date", type="date", operators=["greater_than", "less_than"]),
            FieldDefinition(id="billing_cycle", label="Billing Cycle", type="string", operators=["equals", "not_equals"]),
        ],
    ),
    EntityDefinition(
        id="audit_logs",
        label="Audit Logs",
        description="System audit trail tracking all actions and changes.",
        fields=[
            FieldDefinition(id="id", label="Log ID", type="uuid", operators=["equals", "not_equals"]),
            FieldDefinition(id="action", label="Action", type="string", operators=["equals", "not_equals", "contains"]),
            FieldDefinition(id="entity_type", label="Entity Type", type="string", operators=["equals", "not_equals"]),
            FieldDefinition(id="actor_name", label="Actor Name", type="string", operators=["equals", "contains"]),
            FieldDefinition(id="actor_email", label="Actor Email", type="string", operators=["equals", "contains"]),
            FieldDefinition(id="created_at", label="Created At", type="datetime", operators=["greater_than", "less_than"]),
        ],
    ),
    EntityDefinition(
        id="tenant_modules",
        label="Tenant Modules",
        description="Complex join of Tenants and their assigned Modules with seats and status.",
        fields=[
            FieldDefinition(id="tenant_id", label="Tenant ID", type="uuid", operators=["equals", "not_equals"]),
            FieldDefinition(id="org_number", label="Org Number", type="number", operators=["equals", "not_equals"]),
            FieldDefinition(id="tenant_name", label="Tenant Name", type="string", operators=["equals", "contains"]),
            FieldDefinition(id="tenant_status", label="Tenant Status", type="string", operators=["equals", "not_equals", "in"]),
            FieldDefinition(id="module_slug", label="Module Slug", type="string", operators=["equals", "not_equals", "in"]),
            FieldDefinition(id="module_name", label="Module Name", type="string", operators=["equals", "contains", "in"]),
            FieldDefinition(id="module_seats", label="Module Seats", type="number", operators=["equals", "greater_than", "less_than"]),
            FieldDefinition(id="module_status", label="Module Status", type="string", operators=["equals", "not_equals"]),
            FieldDefinition(id="valid_from", label="Added On (Date)", type="date", operators=["greater_than", "less_than"]),
        ],
    ),
]

_FIELD_MAPPING = {
    "tenants": {
        "tenant_id": Tenant.tenant_id,
        "org_number": Tenant.org_number,
        "created_at": Tenant.created_at,
        "name_he": TenantIdentity.name_he,
        "tax_id": TenantIdentity.tax_id,
        "status": TenantStatus.status,
        "seat_count": TenantSubscription.seat_count,
        "next_renewal_at": TenantSubscription.next_renewal_at,
        "billing_cycle": TenantSubscription.billing_cycle,
    },
    "audit_logs": {
        "id": AuditLog.id,
        "action": AuditLog.action,
        "entity_type": AuditLog.entity_type,
        "actor_name": AdminUser.full_name,
        "actor_email": AdminUser.email,
        "created_at": AuditLog.created_at,
    },
    "tenant_modules": {
        "tenant_id": Tenant.tenant_id,
        "org_number": Tenant.org_number,
        "tenant_name": TenantIdentity.name_he,
        "tenant_status": TenantStatus.status,
        "module_slug": TenantSubscriptionModule.module_slug,
        "module_name": Module.name,
        "module_seats": TenantSubscriptionModule.seats,
        "module_status": TenantSubscriptionModule.status,
        "valid_from": TenantSubscriptionModule.valid_from,
    },
}


def get_builder_schema() -> DynamicReportSchemaResponse:
    return DynamicReportSchemaResponse(entities=AVAILABLE_ENTITIES)


def apply_filter(query: Select, field_col: Any, operator: str, value: Any) -> Select:
    if operator == "equals":
        return query.where(field_col == value)
    if operator == "not_equals":
        return query.where(field_col != value)
    if operator == "contains":
        return query.where(cast(field_col, String).ilike(f"%{value}%"))
    if operator == "greater_than":
        return query.where(field_col > value)
    if operator == "less_than":
        return query.where(field_col < value)
    if operator == "is_null":
        return query.where(field_col.is_(None))
    if operator == "is_not_null":
        return query.where(field_col.is_not(None))
    if operator == "in":
        if isinstance(value, str):
            value = [v.strip() for v in value.split(",")]
        return query.where(field_col.in_(value))
    if operator == "not_in":
        if isinstance(value, str):
            value = [v.strip() for v in value.split(",")]
        return query.where(field_col.notin_(value))
    return query


async def execute_dynamic_query(db: AsyncSession, request: DynamicReportQuery) -> DynamicReportResult:
    if request.entity not in _FIELD_MAPPING:
        raise ValueError(f"Unknown entity: {request.entity}")

    mapping = _FIELD_MAPPING[request.entity]
    
    # 1. Build Base Select
    if request.entity == "tenants":
        query = select(Tenant)
        query = query.outerjoin(TenantIdentity, (Tenant.tenant_id == TenantIdentity.tenant_id) & TenantIdentity.valid_to.is_(None))
        query = query.outerjoin(TenantStatus, (Tenant.tenant_id == TenantStatus.tenant_id) & TenantStatus.valid_to.is_(None))
        query = query.outerjoin(TenantSubscription, (Tenant.tenant_id == TenantSubscription.tenant_id) & TenantSubscription.valid_to.is_(None))
    elif request.entity == "tenant_modules":
        query = select(TenantSubscriptionModule)
        query = query.join(Module, TenantSubscriptionModule.module_slug == Module.slug)
        query = query.join(TenantSubscription, TenantSubscriptionModule.tenant_subscription_id == TenantSubscription.id)
        query = query.join(Tenant, TenantSubscription.tenant_id == Tenant.tenant_id)
        query = query.outerjoin(TenantIdentity, (Tenant.tenant_id == TenantIdentity.tenant_id) & TenantIdentity.valid_to.is_(None))
        query = query.outerjoin(TenantStatus, (Tenant.tenant_id == TenantStatus.tenant_id) & TenantStatus.valid_to.is_(None))
        query = query.where(TenantSubscriptionModule.valid_to.is_(None))
    elif request.entity == "audit_logs":
        query = select(AuditLog)
        query = query.outerjoin(AdminUser, AuditLog.actor_id == AdminUser.id)
    else:
        raise ValueError(f"Entity not configured for execution: {request.entity}")

    # For safety, ensure selected_fields are valid
    selected = [f for f in request.selected_fields if f in mapping]
    if not selected:
        # Fallback if somehow none provided, use all available fields
        selected = list(mapping.keys())

    # Replace the select clause with just the requested fields
    cols = [mapping[f].label(f) for f in selected]
    query = query.with_only_columns(*cols)

    # 2. Apply Filters
    for rule in request.filters:
        if rule.field in mapping:
            query = apply_filter(query, mapping[rule.field], rule.operator, rule.value)

    # 3. Apply Sorting
    if request.sort_field and request.sort_field in mapping:
        sort_col = mapping[request.sort_field]
        query = query.order_by(desc(sort_col) if request.sort_desc else asc(sort_col))
    else:
        # Default sorts
        if request.entity == "tenants":
            query = query.order_by(desc(Tenant.created_at))
        elif request.entity == "audit_logs":
            query = query.order_by(desc(AuditLog.created_at))
        elif request.entity == "tenant_modules":
            query = query.order_by(desc(TenantSubscriptionModule.valid_from))

    # 4. Limit
    query = query.limit(min(request.limit, 1000))

    # Execute
    result = await db.execute(query)
    rows = result.all()

    # Format result rows
    formatted_rows = []
    for row in rows:
        row_dict = {}
        for idx, col_name in enumerate(selected):
            val = row[idx]
            if isinstance(val, str) is False and hasattr(val, "isoformat"):
                val = val.isoformat()
            if hasattr(val, "hex"):
                val = str(val) # For UUIDs
            row_dict[col_name] = val
        formatted_rows.append(row_dict)

    return DynamicReportResult(
        columns=selected,
        rows=formatted_rows,
        total=len(formatted_rows), # In a real system, we'd do a Count() query, but this is fine for now
    )
