from __future__ import annotations

import uuid
from typing import Any

ORG_UNIT_TYPE_ORDER = ("division", "department", "section", "team")
ORG_UNIT_PARENT_TYPE: dict[str, str | None] = {
    "division": None,
    "department": "division",
    "section": "department",
    "team": "section",
}


def would_create_manager_cycle(
    manager_map: dict[uuid.UUID, uuid.UUID | None],
    employee_id: uuid.UUID,
    proposed_manager_id: uuid.UUID | None,
) -> bool:
    if proposed_manager_id is None:
        return False
    if proposed_manager_id == employee_id:
        return True

    visited: set[uuid.UUID] = {employee_id}
    cursor = proposed_manager_id
    while cursor is not None:
        if cursor in visited:
            return True
        visited.add(cursor)
        cursor = manager_map.get(cursor)
    return False


def redact_identity_sensitive(identity: dict[str, Any] | None, can_manage_sensitive: bool) -> dict[str, Any] | None:
    if identity is None or can_manage_sensitive:
        return identity

    masked = dict(identity)
    legal_id_number = masked.get("legal_id_number")
    spouse_legal_id = masked.get("spouse_legal_id")
    bank_account = masked.get("bank_account")
    if isinstance(legal_id_number, str) and legal_id_number:
        masked["legal_id_number"] = _mask_value(legal_id_number)
    if isinstance(spouse_legal_id, str) and spouse_legal_id:
        masked["spouse_legal_id"] = _mask_value(spouse_legal_id)
    if isinstance(bank_account, str) and bank_account:
        masked["bank_account"] = _mask_value(bank_account)
    return masked


def redact_bank_account_sensitive(bank_account: dict[str, Any] | None, can_manage_sensitive: bool) -> dict[str, Any] | None:
    if bank_account is None or can_manage_sensitive:
        return bank_account

    masked = dict(bank_account)
    account_number = masked.get("account_number")
    if isinstance(account_number, str) and account_number:
        masked["account_number"] = _mask_value(account_number)
    return masked


def redact_compensation_sensitive(compensation: dict[str, Any] | None, can_manage_sensitive: bool) -> dict[str, Any] | None:
    if compensation is None or can_manage_sensitive:
        return compensation

    masked = dict(compensation)
    masked["base_salary"] = None
    masked["components_json"] = None
    return masked


def _mask_value(value: str) -> str:
    if len(value) <= 4:
        return "*" * len(value)
    return "*" * (len(value) - 4) + value[-4:]


def expected_parent_unit_type(unit_type: str) -> str | None:
    return ORG_UNIT_PARENT_TYPE.get(unit_type)


def next_three_digit_code(existing_codes: list[str | None]) -> str:
    max_code = 0
    for code in existing_codes:
        if not code:
            continue
        normalized = code.strip()
        if normalized.isdigit():
            max_code = max(max_code, int(normalized))
    return str(max_code + 1).zfill(3)
