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


def _current_user(user_id=None, permissions=None) -> CurrentUser:
    return CurrentUser(
        id=user_id or uuid4(),
        email="reports@example.com",
        role="admin",
        permissions=permissions or {"reports": {"can_view": True, "can_edit": True}},
    )


@pytest.mark.asyncio
async def test_load_snapshot_rows_respects_as_of_and_includes_active_modules():
    tenant_id = uuid4()
    subscription_id = uuid4()
    db = _FakeSession(
        [
            _ScalarResult([SimpleNamespace(tenant_id=tenant_id, org_number=101)]),
            _ScalarResult([SimpleNamespace(tenant_id=tenant_id, name_he="Acme", tax_id="123", valid_from=date(2026, 1, 1), valid_to=None)]),
            _ScalarResult([SimpleNamespace(tenant_id=tenant_id, status="active", valid_from=date(2026, 1, 1), valid_to=None)]),
            _ScalarResult([SimpleNamespace(id=subscription_id, tenant_id=tenant_id, seat_count=18, billing_cycle="monthly", next_renewal_at=date(2026, 7, 1), valid_from=date(2026, 1, 1), valid_to=None)]),
            _ScalarResult([SimpleNamespace(slug="core", name="Core"), SimpleNamespace(slug="vision", name="Vision")]),
            _ScalarResult([
                SimpleNamespace(module_slug="core", base_price_ils=0, per_seat_ils=10, valid_from=date(2026, 1, 1), valid_to=None),
                SimpleNamespace(module_slug="vision", base_price_ils=0, per_seat_ils=20, valid_from=date(2026, 1, 1), valid_to=None),
            ]),
            _ScalarResult([
                SimpleNamespace(tenant_subscription_id=subscription_id, module_slug="core", status="active", seats=12, valid_from=date(2026, 2, 1), valid_to=None, source_type="manual", pricing_mode="catalog"),
                SimpleNamespace(tenant_subscription_id=subscription_id, module_slug="vision", status="active", seats=6, valid_from=date(2026, 5, 1), valid_to=None, source_type="manual", pricing_mode="catalog"),
            ]),
        ]
    )

    rows = await reporting._load_snapshot_rows(db, date(2026, 4, 15))

    assert rows["tenant_snapshot"][0]["tenant_name"] == "Acme"
    assert rows["tenant_snapshot"][0]["module_count"] == 1
    assert rows["tenant_module_snapshot"][0]["module_slug"] == "core"
    assert rows["tenant_module_snapshot"][0]["module_seats"] == 12


@pytest.mark.asyncio
async def test_execute_report_query_filters_module_and_seat_threshold(monkeypatch):
    async def fake_load(_db, _as_of):
        return {
            "tenant_snapshot": [],
            "tenant_module_snapshot": [
                {"tenant_id": "a", "tenant_name": "Acme", "module_slug": "core", "module_name": "Core", "module_seats": 15, "tenant_status": "active", "valid_from": date(2026, 4, 1)},
                {"tenant_id": "b", "tenant_name": "Beta", "module_slug": "core", "module_name": "Core", "module_seats": 5, "tenant_status": "active", "valid_from": date(2026, 4, 2)},
                {"tenant_id": "c", "tenant_name": "Gamma", "module_slug": "vision", "module_name": "Vision", "module_seats": 22, "tenant_status": "active", "valid_from": date(2026, 4, 3)},
            ],
            "module_summary": [],
            "seat_distribution": [],
        }

    monkeypatch.setattr(reporting, "_load_snapshot_rows", fake_load)

    result = await reporting.execute_report_query(
        None,
        ReportQueryRequest(
            definition=ReportDefinition(
                dataset="tenant_module_snapshot",
                columns=["tenant_name", "module_slug", "module_seats"],
                filters=[
                    {"field": "module_slug", "operator": "equals", "value": "core"},
                    {"field": "module_seats", "operator": "greater_than", "value": 10},
                ],
                limit=25,
            )
        ),
    )

    assert result.total == 1
    assert result.rows[0]["tenant_name"] == "Acme"


