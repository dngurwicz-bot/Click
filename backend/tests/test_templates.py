from datetime import date
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.middleware.auth import CurrentUser
from app.routers import templates as templates_router
from app.schemas.template import TemplateActionBody, TemplateActionResult, TemplateOut


class _ScalarOneResult:
    def __init__(self, row):
        self._row = row

    def scalar_one_or_none(self):
        return self._row


class _FakeSession:
    def __init__(self, execute_results: list[object] | None = None):
        self.execute_results = list(execute_results or [])
        self.execute_count = 0
        self.committed = False

    async def execute(self, _query):
        self.execute_count += 1
        if self.execute_results:
            return _ScalarOneResult(self.execute_results.pop(0))
        return _ScalarOneResult(None)

    async def commit(self):
        self.committed = True


def _current_user() -> CurrentUser:
    return CurrentUser(
        id=uuid4(),
        email="admin@example.com",
        role="admin",
        permissions={"templates": {"can_view": True, "can_edit": True}},
    )


@pytest.mark.asyncio
async def test_template_record_delete_returns_valid_action_result():
    template_id = uuid4()
    db = _FakeSession([
        SimpleNamespace(id=template_id, name="Growth", valid_from=date(2026, 4, 5)),
    ])

    result = await templates_router.template_record_action(
        template_id,
        TemplateActionBody(action="delete", valid_from=date(2026, 4, 5)),
        db=db,
        current_user=_current_user(),
    )

    assert result == TemplateActionResult(action="delete")
    assert db.committed is True
    assert db.execute_count == 4


def test_template_record_route_accepts_delete_result_response_model():
    route = next(
        route
        for route in templates_router.router.routes
        if getattr(route, "path", "") == "/api/admin/templates/{template_id}/record"
    )

    assert route.response_model == TemplateOut | TemplateActionResult
