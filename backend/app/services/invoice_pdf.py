from __future__ import annotations

import io
import urllib.request
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path

from bidi.algorithm import get_display
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

FONT_NAME = "NotoSansHebrew"
FONT_PATH = Path(__file__).resolve().parent.parent / "assets" / "fonts" / "NotoSansHebrew-Regular.ttf"


class TaxInvoiceValidationError(Exception):
    def __init__(self, missing_fields: list[str]):
        super().__init__("Missing tax invoice fields")
        self.missing_fields = missing_fields


def _ensure_font_registered() -> None:
    if FONT_NAME in pdfmetrics.getRegisteredFontNames():
        return
    pdfmetrics.registerFont(TTFont(FONT_NAME, str(FONT_PATH)))


def _rtl(text: str | None) -> str:
    value = (text or "").strip()
    if not value:
        return ""
    return get_display(value)


def _fmt_money(value: Decimal | str | float | int | None) -> str:
    if value is None:
        return "-"
    numeric = Decimal(str(value))
    return f"₪{numeric:,.2f}"


def _fmt_qty(value: Decimal | str | float | int | None) -> str:
    if value is None:
        return "-"
    numeric = Decimal(str(value))
    return f"{numeric.normalize():f}".rstrip("0").rstrip(".")


def _fmt_date(value) -> str:
    if value is None:
        return "-"
    return value.strftime("%d/%m/%Y")


def _fmt_period(period: str) -> str:
    months = [
        "", "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
        "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
    ]
    year, month = period.split("-")
    return f"{months[int(month)]} {year}"


def _tax_missing_fields(settings_payload: dict[str, str | None]) -> list[str]:
    required = {
        "issuer_name_he": "שם מנפיק",
        "issuer_tax_id": "ח.פ / ע.מ",
        "issuer_address": "כתובת מנפיק",
    }
    missing: list[str] = []
    for key, label in required.items():
        if not (settings_payload.get(key) or "").strip():
            missing.append(label)
    return missing


def _build_logo(logo_url: str | None):
    if not logo_url:
        return None
    try:
        with urllib.request.urlopen(logo_url, timeout=5) as response:
            image_bytes = response.read()
    except Exception:
        return None
    return Image(io.BytesIO(image_bytes), width=26 * mm, height=26 * mm)


@dataclass
class PdfVariantInfo:
    title: str
    subtitle: str


VARIANTS: dict[str, PdfVariantInfo] = {
    "statement": PdfVariantInfo(title="חשבונית", subtitle="מסמך חיוב ממוחשב"),
    "tax": PdfVariantInfo(title="חשבונית מס", subtitle="מסמך חיוב פורמלי"),
}


