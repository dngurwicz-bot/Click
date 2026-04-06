from datetime import date, datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.middleware.auth import CurrentUser
from app.routers import billing as billing_router
from app.schemas.billing import BillingSettingsUpdate
from app.services.invoice_pdf import TaxInvoiceValidationError, render_invoice_pdf


class _ScalarOneResult:
    def __init__(self, row):
        self._row = row

    def scalar_one_or_none(self):
        return self._row


class _FakeSession:
    def __init__(self, initial_row=None):
        self.row = initial_row
        self.added = []

    async def execute(self, _query):
        return _ScalarOneResult(self.row)

    def add(self, row):
        self.row = row
        self.added.append(row)

    async def commit(self):
        return None


def _current_user() -> CurrentUser:
    return CurrentUser(
        id=uuid4(),
        email="billing@example.com",
        role="admin",
        permissions={"billing": {"can_view": True, "can_edit": True}},
    )


@pytest.mark.asyncio
async def test_get_billing_settings_falls_back_to_env(monkeypatch):
    db = _FakeSession(initial_row=None)
    monkeypatch.setattr(
        billing_router,
        "get_settings",
        lambda: SimpleNamespace(
            COMPANY_NAME_HE="CLICK",
            COMPANY_NAME_EN="CLICK Ltd.",
            COMPANY_TAX_ID="",
            COMPANY_ADDRESS="",
            COMPANY_PHONE="03-5555555",
            COMPANY_EMAIL="billing@click.test",
        ),
    )

    result = await billing_router.get_billing_settings(db=db, _=_current_user())

    assert result.source == "env"
    assert result.issuer_name_he == "CLICK"
    assert result.can_render_tax_invoice is False
    assert "ח.פ / ע.מ" in result.missing_tax_fields


@pytest.mark.asyncio
async def test_update_billing_settings_creates_singleton_row(monkeypatch):
    db = _FakeSession(initial_row=None)
    monkeypatch.setattr(
        billing_router,
        "get_settings",
        lambda: SimpleNamespace(
            COMPANY_NAME_HE="ENV NAME",
            COMPANY_NAME_EN="",
            COMPANY_TAX_ID="",
            COMPANY_ADDRESS="",
            COMPANY_PHONE="",
            COMPANY_EMAIL="",
        ),
    )

    result = await billing_router.update_billing_settings(
        BillingSettingsUpdate(
            issuer_name_he="חברת בדיקה",
            issuer_name_en="Test Co.",
            issuer_tax_id="512345678",
            issuer_address="תל אביב 1",
            issuer_phone="03-1234567",
            issuer_email="finance@test.co",
            issuer_logo_url=None,
            payment_instructions="העברה בנקאית",
            footer_text="תודה רבה",
        ),
        db=db,
        current_user=_current_user(),
    )

    assert len(db.added) == 1
    assert result.source == "database"
    assert result.can_render_tax_invoice is True
    assert result.issuer_tax_id == "512345678"


def test_render_invoice_pdf_blocks_tax_variant_when_required_fields_missing():
    invoice = SimpleNamespace(
        invoice_number="INV-2026-0001",
        issue_date=date(2026, 4, 6),
        due_date=date(2026, 5, 6),
        billing_period="2026-04",
        subtotal_ils="100.00",
        vat_pct="17.00",
        vat_ils="17.00",
        total_ils="117.00",
        notes=None,
    )

    with pytest.raises(TaxInvoiceValidationError) as exc_info:
        render_invoice_pdf(
            invoice=invoice,
            lines=[],
            tenant_name="ארגון בדיקה",
            tenant_tax_id=None,
            tenant_address=None,
            issuer={
                "issuer_name_he": "CLICK",
                "issuer_tax_id": None,
                "issuer_address": None,
            },
            variant="tax",
        )

    assert "ח.פ / ע.מ" in exc_info.value.missing_fields


def test_render_invoice_pdf_returns_pdf_bytes_for_statement_variant():
    invoice = SimpleNamespace(
        invoice_number="INV-2026-0002",
        issue_date=date(2026, 4, 6),
        due_date=date(2026, 5, 6),
        billing_period="2026-04",
        subtotal_ils="100.00",
        vat_pct="17.00",
        vat_ils="17.00",
        total_ils="117.00",
        notes="מסמך בדיקה",
    )
    line = SimpleNamespace(
        description="מנוי חודשי",
        quantity="1",
        unit_price_ils="100.00",
        amount_ils="100.00",
    )

    pdf_bytes = render_invoice_pdf(
        invoice=invoice,
        lines=[line],
        tenant_name="ארגון בדיקה",
        tenant_tax_id="512345678",
        tenant_address="תל אביב",
        issuer={
            "issuer_name_he": "CLICK",
            "issuer_name_en": "CLICK Ltd.",
            "issuer_tax_id": "512345678",
            "issuer_address": "רחוב 1 תל אביב",
            "issuer_phone": "03-1234567",
            "issuer_email": "billing@click.test",
            "issuer_logo_url": None,
            "payment_instructions": "העברה בנקאית",
            "footer_text": "תודה",
        },
        variant="statement",
    )

    assert pdf_bytes.startswith(b"%PDF")
