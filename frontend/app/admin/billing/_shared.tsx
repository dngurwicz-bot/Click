"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { HebrewMonthPicker } from "@/components/ui/HebrewMonthPicker";
import { HebrewDatePicker } from "@/components/ui/HebrewDatePicker";
import {
  Plus, Zap, FileText, FileDown, X, AlertCircle,
  CheckCircle2, Ban, Send, Wallet, Quote, Trash2, TrendingUp,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface BillingChargeOut {
  id: string;
  tenant_id: string;
  tenant_name?: string;
  billing_period: string;
  charge_type: string;
  module_slug?: string;
  module_name?: string;
  description: string;
  quantity: string;
  unit_price_ils: string;
  amount_ils: string;
  discount_pct: string;
  amount_after_discount_ils: string;
  status: string;
  invoice_id?: string;
  notes?: string;
  created_at: string;
}

export interface InvoiceListItem {
  id: string;
  invoice_number: string;
  tenant_id: string;
  tenant_name?: string;
  billing_period: string;
  issue_date: string;
  due_date: string;
  subtotal_ils: string;
  discount_ils: string;
  vat_ils: string;
  total_ils: string;
  status: string;
  payment_date?: string;
}

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  charge_id?: string;
  description: string;
  quantity: string;
  unit_price_ils: string;
  amount_ils: string;
  sort_order: number;
}

export interface InvoiceOut extends InvoiceListItem {
  vat_pct: string;
  notes?: string;
  payment_ref?: string;
  lines: InvoiceLine[];
}

export interface TenantListItem {
  tenant_id: string;
  name_he: string;
  org_number: number;
}

export interface QuoteLineOut {
  id: string;
  quote_id: string;
  description: string;
  quantity: string;
  unit_price_ils: string;
  amount_ils: string;
  discount_pct: string;
  amount_after_discount_ils: string;
  module_slug?: string;
  charge_type: string;
  notes?: string;
  sort_order: number;
}

export interface QuoteListItem {
  id: string;
  quote_number?: string;
  tenant_id?: string;
  tenant_name?: string;
  prospect_name?: string;
  prospect_email?: string;
  title: string;
  valid_until: string;
  status: string;
  total_ils: string;
  discount_ils?: string;
  converted_invoice_id?: string;
  created_at: string;
  updated_at: string;
}

export interface QuoteOut extends QuoteListItem {
  discount_pct: string;
  vat_pct: string;
  subtotal_ils: string;
  vat_ils: string;
  notes?: string;
  lines: QuoteLineOut[];
}

export interface ModuleMinimal {
  slug: string;
  name: string;
  current_price?: {
    base_price_ils: string;
    per_seat_ils: string;
    included_seats: number;
    setup_fee_ils: string;
    overage_per_seat_ils?: string;
    pricing_policy_note?: string;
    pricing_summary_text?: string;
  };
}

export interface BillingSettingsOut {
  id?: string | null;
  issuer_name_he: string;
  issuer_name_en?: string | null;
  issuer_tax_id?: string | null;
  issuer_address?: string | null;
  issuer_phone?: string | null;
  issuer_email?: string | null;
  issuer_logo_url?: string | null;
  payment_instructions?: string | null;
  footer_text?: string | null;
  invoice_primary_color: string;
  invoice_layout: string;
  missing_tax_fields: string[];
  can_render_tax_invoice: boolean;
  source: string;
  updated_at?: string | null;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

export const CHARGE_TYPE_LABELS: Record<string, string> = {
  base_fee: "דמי מנוי", per_seat: "מושבים נוספים",
  setup_fee: "דמי הקמה", addon: "תוספת",
  credit: "זיכוי", manual: "ידני",
};

export const CHARGE_STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  pending:   { label: "ממתין",  cls: "bg-amber-50 text-amber-700",   dot: "bg-amber-400" },
  invoiced:  { label: "חויב",   cls: "bg-blue-50 text-blue-700",     dot: "bg-blue-500" },
  cancelled: { label: "מבוטל",  cls: "bg-slate-100 text-slate-500",  dot: "bg-slate-400" },
};

export const INVOICE_STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  draft:     { label: "טיוטה",  cls: "bg-slate-100 text-slate-600",  dot: "bg-slate-400" },
  sent:      { label: "נשלח",   cls: "bg-blue-50 text-blue-700",     dot: "bg-blue-500" },
  paid:      { label: "שולם",   cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  overdue:   { label: "בפיגור", cls: "bg-red-50 text-red-700",       dot: "bg-red-500" },
  cancelled: { label: "מבוטל",  cls: "bg-slate-100 text-slate-500",  dot: "bg-slate-400" },
};

export const QUOTE_STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  draft:    { label: "טיוטה",   cls: "bg-slate-100 text-slate-600",    dot: "bg-slate-400" },
  sent:     { label: "נשלח",    cls: "bg-blue-50 text-blue-700",       dot: "bg-blue-500" },
  accepted: { label: "אושר",    cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  declined: { label: "נדחה",    cls: "bg-red-50 text-red-700",         dot: "bg-red-500" },
  expired:  { label: "פג תוקף", cls: "bg-slate-100 text-slate-500",    dot: "bg-slate-300" },
};