def render_invoice_pdf(
    *,
    invoice,
    lines,
    tenant_name: str,
    tenant_tax_id: str | None,
    tenant_address: str | None,
    issuer: dict[str, str | None],
    variant: str,
) -> bytes:
    if variant not in VARIANTS:
        raise ValueError(f"Unsupported PDF variant: {variant}")

    missing_tax_fields = _tax_missing_fields(issuer)
    if variant == "tax" and missing_tax_fields:
        raise TaxInvoiceValidationError(missing_tax_fields)

    _ensure_font_registered()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=14 * mm,
        bottomMargin=12 * mm,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        title=f"{VARIANTS[variant].title} {invoice.invoice_number}",
    )

    styles = getSampleStyleSheet()
    normal = ParagraphStyle(
        "InvoiceNormal",
        parent=styles["Normal"],
        fontName=FONT_NAME,
        fontSize=10,
        leading=14,
        alignment=TA_RIGHT,
        textColor=colors.HexColor("#1f2937"),
    )
    small = ParagraphStyle(
        "InvoiceSmall",
        parent=normal,
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#6b7280"),
    )
    title_style = ParagraphStyle(
        "InvoiceTitle",
        parent=normal,
        fontSize=18,
        leading=22,
        alignment=TA_RIGHT,
        textColor=colors.HexColor("#0f4c81"),
    )
    left_style = ParagraphStyle(
        "LeftData",
        parent=normal,
        alignment=TA_LEFT,
    )
    center_style = ParagraphStyle(
        "CenterData",
        parent=normal,
        alignment=TA_CENTER,
    )

    elements = []
    logo = _build_logo(issuer.get("issuer_logo_url"))
    issuer_lines = [
        Paragraph(_rtl(issuer.get("issuer_name_he")), title_style),
        Paragraph(_rtl(issuer.get("issuer_name_en")), small) if issuer.get("issuer_name_en") else None,
        Paragraph(_rtl(f'ח.פ / ע.מ: {issuer.get("issuer_tax_id")}'), small) if issuer.get("issuer_tax_id") else None,
        Paragraph(_rtl(issuer.get("issuer_address")), small) if issuer.get("issuer_address") else None,
        Paragraph(_rtl(f'טלפון: {issuer.get("issuer_phone")}'), small) if issuer.get("issuer_phone") else None,
        Paragraph(_rtl(f'דוא\"ל: {issuer.get("issuer_email")}'), small) if issuer.get("issuer_email") else None,
    ]
    issuer_stack = [line for line in issuer_lines if line is not None]

    header_left = [
        Paragraph(_rtl(VARIANTS[variant].title), title_style),
        Paragraph(_rtl(VARIANTS[variant].subtitle), small),
        Spacer(1, 2 * mm),
        Paragraph(_rtl(f"מספר מסמך: {invoice.invoice_number}"), normal),
        Paragraph(_rtl(f"תאריך הנפקה: {_fmt_date(invoice.issue_date)}"), normal),
        Paragraph(_rtl(f"לתשלום עד: {_fmt_date(invoice.due_date)}"), normal),
        Paragraph(_rtl(f"תקופת חיוב: {_fmt_period(invoice.billing_period)}"), normal),
    ]

    issuer_table = Table(
        [[logo, issuer_stack]] if logo else [[issuer_stack]],
        colWidths=[30 * mm, 120 * mm] if logo else [150 * mm],
    )
    issuer_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    meta_table = Table(
        [[issuer_table, header_left]],
        colWidths=[95 * mm, 75 * mm],
    )
    meta_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("LINEBELOW", (0, 0), (-1, -1), 1, colors.HexColor("#0f4c81")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 6 * mm))

    parties = Table(
        [[
            [x for x in [
                Paragraph(_rtl("לקוח"), normal),
                Paragraph(_rtl(tenant_name), title_style),
                Paragraph(_rtl(f"ח.פ / ע.מ: {tenant_tax_id}"), small) if tenant_tax_id else None,
                Paragraph(_rtl(tenant_address), small) if tenant_address else None,
            ] if x is not None],
            [x for x in [
                Paragraph(_rtl("מנפיק"), normal),
                Paragraph(_rtl(issuer.get("issuer_name_he")), title_style),
                Paragraph(_rtl(f"ח.פ / ע.מ: {issuer.get('issuer_tax_id')}"), small) if issuer.get("issuer_tax_id") else None,
                Paragraph(_rtl(issuer.get("issuer_address")), small) if issuer.get("issuer_address") else None,
            ] if x is not None],
        ]],
        colWidths=[85 * mm, 85 * mm],
    )
    parties.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (-1, -1), colors.whitesmoke),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#d1d5db")),
        ("INNERGRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#e5e7eb")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(parties)
    elements.append(Spacer(1, 6 * mm))

    table_data = [[
        Paragraph("#", center_style),
        Paragraph(_rtl("תיאור"), normal),
        Paragraph(_rtl("כמות"), center_style),
        Paragraph(_rtl("מחיר יחידה"), left_style),
        Paragraph(_rtl("סכום"), left_style),
    ]]
    for index, line in enumerate(lines, start=1):
        table_data.append([
            Paragraph(str(index), center_style),
            Paragraph(_rtl(line.description), normal),
            Paragraph(_fmt_qty(line.quantity), center_style),
            Paragraph(_fmt_money(line.unit_price_ils), left_style),
            Paragraph(_fmt_money(line.amount_ils), left_style),
        ])

    lines_table = Table(
        table_data,
        colWidths=[10 * mm, 92 * mm, 20 * mm, 28 * mm, 28 * mm],
        repeatRows=1,
    )
    lines_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f4c81")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), FONT_NAME),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("LEADING", (0, 0), (-1, -1), 12),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#d1d5db")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e5e7eb")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ALIGN", (2, 0), (2, -1), "CENTER"),
        ("ALIGN", (3, 0), (4, -1), "LEFT"),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(lines_table)
    elements.append(Spacer(1, 6 * mm))

    totals = Table(
        [
            [Paragraph(_rtl("לפני מע\"מ"), normal), Paragraph(_fmt_money(invoice.subtotal_ils), left_style)],
            [Paragraph(_rtl(f"מע\"מ ({invoice.vat_pct}%)"), normal), Paragraph(_fmt_money(invoice.vat_ils), left_style)],
            [Paragraph(_rtl("סה\"כ לתשלום"), normal), Paragraph(_fmt_money(invoice.total_ils), left_style)],
        ],
        colWidths=[42 * mm, 42 * mm],
        hAlign="RIGHT",
    )
    totals.setStyle(TableStyle([
        ("BACKGROUND", (0, 2), (-1, 2), colors.HexColor("#eff6ff")),
        ("TEXTCOLOR", (0, 2), (-1, 2), colors.HexColor("#0f4c81")),
        ("FONTNAME", (0, 0), (-1, -1), FONT_NAME),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#d1d5db")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e5e7eb")),
        ("ALIGN", (1, 0), (1, -1), "LEFT"),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(totals)
    elements.append(Spacer(1, 5 * mm))

    if issuer.get("payment_instructions"):
        payment_box = Table(
            [[Paragraph(_rtl("הוראות תשלום"), normal)], [Paragraph(_rtl(issuer.get("payment_instructions")), normal)]],
            colWidths=[170 * mm],
        )
        payment_box.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f0fdf4")),
            ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#bbf7d0")),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(payment_box)
        elements.append(Spacer(1, 4 * mm))

    notes_text = invoice.notes or issuer.get("footer_text") or "מסמך זה הופק אוטומטית על-ידי המערכת."
    footer = Paragraph(_rtl(notes_text), small)
    elements.append(footer)

    doc.build(elements)
    return buffer.getvalue()


def render_quote_pdf(
    *,
    quote,
    lines,
    recipient_name: str,
    recipient_email: str | None,
    issuer: dict[str, str | None],
) -> bytes:
    """Render a Quote as PDF (Hebrew RTL, similar layout to invoice_pdf)."""
    _ensure_font_registered()
    buffer = io.BytesIO()

    status_label = {
        "draft": "טיוטה",
        "sent": "נשלח",
        "accepted": "אושר",
        "declined": "נדחה",
        "expired": "פג תוקף",
    }.get(getattr(quote, "status", "draft"), "")

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=14 * mm,
        bottomMargin=12 * mm,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        title=f"הצעת מחיר {quote.quote_number or ''}",
    )

    styles = getSampleStyleSheet()
    normal = ParagraphStyle(
        "QuoteNormal",
        parent=styles["Normal"],
        fontName=FONT_NAME,
        fontSize=10,
        leading=14,
        alignment=TA_RIGHT,
        textColor=colors.HexColor("#1f2937"),
    )
    small = ParagraphStyle(
        "QuoteSmall",
        parent=normal,
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#6b7280"),
    )
    title_style = ParagraphStyle(
        "QuoteTitle",
        parent=normal,
        fontSize=18,
        leading=22,
        alignment=TA_RIGHT,
        textColor=colors.HexColor("#065f46"),
    )
    left_style = ParagraphStyle("QuoteLeft", parent=normal, alignment=TA_LEFT)
    center_style = ParagraphStyle("QuoteCenter", parent=normal, alignment=TA_CENTER)

    elements = []
    logo = _build_logo(issuer.get("issuer_logo_url"))
    issuer_stack = [x for x in [
        Paragraph(_rtl(issuer.get("issuer_name_he")), title_style),
        Paragraph(_rtl(issuer.get("issuer_name_en")), small) if issuer.get("issuer_name_en") else None,
        Paragraph(_rtl(f'ח.פ / ע.מ: {issuer.get("issuer_tax_id")}'), small) if issuer.get("issuer_tax_id") else None,
        Paragraph(_rtl(issuer.get("issuer_address")), small) if issuer.get("issuer_address") else None,
        Paragraph(_rtl(f'טלפון: {issuer.get("issuer_phone")}'), small) if issuer.get("issuer_phone") else None,
        Paragraph(_rtl(f'דוא"ל: {issuer.get("issuer_email")}'), small) if issuer.get("issuer_email") else None,
    ] if x is not None]

    header_left = [
        Paragraph(_rtl("הצעת מחיר"), title_style),
        Paragraph(_rtl("מסמך הצעת מחיר"), small),
        Spacer(1, 2 * mm),
    ]
    if quote.quote_number:
        header_left.append(Paragraph(_rtl(f"מספר הצעה: {quote.quote_number}"), normal))
    header_left += [
        Paragraph(_rtl(f"סטטוס: {status_label}"), normal),
        Paragraph(_rtl(f"תוקף עד: {_fmt_date(quote.valid_until)}"), normal),
    ]

    issuer_table = Table(
        [[logo, issuer_stack]] if logo else [[issuer_stack]],
        colWidths=[30 * mm, 120 * mm] if logo else [150 * mm],
    )
    issuer_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    meta_table = Table(
        [[issuer_table, header_left]],
        colWidths=[95 * mm, 75 * mm],
    )
    meta_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("LINEBELOW", (0, 0), (-1, -1), 1, colors.HexColor("#065f46")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 6 * mm))

    recipient_lines = [x for x in [
        Paragraph(_rtl("מוצע ל"), normal),
        Paragraph(_rtl(recipient_name), title_style),
        Paragraph(_rtl(f'דוא"ל: {recipient_email}'), small) if recipient_email else None,
    ] if x is not None]

    issuer_party_lines = [x for x in [
        Paragraph(_rtl("מנפיק"), normal),
        Paragraph(_rtl(issuer.get("issuer_name_he")), title_style),
        Paragraph(_rtl(f'ח.פ / ע.מ: {issuer.get("issuer_tax_id")}'), small) if issuer.get("issuer_tax_id") else None,
    ] if x is not None]

    parties = Table(
        [[recipient_lines, issuer_party_lines]],
        colWidths=[85 * mm, 85 * mm],
    )
    parties.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (-1, -1), colors.whitesmoke),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#d1d5db")),
        ("INNERGRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#e5e7eb")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(parties)
    elements.append(Spacer(1, 6 * mm))

    table_data = [[
        Paragraph("#", center_style),
        Paragraph(_rtl("תיאור"), normal),
        Paragraph(_rtl("כמות"), center_style),
        Paragraph(_rtl("מחיר יחידה"), left_style),
        Paragraph(_rtl("סכום"), left_style),
    ]]
    for index, line in enumerate(lines, start=1):
        table_data.append([
            Paragraph(str(index), center_style),
            Paragraph(_rtl(line.description), normal),
            Paragraph(_fmt_qty(line.quantity), center_style),
            Paragraph(_fmt_money(line.unit_price_ils), left_style),
            Paragraph(_fmt_money(line.amount_after_discount_ils), left_style),
        ])

    lines_table = Table(
        table_data,
        colWidths=[10 * mm, 92 * mm, 20 * mm, 28 * mm, 28 * mm],
        repeatRows=1,
    )
    lines_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#065f46")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), FONT_NAME),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("LEADING", (0, 0), (-1, -1), 12),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#d1d5db")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e5e7eb")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0fdf4")]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ALIGN", (2, 0), (2, -1), "CENTER"),
        ("ALIGN", (3, 0), (4, -1), "LEFT"),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(lines_table)
    elements.append(Spacer(1, 6 * mm))

    totals = Table(
        [
            [Paragraph(_rtl('לפני מע"מ'), normal), Paragraph(_fmt_money(quote.subtotal_ils), left_style)],
            [Paragraph(_rtl(f'מע"מ ({quote.vat_pct}%)'), normal), Paragraph(_fmt_money(quote.vat_ils), left_style)],
            [Paragraph(_rtl('סה"כ להצעה'), normal), Paragraph(_fmt_money(quote.total_ils), left_style)],
        ],
        colWidths=[42 * mm, 42 * mm],
        hAlign="RIGHT",
    )
    totals.setStyle(TableStyle([
        ("BACKGROUND", (0, 2), (-1, 2), colors.HexColor("#ecfdf5")),
        ("TEXTCOLOR", (0, 2), (-1, 2), colors.HexColor("#065f46")),
        ("FONTNAME", (0, 0), (-1, -1), FONT_NAME),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#d1d5db")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e5e7eb")),
        ("ALIGN", (1, 0), (1, -1), "LEFT"),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(totals)
    elements.append(Spacer(1, 5 * mm))

    # Validity & notes box
    validity_text = f'הצעה זו תקפה עד {_fmt_date(quote.valid_until)}.'
    if quote.notes:
        validity_text += f" {quote.notes}"
    validity_box = Table(
        [[Paragraph(_rtl("הערות והתנאים"), normal)], [Paragraph(_rtl(validity_text), normal)]],
        colWidths=[170 * mm],
    )
    validity_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#ecfdf5")),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#6ee7b7")),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(validity_box)
    elements.append(Spacer(1, 4 * mm))

    footer_text = issuer.get("footer_text") or "מסמך זה הופק אוטומטית על-ידי המערכת."
    elements.append(Paragraph(_rtl(footer_text), small))

    doc.build(elements)
    return buffer.getvalue()
