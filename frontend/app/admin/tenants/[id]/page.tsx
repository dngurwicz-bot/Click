"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { isLoggedIn, api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { TopNav } from "@/components/layout/TopNav";
import { CardPage, type ChildTab } from "@/components/layout/CardPage";
import { FormField } from "@/components/ui/FormField";
import { X, Camera, Building2, AlertCircle, CheckCircle2, Send, FileText } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditFields {
  created_at?: string; created_by?: string;
  updated_at?: string; updated_by?: string;
}
interface TenantIdentityOut extends AuditFields {
  id: string; name_he: string; name_en?: string; tax_id: string;
  entity_type: string; logo_url?: string; industry_code?: string;
  valid_from: string; valid_to?: string;
}
interface TenantContactOut extends AuditFields {
  id: string; contact_type: string; email: string; phone: string;
  phone_alt?: string; contact_name?: string;
  website?: string; valid_from: string; valid_to?: string;
}
interface TenantAddressOut extends AuditFields {
  id: string; street: string; city: string; zip_code?: string;
  country: string; addr_type: string; valid_from: string; valid_to?: string;
}
interface TenantSubscriptionOut extends AuditFields {
  id: string; package_slug: string; billing_cycle: string; currency: string;
  discount_pct: string; is_price_locked: boolean; next_renewal_at?: string;
  valid_from: string; valid_to?: string;
}
interface TenantStatusOut extends AuditFields {
  id: string; status: string; reason?: string; notes?: string;
  valid_from: string; valid_to?: string;
}
interface TenantOut extends AuditFields {
  tenant_id: string; org_number: number; created_at: string;
  updated_at?: string; created_by?: string; updated_by?: string;
  identity?: TenantIdentityOut; contact?: TenantContactOut;
  address?: TenantAddressOut; subscription?: TenantSubscriptionOut; status?: TenantStatusOut;
}
interface TenantHistory {
  identity: TenantIdentityOut[]; contact: TenantContactOut[];
  address: TenantAddressOut[]; subscription: TenantSubscriptionOut[]; status: TenantStatusOut[];
}

type SectionKey = "identity" | "contact" | "address" | "subscription" | "status";

// ─── Billing Types ────────────────────────────────────────────────────────────

interface TenantBillingCharge {
  id: string; billing_period: string; charge_type: string;
  module_name?: string; description: string;
  amount_ils: string; discount_pct: string; amount_after_discount_ils: string;
  status: string; invoice_id?: string; created_at: string;
}

interface TenantInvoiceItem {
  id: string; invoice_number: string; billing_period: string;
  issue_date: string; due_date: string;
  subtotal_ils: string; vat_ils: string; total_ils: string;
  status: string; payment_date?: string;
}

interface TenantBillingSummary {
  charges: TenantBillingCharge[];
  invoices: TenantInvoiceItem[];
  pending_total_ils: string;
  invoiced_total_ils: string;
  paid_total_ils: string;
}

interface TenantInvoiceDetail extends TenantInvoiceItem {
  vat_pct: string; discount_ils: string; notes?: string; payment_ref?: string;
  tenant_name?: string;
  lines: { id: string; description: string; quantity: string; unit_price_ils: string; amount_ils: string }[];
}

// ─── Labels ───────────────────────────────────────────────────────────────────

const ENTITY_LABELS: Record<string, string> = {
  company: 'חברה בע"מ', self_employed: "עוסק מורשה",
  nonprofit: "עמותה", gov: "גוף ממשלתי",
};
const STATUS_LABELS: Record<string, string> = {
  trial: "ניסיון", active: "פעיל", suspended: "מושהה", cancelled: "מבוטל",
};
const STATUS_TYPE_MAP: Record<string, "active" | "trial" | "suspended" | "cancelled"> = {
  active: "active", trial: "trial", suspended: "suspended", cancelled: "cancelled",
};
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("he-IL") : "—";
const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }) : "—";

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditModalProps {
  section: SectionKey;
  initialData: Record<string, string>;
  initialValidFrom: string;
  initialValidTo: string;
  allRows: Array<{ valid_from: string; valid_to?: string }>;
  tenantId: string;
  onClose: () => void;
  onSaved: () => void;
  initialMode?: EditMode;
}

type FieldDef = {
  key: string; label: string; required?: boolean;
  type?: "text" | "email" | "select" | "checkbox" | "textarea";
  options?: { value: string; label: string }[];
  lookupKey?: string;
};

const SECTION_FIELDS: Record<SectionKey, FieldDef[]> = {
  identity: [
    { key: "name_he",       label: "שם ארגון (עברית)", required: true },
    { key: "name_en",       label: "שם ארגון (אנגלית)" },
    { key: "tax_id",        label: 'ח.פ / ע.מ',        required: true },
    { key: "entity_type",   label: "סוג ישות",           required: true, lookupKey: "entity_type" },
    { key: "industry_code", label: "ענף תעשייה" },
    { key: "logo_url",      label: "לוגו (URL)" },
  ],
  contact: [
    { key: "contact_type", label: "סוג",         required: true, lookupKey: "contact_type" },
    { key: "email",        label: "אימייל",      required: true, type: "email" },
    { key: "phone",        label: "טלפון",       required: true },
    { key: "phone_alt",    label: "טלפון נוסף" },
    { key: "contact_name", label: "איש קשר" },
    { key: "website",      label: "אתר" },
  ],
  address: [
    { key: "street",    label: "רחוב",       required: true },
    { key: "city",      label: "עיר",        required: true },
    { key: "zip_code",  label: "מיקוד" },
    { key: "country",   label: "מדינה",      required: true },
    { key: "addr_type", label: "סוג כתובת",  required: true, type: "select",
      options: [{ value: "main", label: "ראשית" }, { value: "mailing", label: "דואר" }, { value: "branch", label: "סניף" }] },
  ],
  subscription: [
    { key: "package_slug",  label: "חבילה",       required: true, lookupKey: "package" },
    { key: "billing_cycle", label: "מחזור חיוב",  required: true, type: "select",
      options: [{ value: "monthly", label: "חודשי" }, { value: "quarterly", label: "רבעוני" }, { value: "annual", label: "שנתי" }] },
    { key: "currency",      label: "מטבע",         required: true, type: "select",
      options: [{ value: "ILS", label: "₪ שקל" }, { value: "USD", label: "$ דולר" }, { value: "EUR", label: "€ יורו" }] },
    { key: "discount_pct",   label: "הנחה %" },
    { key: "is_price_locked", label: "מחיר נעול", type: "checkbox" },
  ],
  status: [
    { key: "status", label: "סטטוס", required: true, type: "select",
      options: [{ value: "trial", label: "ניסיון" }, { value: "active", label: "פעיל" }, { value: "suspended", label: "מושהה" }, { value: "cancelled", label: "מבוטל" }] },
    { key: "reason", label: "סיבת שינוי" },
    { key: "notes",  label: "הערות פנימיות", type: "textarea" },
  ],
};

