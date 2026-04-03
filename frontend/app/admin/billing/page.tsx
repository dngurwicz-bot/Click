"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, api } from "@/lib/api";
import { TopNav } from "@/components/layout/TopNav";
import {
  HelpCircle, Printer, RefreshCw, Plus, Search,
  Zap, FileText, X, AlertCircle, ChevronDown,
  CheckCircle2, Clock, Ban, Send, Wallet,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface BillingChargeOut {
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

interface InvoiceListItem {
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

interface InvoiceLine {
  id: string;
  invoice_id: string;
  charge_id?: string;
  description: string;
  quantity: string;
  unit_price_ils: string;
  amount_ils: string;
  sort_order: number;
}

interface InvoiceOut extends InvoiceListItem {
  vat_pct: string;
  notes?: string;
  payment_ref?: string;
  lines: InvoiceLine[];
}

interface TenantListItem {
  tenant_id: string;
  name_he: string;
  org_number: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const CHARGE_TYPE_LABELS: Record<string, string> = {
  base_fee: "דמי מנוי", per_seat: "לפי מושב",
  setup_fee: "דמי הקמה", addon: "תוספת",
  credit: "זיכוי", manual: "ידני",
};

const CHARGE_STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  pending:   { label: "ממתין",  cls: "bg-amber-50 text-amber-700",   dot: "bg-amber-400" },
  invoiced:  { label: "חויב",   cls: "bg-blue-50 text-blue-700",     dot: "bg-blue-500" },
  cancelled: { label: "מבוטל",  cls: "bg-slate-100 text-slate-500",  dot: "bg-slate-400" },
};

const INVOICE_STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  draft:     { label: "טיוטה",  cls: "bg-slate-100 text-slate-600",  dot: "bg-slate-400" },
  sent:      { label: "נשלח",   cls: "bg-blue-50 text-blue-700",     dot: "bg-blue-500" },
  paid:      { label: "שולם",   cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  overdue:   { label: "בפיגור", cls: "bg-red-50 text-red-700",       dot: "bg-red-500" },
  cancelled: { label: "מבוטל",  cls: "bg-slate-100 text-slate-500",  dot: "bg-slate-400" },
};

const ILS_MONTHS = [
  "", "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: string | number) =>
  `₪${parseFloat(String(v)).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("he-IL") : "—";

function periodLabel(p: string) {
  const [y, m] = p.split("-");
  return `${ILS_MONTHS[parseInt(m)]} ${y}`;
}

function StatusBadge({ cfg }: { cfg: { label: string; cls: string; dot: string } }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Generate Charges Modal ───────────────────────────────────────────────────

function GenerateChargesModal({
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
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md
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

function NewInvoiceModal({
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
          {/* Row 1: Tenant + Period */}
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
              <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md
                           focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 text-right" />
            </div>
          </div>

          {/* Row 2: Dates + VAT */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">תאריך הנפקה</label>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md
                           focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 text-right" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">לתשלום עד</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md
                           focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 text-right" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">מע&quot;מ %</label>
              <input type="number" value={vatPct} onChange={(e) => setVatPct(e.target.value)}
                step="0.01" min="0" max="100"
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md
                           focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 text-right" />
            </div>
          </div>

          {/* Charges selection */}
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
                <table className="w-full text-xs border-collapse">
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
                        <td className="px-3 py-1.5 border-b border-slate-100 text-slate-800 font-medium tabular-nums text-left">
                          {fmt(c.amount_after_discount_ils)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">הערות (אופציונלי)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md
                         focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none text-right" />
          </div>

          {/* Totals */}
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

// ─── Invoice Detail Modal ─────────────────────────────────────────────────────

function InvoiceDetailModal({
  invoice: initial, onClose, onUpdated,
}: { invoice: InvoiceListItem; onClose: () => void; onUpdated: () => void }) {
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50 rounded-t-lg shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-800">{initial.invoice_number}</span>
            <StatusBadge cfg={statusCfg} />
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-200 text-slate-500"><X size={16} /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : inv ? (
          <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
            {/* Meta info */}
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

            {/* Lines table */}
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1.5">פירוט חיובים</p>
              <div className="border border-slate-200 rounded-md overflow-hidden">
                <table className="w-full text-xs border-collapse">
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
                        <td className="px-3 py-1.5 border-b border-slate-100 text-slate-600 tabular-nums text-left">{fmt(line.unit_price_ils)}</td>
                        <td className="px-3 py-1.5 border-b border-slate-100 text-slate-800 font-medium tabular-nums text-left">{fmt(line.amount_ils)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
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

            {/* Notes */}
            {inv.notes && (
              <div className="text-xs text-slate-500 bg-amber-50 border border-amber-100 rounded px-3 py-2">
                <span className="font-medium text-amber-700">הערות: </span>{inv.notes}
              </div>
            )}

            {/* Mark paid form */}
            {showPaidForm && (
              <div className="border border-emerald-200 bg-emerald-50 rounded-md px-4 py-3 space-y-3">
                <p className="text-xs font-semibold text-emerald-800">פרטי תשלום</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">תאריך תשלום</label>
                    <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md
                                 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 text-right" />
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

        {/* Footer actions */}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

type MainTab = "charges" | "invoices";

export default function BillingPage() {
  const router = useRouter();

  const [activeTab, setActiveTab]           = useState<MainTab>("charges");
  const [charges, setCharges]               = useState<BillingChargeOut[]>([]);
  const [invoices, setInvoices]             = useState<InvoiceListItem[]>([]);
  const [tenants, setTenants]               = useState<TenantListItem[]>([]);
  const [loading, setLoading]               = useState(true);

  // Filters
  const [filterPeriod, setFilterPeriod]     = useState(currentPeriod());
  const [filterTenantId, setFilterTenantId] = useState("");
  const [filterStatus, setFilterStatus]     = useState("");
  const [search, setSearch]                 = useState("");

  // Modals
  const [showGenerate, setShowGenerate]     = useState(false);
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceListItem | null>(null);
  const [generateResult, setGenerateResult] = useState<{ created: number; skipped: number; tenants_processed: number } | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterPeriod) params.set("billing_period", filterPeriod);
    if (filterTenantId) params.set("tenant_id", filterTenantId);
    if (filterStatus) params.set("status", filterStatus);

    Promise.all([
      api.get<BillingChargeOut[]>(`/api/admin/billing/charges?${params}`),
      api.get<InvoiceListItem[]>(`/api/admin/billing/invoices?${params}`),
      api.get<{ tenant_id: string; org_number: number; name_he: string }[]>("/api/admin/tenants"),
    ])
      .then(([c, inv, t]) => {
        setCharges(c);
        setInvoices(inv);
        setTenants(t.map((x) => ({ tenant_id: x.tenant_id, name_he: x.name_he, org_number: x.org_number })));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filterPeriod, filterTenantId, filterStatus]);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    loadData();
  }, [loadData, router]);

  // Client-side search filter
  const filteredCharges = charges.filter((c) =>
    !search || c.tenant_name?.includes(search) || c.description.includes(search) || c.module_name?.includes(search)
  );
  const filteredInvoices = invoices.filter((inv) =>
    !search || inv.tenant_name?.includes(search) || inv.invoice_number.includes(search)
  );

  // Summary stats
  const pendingTotal  = charges.filter((c) => c.status === "pending").reduce((s, c) => s + parseFloat(c.amount_after_discount_ils), 0);
  const invoicedTotal = invoices.filter((i) => i.status !== "cancelled").reduce((s, i) => s + parseFloat(i.total_ils), 0);
  const paidTotal     = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + parseFloat(i.total_ils), 0);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <TopNav />

      <main className="flex-1 overflow-hidden flex flex-col">

        {/* ── Title Bar ──────────────────────────────────────────────── */}
        <div className="bg-white border-b border-slate-200 flex items-center justify-between px-3 py-1.5 shrink-0"
             style={{ boxShadow: "0 1px 0 0 #e2e8f0" }}>
          <div className="flex items-center gap-0.5">
            <button title="עזרה" className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <HelpCircle size={13} />
            </button>
            <button title="הדפסה" className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <Printer size={13} />
            </button>
            <button title="רענן" onClick={loadData} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <RefreshCw size={13} />
            </button>
          </div>
          <h1 className="text-sm font-semibold tracking-wide" style={{ color: "#1c2831" }}>
            ניהול חיובים וחשבוניות
          </h1>
        </div>

        {/* ── Stats Bar ──────────────────────────────────────────────── */}
        <div className="bg-white border-b border-slate-200 flex items-center gap-6 px-4 py-2 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <Clock size={12} className="text-amber-500" />
            <span className="text-slate-500">ממתין לחיוב:</span>
            <span className="font-semibold text-amber-700 tabular-nums">{fmt(pendingTotal)}</span>
          </div>
          <div className="w-px h-4 bg-slate-200" />
          <div className="flex items-center gap-2 text-xs">
            <Send size={12} className="text-blue-500" />
            <span className="text-slate-500">חויב:</span>
            <span className="font-semibold text-blue-700 tabular-nums">{fmt(invoicedTotal)}</span>
          </div>
          <div className="w-px h-4 bg-slate-200" />
          <div className="flex items-center gap-2 text-xs">
            <CheckCircle2 size={12} className="text-emerald-500" />
            <span className="text-slate-500">שולם:</span>
            <span className="font-semibold text-emerald-700 tabular-nums">{fmt(paidTotal)}</span>
          </div>

          {generateResult && (
            <div className="mr-auto flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-0.5 text-xs text-emerald-700">
              <CheckCircle2 size={11} />
              נוצרו {generateResult.created} חיובים חדשים
              ({generateResult.skipped} קיימים, {generateResult.tenants_processed} ארגונים)
              <button onClick={() => setGenerateResult(null)} className="text-emerald-500 hover:text-emerald-700">
                <X size={11} />
              </button>
            </div>
          )}
        </div>

        {/* ── Action Bar ─────────────────────────────────────────────── */}
        <div className="bg-slate-50 border-b border-slate-200 flex items-center justify-between px-3 py-1.5 shrink-0 gap-3">
          {/* RIGHT: actions + search */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGenerate(true)}
              className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white
                         text-xs font-semibold px-3 py-1.5 rounded-md transition-colors shadow-sm">
              <Zap size={12} /> ייצר חיובים
            </button>
            <button
              onClick={() => setShowNewInvoice(true)}
              className="flex items-center gap-1.5 border border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100
                         text-xs font-semibold px-3 py-1.5 rounded-md transition-colors">
              <Plus size={12} /> חשבונית חדשה
            </button>
            <div className="relative">
              <Search size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="חיפוש..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-8 pl-3 py-1.5 text-xs border border-slate-300 bg-white rounded-md
                           focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100
                           text-right w-44 transition-colors"
              />
            </div>
          </div>

          {/* CENTER: filters */}
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              title="תקופת חיוב"
              className="px-2 py-1.5 text-xs border border-slate-300 bg-white rounded-md
                         focus:outline-none focus:border-brand-400 text-right w-36"
            />
            <select
              value={filterTenantId}
              onChange={(e) => setFilterTenantId(e.target.value)}
              className="px-2 py-1.5 text-xs border border-slate-300 bg-white rounded-md
                         focus:outline-none focus:border-brand-400 text-right w-40"
            >
              <option value="">כל הארגונים</option>
              {tenants.map((t) => (
                <option key={t.tenant_id} value={t.tenant_id}>{t.name_he}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2 py-1.5 text-xs border border-slate-300 bg-white rounded-md
                         focus:outline-none focus:border-brand-400 text-right w-28"
            >
              <option value="">כל הסטטוסים</option>
              {activeTab === "charges" ? (
                <>
                  <option value="pending">ממתין</option>
                  <option value="invoiced">חויב</option>
                  <option value="cancelled">מבוטל</option>
                </>
              ) : (
                <>
                  <option value="draft">טיוטה</option>
                  <option value="sent">נשלח</option>
                  <option value="paid">שולם</option>
                  <option value="overdue">בפיגור</option>
                  <option value="cancelled">מבוטל</option>
                </>
              )}
            </select>
          </div>

          {/* LEFT: count */}
          <div className="text-xs text-slate-400 font-medium shrink-0">
            {!loading && (
              <span>{activeTab === "charges" ? filteredCharges.length : filteredInvoices.length} פריטים</span>
            )}
          </div>
        </div>

        {/* ── Tab Bar ────────────────────────────────────────────────── */}
        <div className="bg-white border-b border-slate-200 flex items-end px-3 shrink-0 gap-0.5">
          {(["charges", "invoices"] as MainTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setFilterStatus(""); }}
              className={`px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap flex items-center gap-1.5
                ${activeTab === tab
                  ? "border-brand-500 text-brand-600"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                }`}
            >
              {tab === "charges" ? <><Wallet size={12} /> חיובים</> : <><FileText size={12} /> חשבוניות</>}
            </button>
          ))}
        </div>

        {/* ── Table Area ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto bg-white min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activeTab === "charges" ? (

            // ── Charges Table ────────────────────────────────────────
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr>
                  {["ארגון", "תקופה", "מודול", "סוג", "תיאור", "מחיר יח׳", "סכום", "הנחה%", "לחיוב", "סטטוס"].map((h) => (
                    <th key={h} className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredCharges.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-16 text-slate-400">אין חיובים להצגה</td></tr>
                ) : (
                  filteredCharges.map((c, i) => {
                    const st = CHARGE_STATUS[c.status] ?? CHARGE_STATUS.pending;
                    return (
                      <tr key={c.id}
                        className={`transition-colors ${i % 2 === 0 ? "bg-white hover:bg-brand-50/40" : "bg-slate-50/60 hover:bg-brand-50/40"}`}>
                        <td className="px-4 py-2 border-b border-slate-100 font-medium text-slate-800">{c.tenant_name ?? "—"}</td>
                        <td className="px-4 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">{periodLabel(c.billing_period)}</td>
                        <td className="px-4 py-2 border-b border-slate-100 text-slate-600">{c.module_name ?? c.module_slug ?? "—"}</td>
                        <td className="px-4 py-2 border-b border-slate-100 text-slate-500">{CHARGE_TYPE_LABELS[c.charge_type] ?? c.charge_type}</td>
                        <td className="px-4 py-2 border-b border-slate-100 text-slate-700 max-w-[200px] truncate" title={c.description}>{c.description}</td>
                        <td className="px-4 py-2 border-b border-slate-100 text-slate-600 tabular-nums text-left">{fmt(c.unit_price_ils)}</td>
                        <td className="px-4 py-2 border-b border-slate-100 text-slate-600 tabular-nums text-left">{fmt(c.amount_ils)}</td>
                        <td className="px-4 py-2 border-b border-slate-100 text-slate-500 tabular-nums">
                          {parseFloat(c.discount_pct) > 0 ? `${c.discount_pct}%` : "—"}
                        </td>
                        <td className="px-4 py-2 border-b border-slate-100 font-semibold text-slate-800 tabular-nums text-left">{fmt(c.amount_after_discount_ils)}</td>
                        <td className="px-4 py-2 border-b border-slate-100"><StatusBadge cfg={st} /></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

          ) : (

            // ── Invoices Table ───────────────────────────────────────
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr>
                  {["מס' חשבונית", "ארגון", "תקופה", "הנפקה", "לתשלום עד", "לפני מע\"מ", "מע\"מ", "סה\"כ", "סטטוס"].map((h) => (
                    <th key={h} className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-16 text-slate-400">אין חשבוניות להצגה</td></tr>
                ) : (
                  filteredInvoices.map((inv, i) => {
                    const st = INVOICE_STATUS[inv.status] ?? INVOICE_STATUS.draft;
                    return (
                      <tr key={inv.id}
                        className={`cursor-pointer transition-colors ${i % 2 === 0 ? "bg-white hover:bg-brand-50/40" : "bg-slate-50/60 hover:bg-brand-50/40"}`}
                        onDoubleClick={() => setSelectedInvoice(inv)}>
                        <td className="px-4 py-2 border-b border-slate-100 font-bold text-brand-700">{inv.invoice_number}</td>
                        <td className="px-4 py-2 border-b border-slate-100 font-medium text-slate-800">{inv.tenant_name ?? "—"}</td>
                        <td className="px-4 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">{periodLabel(inv.billing_period)}</td>
                        <td className="px-4 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">{fmtDate(inv.issue_date)}</td>
                        <td className={`px-4 py-2 border-b border-slate-100 whitespace-nowrap ${inv.status === "overdue" ? "text-red-600 font-medium" : "text-slate-600"}`}>
                          {fmtDate(inv.due_date)}
                        </td>
                        <td className="px-4 py-2 border-b border-slate-100 text-slate-600 tabular-nums text-left">{fmt(inv.subtotal_ils)}</td>
                        <td className="px-4 py-2 border-b border-slate-100 text-slate-500 tabular-nums text-left">{fmt(inv.vat_ils)}</td>
                        <td className="px-4 py-2 border-b border-slate-100 font-bold text-slate-800 tabular-nums text-left">{fmt(inv.total_ils)}</td>
                        <td className="px-4 py-2 border-b border-slate-100"><StatusBadge cfg={st} /></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* ── Modals ─────────────────────────────────────────────────── */}
      {showGenerate && (
        <GenerateChargesModal
          onClose={() => setShowGenerate(false)}
          onDone={(result) => {
            setShowGenerate(false);
            setGenerateResult(result);
            loadData();
          }}
        />
      )}

      {showNewInvoice && (
        <NewInvoiceModal
          tenants={tenants}
          onClose={() => setShowNewInvoice(false)}
          onSaved={() => {
            setShowNewInvoice(false);
            setActiveTab("invoices");
            loadData();
          }}
        />
      )}

      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onUpdated={() => {
            setSelectedInvoice(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
