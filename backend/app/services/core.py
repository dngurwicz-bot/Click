"""Shared helpers for the Core (HR) module."""
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func


def next_three_digit_code(existing: list[str]) -> str:
    """Return next available zero-padded 3-digit code (001, 002, …)."""
    used = set()
    for c in existing:
        try:
            used.add(int(c))
        except ValueError:
            pass
    n = 1
    while n in used:
        n += 1
    return str(n).zfill(3)


async def next_employee_number(session: AsyncSession, tenant_id: uuid.UUID) -> int:
    """Return the next employee number for this tenant (tenant-scoped sequence)."""
    from app.models.core import Employee
    result = await session.execute(
        select(func.coalesce(func.max(Employee.employee_number), 0) + 1)
        .where(Employee.tenant_id == tenant_id)
    )
    return result.scalar_one()