const SECTION_LABELS: Record<SectionKey, string> = {
  identity: "פרטי זהות", contact: "פרטי קשר", address: "כתובת",
  subscription: "מנוי", status: "סטטוס",
};

// Action codes matching Hilan spec: ' '=הוספה, '2'=עדכון, '4'=קביעה, '3'=ביטול
type EditMode = "update" | "add" | "set" | "delete" | "close";

// ── LookupInput ───────────────────────────────────────────────────────────────

function LookupInput({ value, options, onChange }: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef  = useRef<HTMLDivElement>(null);

  const displayLabel = options.find((o) => o.value === value)?.label ?? value;

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  return (
    <div className="relative flex-1" ref={wrapRef}>
      <input
        ref={inputRef}
        readOnly
        value={displayLabel}
        onKeyDown={(e) => {
          if (e.key === "F6" || e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v) => !v); }
          if (e.key === "Escape") setOpen(false);
        }}
        onClick={() => setOpen((v) => !v)}
        className="border border-slate-300 rounded px-2 py-1 text-xs w-full focus:outline-none focus:border-blue-400 bg-white cursor-pointer select-none"
        placeholder="לחץ F6 לבחירה…"
      />
      {open && (
        <div className="absolute top-full right-0 z-[60] bg-white border border-slate-200 rounded-lg shadow-xl mt-0.5 w-full min-w-[180px] max-h-48 overflow-y-auto">
          <div className="px-2 py-1 border-b border-slate-100 text-[10px] text-slate-400">F6 / Enter / לחיצה לבחירה</div>
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-400">טוען…</div>
          ) : options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); inputRef.current?.focus(); }}
              className={`w-full text-right px-3 py-2 text-xs transition-colors
                ${value === o.value
                  ? "bg-brand-50 text-brand-700 font-semibold"
                  : "text-slate-700 hover:bg-slate-50"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── EditModal ─────────────────────────────────────────────────────────────────

function EditModal({ section, initialData, initialValidFrom, initialValidTo, allRows, tenantId, onClose, onSaved, initialMode }: EditModalProps) {
  const [mode, setMode]           = useState<EditMode>(initialMode ?? "update");
  const [form, setForm]           = useState<Record<string, string>>(initialData);
  const [validFrom, setValidFrom] = useState<string>(initialValidFrom);
  const [validTo, setValidTo]     = useState<string>(initialValidTo);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [lookupOptions, setLookupOptions] = useState<Record<string, { value: string; label: string }[]>>({});

  const fields = SECTION_FIELDS[section];

  // Fetch lookup lists needed for this section
  useEffect(() => {
    const needed = Array.from(new Set(fields.filter((f) => f.lookupKey).map((f) => f.lookupKey!)));
    needed.forEach((listKey) => {
      api.get<{ items: { item_key: string; label_he: string; is_active: boolean }[] }>(
        `/api/admin/lookups/${listKey}`
      ).then((data) => {
        const opts = data.items
          .filter((i) => i.is_active)
          .map((i) => ({ value: i.item_key, label: i.label_he }));
        setLookupOptions((prev) => ({ ...prev, [listKey]: opts }));
      }).catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  function switchToAddMode() {
    setMode("add");
    setForm(Object.fromEntries(fields.map((f) => [f.key, ""])));
    setValidFrom("");
    // Don't reset validTo
    setError(null); setDropdownOpen(false);
  }
  function switchToSetMode() {
    setMode("set");
    // keep current form data & validFrom so user only needs to adjust
    setValidTo(""); setError(null); setDropdownOpen(false);
  }
  function switchToUpdateMode() {
    setMode("update");
    setForm(initialData); setValidFrom(initialValidFrom); setValidTo(initialValidTo); setError(null);
  }
  function switchToDeleteMode() {
    setMode("delete");
    setError(null); setDropdownOpen(false);
  }
  function switchToCloseMode() {
    setMode("close");
    setValidTo(""); // User must enter the end date
    setError(null); setDropdownOpen(false);
  }

  // Helper: send section payload (needed even for delete/close — backend ignores the data)
  function buildSectionPayload() {
    const p: Record<string, string | number | boolean> = {};
    for (const f of fields) {
      if (f.type === "checkbox") {
        p[f.key] = form[f.key] === "true";
      } else {
        p[f.key] = form[f.key] ?? "";
      }
    }
    if (section === "address" && !p.addr_type) p.addr_type = "main";
    return p;
  }

  async function handleDelete() {
    setSaving(true); setError(null);
    try {
      await api.put(`/api/admin/tenants/${tenantId}`, {
        valid_from: initialValidFrom,
        action: "delete",
        [section]: buildSectionPayload(),
      });
      onSaved(); onClose();
    } catch (e: unknown) {
      const err = e as { error?: string; detail?: { error?: string } };
      setError(err?.error ?? err?.detail?.error ?? "שגיאה במחיקה");
    } finally { setSaving(false); }
  }

  async function handleClose() {
    if (!validTo) { setError("יש להזין תאריך גמר תוקף"); return; }
    setSaving(true); setError(null);
    try {
      await api.put(`/api/admin/tenants/${tenantId}`, {
        valid_to: validTo,
        action: "close",
        [section]: buildSectionPayload(),
      });
      onSaved(); onClose();
    } catch (e: unknown) {
      const err = e as { error?: string; detail?: { error?: string } };
      setError(err?.error ?? err?.detail?.error ?? "שגיאה בסגירת תקופה");
    } finally { setSaving(false); }
  }

  async function handleSave(action: "update" | "add" | "set") {
    if (!validFrom) { setError("יש להזין תאריך תוקף"); return; }
    setSaving(true); setError(null);

    // Front-end overlap check for הוספה only
    if (action === "add") {
      const d = new Date(validFrom);
      for (const row of allRows) {
        const rf = new Date(row.valid_from);
        const rt = row.valid_to ? new Date(row.valid_to) : null;
        if (d.getTime() === rf.getTime()) {
          setError(`תאריך ${validFrom} כבר קיים כתאריך תחילה של רשומה`);
          setSaving(false); return;
        }
        if (rt !== null && d > rf && d <= rt) {
          setError(`תאריך ${validFrom} נמצא בטווח רשומה קיימת (${row.valid_from} – ${row.valid_to})`);
          setSaving(false); return;
        }
      }
    }

    try {
      await api.put(`/api/admin/tenants/${tenantId}`, {
        valid_from: validFrom,
        valid_to: validTo || null,
        action,
        [section]: buildSectionPayload(),
      });
      onSaved(); onClose();
    } catch (e: unknown) {
      const err = e as { error?: string; detail?: { error?: string } };
      setError(err?.error ?? err?.detail?.error ?? "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  // Whether an active (open) row already exists — הוסף is blocked in that case
  // For contact section, multiple types can coexist so the check is skipped
  const hasActiveRow = section !== "contact" && allRows.some((r) => !r.valid_to);

  const modalTitle =
    mode === "add"    ? `רשומה חדשה — ${SECTION_LABELS[section]}`
    : mode === "set"    ? `קבע תקופה — ${SECTION_LABELS[section]}`
    : mode === "delete" ? `מחיקת שורה — ${SECTION_LABELS[section]}`
    : mode === "close"  ? `סגירת תקופה — ${SECTION_LABELS[section]}`
    : `עדכון — ${SECTION_LABELS[section]}`;

  const headerBg =
    mode === "set"    ? "bg-amber-50"  :
    mode === "delete" ? "bg-red-50"    :
    mode === "close"  ? "bg-orange-50" :
    "bg-[#dce4f0]";

  const headerText =
    mode === "set"    ? "text-amber-800"  :
    mode === "delete" ? "text-red-800"    :
    mode === "close"  ? "text-orange-800" :
    "text-[#1a3a6e]";

  const activeRow = allRows.find((r) => !r.valid_to);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4" dir="rtl"
           onClick={() => setDropdownOpen(false)}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className={`flex items-center justify-between px-5 py-3 border-b border-slate-200 rounded-t-lg ${headerBg}`}>
          <h2 className={`text-sm font-bold ${headerText}`}>
            {modalTitle}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/60 text-slate-500">
            <X size={16} />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="px-5 py-4 space-y-3">

          {/* ── מחיקה mode ──────────────────────────────────────────────── */}
          {mode === "delete" && (
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-300 rounded px-4 py-3 text-xs text-red-800 space-y-1.5">
                <div className="font-bold text-sm">⚠️ מחיקת שורה — פעולה בלתי הפיכה</div>
                <div>השורה מתאריך <strong>{fmtDate(initialValidFrom)}</strong>{initialValidTo ? ` עד ${fmtDate(initialValidTo)}` : " (פעילה)"} תימחק לחלוטין מהמאגר.</div>
                <div className="text-red-600">לא ישאר כל זכר לנתונים אלו. אם ברצונך רק לסיים את התוקף — השתמש ב<strong>סגור תקופה</strong> במקום.</div>
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">{error}</p>}
            </div>
          )}

          {/* ── סגירת תקופה mode ────────────────────────────────────────── */}
          {mode === "close" && (
            <div className="space-y-3">
              <div className="bg-orange-50 border border-orange-200 rounded px-4 py-2 text-xs text-orange-800">
                סוגרת את השורה <strong>הפעילה</strong>{activeRow ? ` (מ-${fmtDate(activeRow.valid_from)})` : ""} על ידי הגדרת תאריך גמר תוקף. השורה תישאר בהיסטוריה.
              </div>
              <div className="flex items-center gap-3 pt-1">
                <label className="text-xs font-semibold text-slate-600 w-28 shrink-0">
                  <span className="text-red-500 ml-0.5">*</span>
                  תוקף עד (אחרון)
                </label>
                <input
                  type="date" value={validTo}
                  onChange={(e) => setValidTo(e.target.value)}
                  className="border border-orange-400 bg-orange-50 rounded px-2 py-1 text-xs w-36 focus:outline-none focus:border-orange-600 font-semibold"
                />
                <span className="text-xs text-orange-700">יום אחרון שהשורה בתוקף</span>
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">{error}</p>}
            </div>
          )}

          {/* ── Normal modes (update / add / set) ───────────────────────── */}
          {(mode === "update" || mode === "add" || mode === "set") && (<>

          {/* הוסף blocked when active row exists */}
          {mode === "add" && hasActiveRow && (
            <div className="bg-blue-50 border border-blue-300 rounded px-4 py-3 text-xs text-blue-800 space-y-1">
              <div><strong>לא ניתן להוסיף רשומה חדשה</strong> — קיימת רשומה פעילה ללא תאריך סיום.</div>
              <div>לפתיחת תקופה חדשה: חזור ל<strong>שמור</strong> ושנה את תאריך התחילה לתאריך העתידי הרצוי — המערכת תסגור אוטומטית את הרשומה הנוכחית ותפתח חדשה.</div>
              <div className="text-blue-600">לחלופין, השתמש ב<strong>סגור תקופה</strong> כדי להוסיף תאריך סיום לרשומה הפעילה, ואז תוכל להוסיף רשומה חדשה.</div>
            </div>
          )}
          {/* Section fields — hidden in add mode when blocked */}
          <div className={`space-y-3 ${mode === "add" && hasActiveRow ? "hidden" : ""}`}>
            {fields.map((f) => (
              <div key={f.key} className="flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-600 w-28 shrink-0">
                  {f.required && <span className="text-red-500 ml-0.5">*</span>}
                  {f.label}
                </label>
                {f.lookupKey ? (
                  <LookupInput
                    value={form[f.key] ?? ""}
                    options={lookupOptions[f.lookupKey] ?? []}
                    onChange={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
                  />
                ) : f.type === "checkbox" ? (
                  <input
                    type="checkbox"
                    checked={form[f.key] === "true"}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: String(e.target.checked) }))}
                    className="w-4 h-4 rounded border-slate-300 text-brand-600"
                  />
                ) : f.type === "textarea" ? (
                  <textarea
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    rows={2}
                    className="border border-slate-300 rounded px-2 py-1 text-xs flex-1 focus:outline-none focus:border-blue-400 resize-none"
                  />
                ) : f.type === "select" && f.options ? (
                  <select
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    className="border border-slate-300 rounded px-2 py-1 text-xs flex-1 focus:outline-none focus:border-blue-400 bg-white"
                  >
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.type ?? "text"}
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    className="border border-slate-300 rounded px-2 py-1 text-xs flex-1 focus:outline-none focus:border-blue-400"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Date fields — hidden in add mode when blocked */}
          <div className={`border-t border-slate-200 pt-3 space-y-2 ${mode === "add" && hasActiveRow ? "hidden" : ""}`}>
            {/* valid_from */}
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-600 w-28 shrink-0">
                <span className="text-red-500 ml-0.5">*</span>
                {mode === "set" ? "תוקף מתאריך" : "תוקף מתאריך"}
              </label>
              <input
                type="date" value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                className={`border rounded px-2 py-1 text-xs w-36 focus:outline-none focus:border-blue-400
                  ${mode === "add" ? "border-amber-400 bg-amber-50 font-semibold"
                  : mode === "set" ? "border-amber-400 bg-amber-50 font-semibold"
                  : "border-slate-300"}`}
              />
              {mode === "add" && <span className="text-xs text-amber-700 font-medium">תאריך תחילת תוקף חדש</span>}
              {mode === "set" && <span className="text-xs text-amber-700 font-medium">תחילת תקופת הקביעה</span>}
            </div>
            {/* valid_to — optional end date for all modes */}
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-600 w-28 shrink-0">
                תוקף עד (אופציונלי)
              </label>
              <input
                type="date" value={validTo}
                onChange={(e) => setValidTo(e.target.value)}
                className={`border rounded px-2 py-1 text-xs w-36 focus:outline-none focus:border-blue-400
                  ${mode === "set" ? "border-amber-300 bg-amber-50" : "border-slate-300"}`}
              />
              {!validTo && <span className="text-xs text-slate-400">ריק = ללא תאריך סיום</span>}
              {validTo && <span className="text-xs text-blue-600 cursor-pointer hover:underline"
                onClick={() => setValidTo("")}>✕ נקה</span>}
            </div>
          </div>

          {/* קביעה warning */}
          {mode === "set" && (
            <div className="bg-amber-50 border border-amber-300 rounded px-3 py-2 text-xs text-amber-800">
              ⚠️ <strong>קביעה</strong> — פעולה חזקה: תחליף / תפצל / תמחק כל רשומה חופפת בתקופה המדווחת.
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">{error}</p>
          )}

          </>)} {/* end normal modes */}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-lg">
          {mode === "delete" ? (
            <>
              <button onClick={switchToUpdateMode}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded text-slate-600 hover:bg-slate-100 transition-colors">
                ← ביטול
              </button>
              <button onClick={handleDelete} disabled={saving}
                className="px-4 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50 font-semibold">
                {saving ? "מוחק..." : "מחק לצמיתות"}
              </button>
            </>
          ) : mode === "close" ? (
            <>
              <button onClick={switchToUpdateMode}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded text-slate-600 hover:bg-slate-100 transition-colors">
                ← ביטול
              </button>
              <button onClick={handleClose} disabled={saving}
                className="px-4 py-1.5 text-xs bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors disabled:opacity-50">
                {saving ? "שומר..." : "סגור תקופה"}
              </button>
            </>
          ) : mode === "add" ? (
            <>
              <button onClick={switchToUpdateMode}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded text-slate-600 hover:bg-slate-100 transition-colors">
                ← חזרה לשמור
              </button>
              <button onClick={onClose}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded text-slate-600 hover:bg-slate-100 transition-colors">
                ביטול
              </button>
              {!hasActiveRow && (
                <button onClick={() => handleSave("add")} disabled={saving}
                  className="px-4 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50">
                  {saving ? "שומר..." : "הוסף"}
                </button>
              )}
            </>
          ) : mode === "set" ? (
            <>
              <button onClick={switchToUpdateMode}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded text-slate-600 hover:bg-slate-100 transition-colors">
                ← חזרה לשמור
              </button>
              <button onClick={onClose}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded text-slate-600 hover:bg-slate-100 transition-colors">
                ביטול
              </button>
              <button onClick={() => handleSave("set")} disabled={saving}
                className="px-4 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors disabled:opacity-50">
                {saving ? "שומר..." : "קבע"}
              </button>
            </>
          ) : (
            /* עדכון mode — split button [שמור | ▾] */
            <>
              <button onClick={onClose}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded text-slate-600 hover:bg-slate-100 transition-colors">
                ביטול
              </button>
              <div className="relative flex">
                <button
                  onClick={(e) => { e.stopPropagation(); handleSave("update"); }}
                  disabled={saving}
                  className="px-4 py-1.5 text-xs bg-[#0d6efd] hover:bg-[#0b5ed7] text-white rounded-r transition-colors disabled:opacity-50 border-l border-blue-400">
                  {saving ? "שומר..." : "שמור"}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setDropdownOpen((o) => !o); }}
                  disabled={saving}
                  className="px-2 py-1.5 text-xs bg-[#0d6efd] hover:bg-[#0b5ed7] text-white rounded-l transition-colors disabled:opacity-50">
                  ▾
                </button>
                {dropdownOpen && (
                  <div className="absolute bottom-full left-0 mb-1 bg-white border border-slate-200 rounded shadow-lg z-10 min-w-[150px] text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); switchToAddMode(); }}
                      disabled={hasActiveRow}
                      title={hasActiveRow ? "קיימת רשומה פעילה — השתמש בשמור עם תאריך עתידי" : undefined}
                      className={`w-full px-4 py-2 text-xs text-right block border-b border-slate-100
                        ${hasActiveRow
                          ? "text-slate-400 cursor-not-allowed bg-slate-50"
                          : "text-slate-700 hover:bg-blue-50"}`}>
                      רשומה חדשה
                      {hasActiveRow && <span className="block text-[10px] text-slate-400 leading-tight">קיימת רשומה פעילה</span>}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); handleSave("update"); }}
                      className="w-full px-4 py-2 text-xs text-slate-700 hover:bg-blue-50 text-right block border-b border-slate-100">
                      שמור
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); switchToSetMode(); }}
                      className="w-full px-4 py-2 text-xs text-amber-700 hover:bg-amber-50 text-right block font-medium border-b border-slate-100">
                      קבע תקופה
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); switchToCloseMode(); }}
                      disabled={!hasActiveRow}
                      title={!hasActiveRow ? "אין שורה פעילה לסגירה" : undefined}
                      className={`w-full px-4 py-2 text-xs text-right block border-b border-slate-100
                        ${!hasActiveRow ? "text-slate-400 cursor-not-allowed" : "text-orange-700 hover:bg-orange-50"}`}>
                      סגור תקופה
                      {!hasActiveRow && <span className="block text-[10px] text-slate-400 leading-tight">אין שורה פעילה</span>}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); switchToDeleteMode(); }}
                      className="w-full px-4 py-2 text-xs text-red-700 hover:bg-red-50 text-right block font-medium">
                      מחק שורה זו
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Parent form ──────────────────────────────────────────────────────────────

function LogoUpload({ tenantId, logoUrl, onUploaded }: {
  tenantId: string;
  logoUrl?: string;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview]     = useState<string | undefined>(logoUrl);
  const [errMsg,  setErrMsg]      = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErrMsg(null);

    // 1. Show instant local preview while uploading
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    try {
      const ext  = file.name.split(".").pop() ?? "png";
      const path = `tenants/${tenantId}/logo.${ext}`;

      // 2. Ensure the bucket exists (create if missing)
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some((b) => b.name === "logos");
      if (!bucketExists) {
        await supabase.storage.createBucket("logos", { public: true });
      }

      // 3. Upload file
      const { error: upErr } = await supabase.storage
        .from("logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      // 4. Get public URL and notify parent
      const { data } = supabase.storage.from("logos").getPublicUrl(path);
      const publicUrl = data.publicUrl + `?t=${Date.now()}`;
      setPreview(publicUrl);
      onUploaded(publicUrl);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "שגיאה בהעלאה";
      setErrMsg(msg);
      setPreview(logoUrl); // revert to original
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <div
        className="relative group cursor-pointer"
        onClick={() => !uploading && inputRef.current?.click()}
        title="לחץ להעלאת לוגו"
      >
        {/* Logo box */}
        <div className="w-[88px] h-[88px] rounded-xl border-2 border-dashed border-slate-300 bg-slate-50
                        flex items-center justify-center overflow-hidden
                        group-hover:border-brand-400 transition-colors">
          {preview ? (
            <img src={preview} alt="לוגו" className="w-full h-full object-contain p-1.5" />
          ) : (
            <Building2 size={30} className="text-slate-300" />
          )}
        </div>

        {/* Spinner overlay while uploading */}
        {uploading && (
          <div className="absolute inset-0 rounded-xl bg-white/75 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Camera icon on hover (when not uploading) */}
        {!uploading && (
          <div className="absolute inset-0 rounded-xl bg-black/25 flex items-center justify-center
                          opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera size={20} className="text-white drop-shadow" />
          </div>
        )}

        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>

      {/* Caption / error */}
      {errMsg ? (
        <p className="text-[10px] text-red-500 text-center leading-tight max-w-[88px]">{errMsg}</p>
      ) : (
        <p className="text-[10px] text-slate-400 text-center leading-tight">
          {uploading ? "מעלה…" : "לחץ להעלאת לוגו"}
        </p>
      )}
    </div>
  );
}

function ParentForm({ tenant, onLogoUploaded }: { tenant: TenantOut; onLogoUploaded: (url: string) => void }) {
  const statusVal = tenant.status?.status ?? "trial";
  const statusLabel = STATUS_LABELS[statusVal] ?? statusVal;
  const statusCfg = {
    active:    { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50/70", border: "border-emerald-200" },
    trial:     { dot: "bg-amber-400",   text: "text-amber-700",   bg: "bg-amber-50/70",   border: "border-amber-200"  },
    suspended: { dot: "bg-red-500",     text: "text-red-700",     bg: "bg-red-50/70",     border: "border-red-200"    },
    cancelled: { dot: "bg-slate-400",   text: "text-slate-500",   bg: "bg-slate-100/70",  border: "border-slate-200"  },
  }[statusVal as "active" | "trial" | "suspended" | "cancelled"] ?? { dot: "bg-slate-400", text: "text-slate-500", bg: "bg-slate-100/70", border: "border-slate-200" };

  return (
    <div className="flex items-start gap-5 px-5 py-4 bg-gradient-to-l from-slate-50 to-white border-b border-slate-200">

      {/* Logo upload */}
      <LogoUpload
        tenantId={tenant.tenant_id}
        logoUrl={tenant.identity?.logo_url}
        onUploaded={onLogoUploaded}
      />

      {/* Divider */}
      <div className="self-stretch w-px bg-slate-200 shrink-0" />

      {/* Fields */}
      <div className="flex-1 min-w-0">
        {/* Org name + status */}
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-xl font-bold text-navy-500 leading-tight">
            {tenant.identity?.name_he ?? "—"}
          </h2>
          {tenant.identity?.name_en && (
            <span className="text-sm text-slate-400 font-normal">{tenant.identity.name_en}</span>
          )}
          <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border mr-auto ${statusCfg.bg} ${statusCfg.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
            <span className={statusCfg.text}>{statusLabel}</span>
          </span>
        </div>

        {/* Detail fields grid */}
        <div className="grid grid-cols-4 gap-x-6 gap-y-1.5">
          <FormField label="מ.ארגון"   value={String(tenant.org_number)}                                                       readOnly />
          <FormField label="ח.פ / ע.מ" required value={tenant.identity?.tax_id}                                                readOnly />
          <FormField label="סוג ישות"  required value={ENTITY_LABELS[tenant.identity?.entity_type ?? ""] ?? tenant.identity?.entity_type} readOnly />
          <FormField label="תוקף מ"    value={tenant.identity?.valid_from ? new Date(tenant.identity.valid_from).toLocaleDateString("he-IL") : "—"} readOnly />
        </div>

        {/* Audit row */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 pt-2.5 border-t border-slate-200">
          {tenant.created_at && (
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-slate-400">נפתח:</span>
              <span className="font-medium text-slate-600">{fmtDateTime(tenant.created_at)}</span>
              {tenant.created_by && <span className="text-slate-500">ע&quot;י <span className="font-semibold">{tenant.created_by}</span></span>}
            </div>
          )}
          {tenant.updated_at && (
            <>
              <div className="w-px h-3 bg-slate-200 shrink-0" />
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-slate-400">עודכן:</span>
                <span className="font-medium text-slate-600">{fmtDateTime(tenant.updated_at)}</span>
                {tenant.updated_by && <span className="text-slate-500">ע&quot;י <span className="font-semibold">{tenant.updated_by}</span></span>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Child tab builders ───────────────────────────────────────────────────────

// Sort: current row (no valid_to) first, then by valid_from descending
function sortRows<T extends { valid_from: string; valid_to?: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aCurrent = !a.valid_to ? 1 : 0;
    const bCurrent = !b.valid_to ? 1 : 0;
    if (aCurrent !== bCurrent) return bCurrent - aCurrent; // current first
    return new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime();
  });
}

function buildIdentityTab(rows: TenantIdentityOut[], onDblClick: (i: number) => void): ChildTab {
  const sorted = sortRows(rows);
  return {
    id: "identity", label: "פרטי זהות",
    columns: [
      { key: "valid_from",  label: "תוקף מ",       required: true },
      { key: "valid_to",    label: "תוקף עד" },
      { key: "name_he",     label: "שם ארגון",      required: true },
      { key: "name_en",     label: "שם באנגלית" },
      { key: "tax_id",      label: "ח.פ",           required: true },
      { key: "entity_type", label: "סוג ישות",      required: true },
      { key: "created_at",  label: "תאריך שינוי" },
      { key: "created_by",  label: "בוצע ע\"י" },
    ],
    rows: sorted.map((r) => ({
      valid_from:  fmtDate(r.valid_from),
      valid_to:    r.valid_to ? fmtDate(r.valid_to) : "—",
      name_he:     r.name_he,
      name_en:     r.name_en ?? "—",
      tax_id:      r.tax_id,
      entity_type: ENTITY_LABELS[r.entity_type] ?? r.entity_type,
      created_at:  fmtDateTime(r.created_at),
      created_by:  r.created_by ?? "—",
      _current:    !r.valid_to,
    })),
    onRowDoubleClick: (i) => onDblClick(rows.indexOf(sorted[i])),
  };
}

const CONTACT_TYPE_LABELS: Record<string, string> = {
  main: "ראשי", billing: "חשבונאות", technical: "טכני", other: "אחר",
};

function buildContactTab(rows: TenantContactOut[], onDblClick: (i: number) => void): ChildTab {
  const sorted = sortRows(rows);
  return {
    id: "contact", label: "פרטי קשר",
    columns: [
      { key: "valid_from",    label: "תוקף מ",   required: true },
      { key: "valid_to",      label: "תוקף עד" },
      { key: "contact_type",  label: "סוג",      required: true },
      { key: "email",         label: "אימייל",   required: true },
      { key: "phone",         label: "טלפון",    required: true },
      { key: "contact_name",  label: "איש קשר" },
      { key: "website",       label: "אתר" },
      { key: "created_at",    label: "תאריך שינוי" },
      { key: "created_by",    label: "בוצע ע\"י" },
    ],
    rows: sorted.map((r) => ({
      valid_from:   fmtDate(r.valid_from),
      valid_to:     r.valid_to ? fmtDate(r.valid_to) : "—",
      contact_type: CONTACT_TYPE_LABELS[r.contact_type] ?? r.contact_type,
      email:        r.email,
      phone:        r.phone,
      contact_name: r.contact_name ?? "—",
      website:      r.website ?? "—",
      created_at:   fmtDateTime(r.created_at),
      created_by:   r.created_by ?? "—",
      _current:     !r.valid_to,
    })),
    onRowDoubleClick: (i) => onDblClick(rows.indexOf(sorted[i])),
  };
}

function buildAddressTab(rows: TenantAddressOut[], onDblClick: (i: number) => void): ChildTab {
  const sorted = sortRows(rows);
  return {
    id: "address", label: "כתובת",
    columns: [
      { key: "valid_from", label: "תוקף מ",  required: true },
      { key: "valid_to",   label: "תוקף עד" },
      { key: "street",     label: "רחוב",    required: true },
      { key: "city",       label: "עיר",     required: true },
      { key: "zip_code",   label: "מיקוד" },
      { key: "country",    label: "מדינה",   required: true },
      { key: "created_at", label: "תאריך שינוי" },
      { key: "created_by", label: "בוצע ע\"י" },
    ],
    rows: sorted.map((r) => ({
      valid_from: fmtDate(r.valid_from),
      valid_to:   r.valid_to ? fmtDate(r.valid_to) : "—",
      street:     r.street,
      city:       r.city,
      zip_code:   r.zip_code ?? "—",
      country:    r.country,
      created_at: fmtDateTime(r.created_at),
      created_by: r.created_by ?? "—",
      _current:   !r.valid_to,
    })),
    onRowDoubleClick: (i) => onDblClick(rows.indexOf(sorted[i])),
  };
}

function buildSubscriptionTab(rows: TenantSubscriptionOut[], onDblClick: (i: number) => void): ChildTab {
  const sorted = sortRows(rows);
  return {
    id: "subscription", label: "מנוי",
    columns: [
      { key: "valid_from",    label: "תוקף מ",       required: true },
      { key: "valid_to",      label: "תוקף עד" },
      { key: "package_slug",  label: "חבילה",        required: true },
      { key: "billing_cycle", label: "מחזור חיוב",   required: true },
      { key: "currency",      label: "מטבע",         required: true },
      { key: "discount_pct",  label: "הנחה %" },
      { key: "created_at",    label: "תאריך שינוי" },
      { key: "created_by",    label: "בוצע ע\"י" },
    ],
    rows: sorted.map((r) => ({
      valid_from:    fmtDate(r.valid_from),
      valid_to:      r.valid_to ? fmtDate(r.valid_to) : "—",
      package_slug:  r.package_slug,
      billing_cycle: r.billing_cycle,
      currency:      r.currency,
      discount_pct:  `${r.discount_pct}%`,
      created_at:    fmtDateTime(r.created_at),
      created_by:    r.created_by ?? "—",
      _current:      !r.valid_to,
    })),
    onRowDoubleClick: (i) => onDblClick(rows.indexOf(sorted[i])),
  };
}

function buildStatusTab(rows: TenantStatusOut[], onDblClick: (i: number) => void): ChildTab {
  const sorted = sortRows(rows);
  return {
    id: "status", label: "סטטוס",
    columns: [
      { key: "valid_from", label: "תוקף מ",  required: true },
      { key: "valid_to",   label: "תוקף עד" },
      { key: "status",     label: "סטטוס",   required: true },
      { key: "reason",     label: "סיבה" },
      { key: "created_at", label: "תאריך שינוי" },
      { key: "created_by", label: "בוצע ע\"י" },
    ],
    rows: sorted.map((r) => ({
      valid_from: fmtDate(r.valid_from),
      valid_to:   r.valid_to ? fmtDate(r.valid_to) : "—",
      status:     STATUS_LABELS[r.status] ?? r.status,
      reason:     r.reason ?? "—",
      created_at: fmtDateTime(r.created_at),
      created_by: r.created_by ?? "—",
      _current:   !r.valid_to,
    })),
    onRowDoubleClick: (i) => onDblClick(rows.indexOf(sorted[i])),
  };
}

// ─── Billing helpers ──────────────────────────────────────────────────────────

const ILS_MONTHS_SHORT = ["","ינו","פבר","מרץ","אפר","מאי","יוני","יול","אוג","ספט","אוק","נוב","דצמ"];

const CHARGE_STATUS_CFG: Record<string, { label: string; cls: string; dot: string }> = {
  pending:   { label: "ממתין",  cls: "bg-amber-50 text-amber-700",  dot: "bg-amber-400" },
  invoiced:  { label: "חויב",   cls: "bg-blue-50 text-blue-700",    dot: "bg-blue-500" },
  cancelled: { label: "מבוטל",  cls: "bg-slate-100 text-slate-500", dot: "bg-slate-400" },
};
const INVOICE_STATUS_CFG: Record<string, { label: string; cls: string; dot: string }> = {
  draft:     { label: "טיוטה",  cls: "bg-slate-100 text-slate-600",    dot: "bg-slate-400" },
  sent:      { label: "נשלח",   cls: "bg-blue-50 text-blue-700",       dot: "bg-blue-500" },
  paid:      { label: "שולם",   cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  overdue:   { label: "בפיגור", cls: "bg-red-50 text-red-700",         dot: "bg-red-500" },
  cancelled: { label: "מבוטל",  cls: "bg-slate-100 text-slate-500",    dot: "bg-slate-400" },
};

function BillingStatusBadge({ cfg }: { cfg: { label: string; cls: string; dot: string } }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

const fmtIls = (v: string | number) =>
  `₪${parseFloat(String(v)).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CHARGE_TYPE_LABELS: Record<string, string> = {
  base_fee: "דמי מנוי", per_seat: "לפי מושב",
  setup_fee: "דמי הקמה", addon: "תוספת", credit: "זיכוי", manual: "ידני",
};

function periodShort(p: string) {
  const [y, m] = p.split("-");
  return `${ILS_MONTHS_SHORT[parseInt(m)]} ${y}`;
}

// ─── Tenant Invoice Detail Modal ──────────────────────────────────────────────

function InvoiceViewModal({
  invoice: initial, onClose, onUpdated,
}: { invoice: TenantInvoiceItem; onClose: () => void; onUpdated: () => void }) {
  const [inv, setInv]         = useState<TenantInvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [showPaid, setShowPaid] = useState(false);
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payRef,  setPayRef]  = useState("");

  useEffect(() => {
    api.get<TenantInvoiceDetail>(`/api/admin/billing/invoices/${initial.id}`)
      .then(setInv).catch(console.error).finally(() => setLoading(false));
  }, [initial.id]);

  async function doAction(path: string, body: object) {
    setSaving(true); setError(null);
    try {
      await api.post(path, body);
      onUpdated();
    } catch (e: unknown) {
      const err = e as { error?: string; detail?: { error?: string } };
      setError(err?.error ?? err?.detail?.error ?? "שגיאה");
    } finally { setSaving(false); }
  }

  const st = INVOICE_STATUS_CFG[initial.status] ?? INVOICE_STATUS_CFG.draft;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl mx-4 max-h-[90vh] flex flex-col" dir="rtl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50 rounded-t-lg shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-800">{initial.invoice_number}</span>
            <BillingStatusBadge cfg={st} />
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-200 text-slate-500"><X size={16} /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : inv ? (
          <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div><p className="text-slate-400 mb-0.5">תקופה</p><p className="font-medium">{periodShort(inv.billing_period)}</p></div>
              <div><p className="text-slate-400 mb-0.5">הנפקה</p><p className="font-medium">{fmtDate(inv.issue_date)}</p></div>
              <div><p className="text-slate-400 mb-0.5">לתשלום עד</p>
                <p className={`font-medium ${inv.status === "overdue" ? "text-red-600" : ""}`}>{fmtDate(inv.due_date)}</p></div>
              {inv.payment_date && (
                <div><p className="text-slate-400 mb-0.5">תאריך תשלום</p><p className="font-medium text-emerald-700">{fmtDate(inv.payment_date)}</p></div>
              )}
              {inv.payment_ref && (
                <div><p className="text-slate-400 mb-0.5">אסמכתא</p><p className="font-medium">{inv.payment_ref}</p></div>
              )}
            </div>

            <div className="border border-slate-200 rounded-md overflow-hidden">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="text-right px-3 py-2 bg-slate-100 border-b border-slate-200 font-semibold text-slate-600">תיאור</th>
                    <th className="text-right px-3 py-2 bg-slate-100 border-b border-slate-200 font-semibold text-slate-600 w-28">סכום</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.lines.map((line, i) => (
                    <tr key={line.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                      <td className="px-3 py-1.5 border-b border-slate-100 text-slate-700">{line.description}</td>
                      <td className="px-3 py-1.5 border-b border-slate-100 font-medium tabular-nums text-left">{fmtIls(line.amount_ils)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded px-3 py-2 space-y-1 text-xs max-w-xs mr-auto">
              <div className="flex justify-between text-slate-600">
                <span className="tabular-nums">{fmtIls(inv.subtotal_ils)}</span><span>לפני מע&quot;מ</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="tabular-nums">{fmtIls(inv.vat_ils)}</span><span>מע&quot;מ ({inv.vat_pct}%)</span>
              </div>
              <div className="flex justify-between font-bold text-slate-800 border-t border-slate-200 pt-1">
                <span className="tabular-nums">{fmtIls(inv.total_ils)}</span><span>סה&quot;כ</span>
              </div>
            </div>

            {showPaid && (
              <div className="border border-emerald-200 bg-emerald-50 rounded px-4 py-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">תאריך תשלום</label>
                    <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:border-brand-400 text-right" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">אסמכתא</label>
                    <input type="text" value={payRef} onChange={(e) => setPayRef(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:border-brand-400 text-right" />
                  </div>
                </div>
                <button onClick={() => doAction(`/api/admin/billing/invoices/${initial.id}/mark-paid`, { payment_date: payDate, payment_ref: payRef || null })}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold disabled:opacity-50">
                  <CheckCircle2 size={12} /> {saving ? "שומר..." : "אישור תשלום"}
                </button>
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
          <div className="flex gap-2 px-5 py-3 border-t border-slate-200 shrink-0 flex-row-reverse">
            {inv.status === "draft" && (
              <button onClick={() => doAction(`/api/admin/billing/invoices/${initial.id}/finalize`, {})}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold disabled:opacity-50">
                <Send size={12} /> שלח ללקוח
              </button>
            )}
            {(inv.status === "sent" || inv.status === "overdue") && !showPaid && (
              <button onClick={() => setShowPaid(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold">
                <CheckCircle2 size={12} /> סמן כשולם
              </button>
            )}
            <button onClick={onClose}
              className="px-4 py-1.5 text-xs border border-slate-300 bg-white text-slate-600 rounded hover:bg-slate-50">
              סגור
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers to extract raw data for pre-filling the edit form ────────────────

function getRawFields(section: SectionKey, item: TenantIdentityOut | TenantContactOut | TenantAddressOut | TenantSubscriptionOut | TenantStatusOut): Record<string, string> {
  const r = item as unknown as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(r)
      .filter(([k]) => !["id", "tenant_id", "valid_from", "valid_to", "created_at", "created_by", "updated_at", "updated_by"].includes(k))
      .map(([k, v]) => [k, String(v ?? "")])
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TenantDetailPage() {
  const router  = useRouter();
  const { id }  = useParams<{ id: string }>();
  const [tenant,  setTenant]  = useState<TenantOut | null>(null);
  const [history, setHistory] = useState<TenantHistory | null>(null);
  const [billing, setBilling] = useState<TenantBillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBillingInvoice, setSelectedBillingInvoice] = useState<TenantInvoiceItem | null>(null);
  const [editState, setEditState] = useState<{
    section: SectionKey;
    data: Record<string, string>;
    initialValidFrom: string;
    initialValidTo: string;
    allRows: Array<{ valid_from: string; valid_to?: string }>;
    initialMode?: EditMode;
  } | null>(null);

  function loadData() {
    setLoading(true);
    Promise.all([
      api.get<TenantOut>(`/api/admin/tenants/${id}`),
      api.get<TenantHistory>(`/api/admin/tenants/${id}/history`),
      api.get<TenantBillingSummary>(`/api/admin/tenants/${id}/billing`).catch(() => null),
    ])
      .then(([t, h, b]) => { setTenant(t); setHistory(h); setBilling(b); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    loadData();
  }, [id, router]);

  function openEdit(section: SectionKey, index: number) {
    if (!history) return;
    const items = history[section] as (TenantIdentityOut | TenantContactOut | TenantAddressOut | TenantSubscriptionOut | TenantStatusOut)[];
    const item = items[index];
    if (!item) return;
    setEditState({
      section,
      data: getRawFields(section, item),
      initialValidFrom: item.valid_from,
      initialValidTo: item.valid_to ?? "",
      allRows: items.map((r) => ({ valid_from: r.valid_from, valid_to: r.valid_to })),
    });
  }

  function openAddNew(section: SectionKey) {
    const fields = SECTION_FIELDS[section];
    const items = history ? (history[section] as Array<{ valid_from: string; valid_to?: string }>) : [];
    setEditState({
      section,
      data: Object.fromEntries(fields.map((f) => [f.key, ""])),
      initialValidFrom: "",
      initialValidTo: "",
      allRows: items.map((r) => ({ valid_from: r.valid_from, valid_to: r.valid_to })),
      initialMode: "add",
    });
  }

  const statusVal = tenant?.status?.status ?? "trial";

  // ── Billing child tabs ────────────────────────────────────────────────────
  const billingChargesTab: ChildTab = {
    id: "billing_charges",
    label: "חיובים",
    columns: [
      { key: "period",   label: "תקופה" },
      { key: "module",   label: "מודול" },
      { key: "type",     label: "סוג" },
      { key: "desc",     label: "תיאור" },
      { key: "discount", label: "הנחה%" },
      { key: "amount",   label: "לחיוב" },
      { key: "status",   label: "סטטוס" },
    ],
    rows: (billing?.charges ?? []).map((c) => {
      const stCfg = CHARGE_STATUS_CFG[c.status] ?? CHARGE_STATUS_CFG.pending;
      return {
        period:   periodShort(c.billing_period),
        module:   c.module_name ?? c.charge_type,
        type:     CHARGE_TYPE_LABELS[c.charge_type] ?? c.charge_type,
        desc:     c.description,
        discount: parseFloat(c.discount_pct) > 0 ? `${c.discount_pct}%` : "—",
        amount:   <span className="tabular-nums font-semibold">{fmtIls(c.amount_after_discount_ils)}</span>,
        status:   <BillingStatusBadge cfg={stCfg} />,
      };
    }),
    emptyMessage: "אין חיובים — ניתן ליצור מדף ניהול חיובים",
  };

  const billingInvoicesTab: ChildTab = {
    id: "billing_invoices",
    label: "חשבוניות",
    columns: [
      { key: "number",  label: "מס׳ חשבונית" },
      { key: "period",  label: "תקופה" },
      { key: "issued",  label: "הנפקה" },
      { key: "due",     label: "לתשלום עד" },
      { key: "total",   label: "סה״כ" },
      { key: "status",  label: "סטטוס" },
    ],
    rows: (billing?.invoices ?? []).map((inv) => {
      const stCfg = INVOICE_STATUS_CFG[inv.status] ?? INVOICE_STATUS_CFG.draft;
      return {
        number: <span className="font-bold text-brand-700">{inv.invoice_number}</span>,
        period: periodShort(inv.billing_period),
        issued: fmtDate(inv.issue_date),
        due:    <span className={inv.status === "overdue" ? "text-red-600 font-medium" : ""}>{fmtDate(inv.due_date)}</span>,
        total:  <span className="tabular-nums font-semibold">{fmtIls(inv.total_ils)}</span>,
        status: <BillingStatusBadge cfg={stCfg} />,
      };
    }),
    onRowDoubleClick: (i) => {
      const inv = billing?.invoices[i];
      if (inv) setSelectedBillingInvoice(inv);
    },
    emptyMessage: "אין חשבוניות — ניתן ליצור מדף ניהול חיובים",
  };

  const childTabs: ChildTab[] = history ? [
    { ...buildIdentityTab(history.identity,         (i) => openEdit("identity",     i)), onAddClick: () => openAddNew("identity") },
    { ...buildContactTab(history.contact,           (i) => openEdit("contact",      i)), onAddClick: () => openAddNew("contact") },
    { ...buildAddressTab(history.address,           (i) => openEdit("address",      i)), onAddClick: () => openAddNew("address") },
    { ...buildSubscriptionTab(history.subscription, (i) => openEdit("subscription", i)), onAddClick: () => openAddNew("subscription") },
    { ...buildStatusTab(history.status,             (i) => openEdit("status",       i)), onAddClick: () => openAddNew("status") },
    billingChargesTab,
    billingInvoicesTab,
  ] : [];

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <TopNav />
      <main className="flex-1 overflow-hidden">
        <CardPage
          title="כרטיס ארגון"
          backHref="/admin/tenants"
          backLabel="ניהול ארגונים"
          status={
            tenant
              ? { label: STATUS_LABELS[statusVal] ?? statusVal, type: STATUS_TYPE_MAP[statusVal] ?? "trial" }
              : undefined
          }
          onNew={() => router.push("/admin/tenants/new")}
          primaryActions={[]}
          parentContent={tenant ? (
            <ParentForm
              tenant={tenant}
              onLogoUploaded={(url) => {
                setTenant((prev) => prev && prev.identity
                  ? { ...prev, identity: { ...prev.identity, logo_url: url } }
                  : prev
                );
              }}
            />
          ) : undefined}
          formTabs={[]}
          childTabs={childTabs}
          loading={loading}
        />
      </main>

      {editState && tenant && (
        <EditModal
          section={editState.section}
          initialData={editState.data}
          initialValidFrom={editState.initialValidFrom}
          initialValidTo={editState.initialValidTo}
          allRows={editState.allRows}
          tenantId={tenant.tenant_id}
          onClose={() => setEditState(null)}
          onSaved={loadData}
          initialMode={editState.initialMode}
        />
      )}

      {selectedBillingInvoice && (
        <InvoiceViewModal
          invoice={selectedBillingInvoice}
          onClose={() => setSelectedBillingInvoice(null)}
          onUpdated={() => { setSelectedBillingInvoice(null); loadData(); }}
        />
      )}
    </div>
  );
}
