from datetime import UTC, date, datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.middleware.auth import CurrentUser
from app.schemas.reporting import ReportDefinition, ReportExportRequest, ReportQueryRequest, ReportResult
from app.services import reporting


class _ScalarResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return self

    def all(self):
        return self._rows

    def scalar_one_or_none(self):
        return self._rows


class _TupleResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _FakeSession:
    def __init__(self, execute_results):
        self.execute_results = list(execute_results)
        self.added = []
        self.deleted = []

    async def execute(self, _query):
        return self.execute_results.pop(0)

    def add(self, row):
        self.added.append(row)

    async def flush(self):
        return None

    async def refresh(self, row):
        if getattr(row, "id", None) is None:
            row.id = uuid4()
        if getattr(row, "created_at", None) is None:
            row.created_at = datetime.now(UTC)
        return None

    async def delete(self, row):
        self.deleted.append(row)
        return None


def _current_user(user_id=None, permissions=None) -> CurrentUser:
    return CurrentUser(
        id=user_id or uuid4(),
        email="reports@example.com",
        role="admin",
        permissions=permissions or {"reports": {"can_view": True, "can_edit": True}},
    )


def _base_loader_results():
    tenant_id = uuid4()
    subscription_id = uuid4()
    template_id = uuid4()
    admin_id = uuid4()
    saved_report_id = uuid4()
    results = [
        _ScalarResult([SimpleNamespace(tenant_id=tenant_id, org_number=101, created_at=datetime(2026, 1, 2, tzinfo=UTC))]),
        _ScalarResult([
            SimpleNamespace(
                tenant_id=tenant_id,
                name_he="Acme",
                name_en="Acme Inc",
                tax_id="123456789",
                entity_type="company",
                logo_url="https://cdn/logo.png",
                industry_code="tech",
                valid_from=date(2026, 1, 1),
                valid_to=None,
            )
        ]),
        _ScalarResult([
            SimpleNamespace(
                tenant_id=tenant_id,
                contact_name="Dana",
                email="dana@acme.test",
                phone="050-1234567",
                phone_alt="050-0000000",
                website="https://acme.test",
                valid_from=date(2026, 1, 1),
                valid_to=None,
            )
        ]),
        _ScalarResult([
            SimpleNamespace(
                tenant_id=tenant_id,
                street="Herzl 1",
                city="Tel Aviv",
                zip_code="61000",
                country="IL",
                valid_from=date(2026, 1, 1),
                valid_to=None,
            )
        ]),
        _ScalarResult([
            SimpleNamespace(
                tenant_id=tenant_id,
                status="active",
                reason="paid",
                notes="VIP",
                valid_from=date(2026, 1, 1),
                valid_to=None,
            )
        ]),
        _ScalarResult([
            SimpleNamespace(
                id=subscription_id,
                tenant_id=tenant_id,
                billing_cycle="monthly",
                currency="ILS",
                template_id=template_id,
                seat_count=18,
                selected_module_slugs=["core"],
                discount_pct=5,
                is_price_locked=True,
                next_renewal_at=date(2026, 7, 1),
                valid_from=date(2026, 1, 1),
                valid_to=None,
            )
        ]),
        _ScalarResult([
            SimpleNamespace(
                id=uuid4(),
                tenant_subscription_id=subscription_id,
                module_slug="core",
                source_type="manual",
                status="active",
                seats=12,
                pricing_mode="override",
                override_base_price_ils=100,
                override_per_seat_ils=10,
                override_setup_fee_ils=50,
                override_included_seats=3,
                price_lock_reason="special deal",
                notes="important",
                valid_from=date(2026, 2, 1),
                valid_to=None,
            )
        ]),
        _ScalarResult([
            SimpleNamespace(
                id=uuid4(),
                slug="core",
                name="Core",
                description="Core module",
                icon="box",
                color_hex="#112233",
                is_required=True,
                is_active=True,
                sort_order=10,
                depends_on=["auth"],
            )
        ]),
        _ScalarResult([
            SimpleNamespace(
                module_slug="core",
                base_price_ils=200,
                per_seat_ils=15,
                included_seats=2,
                setup_fee_ils=99,
                valid_from=date(2026, 1, 1),
                valid_to=None,
                created_at=datetime(2026, 1, 1, tzinfo=UTC),
            )
        ]),
        _ScalarResult([
            SimpleNamespace(
                id=template_id,
                name="Growth",
                description="Growth template",
                default_billing_cycle="monthly",
                trial_days=14,
                is_active=True,
                sort_order=1,
                target_industry="tech",
                recommended_size="10-50",
                valid_from=date(2026, 1, 1),
                valid_to=None,
                created_at=datetime(2026, 1, 1, tzinfo=UTC),
            )
        ]),
        _ScalarResult([
            SimpleNamespace(
                id=uuid4(),
                template_id=template_id,
                default_type="currency",
                default_value="ILS",
                is_mandatory=True,
                note="required",
            )
        ]),
        _ScalarResult([
            SimpleNamespace(template_id=template_id, module_slug="core")
        ]),
        _ScalarResult([
            SimpleNamespace(
                id=admin_id,
                full_name="System Admin",
                email="admin@click.test",
                role="super_admin",
                is_active=True,
                last_login_at=datetime(2026, 4, 10, tzinfo=UTC),
                created_by=None,
                created_at=datetime(2026, 1, 1, tzinfo=UTC),
                valid_from=date(2026, 1, 1),
                valid_to=None,
            )
        ]),
        _ScalarResult([
            SimpleNamespace(id=uuid4(), user_id=admin_id, resource="reports", can_view=True, can_edit=True)
        ]),
        _ScalarResult([
            SimpleNamespace(
                id=uuid4(),
                tenant_id=tenant_id,
                actor_id=admin_id,
                actor_type="admin",
                action="update",
                entity_type="tenant",
                entity_id=tenant_id,
                old_values={"status": "trial"},
                new_values={"status": "active"},
                ip_address="127.0.0.1",
                created_at=datetime(2026, 4, 12, tzinfo=UTC),
            )
        ]),
        _ScalarResult([
            SimpleNamespace(
                id=saved_report_id,
                name="Legacy Seats",
                description=None,
                dataset="tenant_snapshot",
                definition_json=ReportDefinition(dataset="tenant_snapshot", columns=["org_number"]).model_dump(mode="json"),
                visibility="shared",
                owner_id=admin_id,
                created_at=datetime(2026, 4, 10, tzinfo=UTC),
                updated_at=datetime(2026, 4, 11, tzinfo=UTC),
            )
        ]),
    ]
    results.extend(_ScalarResult([]) for _ in reporting.AUTO_MODEL_DATASETS)
    return results


