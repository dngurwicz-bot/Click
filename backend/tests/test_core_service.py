from uuid import uuid4

from app.services.core import (
    redact_bank_account_sensitive,
    redact_compensation_sensitive,
    redact_identity_sensitive,
    would_create_manager_cycle,
)


def test_would_create_manager_cycle_detects_direct_and_indirect_cycles():
    employee_a = uuid4()
    employee_b = uuid4()
    employee_c = uuid4()

    manager_map = {
        employee_a: employee_b,
        employee_b: employee_c,
        employee_c: None,
    }

    assert would_create_manager_cycle(manager_map, employee_a, employee_a) is True
    assert would_create_manager_cycle(manager_map, employee_c, employee_a) is True
    assert would_create_manager_cycle(manager_map, employee_a, None) is False


def test_redact_identity_sensitive_masks_sensitive_fields():
    payload = {
        "id": str(uuid4()),
        "legal_id_number": "123456789",
        "spouse_legal_id": "111222333",
        "bank_account": "987654321",
    }

    redacted = redact_identity_sensitive(payload, can_manage_sensitive=False)

    assert redacted is not None
    assert redacted["legal_id_number"].endswith("6789")
    assert redacted["spouse_legal_id"].endswith("2333")
    assert redacted["bank_account"].endswith("4321")
    assert redacted["legal_id_number"] != payload["legal_id_number"]


def test_redact_compensation_sensitive_removes_amounts_without_permission():
    payload = {
        "id": str(uuid4()),
        "base_salary": 15000,
        "currency": "ILS",
        "components_json": {"bonus": 1200},
    }

    redacted = redact_compensation_sensitive(payload, can_manage_sensitive=False)

    assert redacted is not None
    assert redacted["base_salary"] is None
    assert redacted["components_json"] is None


def test_redact_bank_account_sensitive_masks_account_number():
    payload = {
        "id": str(uuid4()),
        "bank_name": "Leumi",
        "account_number": "123456789",
    }

    redacted = redact_bank_account_sensitive(payload, can_manage_sensitive=False)

    assert redacted is not None
    assert redacted["bank_name"] == "Leumi"
    assert redacted["account_number"].endswith("6789")
