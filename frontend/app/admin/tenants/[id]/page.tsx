"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { ApiRequestError, isLoggedIn, api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { TopNav } from "@/components/layout/TopNav";
import { CardPage, type ChildTab } from "@/components/layout/CardPage";
import { FormField } from "@/components/ui/FormField";
import { HebrewDatePicker } from "@/components/ui/HebrewDatePicker";
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
  id: string; billing_cycle: string; currency: string;
  template_id?: string; seat_count: number; selected_module_slugs: string[];
  discount_pct: string; is_price_locked: boolean; next_renewal_at?: string;
  valid_from: string; valid_to?: string;
}
interface TenantSubscriptionModuleOut extends AuditFields {
  id: string;
  tenant_subscription_id: string;
  module_slug: string;
  source_type: "template" | "manual";
  status: "active" | "removed";
  seats: number;
  pricing_mode: "catalog" | "override";
  override_base_price_ils?: string | null;
  override_per_seat_ils?: string | null;
  override_setup_fee_ils?: string | null;
  override_included_seats?: number | null;
  price_lock_reason?: string | null;
  notes?: string | null;
  valid_from: string;
  valid_to?: string | null;
}
interface TenantStatusOut extends AuditFields {
  id: string; status: string; reason?: string; notes?: string;
  valid_from: string; valid_to?: string;
}
interface TenantOut extends AuditFields {
  tenant_id: string; org_number: number; created_at: string;
  updated_at?: string; created_by?: string; updated_by?: string;
  identity?: TenantIdentityOut; contact?: TenantContactOut;
  address?: TenantAddressOut; subscription?: TenantSubscriptionOut; subscription_modules?: TenantSubscriptionModuleOut[]; status?: TenantStatusOut;
}
interface TenantHistory {
  identity: TenantIdentityOut[]; contact: TenantContactOut[];
  address: TenantAddressOut[]; subscription: TenantSubscriptionOut[]; subscription_modules: TenantSubscriptionModuleOut[]; status: TenantStatusOut[];
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

interface SeatChangeLogItem {
  id: string;
  subscription_module_id: string;
  module_slug: string;
  old_seats: number;
  new_seats: number;
  effective_date: string;
  billed: boolean;
  billing_period?: string | null;
  proration_charge_id?: string | null;
  created_at: string;
}

interface TenantInvoiceDetail extends TenantInvoiceItem {
  vat_pct: string; discount_ils: string; notes?: string; payment_ref?: string;
  tenant_name?: string;
  lines: { id: string; description: string; quantity: string; unit_price_ils: string; amount_ils: string }[];
}

interface TemplatePricingSummary {
  seat_count: number;
  modules_count: number;
  recurring_after_discount_ils: string;
  setup_after_discount_ils: string;
  total_after_discount_ils: string;
}

interface TemplateOption {
  id: string;
  name: string;
  description?: string | null;
  default_billing_cycle: string;
  module_slugs: string[];
  discount_pct: string;
  seat_count: number;
  is_price_locked: boolean;
  pricing_summary: TemplatePricingSummary | null;
  valid_to?: string | null;
}
interface ModuleOption {
  slug: string;
  name: string;
  is_active: boolean;
  current_price?: {
    base_price_ils: string;
    per_seat_ils: string;
    included_seats: number;
    setup_fee_ils: string;
    valid_from: string;
  } | null;
}
interface TenantSyncPreviewModuleDiff {
  module_slug: string;
  module_name: string;
  action: "add" | "remove" | "update";
  current_seats: number;
  proposed_seats: number;
  pricing_mode: "catalog" | "override";
  current_monthly_ils: string;
  proposed_monthly_ils: string;
  current_setup_ils: string;
  proposed_setup_ils: string;
}
interface TenantSyncPreviewOut {
  tenant_id: string;
  template_id: string;
  effective_from: string;
  current_discount_pct: string;
  proposed_discount_pct: string;
  current_is_price_locked: boolean;
  proposed_is_price_locked: boolean;
  module_diffs: TenantSyncPreviewModuleDiff[];
  current_monthly_total_ils: string;
  proposed_monthly_total_ils: string;
  current_setup_total_ils: string;
  proposed_setup_total_ils: string;
}

interface BillingSettingsOut {
  can_render_tax_invoice: boolean;
  missing_tax_fields: string[];
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
const ACTIVE_TENANT_STATUSES = new Set(["active", "trial"]);
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("he-IL") : "—";
const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }) : "—";