@pytest.mark.asyncio
async def test_load_snapshot_rows_exposes_full_core_datasets():
    db = _FakeSession(_base_loader_results())

    rows = await reporting._load_snapshot_rows(db, date(2026, 4, 15))

    tenant_row = rows["tenant_snapshot_full"][0]
    module_row = rows["tenant_module_snapshot_full"][0]
    master_row_types = {row["record_type"] for row in rows["master_dataset"]}

    assert tenant_row["identity_name_he"] == "Acme"
    assert tenant_row["subscription_template_name"] == "Growth"
    assert tenant_row["subscription_seat_count"] == 12
    assert tenant_row["subscription_selected_module_slugs"] == "core"
    assert module_row["override_setup_fee_ils"] == 50.0
    assert module_row["subscription_seat_count"] == 12
    assert module_row["module_color_hex"] == "#112233"
    assert "audit_log" in master_row_types
    assert "saved_report" in master_row_types
    assert rows["admin_permissions"][0]["resource"] == "reports"
    assert rows["template_defaults"][0]["default_value"] == "ILS"
    assert rows["master_dataset"][0]["contact_main_phone"] == "050-1234567"
    assert rows["master_dataset"][0]["address_main_street"] == "Herzl 1"


def test_master_dataset_metadata_contains_contact_and_address_fields():
    dataset = reporting.DATASET_MAP["master_dataset"]
    field_ids = {field.id for field in dataset.fields}

    assert "contact_main_name" in field_ids
    assert "contact_main_phone" in field_ids
    assert "contact_main_email" in field_ids
    assert "address_main_street" in field_ids
    assert "address_main_city" in field_ids


def test_dataset_metadata_exposes_new_system_fields_and_summary_datasets():
    tenant_dataset = reporting.DATASET_MAP["tenant_snapshot_full"]
    tenant_field_ids = {field.id for field in tenant_dataset.fields}
    module_dataset = reporting.DATASET_MAP["tenant_module_snapshot_full"]
    module_field_ids = {field.id for field in module_dataset.fields}

    assert "identity_created_at" in tenant_field_ids
    assert "contact_main_created_at" in tenant_field_ids
    assert "address_main_updated_at" in tenant_field_ids
    assert "status_created_at" in tenant_field_ids
    assert "subscription_updated_at" in tenant_field_ids
    assert "tenant_subscription_id" in module_field_ids
    assert "assignment_created_at" in module_field_ids

    assert "module_summary" in reporting.DATASET_MAP
    assert "seat_distribution" in reporting.DATASET_MAP


