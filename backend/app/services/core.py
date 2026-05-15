"""Shared helpers for the Core (HR) module."""
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func


def _mask_sensitive_value(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = str(value)
    if len(cleaned) <= 4:
        return "*" * len(cleaned)
    return f"{'*' * (len(cleaned) - 4)}{cleaned[-4:]}"


def redact_identity_sensitive(payload: dict | None, *, can_manage_sensitive: bool) -> dict | None:
    if payload is None or can_manage_sensitive:
        return payload
    redacted = dict(payload)
    for key in ("legal_id_number", "spouse_legal_id", "bank_account"):
        if key in redacted:
            redacted[key] = _mask_sensitive_value(redacted.get(key))
    return redacted


def redact_compensation_sensitive(payload: dict | None, *, can_manage_sensitive: bool) -> dict | None:
    if payload is None or can_manage_sensitive:
        return payload
    redacted = dict(payload)
    for key in ("base_salary", "amount", "percentage", "components_json"):
        if key in redacted:
            redacted[key] = None
    return redacted


def redact_bank_account_sensitive(payload: dict | None, *, can_manage_sensitive: bool) -> dict | None:
    if payload is None or can_manage_sensitive:
        return payload
    redacted = dict(payload)
    for key in ("account_number", "account", "iban"):
        if key in redacted:
            redacted[key] = _mask_sensitive_value(redacted.get(key))
    return redacted


def would_create_manager_cycle(
    manager_map: dict[uuid.UUID, uuid.UUID | None],
    employee_id: uuid.UUID,
    manager_id: uuid.UUID | None,
) -> bool:
    seen: set[uuid.UUID] = set()
    current = manager_id
    while current is not None:
        if current == employee_id:
            return True
        if current in seen:
            return True
        seen.add(current)
        current = manager_map.get(current)
    return False


def next_three_digit_code(existing: list[str]) -> str:
    """Return the next numeric code after the current maximum (001, 002, …)."""
    max_value = 0
    for c in existing:
        if c in (None, ""):
            continue
        try:
            max_value = max(max_value, int(c))
        except (TypeError, ValueError):
            pass
    return str(max_value + 1).zfill(3)


async def next_employee_number(session: AsyncSession, tenant_id: uuid.UUID) -> int:
    """Return the next employee number for this tenant (tenant-scoped sequence)."""
    from app.models.core import Employee
    result = await session.execute(
        select(func.coalesce(func.max(Employee.employee_number), 0) + 1)
        .where(Employee.tenant_id == tenant_id)
    )
    return result.scalar_one()