@pytest.mark.asyncio
async def test_execute_report_query_groups_by_module_with_metrics(monkeypatch):
    async def fake_load(_db, _as_of):
        return {
            "tenant_snapshot": [],
            "tenant_module_snapshot": [
                {"tenant_id": "a", "module_name": "Core", "module_slug": "core", "module_seats": 12},
                {"tenant_id": "b", "module_name": "Core", "module_slug": "core", "module_seats": 8},
                {"tenant_id": "b", "module_name": "Vision", "module_slug": "vision", "module_seats": 5},
            ],
            "module_summary": [],
            "seat_distribution": [],
        }

    monkeypatch.setattr(reporting, "_load_snapshot_rows", fake_load)

    result = await reporting.execute_report_query(
        None,
        ReportQueryRequest(
            definition=ReportDefinition(
                dataset="tenant_module_snapshot",
                group_by=["module_name"],
                metrics=[
                    {"operation": "count_distinct", "field": "tenant_id", "label": "Customers"},
                    {"operation": "sum", "field": "module_seats", "label": "Seats"},
                ],
                sort=[{"field": "Seats", "direction": "desc"}],
                view_mode="summary",
                limit=25,
            )
        ),
    )

    assert result.total == 2
    assert result.rows[0]["module_name"] == "Core"
    assert result.rows[0]["Customers"] == "2"
    assert result.rows[0]["Seats"] == "20.00"


@pytest.mark.asyncio
async def test_run_saved_report_blocks_personal_report_from_other_user():
    owner_id = uuid4()
    other_user = _current_user()
    row = SimpleNamespace(
        id=uuid4(),
        name="Private",
        description=None,
        dataset="tenant_snapshot",
        visibility="personal",
        owner_id=owner_id,
        definition_json=ReportDefinition(dataset="tenant_snapshot").model_dump(mode="json"),
        created_at=datetime.now(UTC),
        updated_at=None,
    )
    db = _FakeSession([_ScalarResult(row)])

    with pytest.raises(PermissionError):
        await reporting.run_saved_report(db, row.id, other_user)


@pytest.mark.asyncio
async def test_run_saved_report_allows_shared_report(monkeypatch):
    owner_id = uuid4()
    row = SimpleNamespace(
        id=uuid4(),
        name="Shared",
        description=None,
        dataset="tenant_snapshot",
        visibility="shared",
        owner_id=owner_id,
        definition_json=ReportDefinition(dataset="tenant_snapshot").model_dump(mode="json"),
        created_at=datetime.now(UTC),
        updated_at=None,
    )
    db = _FakeSession([_ScalarResult(row)])

    async def fake_execute(_db, request):
        return ReportResult(columns=["tenant_name"], rows=[{"tenant_name": "Acme"}], total=1, summary=[], applied_definition=request.definition)

    monkeypatch.setattr(reporting, "execute_report_query", fake_execute)

    result = await reporting.run_saved_report(db, row.id, _current_user())

    assert result.total == 1
    assert result.rows[0]["tenant_name"] == "Acme"


@pytest.mark.asyncio
async def test_export_report_matches_query_output(monkeypatch):
    async def fake_execute(_db, request):
        return ReportResult(
            columns=["tenant_name", "seat_count"],
            rows=[{"tenant_name": "Acme", "seat_count": "18"}],
            total=1,
            summary=[{"label": "לקוחות", "value": "1"}],
            applied_definition=request.definition,
        )

    monkeypatch.setattr(reporting, "execute_report_query", fake_execute)

    payload = await reporting.export_report(
        None,
        ReportExportRequest(title="Seat Report", format="csv", definition=ReportDefinition(dataset="tenant_snapshot")),
    )

    assert payload.file_name.endswith(".csv")
    assert payload.content_base64