def test_auto_model_datasets_include_core_tables_and_fields():
    employee_dataset = reporting.DATASET_MAP["table__employees"]
    employee_field_ids = {field.id for field in employee_dataset.fields}
    org_unit_dataset = reporting.DATASET_MAP["table__org_units"]
    org_unit_field_ids = {field.id for field in org_unit_dataset.fields}

    assert "employee_number" in employee_field_ids
    assert "external_ref" in employee_field_ids
    assert "unit_type" in org_unit_field_ids
    assert "manager_employee_id" in org_unit_field_ids


def test_all_report_fields_include_detailed_help_and_valid_relations():
    for dataset in reporting.DATASETS:
        field_ids = {field.id for field in dataset.fields}
        for field in dataset.fields:
            assert field.help.summary.strip(), f"{dataset.id}.{field.id} missing help summary"
            assert field.help.details.strip(), f"{dataset.id}.{field.id} missing help details"
            assert len(field.help.details.strip()) >= 40, f"{dataset.id}.{field.id} help details too short"
            assert len(field.help.notes) >= 2, f"{dataset.id}.{field.id} missing help notes"
            for related_field in field.help.related_fields:
                assert related_field in field_ids, f"{dataset.id}.{field.id} references unknown related field {related_field}"


@pytest.mark.asyncio
async def test_execute_report_query_filters_new_dataset(monkeypatch):
    async def fake_load(_db, _as_of):
        return {
            "tenant_module_snapshot_full": [
                {"tenant_id": "a", "tenant_name": "Acme", "module_name": "Core", "module_seats": 15, "tenant_status": "active", "pricing_mode": "override", "valid_from": date(2026, 4, 1)},
                {"tenant_id": "b", "tenant_name": "Beta", "module_name": "Core", "module_seats": 5, "tenant_status": "active", "pricing_mode": "catalog", "valid_from": date(2026, 4, 2)},
            ]
        }

    monkeypatch.setattr(reporting, "_load_snapshot_rows", fake_load)

    result = await reporting.execute_report_query(
        None,
        ReportQueryRequest(
            definition=ReportDefinition(
                dataset="tenant_module_snapshot_full",
                columns=["tenant_name", "module_name", "module_seats"],
                filters=[
                    {"field": "pricing_mode", "operator": "equals", "value": "override"},
                    {"field": "module_seats", "operator": "greater_than", "value": 10},
                ],
                limit=25,
            )
        ),
    )

    assert result.total == 1
    assert result.rows[0]["tenant_name"] == "Acme"


@pytest.mark.asyncio
async def test_execute_report_query_supports_auto_model_dataset(monkeypatch):
    async def fake_auto_loader(_db, dataset_id, **_kwargs):
        assert dataset_id == "table__employees"
        return [
            {"id": "1", "employee_number": "E-100", "is_active": True},
            {"id": "2", "employee_number": "E-200", "is_active": False},
        ]

    monkeypatch.setattr(reporting, "_load_auto_dataset_rows", fake_auto_loader)

    result = await reporting.execute_report_query(
        None,
        ReportQueryRequest(
            definition=ReportDefinition(
                dataset="table__employees",
                columns=["employee_number", "is_active"],
                filters=[{"field": "is_active", "operator": "equals", "value": True}],
                limit=25,
            )
        ),
    )

    assert result.total == 1
    assert result.rows[0]["employee_number"] == "E-100"


@pytest.mark.asyncio
async def test_execute_report_query_groups_permissions(monkeypatch):
    async def fake_load(_db, _as_of):
        return {
            "admin_permissions": [
                {"user_name": "A", "resource": "reports", "can_view": True},
                {"user_name": "A", "resource": "reports", "can_view": True},
                {"user_name": "B", "resource": "audit", "can_view": False},
            ]
        }

    monkeypatch.setattr(reporting, "_load_snapshot_rows", fake_load)

    result = await reporting.execute_report_query(
        None,
        ReportQueryRequest(
            definition=ReportDefinition(
                dataset="admin_permissions",
                group_by=["resource"],
                metrics=[{"operation": "count", "label": "Rows"}],
                sort=[{"field": "Rows", "direction": "desc"}],
                view_mode="summary",
                limit=25,
            )
        ),
    )

    assert result.total == 2
    assert result.rows[0]["resource"] == "reports"
    assert result.rows[0]["Rows"] == "2"