function todayIsoDate(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

function buildActiveStatusWindows(rows: TenantStatusOut[]) {
  return rows
    .filter((row) => ACTIVE_TENANT_STATUSES.has(row.status))
    .map((row) => ({
      valid_from: row.valid_from,
      valid_to: row.valid_to ?? null,
    }));
}

function findStatusWindowForRange(rows: TenantStatusOut[], validFrom: string, validTo?: string | null) {
  const windows = buildActiveStatusWindows(rows);
  return windows.find((window) => {
    if (window.valid_from > validFrom) return false;
    if (window.valid_to && validFrom > window.valid_to) return false;
    if (!validTo) return window.valid_to === null;
    return window.valid_to === null || validTo <= window.valid_to;
  }) ?? null;
}

function getTenantDateRangeError(rows: TenantStatusOut[], validFrom: string, validTo?: string | null) {
  const windows = buildActiveStatusWindows(rows);
  if (findStatusWindowForRange(rows, validFrom, validTo)) return null;
  if (!validTo) {
    return windows.length === 0
      ? `לא ניתן לבצע פעולה מתאריך ${fmtDate(validFrom)} כי ללקוח אין חלון סטטוס פעיל.`
      : `לא ניתן לבצע פעולה מתאריך ${fmtDate(validFrom)} כי הלקוח אינו פעיל בתאריך זה או שאין חלון פעיל פתוח מתאריך זה.`;
  }
  return windows.length === 0
    ? `לא ניתן לבצע פעולה בטווח ${fmtDate(validFrom)} עד ${fmtDate(validTo)} כי ללקוח אין חלון סטטוס פעיל.`
    : `לא ניתן לבצע פעולה בטווח ${fmtDate(validFrom)} עד ${fmtDate(validTo)} כי כל הטווח חייב להיות בתוך חלון סטטוס פעיל.`;
}

function getAuditStamp(row: AuditFields) {
  return {
    at: row.updated_at ?? row.created_at ?? null,
    by: row.updated_by ?? row.created_by ?? null,
  };
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError) {
    return error.error ?? (typeof error.details === "object" && error.details && "error" in error.details
      ? String((error.details as { error?: unknown }).error ?? fallback)
      : fallback);
  }
  if (error && typeof error === "object") {
    const candidate = error as { error?: string; detail?: { error?: string }; details?: { error?: string } };
    return candidate.error ?? candidate.detail?.error ?? candidate.details?.error ?? fallback;
  }
  return fallback;
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditModalProps {
  section: SectionKey;
  initialData: Record<string, string>;
  initialValidFrom: string;
  initialValidTo: string;
  allRows: Array<{ valid_from: string; valid_to?: string }>;
  statusRows: TenantStatusOut[];
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
    { key: "template_id", label: "תבנית" },
    { key: "billing_cycle", label: "מחזור חיוב",  required: true, type: "select",
      options: [{ value: "monthly", label: "חודשי" }, { value: "quarterly", label: "רבעוני" }, { value: "yearly", label: "שנתי" }] },
    { key: "currency",      label: "מטבע",         required: true, type: "select",
      options: [{ value: "ILS", label: "₪ שקל" }, { value: "USD", label: "$ דולר" }, { value: "EUR", label: "€ יורו" }] },
    { key: "seat_count",     label: "מושבים" },
    { key: "selected_module_slugs", label: "מודולים" },
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

function EditModal({ section, initialData, initialValidFrom, initialValidTo, allRows, statusRows, tenantId, onClose, onSaved, initialMode }: EditModalProps) {
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
      api.get<{ items: { item_key: string; label_he: string; is_active: boolean }[] }>(`/api/admin/lookups/${listKey}`)
        .then((data) => {
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
    const p: Record<string, string | number | boolean | string[]> = {};
    for (const f of fields) {
      if (section === "subscription" && f.key === "selected_module_slugs") {
        p[f.key] = (form[f.key] ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
      } else if (section === "subscription" && f.key === "seat_count") {
        p[f.key] = parseInt(form[f.key] ?? "0", 10) || 0;
      } else if (f.type === "checkbox") {
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
      setError(getApiErrorMessage(e, "שגיאה במחיקה"));
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
      setError(getApiErrorMessage(e, "שגיאה בסגירת תקופה"));
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

    if (section !== "status") {
      const statusError = getTenantDateRangeError(statusRows, validFrom, validTo || null);
      if (statusError) {
        setError(statusError);
        setSaving(false);
        return;
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
      setError(getApiErrorMessage(e, "שגיאה בשמירה"));
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
                <HebrewDatePicker
                  value={validTo}
                  onChange={setValidTo}
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
              <HebrewDatePicker
                value={validFrom}
                onChange={setValidFrom}
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
              <HebrewDatePicker
                value={validTo}
                onChange={setValidTo}
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
        <div className="w-[72px] h-[72px] rounded-xl border border-dashed border-slate-300 bg-white
                        flex items-center justify-center overflow-hidden
                        group-hover:border-brand-400 transition-colors">
          {preview ? (
            <Image src={preview} alt="לוגו" fill sizes="72px" className="object-contain p-1.5" />
          ) : (
            <Building2 size={24} className="text-slate-300" />
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
        <p className="text-[10px] text-red-500 text-center leading-tight max-w-[72px]">{errMsg}</p>
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
  const identityAudit = getAuditStamp(tenant.identity ?? {});
  const pageCreatedBy = tenant.created_by ?? identityAudit.by;
  const pageUpdatedAt = tenant.updated_at ?? identityAudit.at;
  const pageUpdatedBy = tenant.updated_by ?? identityAudit.by;
  const billingCycleLabel = tenant.subscription?.billing_cycle ?? "—";
  const activeModules = (tenant.subscription_modules ?? []).filter((item) => item.status === "active");
  const currentValidity = tenant.identity?.valid_to
    ? `${fmtDate(tenant.identity.valid_from)} עד ${fmtDate(tenant.identity.valid_to)}`
    : tenant.identity?.valid_from
      ? `מ-${fmtDate(tenant.identity.valid_from)}`
      : "—";
  const statusCfg = {
    active:    { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50/70", border: "border-emerald-200" },
    trial:     { dot: "bg-amber-400",   text: "text-amber-700",   bg: "bg-amber-50/70",   border: "border-amber-200"  },
    suspended: { dot: "bg-red-500",     text: "text-red-700",     bg: "bg-red-50/70",     border: "border-red-200"    },
    cancelled: { dot: "bg-slate-400",   text: "text-slate-500",   bg: "bg-slate-100/70",  border: "border-slate-200"  },
  }[statusVal as "active" | "trial" | "suspended" | "cancelled"] ?? { dot: "bg-slate-400", text: "text-slate-500", bg: "bg-slate-100/70", border: "border-slate-200" };

  return (
    <div className="border-b border-slate-200 bg-gradient-to-l from-slate-50 via-white to-white px-5 py-4">
      <div className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start">
          <div className="flex items-start gap-4">
            <LogoUpload
              tenantId={tenant.tenant_id}
              logoUrl={tenant.identity?.logo_url}
              onUploaded={onLogoUploaded}
            />
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold leading-tight text-slate-800">
                  {tenant.identity?.name_he ?? "—"}
                </h2>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${statusCfg.bg} ${statusCfg.border}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
                  <span className={statusCfg.text}>{statusLabel}</span>
                </span>
              </div>
              {tenant.identity?.name_en && (
                <div className="text-sm text-slate-400">{tenant.identity.name_en}</div>
              )}
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                  מ.ארגון {tenant.org_number}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                  מחזור {billingCycleLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="grid flex-1 min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
              <div className="mb-1 text-[11px] font-medium text-slate-400">ח.פ / ע.מ</div>
              <div className="text-sm font-semibold text-slate-700">{tenant.identity?.tax_id ?? "—"}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
              <div className="mb-1 text-[11px] font-medium text-slate-400">סוג ישות</div>
              <div className="text-sm font-semibold text-slate-700">
                {ENTITY_LABELS[tenant.identity?.entity_type ?? ""] ?? tenant.identity?.entity_type ?? "—"}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
              <div className="mb-1 text-[11px] font-medium text-slate-400">תוקף נוכחי</div>
              <div className="text-sm font-semibold text-slate-700">{currentValidity}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
              <div className="mb-1 text-[11px] font-medium text-slate-400">מודולים בפועל</div>
              <div className="text-sm font-semibold text-slate-700">{activeModules.length}</div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-200 bg-slate-50/70 px-5 py-3 text-[11px]">
          {activeModules.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-slate-500">
              <span className="text-slate-400">מודולים:</span>
              {activeModules.map((item) => (
                <span key={item.id} className="rounded-full bg-white px-2 py-0.5 text-slate-700 border border-slate-200">
                  {item.module_slug} · {item.seats} מושבים
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5 text-slate-500">
            <span className="text-slate-400">נוצר:</span>
            <span className="font-medium text-slate-700">{fmtDateTime(tenant.created_at)}</span>
            <span>ע&quot;י</span>
            <span className="font-semibold text-slate-700">{pageCreatedBy ?? "—"}</span>
          </div>
          <div className="h-3 w-px bg-slate-200" />
          <div className="flex items-center gap-1.5 text-slate-500">
            <span className="text-slate-400">עודכן:</span>
            <span className="font-medium text-slate-700">{fmtDateTime(pageUpdatedAt)}</span>
            <span>ע&quot;י</span>
            <span className="font-semibold text-slate-700">{pageUpdatedBy ?? "—"}</span>
          </div>
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
    rows: sorted.map((r) => {
      const audit = getAuditStamp(r);
      return {
      valid_from:  fmtDate(r.valid_from),
      valid_to:    r.valid_to ? fmtDate(r.valid_to) : "—",
      name_he:     r.name_he,
      name_en:     r.name_en ?? "—",
      tax_id:      r.tax_id,
      entity_type: ENTITY_LABELS[r.entity_type] ?? r.entity_type,
      created_at:  fmtDateTime(audit.at),
      created_by:  audit.by ?? "—",
      _current:    !r.valid_to,
      _valid_from_raw: r.valid_from,
      _valid_to_raw: r.valid_to ?? null,
      };
    }),
    temporalFilter: true,
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
    rows: sorted.map((r) => {
      const audit = getAuditStamp(r);
      return {
      valid_from:   fmtDate(r.valid_from),
      valid_to:     r.valid_to ? fmtDate(r.valid_to) : "—",
      contact_type: CONTACT_TYPE_LABELS[r.contact_type] ?? r.contact_type,
      email:        r.email,
      phone:        r.phone,
      contact_name: r.contact_name ?? "—",
      website:      r.website ?? "—",
      created_at:   fmtDateTime(audit.at),
      created_by:   audit.by ?? "—",
      _current:     !r.valid_to,
      _valid_from_raw: r.valid_from,
      _valid_to_raw: r.valid_to ?? null,
      };
    }),
    temporalFilter: true,
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
    rows: sorted.map((r) => {
      const audit = getAuditStamp(r);
      return {
      valid_from: fmtDate(r.valid_from),
      valid_to:   r.valid_to ? fmtDate(r.valid_to) : "—",
      street:     r.street,
      city:       r.city,
      zip_code:   r.zip_code ?? "—",
      country:    r.country,
      created_at: fmtDateTime(audit.at),
      created_by: audit.by ?? "—",
      _current:   !r.valid_to,
      _valid_from_raw: r.valid_from,
      _valid_to_raw: r.valid_to ?? null,
      };
    }),
    temporalFilter: true,
    onRowDoubleClick: (i) => onDblClick(rows.indexOf(sorted[i])),
  };
}

function buildSubscriptionTab(
  rows: TenantSubscriptionOut[],
  onDblClick: (i: number) => void,
  templateNames: Record<string, string>,
): ChildTab {
  const sorted = sortRows(rows);
  return {
    id: "subscription", label: "מנוי",
    columns: [
      { key: "valid_from",    label: "תוקף מ",       required: true },
      { key: "valid_to",      label: "תוקף עד" },
      { key: "template_id",   label: "תבנית" },
      { key: "billing_cycle", label: "מחזור חיוב",   required: true },
      { key: "seat_count",    label: "מושבים" },
      { key: "modules",       label: "מודולים" },
      { key: "currency",      label: "מטבע",         required: true },
      { key: "discount_pct",  label: "הנחה %" },
      { key: "created_at",    label: "תאריך שינוי" },
      { key: "created_by",    label: "בוצע ע\"י" },
    ],
    rows: sorted.map((r) => {
      const audit = getAuditStamp(r);
      return {
      valid_from:    fmtDate(r.valid_from),
      valid_to:      r.valid_to ? fmtDate(r.valid_to) : "—",
      template_id:   (r.template_id ? templateNames[r.template_id] : null) ?? "—",
      billing_cycle: r.billing_cycle,
      seat_count:    r.seat_count,
      modules:       r.selected_module_slugs?.length ? r.selected_module_slugs.join(", ") : "—",
      currency:      r.currency,
      discount_pct:  `${r.discount_pct}%`,
      created_at:    fmtDateTime(audit.at),
      created_by:    audit.by ?? "—",
      _current:      !r.valid_to,
      _valid_from_raw: r.valid_from,
      _valid_to_raw: r.valid_to ?? null,
      };
    }),
    temporalFilter: true,
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
    rows: sorted.map((r) => {
      const audit = getAuditStamp(r);
      return {
      valid_from: fmtDate(r.valid_from),
      valid_to:   r.valid_to ? fmtDate(r.valid_to) : "—",
      status:     STATUS_LABELS[r.status] ?? r.status,
      reason:     r.reason ?? "—",
      created_at: fmtDateTime(audit.at),
      created_by: audit.by ?? "—",
      _current:   !r.valid_to,
      _valid_from_raw: r.valid_from,
      _valid_to_raw: r.valid_to ?? null,
      };
    }),
    temporalFilter: true,
    onRowDoubleClick: (i) => onDblClick(rows.indexOf(sorted[i])),
  };
}

function buildSubscriptionModulesTab(
  rows: TenantSubscriptionModuleOut[],
  onDblClick: ((row: TenantSubscriptionModuleOut) => void) | undefined,
  onAddClick: (() => void) | undefined,
  options?: {
    addDisabled?: boolean;
    addDisabledReason?: string;
    toolbarNote?: string;
  },
): ChildTab {
  const sorted = [...rows].sort((a, b) => {
    if (a.valid_from === b.valid_from) return a.module_slug.localeCompare(b.module_slug, "he");
    return a.valid_from < b.valid_from ? 1 : -1;
  });
  return {
    id: "subscription_modules",
    label: "מודולי מנוי",
    columns: [
      { key: "module_slug", label: "מודול" },
      { key: "source_type", label: "מקור" },
      { key: "status", label: "סטטוס" },
      { key: "valid_from", label: "מתאריך", required: true },
      { key: "valid_to",   label: "בתוקף עד" },
      { key: "seats", label: "מושבים למודול" },
      { key: "pricing_mode", label: "תמחור" },
      { key: "base_price", label: "בסיס" },
      { key: "per_seat", label: "למושב" },
      { key: "setup_fee", label: "הקמה" },
      { key: "created_at", label: "עודכן" },
      { key: "created_by", label: "ע״י" },
      { key: "notes", label: "הערות" },
    ],
    rows: sorted.map((row) => {
      const audit = getAuditStamp(row);
      return ({
      module_slug: row.module_slug,
      source_type: row.source_type === "template" ? "תבנית" : "ידני",
      status: row.status === "active" ? "פעיל" : "הוסר",
      valid_from: fmtDate(row.valid_from),
      valid_to:   row.valid_to ? fmtDate(row.valid_to) : "—",
      seats: row.seats,
      pricing_mode: row.pricing_mode === "override" ? "Override" : "מחירון",
      base_price: row.pricing_mode === "override" ? (row.override_base_price_ils ? fmtIls(row.override_base_price_ils) : "—") : "קטלוג",
      per_seat: row.pricing_mode === "override" ? (row.override_per_seat_ils ? fmtIls(row.override_per_seat_ils) : "—") : "קטלוג",
      setup_fee: row.pricing_mode === "override" ? (row.override_setup_fee_ils ? fmtIls(row.override_setup_fee_ils) : "—") : "קטלוג",
      created_at: fmtDateTime(audit.at),
      created_by: audit.by ?? "—",
      notes: row.notes ?? "—",
      _current: !row.valid_to,
      _valid_from_raw: row.valid_from,
      _valid_to_raw: row.valid_to ?? null,
    });
    }),
    onRowDoubleClick: onDblClick ? (index) => {
      const row = sorted[index];
      if (row) onDblClick(row);
    } : undefined,
    onAddClick,
    addDisabled: options?.addDisabled,
    addDisabledReason: options?.addDisabledReason,
    toolbarNote: options?.toolbarNote,
    temporalFilter: true,
    emptyMessage: "אין מודולים במנוי - לחץ להוספת מודול",
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

function ApplyTemplateModal({
  tenantId,
  statusRows,
  onClose,
  onApplied,
}: {
  tenantId: string;
  statusRows: TenantStatusOut[];
  onClose: () => void;
  onApplied: () => void;
}) {
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<TemplateOption[]>("/api/admin/templates")
      .then((data) => setTemplates(data.filter((template) => !template.valid_to)))
      .catch(() => setError("לא הצלחתי לטעון תבניות"))
      .finally(() => setLoading(false));
  }, []);

  const selectedTemplate = templates.find((template) => template.id === selectedId) ?? null;

  async function handleApply() {
    if (!selectedId) {
      setError("יש לבחור תבנית");
      return;
    }
    const statusError = getTenantDateRangeError(statusRows, effectiveFrom, effectiveFrom);
    if (statusError) {
      setError(statusError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post(`/api/admin/tenants/${tenantId}/apply-template`, {
        template_id: selectedId,
        valid_from: effectiveFrom,
      });
      onApplied();
      onClose();
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "שגיאה בהחלת התבנית"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl" dir="rtl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3 rounded-t-xl">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">החל תבנית על הארגון</h3>
            <p className="mt-1 text-[11px] text-slate-500">הפעולה תעדכן את פרטי המנוי, המודולים והמושבים של הארגון מתאריך שתבחר.</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-200"><X size={16} /></button>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">תבנית</label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:border-brand-400"
                disabled={loading}
              >
                <option value="">{loading ? "טוען תבניות..." : "בחר תבנית"}</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">תוקף מתאריך</label>
              <HebrewDatePicker
                value={effectiveFrom}
                onChange={setEffectiveFrom}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:border-brand-400 bg-white"
              />
            </div>

            {selectedTemplate && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 space-y-2">
                <div className="font-semibold text-slate-800">{selectedTemplate.name}</div>
                {selectedTemplate.description && <div>{selectedTemplate.description}</div>}
                <div className="grid grid-cols-2 gap-2">
                  <span>מחזור: {selectedTemplate.default_billing_cycle}</span>
                  <span>מושבים: {selectedTemplate.seat_count}</span>
                  <span>הנחה: {selectedTemplate.discount_pct}%</span>
                </div>
                <div className="border-t border-slate-200 pt-2 text-[11px] text-slate-500">
                  מודולים: {selectedTemplate.module_slugs.length ? selectedTemplate.module_slugs.join(", ") : "ללא מודולים"}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-white">
            <div className="text-sm font-semibold">תצוגה מקדימה</div>
            <p className="mt-1 text-[11px] text-slate-300">אחרי ההחלה, החיובים החדשים ייגזרו מהמנוי המעודכן הזה.</p>
            {selectedTemplate?.pricing_summary ? (
              <div className="mt-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">מודולים</span>
                  <span className="font-semibold">{selectedTemplate.pricing_summary.modules_count}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">מושבים</span>
                  <span className="font-semibold">{selectedTemplate.pricing_summary.seat_count}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">חודשי משוער</span>
                  <span className="font-semibold">{fmtIls(selectedTemplate.pricing_summary.recurring_after_discount_ils)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">הקמה משוערת</span>
                  <span className="font-semibold">{fmtIls(selectedTemplate.pricing_summary.setup_after_discount_ils)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-white/10 pt-2">
                  <span className="text-slate-100 font-semibold">סה&quot;כ מחזור ראשון</span>
                  <span className="text-lg font-bold">{fmtIls(selectedTemplate.pricing_summary.total_after_discount_ils)}</span>
                </div>
              </div>
            ) : (
              <div className="mt-6 text-xs text-slate-300">בחר תבנית כדי לראות סיכום כספי.</div>
            )}
          </div>
        </div>

        {error && (
          <div className="px-5 pb-2 text-xs text-red-600">{error}</div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 rounded-b-xl">
          <button onClick={onClose} className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
            ביטול
          </button>
          <button
            onClick={handleApply}
            disabled={saving || loading}
            className="flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <FileText size={12} />
            {saving ? "מחיל..." : "החל תבנית"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SubscriptionModuleModal({
  tenantId,
  initial,
  onClose,
  onSaved,
}: {
  tenantId: string;
  initial?: TenantSubscriptionModuleOut | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  type ModuleMode = "update" | "add" | "set" | "close" | "delete";
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ModuleMode>(initial ? "update" : "add");
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    module_slug: initial?.module_slug ?? "",
    source_type: initial?.source_type ?? "manual",
    status: initial?.status ?? "active",
    seats: String(initial?.seats ?? 0),
    pricing_mode: initial?.pricing_mode ?? "catalog",
    override_base_price_ils: initial?.override_base_price_ils ?? "",
    override_per_seat_ils: initial?.override_per_seat_ils ?? "",
    override_setup_fee_ils: initial?.override_setup_fee_ils ?? "",
    override_included_seats: initial?.override_included_seats != null ? String(initial.override_included_seats) : "",
    price_lock_reason: initial?.price_lock_reason ?? "",
    notes: initial?.notes ?? "",
  });
  const [validFrom, setValidFrom] = useState(initial?.valid_from ?? today);
  const [validTo, setValidTo] = useState(initial?.valid_to ?? "");

  useEffect(() => {
    api.get<ModuleOption[]>("/api/admin/modules")
      .then((data) => setModules(data.filter((item) => item.is_active)))
      .catch(() => setError("לא הצלחתי לטעון מודולים"))
      .finally(() => setLoading(false));
  }, []);

  function setField<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function buildPayload() {
    return {
      module_id: initial?.id,
      module_slug: form.module_slug,
      source_type: form.source_type as "template" | "manual",
      status: form.status as "active" | "removed",
      seats: parseInt(form.seats, 10) || 0,
      pricing_mode: form.pricing_mode as "catalog" | "override",
      override_base_price_ils: form.pricing_mode === "override" && form.override_base_price_ils ? parseFloat(form.override_base_price_ils) : null,
      override_per_seat_ils: form.pricing_mode === "override" && form.override_per_seat_ils ? parseFloat(form.override_per_seat_ils) : null,
      override_setup_fee_ils: form.pricing_mode === "override" && form.override_setup_fee_ils ? parseFloat(form.override_setup_fee_ils) : null,
      override_included_seats: form.pricing_mode === "override" && form.override_included_seats ? parseInt(form.override_included_seats, 10) : null,
      price_lock_reason: form.price_lock_reason || null,
      notes: form.notes || null,
      valid_from: validFrom || null,
      valid_to: validTo || null,
    };
  }

  async function runAction(action: ModuleMode) {
    if (!form.module_slug) {
      setError("יש לבחור מודול");
      return;
    }
    if (action !== "close" && action !== "delete" && !validFrom) {
      setError("יש להזין תאריך תחילת תוקף");
      return;
    }
    if (action === "close" && !validTo) {
      setError("יש להזין תאריך סיום");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.put(`/api/admin/tenants/${tenantId}/subscription-modules/temporal`, {
        ...buildPayload(),
        action,
      });
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "שגיאה בביצוע הפעולה על המודול"));
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:border-brand-400";
  const showPayloadForm = mode === "add" || mode === "update" || mode === "set";
  const titleMap: Record<ModuleMode, string> = {
    update: "עדכון מודול מנוי",
    add: "רשומת מודול חדשה",
    set: "קבע תקופה למודול",
    close: "סגירת תוקף מודול",
    delete: "מחיקת שורת מודול",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl" dir="rtl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3 rounded-t-xl">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{titleMap[mode]}</h3>
            <p className="mt-1 text-[11px] text-slate-500">כאן מנהלים היסטוריית מודולים לפי תוקף, כמו בשאר המערכת הטמפורלית.</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-200"><X size={16} /></button>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          {initial && (
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">פעולה</label>
              <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value as ModuleMode)} disabled={saving}>
                <option value="update">עדכון שורה</option>
                <option value="add">רשומה חדשה</option>
                <option value="set">קבע תקופה</option>
                <option value="close">סגור תקופה</option>
                <option value="delete">מחק שורה</option>
              </select>
            </div>
          )}

          {showPayloadForm && (
            <>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">מודול</label>
            <select className={inputCls} value={form.module_slug} onChange={(e) => setField("module_slug", e.target.value)} disabled={Boolean(initial) || loading || saving}>
              <option value="">{loading ? "טוען מודולים..." : "בחר מודול"}</option>
              {modules.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">מקור</label>
            <select className={inputCls} value={form.source_type} onChange={(e) => setField("source_type", e.target.value)} disabled={Boolean(initial) || saving}>
              <option value="manual">ידני</option>
              <option value="template">תבנית</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">סטטוס</label>
            <select className={inputCls} value={form.status} onChange={(e) => setField("status", e.target.value)} disabled={saving}>
              <option value="active">פעיל</option>
              <option value="removed">הוסר</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">מושבים למודול</label>
            <input className={inputCls} type="number" min="0" value={form.seats} onChange={(e) => setField("seats", e.target.value)} disabled={saving} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-600">מצב תמחור</label>
            <select className={inputCls} value={form.pricing_mode} onChange={(e) => setField("pricing_mode", e.target.value)} disabled={saving}>
              <option value="catalog">מחירון פעיל</option>
              <option value="override">Override ללקוח</option>
            </select>
          </div>
          {form.pricing_mode === "override" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">מחיר בסיס</label>
                <input className={inputCls} type="number" min="0" step="0.01" value={form.override_base_price_ils} onChange={(e) => setField("override_base_price_ils", e.target.value)} disabled={saving} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">מחיר למושב</label>
                <input className={inputCls} type="number" min="0" step="0.01" value={form.override_per_seat_ils} onChange={(e) => setField("override_per_seat_ils", e.target.value)} disabled={saving} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">דמי הקמה</label>
                <input className={inputCls} type="number" min="0" step="0.01" value={form.override_setup_fee_ils} onChange={(e) => setField("override_setup_fee_ils", e.target.value)} disabled={saving} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">מושבים כלולים</label>
                <input className={inputCls} type="number" min="0" value={form.override_included_seats} onChange={(e) => setField("override_included_seats", e.target.value)} disabled={saving} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-600">סיבת נעילה / Override</label>
                <input className={inputCls} value={form.price_lock_reason} onChange={(e) => setField("price_lock_reason", e.target.value)} disabled={saving} />
              </div>
            </>
          )}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">מתאריך</label>
            <HebrewDatePicker value={validFrom} onChange={setValidFrom} disabled={saving} className={`${inputCls} bg-white`} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">עד תאריך</label>
            <HebrewDatePicker value={validTo} onChange={setValidTo} disabled={saving} className={`${inputCls} bg-white`} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-600">הערות</label>
            <textarea className={`${inputCls} min-h-20`} value={form.notes} onChange={(e) => setField("notes", e.target.value)} disabled={saving} />
          </div>
            </>
          )}

          {mode === "close" && (
            <>
              <div className="md:col-span-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                הפעולה תשאיר את השורה בהיסטוריה ותסיים את התוקף שלה בתאריך שתבחר.
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">תוקף עד</label>
                <HebrewDatePicker value={validTo} onChange={setValidTo} disabled={saving} className={`${inputCls} bg-white`} />
              </div>
            </>
          )}

          {mode === "delete" && (
            <div className="md:col-span-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              מחיקת שורה תסיר אותה לחלוטין מההיסטוריה. אם הכוונה רק לסיים תוקף, עדיף להשתמש ב־&quot;סגור תקופה&quot;.
            </div>
          )}
        </div>
        {error && <div className="px-5 pb-2 text-xs text-red-600">{error}</div>}
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 rounded-b-xl">
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50">ביטול</button>
            <button
              onClick={() => runAction(mode)}
              disabled={saving || loading}
              className={`rounded-md px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${
                mode === "delete" ? "bg-red-600 hover:bg-red-700" :
                mode === "close" ? "bg-amber-600 hover:bg-amber-700" :
                "bg-brand-600 hover:bg-brand-700"
              }`}
            >
              {saving ? "שומר..." : (
                mode === "delete" ? "מחק שורה" :
                mode === "close" ? "סגור תקופה" :
                mode === "set" ? "קבע תקופה" :
                mode === "add" ? "הוסף רשומה" :
                "שמור"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SyncTemplateModal({
  tenantId,
  statusRows,
  onClose,
  onApplied,
}: {
  tenantId: string;
  statusRows: TenantStatusOut[];
  onClose: () => void;
  onApplied: () => void;
}) {
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [preview, setPreview] = useState<TenantSyncPreviewOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<TemplateOption[]>("/api/admin/templates")
      .then((data) => setTemplates(data.filter((item) => !item.valid_to)))
      .catch(() => setError("לא הצלחתי לטעון תבניות"))
      .finally(() => setLoading(false));
  }, []);

  async function handlePreview() {
    if (!selectedId) {
      setError("יש לבחור תבנית");
      return;
    }
    const statusError = getTenantDateRangeError(statusRows, effectiveFrom, effectiveFrom);
    if (statusError) {
      setError(statusError);
      return;
    }
    setPreviewing(true);
    setError(null);
    try {
      const data = await api.get<TenantSyncPreviewOut>(`/api/admin/tenants/${tenantId}/sync-preview?template_id=${selectedId}&effective_from=${effectiveFrom}`);
      setPreview(data);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "שגיאה בבניית ההשוואה"));
    } finally {
      setPreviewing(false);
    }
  }

  async function handleApply() {
    if (!selectedId) return;
    const statusError = getTenantDateRangeError(statusRows, effectiveFrom, effectiveFrom);
    if (statusError) {
      setError(statusError);
      return;
    }
    setApplying(true);
    setError(null);
    try {
      await api.post(`/api/admin/tenants/${tenantId}/sync-preview/apply`, {
        template_id: selectedId,
        valid_from: effectiveFrom,
      });
      onApplied();
      onClose();
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "שגיאה בהחלת הסנכרון"));
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-4xl rounded-xl bg-white shadow-xl" dir="rtl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3 rounded-t-xl">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">רענון מנוי מתבנית</h3>
            <p className="mt-1 text-[11px] text-slate-500">המערכת תחשב פערים מול התבנית ותאפשר apply רק אחרי תצוגה מקדימה.</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-200"><X size={16} /></button>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">תבנית</label>
              <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:border-brand-400" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} disabled={loading}>
                <option value="">{loading ? "טוען תבניות..." : "בחר תבנית"}</option>
                {templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">תוקף מתאריך</label>
              <HebrewDatePicker value={effectiveFrom} onChange={setEffectiveFrom} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:border-brand-400" />
            </div>
            <button onClick={handlePreview} disabled={previewing || loading} className="w-full rounded-md border border-brand-300 bg-brand-50 px-4 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50">
              {previewing ? "מחשב..." : "הצג השוואה"}
            </button>
            {preview && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-2">
                <div className="flex items-center justify-between"><span>חודשי נוכחי</span><span className="font-semibold">{fmtIls(preview.current_monthly_total_ils)}</span></div>
                <div className="flex items-center justify-between"><span>חודשי מוצע</span><span className="font-semibold">{fmtIls(preview.proposed_monthly_total_ils)}</span></div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-2"><span>דלתא</span><span className="font-bold">{fmtIls(String(parseFloat(preview.proposed_monthly_total_ils) - parseFloat(preview.current_monthly_total_ils)))}</span></div>
              </div>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">פערי מודולים ומושבים</div>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-right">מודול</th>
                    <th className="px-3 py-2 text-right">פעולה</th>
                    <th className="px-3 py-2 text-right">מושבים נוכחיים</th>
                    <th className="px-3 py-2 text-right">מושבים מוצעים</th>
                    <th className="px-3 py-2 text-right">חודשי נוכחי</th>
                    <th className="px-3 py-2 text-right">חודשי מוצע</th>
                  </tr>
                </thead>
                <tbody>
                  {(preview?.module_diffs ?? []).length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-10 text-center text-slate-400">{preview ? "אין פערים בין המנוי לתבנית" : "בחר תבנית והצג השוואה"}</td></tr>
                  ) : (
                    preview!.module_diffs.map((row) => (
                      <tr key={row.module_slug} className="border-b border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-800">{row.module_name}</td>
                        <td className="px-3 py-2">{row.action === "add" ? "הוספה" : row.action === "remove" ? "הסרה" : "עדכון"}</td>
                        <td className="px-3 py-2">{row.current_seats}</td>
                        <td className="px-3 py-2">{row.proposed_seats}</td>
                        <td className="px-3 py-2">{fmtIls(row.current_monthly_ils)}</td>
                        <td className="px-3 py-2">{fmtIls(row.proposed_monthly_ils)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {error && <div className="px-5 pb-2 text-xs text-red-600">{error}</div>}
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 rounded-b-xl">
          <button onClick={onClose} className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50">ביטול</button>
          <button onClick={handleApply} disabled={!preview || applying} className="rounded-md bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {applying ? "מחיל..." : "החל סנכרון"}
          </button>
        </div>
      </div>
    </div>
  );
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
                    <HebrewDatePicker value={payDate} onChange={setPayDate}
                      className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:border-brand-400 bg-white text-right" />
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
      .map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : String(v ?? "")])
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TenantDetailPage() {
  const router  = useRouter();
  const { id }  = useParams<{ id: string }>();
  const [tenant,      setTenant]      = useState<TenantOut | null>(null);
  const [history,     setHistory]     = useState<TenantHistory | null>(null);
  const [billing,     setBilling]     = useState<TenantBillingSummary | null>(null);
  const [billingSettings, setBillingSettings] = useState<BillingSettingsOut | null>(null);
  const [seatChanges, setSeatChanges] = useState<SeatChangeLogItem[]>([]);
  const [templateOptions, setTemplateOptions] = useState<TemplateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBillingInvoice, setSelectedBillingInvoice] = useState<TenantInvoiceItem | null>(null);
  const [showApplyTemplate, setShowApplyTemplate] = useState(false);
  const [showSyncTemplate, setShowSyncTemplate] = useState(false);
  const [moduleModalState, setModuleModalState] = useState<{ initial?: TenantSubscriptionModuleOut | null } | null>(null);
  const [editState, setEditState] = useState<{
    section: SectionKey;
    data: Record<string, string>;
    initialValidFrom: string;
    initialValidTo: string;
    allRows: Array<{ valid_from: string; valid_to?: string }>;
    initialMode?: EditMode;
  } | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get<TenantOut>(`/api/admin/tenants/${id}`),
      api.get<TenantHistory>(`/api/admin/tenants/${id}/history`),
      api.get<TemplateOption[]>("/api/admin/templates").catch(() => []),
      api.get<TenantBillingSummary>(`/api/admin/tenants/${id}/billing`).catch(() => null),
      api.get<SeatChangeLogItem[]>(`/api/admin/tenants/${id}/seat-changes`).catch(() => []),
      api.get<BillingSettingsOut>("/api/admin/billing/settings").catch(() => null),
    ])
      .then(([t, h, templates, b, sc, settings]) => { setTenant(t); setHistory(h); setTemplateOptions(templates); setBilling(b); setSeatChanges(sc ?? []); setBillingSettings(settings); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    loadData();
  }, [loadData, router]);

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
  const statusRows = history?.status ?? [];
  const templateNameMap = Object.fromEntries(templateOptions.map((item) => [item.id, item.name]));

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
      { key: "pdf",     label: "" },
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
        pdf: (
          <div className="flex items-center gap-2">
            <a
              href={`/api/admin/billing/invoices/${inv.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px]
                         text-slate-500 hover:text-brand-700 hover:bg-brand-50 transition-colors"
              title="הורד PDF">
              PDF
            </a>
            {billingSettings?.can_render_tax_invoice ? (
              <a
                href={`/api/admin/billing/invoices/${inv.id}/pdf?variant=tax`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px]
                           text-slate-500 hover:text-brand-700 hover:bg-brand-50 transition-colors"
                title="הורד חשבונית מס">
                מס
              </a>
            ) : null}
          </div>
        ),
      };
    }),
    onRowDoubleClick: (i) => {
      const inv = billing?.invoices[i];
      if (inv) setSelectedBillingInvoice(inv);
    },
    emptyMessage: "אין חשבוניות — ניתן ליצור מדף ניהול חיובים",
  };

  const unbilledSeatChanges = seatChanges.filter((c) => !c.billed);
  const seatChangesTab: ChildTab = {
    id: "seat_changes",
    label: unbilledSeatChanges.length > 0
      ? `שינויי מושבים (${unbilledSeatChanges.length} ממתינים)`
      : "שינויי מושבים",
    columns: [
      { key: "date",       label: "תאריך שינוי" },
      { key: "module",     label: "מודול" },
      { key: "change",     label: "שינוי" },
      { key: "billed",     label: "חויב" },
      { key: "period",     label: "תקופת חיוב" },
    ],
    rows: seatChanges.map((c) => ({
      date:   fmtDate(c.effective_date),
      module: c.module_slug,
      change: (
        <span className={`tabular-nums font-semibold ${c.new_seats > c.old_seats ? "text-blue-700" : "text-amber-700"}`}>
          {c.old_seats} → {c.new_seats}
          {c.new_seats > c.old_seats
            ? <span className="mr-1 text-xs text-blue-500">(+{c.new_seats - c.old_seats})</span>
            : <span className="mr-1 text-xs text-amber-500">({c.new_seats - c.old_seats})</span>}
        </span>
      ),
      billed: c.billed
        ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-xs font-medium">✓ חויב</span>
        : <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-xs font-medium">ממתין לחיוב</span>,
      period: c.billing_period ? periodShort(c.billing_period) : "—",
    })),
    toolbarNote: unbilledSeatChanges.length > 0
      ? `⚠️ ${unbilledSeatChanges.length} שינויי מושבים ממתינים לחיוב פרו-ריטה — יחויבו בהרצת "יצירת חיובים" הבאה`
      : undefined,
    emptyMessage: "אין שינויי מושבים — השינויים נרשמים אוטומטית בעת עדכון מושבים למודול",
  };

  const childTabs: ChildTab[] = history ? [
    { ...buildIdentityTab(history.identity,         (i) => openEdit("identity",     i)), onAddClick: () => openAddNew("identity") },
    { ...buildContactTab(history.contact,           (i) => openEdit("contact",      i)), onAddClick: () => openAddNew("contact") },
    { ...buildAddressTab(history.address,           (i) => openEdit("address",      i)), onAddClick: () => openAddNew("address") },
    { ...buildSubscriptionTab(history.subscription, (i) => openEdit("subscription", i), templateNameMap), onAddClick: () => openAddNew("subscription") },
    tenant ? buildSubscriptionModulesTab(
      history.subscription_modules ?? [],
      (row) => setModuleModalState({ initial: row }),
      () => setModuleModalState({ initial: null }),
      {
        toolbarNote: "מודולים מנוהלים כעת היסטורית לפי תוקף, כולל פתיחה, עדכון, סגירה ומחיקה.",
      },
    ) : billingChargesTab,
    { ...buildStatusTab(history.status,             (i) => openEdit("status",       i)), onAddClick: () => openAddNew("status") },
    billingChargesTab,
    billingInvoicesTab,
    seatChangesTab,
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
          primaryActions={[
            {
              label: "החל תבנית",
              onClick: () => setShowApplyTemplate(true),
              icon: <FileText size={12} />,
            },
            {
              label: "רענון מתבנית",
              onClick: () => setShowSyncTemplate(true),
              icon: <Send size={12} />,
            },
          ]}
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
          statusRows={history?.status ?? []}
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

      {showApplyTemplate && tenant && (
        <ApplyTemplateModal
          tenantId={tenant.tenant_id}
          statusRows={history?.status ?? []}
          onClose={() => setShowApplyTemplate(false)}
          onApplied={() => {
            setShowApplyTemplate(false);
            loadData();
          }}
        />
      )}

      {showSyncTemplate && tenant && (
        <SyncTemplateModal
          tenantId={tenant.tenant_id}
          statusRows={history?.status ?? []}
          onClose={() => setShowSyncTemplate(false)}
          onApplied={() => {
            setShowSyncTemplate(false);
            loadData();
          }}
        />
      )}

      {moduleModalState && tenant && (
        <SubscriptionModuleModal
          tenantId={tenant.tenant_id}
          initial={moduleModalState.initial}
          onClose={() => setModuleModalState(null)}
          onSaved={() => {
            setModuleModalState(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