const ILS_MONTHS = [
  "", "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const fmt = (v: string | number) =>
  `₪${parseFloat(String(v)).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("he-IL") : "—";

export function periodLabel(p: string) {
  const [y, m] = p.split("-");
  return `${ILS_MONTHS[parseInt(m)]} ${y}`;
}

export function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function StatusBadge({ cfg }: { cfg: { label: string; cls: string; dot: string } }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export async function openInvoicePdf(invoiceId: string, variant: "statement" | "tax") {
  const tab = window.open("", "_blank");
  if (!tab) return;
  const match = document.cookie.match(/(?:^|; )click_token=([^;]*)/);
  const token = match ? decodeURIComponent(match[1]) : "";
  const url = `/api/admin/billing/invoices/${invoiceId}/pdf${variant === "tax" ? "?variant=tax" : ""}`;
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) { tab.close(); return; }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  tab.document.write(
    `<!DOCTYPE html><html><head><title>PDF</title></head>` +
    `<body style="margin:0;height:100vh">` +
    `<embed src="${objectUrl}" type="application/pdf" width="100%" height="100%"/>` +
    `</body></html>`
  );
  tab.document.close();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
}

export async function openQuotePdf(quoteId: string) {
  const tab = window.open("", "_blank");
  if (!tab) return;
  const match = document.cookie.match(/(?:^|; )click_token=([^;]*)/);
  const token = match ? decodeURIComponent(match[1]) : "";
  const url = `/api/admin/billing/quotes/${quoteId}/pdf`;
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) { tab.close(); return; }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  tab.document.write(
    `<!DOCTYPE html><html><head><title>הצעת מחיר</title></head>` +
    `<body style="margin:0;height:100vh">` +
    `<embed src="${objectUrl}" type="application/pdf" width="100%" height="100%"/>` +
    `</body></html>`
  );
  tab.document.close();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
}

// ─── Generate Charges Modal ───────────────────────────────────────────────────

export function GenerateChargesModal({
  onClose, onDone,
}: { onClose: () => void; onDone: (result: { created: number; skipped: number; tenants_processed: number }) => void }) {
  const [period, setPeriod] = useState(currentPeriod());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!period) { setError("יש לבחור תקופה"); return; }
    setLoading(true); setError(null);
    try {
      const result = await api.post<{ created: number; skipped: number; tenants_processed: number }>(
        "/api/admin/billing/charges/generate",
        { billing_period: period }
      );
      onDone(result);
    } catch (e: unknown) {
      const err = e as { error?: string };
      setError(err?.error ?? "שגיאה ביצירת חיובים");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4" dir="rtl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-[#dce4f0] rounded-t-lg">
          <h2 className="text-sm font-bold text-[#1a3a6e] flex items-center gap-2">
            <Zap size={14} /> יצירת חיובים אוטומטית
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/60 text-slate-500"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-slate-500">
            המערכת תייצר חיובי דמי מנוי עבור כל הארגונים הפעילים/ניסיון לתקופה הנבחרת,
            בהתאם לחבילה ולמחירון הנוכחי. הפעולה בטוחה — חיובים קיימים לא יכפלו.
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">תקופת חיוב</label>
            <HebrewMonthPicker
              value={period}
              onChange={setPeriod}
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white
                         focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 text-right"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700">
              <AlertCircle size={13} /> {error}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 px-5 pb-4 flex-row-reverse">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-brand-600 hover:bg-brand-700
                       text-white rounded-md transition-colors disabled:opacity-50 font-semibold"
          >
            <Zap size={12} /> {loading ? "מייצר..." : "ייצר חיובים"}
          </button>
          <button onClick={onClose}
            className="px-4 py-1.5 text-xs border border-slate-300 bg-white text-slate-600 rounded-md hover:bg-slate-50">
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── New Invoice Modal ────────────────────────────────────────────────────────

export function NewInvoiceModal({
  tenants, onClose, onSaved,
}: { tenants: TenantListItem[]; onClose: () => void; onSaved: () => void }) {
  const [tenantId, setTenantId] = useState("");
  const [period, setPeriod]     = useState(currentPeriod());
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate]   = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10);
  });
  const [vatPct, setVatPct]     = useState("17.00");
  const [notes, setNotes]       = useState("");
  const [charges, setCharges]   = useState<BillingChargeOut[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingCharges, setLoadingCharges] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !period) { setCharges([]); setSelected(new Set()); return; }
    setLoadingCharges(true);
    api.get<BillingChargeOut[]>(
      `/api/admin/billing/charges?tenant_id=${tenantId}&billing_period=${period}&status=pending`
    )
      .then((data) => {
        setCharges(data);
        setSelected(new Set(data.map((c) => c.id)));
      })
      .catch(console.error)
      .finally(() => setLoadingCharges(false));
  }, [tenantId, period]);

  const selectedCharges = charges.filter((c) => selected.has(c.id));
  const subtotal = selectedCharges.reduce((s, c) => s + parseFloat(c.amount_after_discount_ils), 0);
  const vat      = subtotal * parseFloat(vatPct || "0") / 100;
  const total    = subtotal + vat;

  async function handleCreate() {
    if (!tenantId) { setError("יש לבחור ארגון"); return; }
    if (selected.size === 0) { setError("יש לבחור לפחות חיוב אחד"); return; }
    setSaving(true); setError(null);
    try {
      await api.post("/api/admin/billing/invoices", {
        tenant_id: tenantId,
        billing_period: period,
        issue_date: issueDate,
        due_date: dueDate,
        vat_pct: vatPct,
        notes: notes || null,
        charge_ids: Array.from(selected),
      });
      onSaved();
    } catch (e: unknown) {
      const err = e as { error?: string; detail?: { error?: string } };
      setError(err?.error ?? err?.detail?.error ?? "שגיאה ביצירת חשבונית");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col" dir="rtl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-[#dce4f0] rounded-t-lg shrink-0">
          <h2 className="text-sm font-bold text-[#1a3a6e] flex items-center gap-2">
            <FileText size={14} /> חשבונית חדשה
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/60 text-slate-500"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 overflow-auto space-y-4 flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">ארגון <span className="text-red-400">*</span></label>
              <select value={tenantId} onChange={(e) => setTenantId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md
                           focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 bg-white text-right">
                <option value="">בחר ארגון...</option>
                {tenants.map((t) => (
                  <option key={t.tenant_id} value={t.tenant_id}>{t.name_he}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">תקופת חיוב</label>
              <HebrewMonthPicker value={period} onChange={setPeriod}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md
                           focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 text-right bg-white" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">תאריך הנפקה</label>
              <HebrewDatePicker value={issueDate} onChange={setIssueDate}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md
                           focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 text-right bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">לתשלום עד</label>
              <HebrewDatePicker value={dueDate} onChange={setDueDate}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md
                           focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 text-right bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">מע&quot;מ %</label>
              <input type="number" value={vatPct} onChange={(e) => setVatPct(e.target.value)}
                step="0.01" min="0" max="100"
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md
                           focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 text-right" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">
              חיובים ממתינים לתקופה {period ? `(${periodLabel(period)})` : ""}
            </label>
            {loadingCharges ? (
              <div className="flex items-center justify-center h-16">
                <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : charges.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-6 border border-dashed border-slate-200 rounded-md">
                {tenantId ? "אין חיובים ממתינים לתקופה זו" : "בחר ארגון ותקופה לטעינת חיובים"}
              </div>
            ) : (
              <div className="border border-slate-200 rounded-md overflow-hidden">
                <table className="admin-data-table w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="w-8 px-3 py-2 bg-slate-100 border-b border-slate-200 text-center">
                        <input type="checkbox"
                          checked={selected.size === charges.length}
                          onChange={(e) => setSelected(e.target.checked ? new Set(charges.map((c) => c.id)) : new Set())}
                          className="accent-brand-600" />
                      </th>
                      <th className="text-right px-3 py-2 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200">תיאור</th>
                      <th className="text-right px-3 py-2 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 w-24">לאחר הנחה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {charges.map((c, i) => (
                      <tr key={c.id}
                        className={`cursor-pointer ${i % 2 === 0 ? "bg-white" : "bg-slate-50/60"} hover:bg-brand-50/40`}
                        onClick={() => {
                          const next = new Set(selected);
                          next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                          setSelected(next);
                        }}>
                        <td className="px-3 py-1.5 border-b border-slate-100 text-center">
                          <input type="checkbox" checked={selected.has(c.id)} readOnly className="accent-brand-600" />
                        </td>
                        <td className="px-3 py-1.5 border-b border-slate-100 text-slate-700">{c.description}</td>
                        <td className="cell-numeric px-3 py-1.5 border-b border-slate-100 text-slate-800 font-medium">
                          {fmt(c.amount_after_discount_ils)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">הערות (אופציונלי)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md
                         focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none text-right" />
          </div>
          {selectedCharges.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-md px-4 py-3 space-y-1 text-xs">
              <div className="flex justify-between text-slate-600">
                <span className="tabular-nums">{fmt(subtotal)}</span>
                <span>סכום לפני מע&quot;מ</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="tabular-nums">{fmt(vat)}</span>
                <span>מע&quot;מ ({vatPct}%)</span>
              </div>
              <div className="flex justify-between font-bold text-slate-800 border-t border-slate-200 pt-1 mt-1">
                <span className="tabular-nums">{fmt(total)}</span>
                <span>סה&quot;כ לתשלום</span>
              </div>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700">
              <AlertCircle size={13} /> {error}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 px-5 py-3 border-t border-slate-200 shrink-0 flex-row-reverse">
          <button onClick={handleCreate} disabled={saving || selected.size === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-brand-600 hover:bg-brand-700
                       text-white rounded-md transition-colors disabled:opacity-50 font-semibold">
            <FileText size={12} /> {saving ? "יוצר..." : "צור חשבונית"}
          </button>
          <button onClick={onClose}
            className="px-4 py-1.5 text-xs border border-slate-300 bg-white text-slate-600 rounded-md hover:bg-slate-50">
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Billing Settings Panel ───────────────────────────────────────────────────

export function BillingSettingsPanel({
  value, onChange, onSave, saving,
}: {
  value: BillingSettingsOut | null;
  onChange: (next: BillingSettingsOut) => void;
  onSave: () => void;
  saving: boolean;
}) {
  if (!value) return null;

  function setField<K extends keyof BillingSettingsOut>(key: K, nextValue: BillingSettingsOut[K]) {
    onChange({ ...(value as BillingSettingsOut), [key]: nextValue } as BillingSettingsOut);
  }

  const missingFields = value.missing_tax_fields ?? [];

  return (
    <div className="border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">פרטי מנפיק לחשבוניות</h3>
          <p className="mt-1 text-xs text-slate-500">המידע הזה יודפס על ה־PDF ויקבע אם אפשר להפיק גם חשבונית מס.</p>
        </div>
        <button
          onClick={onSave}
          disabled={saving}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? "שומר..." : "שמור פרטי מנפיק"}
        </button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <input aria-label="שם מנפיק בעברית" className="rounded-md border border-slate-300 px-3 py-2 text-xs" value={value.issuer_name_he ?? ""} onChange={(e) => setField("issuer_name_he", e.target.value)} placeholder="שם מנפיק בעברית" />
        <input aria-label="שם מנפיק באנגלית" className="rounded-md border border-slate-300 px-3 py-2 text-xs" value={value.issuer_name_en ?? ""} onChange={(e) => setField("issuer_name_en", e.target.value)} placeholder="שם מנפיק באנגלית" />
        <input aria-label="ח.פ / ע.מ" className="rounded-md border border-slate-300 px-3 py-2 text-xs" value={value.issuer_tax_id ?? ""} onChange={(e) => setField("issuer_tax_id", e.target.value)} placeholder="ח.פ / ע.מ" />
        <input aria-label="כתובת מנפיק" className="rounded-md border border-slate-300 px-3 py-2 text-xs md:col-span-2" value={value.issuer_address ?? ""} onChange={(e) => setField("issuer_address", e.target.value)} placeholder="כתובת מנפיק" />
        <input aria-label="URL ללוגו (אופציונלי)" className="rounded-md border border-slate-300 px-3 py-2 text-xs" value={value.issuer_logo_url ?? ""} onChange={(e) => setField("issuer_logo_url", e.target.value)} placeholder="URL ללוגו (אופציונלי)" />
        <input aria-label="טלפון" className="rounded-md border border-slate-300 px-3 py-2 text-xs" value={value.issuer_phone ?? ""} onChange={(e) => setField("issuer_phone", e.target.value)} placeholder="טלפון" />
        <input aria-label="אימייל" className="rounded-md border border-slate-300 px-3 py-2 text-xs" value={value.issuer_email ?? ""} onChange={(e) => setField("issuer_email", e.target.value)} placeholder="אימייל" />
        <input aria-label="הוראות תשלום" className="rounded-md border border-slate-300 px-3 py-2 text-xs md:col-span-3" value={value.payment_instructions ?? ""} onChange={(e) => setField("payment_instructions", e.target.value)} placeholder="הוראות תשלום" />
        <input aria-label="טקסט footer למסמך" className="rounded-md border border-slate-300 px-3 py-2 text-xs md:col-span-3" value={value.footer_text ?? ""} onChange={(e) => setField("footer_text", e.target.value)} placeholder="טקסט footer למסמך" />
      </div>
      <div className="mt-6 border-t border-slate-200 pt-4">
        <h3 className="text-sm font-semibold text-slate-800">עיצוב חשבונית</h3>
        <p className="mt-1 text-xs text-slate-500 mb-3">עיצוב זה חל על הפקת חשבוניות מערכת למשתמשים.</p>
        <div className="grid gap-3 md:grid-cols-2 max-w-lg">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">צבע ראשי (קוד HEX)</label>
            <div className="flex gap-2">
              <input aria-label="צבע ראשי (קוד HEX)" type="color" className="w-8 h-8 p-0 border-0 rounded cursor-pointer" value={value.invoice_primary_color || "#1e3a8a"} onChange={(e) => setField("invoice_primary_color", e.target.value)} />
              <input aria-label="צבע ראשי (קוד HEX)" className="rounded-md flex-1 border border-slate-300 px-3 py-2 text-xs font-mono" value={value.invoice_primary_color || "#1e3a8a"} onChange={(e) => setField("invoice_primary_color", e.target.value)} placeholder="#HexCode" />
            </div>
          </div>
          <div>
             <label className="block text-xs font-semibold text-slate-600 mb-1">תבנית עיצוב</label>
             <select className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-xs bg-white" value={value.invoice_layout || "modern"} onChange={(e) => setField("invoice_layout", e.target.value)}>
                <option value="modern">מודרני (מומלץ)</option>
                <option value="classic">קלאסי (נקי)</option>
             </select>
          </div>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2.5 py-0.5 font-medium ${value.can_render_tax_invoice ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
          {value.can_render_tax_invoice ? "חשבונית מס זמינה" : "חשבונית מס חסומה"}
        </span>
        {value.source === "env" && (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-600">כרגע נטען מ־ENV עד לשמירה ראשונה</span>
        )}
        {!value.can_render_tax_invoice && missingFields.length > 0 && (
          <span className="text-amber-700">חסרים: {missingFields.join(", ")}</span>
        )}
      </div>
    </div>
  );
}

// ─── Invoice Detail Modal ─────────────────────────────────────────────────────

export function InvoiceDetailModal({
  invoice: initial, onClose, onUpdated, billingSettings,
}: { invoice: InvoiceListItem; onClose: () => void; onUpdated: () => void; billingSettings: BillingSettingsOut | null }) {
  const [inv, setInv]             = useState<InvoiceOut | null>(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentRef, setPaymentRef]   = useState("");
  const [showPaidForm, setShowPaidForm] = useState(false);

  useEffect(() => {
    api.get<InvoiceOut>(`/api/admin/billing/invoices/${initial.id}`)
      .then(setInv).catch(console.error).finally(() => setLoading(false));
  }, [initial.id]);

  async function doFinalize() {
    setSaving(true); setError(null);
    try {
      await api.post(`/api/admin/billing/invoices/${initial.id}/finalize`, {});
      onUpdated();
    } catch (e: unknown) {
      const err = e as { error?: string; detail?: { error?: string } };
      setError(err?.error ?? err?.detail?.error ?? "שגיאה");
    } finally { setSaving(false); }
  }

  async function doMarkPaid() {
    setSaving(true); setError(null);
    try {
      await api.post(`/api/admin/billing/invoices/${initial.id}/mark-paid`, {
        payment_date: paymentDate,
        payment_ref: paymentRef || null,
      });
      onUpdated();
    } catch (e: unknown) {
      const err = e as { error?: string; detail?: { error?: string } };
      setError(err?.error ?? err?.detail?.error ?? "שגיאה");
    } finally { setSaving(false); }
  }

  const statusCfg = INVOICE_STATUS[initial.status] ?? INVOICE_STATUS.draft;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-[#dce4f0] rounded-t-2xl shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-[#1a3a6e]">{initial.invoice_number}</span>
            <StatusBadge cfg={statusCfg} />
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/70 text-slate-500"><X size={16} /></button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : inv ? (
          <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div className="space-y-0.5">
                <p className="text-slate-400">ארגון</p>
                <p className="font-medium text-slate-800">{inv.tenant_name ?? "—"}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-slate-400">תקופת חיוב</p>
                <p className="font-medium text-slate-800">{periodLabel(inv.billing_period)}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-slate-400">תאריך הנפקה</p>
                <p className="font-medium text-slate-800">{fmtDate(inv.issue_date)}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-slate-400">לתשלום עד</p>
                <p className={`font-medium ${inv.status === "overdue" ? "text-red-600" : "text-slate-800"}`}>
                  {fmtDate(inv.due_date)}
                </p>
              </div>
              {inv.payment_date && (
                <div className="space-y-0.5">
                  <p className="text-slate-400">תאריך תשלום</p>
                  <p className="font-medium text-emerald-700">{fmtDate(inv.payment_date)}</p>
                </div>
              )}
              {inv.payment_ref && (
                <div className="space-y-0.5">
                  <p className="text-slate-400">אסמכתא</p>
                  <p className="font-medium text-slate-800">{inv.payment_ref}</p>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1.5">פירוט חיובים</p>
              <div className="border border-slate-200 rounded-md overflow-hidden">
                <table className="admin-data-table w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="text-right px-3 py-2 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200">תיאור</th>
                      <th className="text-right px-3 py-2 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 w-16">כמות</th>
                      <th className="text-right px-3 py-2 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 w-28">מחיר יח&apos;</th>
                      <th className="text-right px-3 py-2 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 w-28">סכום</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inv.lines.map((line, i) => (
                      <tr key={line.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                        <td className="px-3 py-1.5 border-b border-slate-100 text-slate-700">{line.description}</td>
                        <td className="px-3 py-1.5 border-b border-slate-100 text-slate-600 tabular-nums">{parseFloat(line.quantity)}</td>
                        <td className="cell-numeric px-3 py-1.5 border-b border-slate-100 text-slate-600">{fmt(line.unit_price_ils)}</td>
                        <td className="cell-numeric px-3 py-1.5 border-b border-slate-100 text-slate-800 font-medium">{fmt(line.amount_ils)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-md px-4 py-3 space-y-1 text-xs max-w-xs mr-auto">
              <div className="flex justify-between text-slate-600">
                <span className="tabular-nums">{fmt(inv.subtotal_ils)}</span>
                <span>סכום לפני מע&quot;מ</span>
              </div>
              {parseFloat(inv.discount_ils) > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span className="tabular-nums">({fmt(inv.discount_ils)})</span>
                  <span>הנחה</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span className="tabular-nums">{fmt(inv.vat_ils)}</span>
                <span>מע&quot;מ ({inv.vat_pct}%)</span>
              </div>
              <div className="flex justify-between font-bold text-slate-800 border-t border-slate-300 pt-1 mt-1">
                <span className="tabular-nums">{fmt(inv.total_ils)}</span>
                <span>סה&quot;כ לתשלום</span>
              </div>
            </div>
            {inv.notes && (
              <div className="text-xs text-slate-500 bg-amber-50 border border-amber-100 rounded px-3 py-2">
                <span className="font-medium text-amber-700">הערות: </span>{inv.notes}
              </div>
            )}
            {showPaidForm && (
              <div className="border border-emerald-200 bg-emerald-50 rounded-md px-4 py-3 space-y-3">
                <p className="text-xs font-semibold text-emerald-800">פרטי תשלום</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">תאריך תשלום</label>
                    <HebrewDatePicker value={paymentDate} onChange={setPaymentDate}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md
                                 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 text-right bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">אסמכתא (אופציונלי)</label>
                    <input type="text" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)}
                      placeholder="מס' העברה / המחאה..."
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md
                                 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 text-right" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={doMarkPaid} disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700
                               text-white rounded-md transition-colors disabled:opacity-50 font-semibold">
                    <CheckCircle2 size={12} /> {saving ? "שומר..." : "אישור תשלום"}
                  </button>
                  <button onClick={() => setShowPaidForm(false)}
                    className="px-3 py-1.5 text-xs border border-slate-300 bg-white text-slate-600 rounded-md hover:bg-slate-50">
                    ביטול
                  </button>
                </div>
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700">
                <AlertCircle size={13} /> {error}
              </div>
            )}
          </div>
        ) : null}
        {inv && (
          <div className="flex items-center gap-2 px-5 py-3 border-t border-slate-200 shrink-0 flex-row-reverse">
            {inv.status === "draft" && (
              <button onClick={doFinalize} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700
                           text-white rounded-md transition-colors disabled:opacity-50 font-semibold">
                <Send size={12} /> שלח ללקוח
              </button>
            )}
            {(inv.status === "sent" || inv.status === "overdue") && !showPaidForm && (
              <button onClick={() => setShowPaidForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700
                           text-white rounded-md transition-colors font-semibold">
                <CheckCircle2 size={12} /> סמן כשולם
              </button>
            )}
            <button
              onClick={() => openInvoicePdf(inv.id, "statement")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-300
                         bg-white text-slate-700 rounded-md hover:bg-slate-50 transition-colors">
              <FileDown size={12} /> PDF חיוב
            </button>
            {billingSettings?.can_render_tax_invoice ? (
              <button
                onClick={() => openInvoicePdf(inv.id, "tax")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-300
                           bg-white text-slate-700 rounded-md hover:bg-slate-50 transition-colors">
                <FileText size={12} /> חשבונית מס
              </button>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-amber-200
                           bg-amber-50 text-amber-700 rounded-md"
                title={(billingSettings?.missing_tax_fields ?? []).join(", ")}
              >
                <Ban size={12} /> חסר מידע לחשבונית מס
              </span>
            )}
            <button onClick={onClose}
              className="px-4 py-1.5 text-xs border border-slate-300 bg-white text-slate-600 rounded-md hover:bg-slate-50">
              סגור
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Quote Builder Modal ──────────────────────────────────────────────────────

interface LocalLine {
  _key: string;
  description: string;
  quantity: string;
  unit_price_ils: string;
  discount_pct: string;
  module_slug: string;
  charge_type: string;
  notes: string;
}

export function QuoteBuilderModal({
  tenants, onClose, onSaved,
}: { tenants: TenantListItem[]; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle]             = useState("");
  const [validUntil, setValidUntil]   = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10);
  });
  const [tenantMode, setTenantMode]   = useState<"tenant" | "prospect">("tenant");
  const [tenantId, setTenantId]       = useState("");
  const [prospectName, setProspectName] = useState("");
  const [prospectEmail, setProspectEmail] = useState("");
  const [notes, setNotes]             = useState("");
  const [discountPct, setDiscountPct] = useState("0");
  const [vatPct, setVatPct]           = useState("17.00");
  const [lines, setLines]             = useState<LocalLine[]>([]);
  const [modules, setModules]         = useState<ModuleMinimal[]>([]);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    api.get<ModuleMinimal[]>("/api/admin/modules").then(setModules).catch(console.error);
  }, []);

  function addLine() {
    setLines((prev) => [...prev, {
      _key: crypto.randomUUID(),
      description: "", quantity: "1", unit_price_ils: "0",
      discount_pct: "0", module_slug: "", charge_type: "base_fee", notes: "",
    }]);
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l._key !== key));
  }

  function updateLine(key: string, field: keyof LocalLine, value: string) {
    setLines((prev) => prev.map((l) => {
      if (l._key !== key) return l;
      const updated = { ...l, [field]: value };
      if (field === "module_slug" && value) {
        const mod = modules.find((m) => m.slug === value);
        if (mod) {
          updated.description = `${mod.name} — ${CHARGE_TYPE_LABELS[updated.charge_type] ?? updated.charge_type}`;
          if (mod.current_price) {
            updated.unit_price_ils = mod.current_price.base_price_ils;
          }
        }
      }
      return updated;
    }));
  }

  const subtotal = lines.reduce((s, l) => {
    const amount = parseFloat(l.quantity || "0") * parseFloat(l.unit_price_ils || "0");
    return s + amount * (1 - parseFloat(l.discount_pct || "0") / 100);
  }, 0);
  const vat   = subtotal * parseFloat(vatPct || "0") / 100;
  const total = subtotal + vat;

  async function handleSave() {
    if (!title.trim()) { setError("יש להזין כותרת להצעה"); return; }
    if (tenantMode === "tenant" && !tenantId) { setError("יש לבחור ארגון"); return; }
    if (tenantMode === "prospect" && !prospectName.trim()) { setError("יש להזין שם פרוספקט"); return; }
    setSaving(true); setError(null);
    try {
      await api.post("/api/admin/billing/quotes", {
        title,
        valid_until: validUntil,
        tenant_id: tenantMode === "tenant" ? tenantId : null,
        prospect_name: tenantMode === "prospect" ? prospectName : null,
        prospect_email: tenantMode === "prospect" ? (prospectEmail || null) : null,
        notes: notes || null,
        discount_pct: discountPct,
        vat_pct: vatPct,
        lines: lines.map((l, i) => ({
          description: l.description,
          quantity: l.quantity,
          unit_price_ils: l.unit_price_ils,
          discount_pct: l.discount_pct,
          module_slug: l.module_slug || null,
          charge_type: l.charge_type,
          notes: l.notes || null,
          sort_order: (i + 1) * 10,
        })),
      });
      onSaved();
    } catch (e: unknown) {
      const err = e as { error?: string; detail?: { error?: string } };
      setError(err?.error ?? err?.detail?.error ?? "שגיאה ביצירת הצעת מחיר");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[92vh] flex flex-col" dir="rtl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-[#dce4f0] rounded-t-lg shrink-0">
          <h2 className="text-sm font-bold text-[#1a3a6e] flex items-center gap-2">
            <Quote size={14} /> הצעת מחיר חדשה
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/60 text-slate-500"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 overflow-auto space-y-4 flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">כותרת ההצעה <span className="text-red-400">*</span></label>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="הצעת מחיר — ניהול HR ל…"
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-brand-400 text-right" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">תוקף עד</label>
              <HebrewDatePicker value={validUntil} onChange={setValidUntil} fieldLabel="תוקף עד"
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-brand-400 text-right bg-white" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">נמען</label>
            <div className="flex gap-3 mb-2 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" checked={tenantMode === "tenant"} onChange={() => setTenantMode("tenant")} className="accent-brand-600" aria-label="ארגון קיים" />
                ארגון קיים
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" checked={tenantMode === "prospect"} onChange={() => setTenantMode("prospect")} className="accent-brand-600" aria-label="פרוספקט חדש" />
                פרוספקט חדש
              </label>
            </div>
            {tenantMode === "tenant" ? (
              <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} aria-label="ארגון"
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-brand-400 bg-white text-right">
                <option value="">בחר ארגון...</option>
                {tenants.map((t) => <option key={t.tenant_id} value={t.tenant_id}>{t.name_he}</option>)}
              </select>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <input value={prospectName} onChange={(e) => setProspectName(e.target.value)} aria-label="שם פרוספקט"
                  placeholder="שם פרוספקט *"
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-brand-400 text-right" />
                <input value={prospectEmail} onChange={(e) => setProspectEmail(e.target.value)} aria-label="אימייל (אופציונלי)"
                  placeholder="אימייל (אופציונלי)"
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-brand-400 text-right" />
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">מע&quot;מ %</label>
              <input type="number" value={vatPct} onChange={(e) => setVatPct(e.target.value)}
                min="0" max="100" step="0.01"
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-brand-400 text-right" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">הנחה כללית %</label>
              <input type="number" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)}
                min="0" max="100" step="0.01"
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-brand-400 text-right" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">הערות</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="הערות אופציונליות..."
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-brand-400 text-right" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700">שורות ההצעה</label>
              <button onClick={addLine}
                className="flex items-center gap-1 text-xs text-brand-700 hover:text-brand-800 font-medium">
                <Plus size={12} /> הוסף שורה
              </button>
            </div>
            {lines.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-6 border border-dashed border-slate-200 rounded-md">
                לחץ &quot;הוסף שורה&quot; להוספת פריטים להצעה
              </div>
            ) : (
              <div className="border border-slate-200 rounded-md overflow-hidden">
                <table className="admin-data-table w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600">
                      <th className="text-right px-2 py-2 font-semibold">מודול</th>
                      <th className="text-right px-2 py-2 font-semibold">סוג</th>
                      <th className="text-right px-2 py-2 font-semibold w-40">תיאור</th>
                      <th className="text-right px-2 py-2 font-semibold w-14">כמות</th>
                      <th className="text-right px-2 py-2 font-semibold w-24">מחיר יח׳ ₪</th>
                      <th className="text-right px-2 py-2 font-semibold w-14">הנחה%</th>
                      <th className="px-2 py-2 font-semibold w-24">סכום</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => {
                      const amount = parseFloat(line.quantity || "0") * parseFloat(line.unit_price_ils || "0");
                      const afterDiscount = amount * (1 - parseFloat(line.discount_pct || "0") / 100);
                      return (
                        <tr key={line._key} className="border-t border-slate-100 hover:bg-slate-50/40">
                          <td className="px-1.5 py-1.5">
                            <select value={line.module_slug} onChange={(e) => updateLine(line._key, "module_slug", e.target.value)} aria-label="מודול"
                              className="w-28 px-1.5 py-1 text-[11px] border border-slate-300 rounded bg-white text-right">
                              <option value="">—</option>
                              {modules.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}
                            </select>
                          </td>
                          <td className="px-1.5 py-1.5">
                            <select value={line.charge_type} onChange={(e) => updateLine(line._key, "charge_type", e.target.value)} aria-label="סוג"
                              className="w-24 px-1.5 py-1 text-[11px] border border-slate-300 rounded bg-white text-right">
                              {Object.entries(CHARGE_TYPE_LABELS).filter(([k]) => k !== "credit").map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-1.5 py-1.5">
                            <input value={line.description} onChange={(e) => updateLine(line._key, "description", e.target.value)} aria-label="תיאור"
                              placeholder="תיאור..."
                              className="w-full px-1.5 py-1 text-[11px] border border-slate-300 rounded text-right" />
                          </td>
                          <td className="px-1.5 py-1.5">
                            <input type="number" value={line.quantity} onChange={(e) => updateLine(line._key, "quantity", e.target.value)} aria-label="כמות"
                              min="0" step="0.01"
                              className="w-14 px-1.5 py-1 text-[11px] border border-slate-300 rounded text-right" />
                          </td>
                          <td className="px-1.5 py-1.5">
                            <input type="number" value={line.unit_price_ils} onChange={(e) => updateLine(line._key, "unit_price_ils", e.target.value)} aria-label="מחיר יח׳ ₪"
                              min="0" step="0.01"
                              className="w-24 px-1.5 py-1 text-[11px] border border-slate-300 rounded text-right" />
                          </td>
                          <td className="px-1.5 py-1.5">
                            <input type="number" value={line.discount_pct} onChange={(e) => updateLine(line._key, "discount_pct", e.target.value)} aria-label="הנחה%"
                              min="0" max="100" step="0.01"
                              className="w-14 px-1.5 py-1 text-[11px] border border-slate-300 rounded text-right" />
                          </td>
                          <td className="cell-numeric px-1.5 py-1.5 font-medium text-slate-800">
                            {fmt(afterDiscount)}
                          </td>
                          <td className="px-1.5 py-1.5">
                            <button onClick={() => removeLine(line._key)} className="text-red-400 hover:text-red-600">
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {lines.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-md px-4 py-3 space-y-1 text-xs max-w-xs mr-auto">
              <div className="flex justify-between text-slate-600">
                <span className="tabular-nums">{fmt(subtotal)}</span>
                <span>לפני מע&quot;מ</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="tabular-nums">{fmt(vat)}</span>
                <span>מע&quot;מ ({vatPct}%)</span>
              </div>
              <div className="flex justify-between font-bold text-slate-800 border-t border-slate-200 pt-1">
                <span className="tabular-nums">{fmt(total)}</span>
                <span>סה&quot;כ הצעה</span>
              </div>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700">
              <AlertCircle size={13} /> {error}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 px-5 py-3 border-t border-slate-200 shrink-0 flex-row-reverse">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-brand-600 hover:bg-brand-700
                       text-white rounded-md transition-colors disabled:opacity-50 font-semibold">
            <Quote size={12} /> {saving ? "שומר..." : "שמור טיוטה"}
          </button>
          <button onClick={onClose}
            className="px-4 py-1.5 text-xs border border-slate-300 bg-white text-slate-600 rounded-md hover:bg-slate-50">
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Quote Detail Modal ───────────────────────────────────────────────────────

export function QuoteDetailModal({
  quoteId, onClose, onUpdated,
}: { quoteId: string; onClose: () => void; onUpdated: () => void }) {
  const [quote, setQuote] = useState<QuoteOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  function loadQuote() {
    setLoading(true);
    api.get<QuoteOut>(`/api/admin/billing/quotes/${quoteId}`)
      .then(setQuote).catch(console.error).finally(() => setLoading(false));
  }

  useEffect(() => { loadQuote(); }, [quoteId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function doAction(action: "send" | "accept" | "decline") {
    setSaving(true); setError(null);
    try {
      await api.post(`/api/admin/billing/quotes/${quoteId}/${action}`, {});
      loadQuote();
      onUpdated();
    } catch (e: unknown) {
      const err = e as { error?: string; detail?: { error?: string } };
      setError(err?.error ?? err?.detail?.error ?? "שגיאה");
    } finally { setSaving(false); }
  }

  async function doConvert() {
    setSaving(true); setError(null);
    try {
      await api.post(`/api/admin/billing/quotes/${quoteId}/convert-to-invoice`, {});
      loadQuote();
      onUpdated();
    } catch (e: unknown) {
      const err = e as { error?: string; detail?: { error?: string } };
      setError(err?.error ?? err?.detail?.error ?? "שגיאה בהמרה לחשבונית");
    } finally { setSaving(false); }
  }

  const statusCfg = QUOTE_STATUS[quote?.status ?? "draft"] ?? QUOTE_STATUS.draft;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-[#dce4f0] rounded-t-2xl shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-[#1a3a6e]">{quote?.quote_number ?? "הצעת מחיר"}</span>
            <StatusBadge cfg={statusCfg} />
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/70 text-slate-500"><X size={16} /></button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : quote ? (
          <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div className="col-span-2 space-y-0.5">
                <p className="text-slate-400">כותרת</p>
                <p className="font-semibold text-slate-800">{quote.title}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-slate-400">תוקף עד</p>
                <p className="font-medium text-slate-700">{fmtDate(quote.valid_until)}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-slate-400">לקוח</p>
                <p className="font-medium text-slate-800">{quote.tenant_name ?? quote.prospect_name ?? "—"}</p>
              </div>
              {quote.prospect_email && (
                <div className="space-y-0.5">
                  <p className="text-slate-400">אימייל</p>
                  <p className="font-medium text-slate-700">{quote.prospect_email}</p>
                </div>
              )}
              {quote.notes && (
                <div className="space-y-0.5 col-span-3">
                  <p className="text-slate-400">הערות</p>
                  <p className="text-slate-600">{quote.notes}</p>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1.5">פירוט שורות</p>
              <div className="border border-slate-200 rounded-md overflow-hidden">
                <table className="admin-data-table w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      {["תיאור", "כמות", "מחיר יח׳", "הנחה", "סכום"].map((h) => (
                        <th key={h} className="text-right px-3 py-2 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {quote.lines.map((line, i) => (
                      <tr key={line.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                        <td className="px-3 py-1.5 border-b border-slate-100 text-slate-700">{line.description}</td>
                        <td className="px-3 py-1.5 border-b border-slate-100 text-slate-600 tabular-nums">{parseFloat(line.quantity)}</td>
                        <td className="cell-numeric px-3 py-1.5 border-b border-slate-100 text-slate-600">{fmt(line.unit_price_ils)}</td>
                        <td className="px-3 py-1.5 border-b border-slate-100 text-slate-500 tabular-nums">
                          {parseFloat(line.discount_pct) > 0 ? `${line.discount_pct}%` : "—"}
                        </td>
                        <td className="cell-numeric px-3 py-1.5 border-b border-slate-100 font-medium text-slate-800">
                          {fmt(line.amount_after_discount_ils)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-md px-4 py-3 space-y-1 text-xs max-w-xs mr-auto">
              <div className="flex justify-between text-slate-600">
                <span className="tabular-nums">{fmt(quote.subtotal_ils)}</span>
                <span>לפני מע&quot;מ</span>
              </div>
              {parseFloat(quote.discount_ils ?? "0") > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span className="tabular-nums">({fmt(quote.discount_ils ?? "0")})</span>
                  <span>הנחה</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span className="tabular-nums">{fmt(quote.vat_ils)}</span>
                <span>מע&quot;מ ({quote.vat_pct}%)</span>
              </div>
              <div className="flex justify-between font-bold text-slate-800 border-t border-slate-300 pt-1">
                <span className="tabular-nums">{fmt(quote.total_ils)}</span>
                <span>סה&quot;כ הצעה</span>
              </div>
            </div>
            {quote.converted_invoice_id && (
              <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
                ✓ הצעה הומרה לחשבונית
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700">
                <AlertCircle size={13} /> {error}
              </div>
            )}
          </div>
        ) : null}
        {quote && (
          <div className="flex items-center gap-2 px-5 py-3 border-t border-slate-200 shrink-0 flex-row-reverse">
            {quote.status === "draft" && (
              <button onClick={() => doAction("send")} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 font-semibold">
                <Send size={12} /> שלח ללקוח
              </button>
            )}
            {quote.status === "sent" && !quote.converted_invoice_id && (
              <>
                <button onClick={() => doAction("accept")} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors disabled:opacity-50 font-semibold">
                  <CheckCircle2 size={12} /> אשר
                </button>
                <button onClick={() => doAction("decline")} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors disabled:opacity-50">
                  <X size={12} /> דחה
                </button>
              </>
            )}
            {quote.status === "accepted" && !quote.converted_invoice_id && (
              <button onClick={doConvert} disabled={saving || !quote.tenant_id}
                title={!quote.tenant_id ? "נדרש ארגון מקושר להמרה לחשבונית" : ""}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white rounded-md transition-colors disabled:opacity-50 font-semibold">
                <TrendingUp size={12} /> המר לחשבונית
              </button>
            )}
            <button onClick={() => openQuotePdf(quote.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-300 bg-white text-slate-700 rounded-md hover:bg-slate-50 transition-colors">
              <FileDown size={12} /> הורד PDF
            </button>
            <button onClick={onClose}
              className="px-4 py-1.5 text-xs border border-slate-300 bg-white text-slate-600 rounded-md hover:bg-slate-50">
              סגור
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