@pytest.mark.asyncio
async def test_execute_report_query_detail_mode_dedupes_selected_columns(monkeypatch):
    async def fake_load(_db, _as_of):
        return {
            "master_dataset": [
                {"org_number": 10006, "identity_name_he": "ארגון דוגמא", "record_type": "tenant_snapshot", "record_key": "a"},
                {"org_number": 10006, "identity_name_he": "ארגון דוגמא", "record_type": "contact", "record_key": "b"},
                {"org_number": 10006, "identity_name_he": "ארגון דוגמא", "record_type": "address", "record_key": "c"},
            ]
        }

    monkeypatch.setattr(reporting, "_load_snapshot_rows", fake_load)

    result = await reporting.execute_report_query(
        None,
        ReportQueryRequest(
            definition=ReportDefinition(
                dataset="master_dataset",
                columns=["org_number", "identity_name_he"],
                limit=25,
            )
        ),
    )

    assert result.total == 1
    assert result.rows == [{"org_number": "10006", "identity_name_he": "ארגון דוגמא"}]
    assert result.summary[0].value == "1"


@pytest.mark.asyncio
async def test_run_saved_report_normalizes_legacy_dataset(monkeypatch):
    owner_id = uuid4()
    row = SimpleNamespace(
        id=uuid4(),
        name="Shared",
        description=None,
        dataset="tenant_snapshot",
        visibility="shared",
        owner_id=owner_id,
        definition_json=ReportDefinition(dataset="tenant_snapshot", columns=["org_number"]).model_dump(mode="json"),
        created_at=datetime.now(UTC),
        updated_at=None,
    )
    db = _FakeSession([_ScalarResult(row)])

    async def fake_execute(_db, request):
        assert request.definition.dataset == "tenant_snapshot_full"
        return ReportResult(columns=["org_number"], rows=[{"org_number": "101"}], total=1, summary=[], applied_definition=request.definition)

    monkeypatch.setattr(reporting, "execute_report_query", fake_execute)

    result = await reporting.run_saved_report(db, row.id, _current_user())

    assert result.total == 1


@pytest.mark.asyncio
async def test_list_saved_reports_filters_by_kind():
    report_row = SimpleNamespace(
        id=uuid4(),
        name="Monthly Report",
        description=None,
        kind="report",
        dataset="tenant_snapshot_full",
        visibility="personal",
        owner_id=uuid4(),
        definition_json=ReportDefinition(dataset="tenant_snapshot_full", columns=["org_number"]).model_dump(mode="json"),
        created_at=datetime.now(UTC),
        updated_at=None,
    )
    template_row = SimpleNamespace(
        id=uuid4(),
        name="Base Template",
        description=None,
        kind="template",
        dataset="tenant_snapshot_full",
        visibility="shared",
        owner_id=uuid4(),
        definition_json=ReportDefinition(dataset="tenant_snapshot_full", columns=["identity_name_he"]).model_dump(mode="json"),
        created_at=datetime.now(UTC),
        updated_at=None,
    )
    db = _FakeSession([_TupleResult([(report_row, "Owner A"), (template_row, "Owner B")])])

    items = await reporting.list_saved_reports(db, _current_user(), "template")

    assert len(items) == 1
    assert items[0].kind == "template"
    assert items[0].name == "Base Template"


@pytest.mark.asyncio
async def test_delete_saved_report_requires_owner():
    owner_id = uuid4()
    row = SimpleNamespace(id=uuid4(), owner_id=owner_id)
    db = _FakeSession([_ScalarResult(row)])

    with pytest.raises(PermissionError):
        await reporting.delete_saved_report(db, row.id, _current_user())

    assert db.deleted == []


@pytest.mark.asyncio
async def test_export_report_matches_query_output(monkeypatch):
    async def fake_execute(_db, request):
        return ReportResult(
            columns=["identity_name_he", "subscription_seat_count"],
            rows=[{"identity_name_he": "Acme", "subscription_seat_count": "18"}],
            total=1,
            summary=[{"label": "לקוחות", "value": "1"}],
            applied_definition=request.definition,
        )

    monkeypatch.setattr(reporting, "execute_report_query", fake_execute)

    payload = await reporting.export_report(
        None,
        ReportExportRequest(title="Seat Report", format="csv", definition=ReportDefinition(dataset="tenant_snapshot_full")),
    )

    assert payload.file_name.endswith(".csv")
    assert payload.content_base64
