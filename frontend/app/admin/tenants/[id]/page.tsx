"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ApiRequestError, getStoredUser, isLoggedIn, api } from "@/lib/api";
import { BILLING_ENABLED } from "@/lib/features";
import { dispatchOrgStructureUpdated } from "@/lib/orgStructureConfig";
import { dispatchTenantOptionsUpdated } from "@/lib/workspaceTenants";
import { CardPage, type ChildTab } from "@/components/layout/CardPage";
import {
  formatOrgStructureSummary,
  type OrgStructureLevel,
  type TenantOrgStructureConfigValue,
} from "@/components/tenants/TenantOrgStructureModal";
import { LogoUploadField } from "@/components/tenants/LogoUploadField";
import {
  AdminDateFields,
  AdminField,
  AdminModal,
  AdminModalBody,
  AdminModalFooter,
  AdminModalHeader,
  AdminModalMessage,
  AdminModalPanel,
  ADMIN_MODAL_ACTION_DANGER,
  ADMIN_MODAL_ACTION_PRIMARY,
  ADMIN_MODAL_ACTION_SECONDARY,
  ADMIN_MODAL_ACTION_WARNING,
  ADMIN_MODAL_GRID,
  ADMIN_MODAL_INPUT,
  ADMIN_MODAL_TEXTAREA,
} from "@/components/ui/AdminModal";
import { FormField } from "@/components/ui/FormField";
import { HebrewDatePicker } from "@/components/ui/HebrewDatePicker";
import { SplitActionButton } from "@/components/ui/SplitActionButton";
import { X, AlertCircle, CheckCircle2, Send, FileText, Printer, Trash2 } from "lucide-react";

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
  discount_pct: string; is_price_locked: boolean; billing_anchor_day: number; next_renewal_at?: string;
  current_monthly_total_ils: string;
  current_yearly_total_ils: string;
  current_cycle_total_ils: string;
  current_setup_total_ils: string;
  initial_charge_total_ils: string;
  next_charge_total_ils: string;
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
interface TenantOrgStructureConfigOut extends AuditFields, TenantOrgStructureConfigValue {
  id: string;
  tenant_id: string;
  is_locked: boolean;
  can_force_override: boolean;
  valid_from: string;
  valid_to?: string | null;
}
interface TenantOrgStructureOverrideImpactOut {
  converted_units_count: number;
  reparented_units_count: number;
  affected_positions_count: number;
  affected_employments_count: number;
  warnings: string[];
}
interface TenantOrgStructureOverridePreviewOut {
  tenant_id: string;
  valid_from: string;
  current_levels: OrgStructureLevel[];
  proposed_levels: OrgStructureLevel[];
  current_position_attachment_level: OrgStructureLevel | null;
  proposed_position_attachment_level: OrgStructureLevel | null;
  impact: TenantOrgStructureOverrideImpactOut;
}
interface TenantOut extends AuditFields {
  tenant_id: string; org_number: number; created_at: string;
  updated_at?: string; created_by?: string; updated_by?: string;
  identity?: TenantIdentityOut; contact?: TenantContactOut;
  address?: TenantAddressOut; subscription?: TenantSubscriptionOut; subscription_modules?: TenantSubscriptionModuleOut[]; status?: TenantStatusOut; org_structure?: TenantOrgStructureConfigOut;
}
interface TenantHistory {
  identity: TenantIdentityOut[]; contact: TenantContactOut[];
  address: TenantAddressOut[]; subscription: TenantSubscriptionOut[]; subscription_modules: TenantSubscriptionModuleOut[]; status: TenantStatusOut[]; org_structure: TenantOrgStructureConfigOut[];
}
interface TenantDeleteImpact {
  tenant_id: string;
  org_number: number;
  tenant_name?: string | null;
  tax_id?: string | null;
  confirmation_phrase: string;
  delete_logo: boolean;
  logo_will_be_deleted: boolean;
  counts: Record<string, number>;
}

type SectionKey = "identity" | "contact" | "address" | "subscription" | "status";
type TenantConfigSectionKey = SectionKey | "org_structure";

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

interface TenantPaymentTrackingItem {
  billing_period: string;
  scheduled_charge_date: string;
  status: "unreported" | "paid" | "unpaid" | "partial" | "waived";
  amount_ils?: string | null;
  paid_at?: string | null;
  external_ref?: string | null;
  notes?: string | null;
  source: "derived" | "manual";
  is_overdue: boolean;
  updated_at?: string | null;
  updated_by?: string | null;
}

interface TenantPaymentTrackingSummary {
  billing_anchor_day?: number | null;
  next_renewal_at?: string | null;
  items: TenantPaymentTrackingItem[];
}

interface TenantInvoiceDetail extends TenantInvoiceItem {
  vat_pct: string; discount_ils: string; notes?: string; payment_ref?: string;
  tenant_name?: string;
  lines: { id: string; description: string; quantity: string; unit_amount_ils: string; amount_ils: string }[];
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
    overage_per_seat_ils?: string;
    pricing_policy_note?: string;
    pricing_summary_text?: string;
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
  immediate_proration_total_ils: string;
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
const BILLING_CYCLE_LABELS: Record<string, string> = {
  monthly: "חודשי",
  quarterly: "רבעוני",
  yearly: "שנתי",
};

const BILLING_CYCLE_CHARGE_LABELS: Record<string, string> = {
  monthly: "חיוב למחזור חודשי",
  quarterly: "חיוב למחזור רבעוני",
  yearly: "חיוב למחזור שנתי",
};
const PAYMENT_TRACKING_STATUS_LABELS: Record<TenantPaymentTrackingItem["status"], string> = {
  unreported: "לא סומן",
  paid: "שולם",
  unpaid: "לא שולם",
  partial: "שולם חלקית",
  waived: "ויתרו / זוכה",
};
const STATUS_TYPE_MAP: Record<string, "active" | "trial" | "suspended" | "cancelled"> = {
  active: "active", trial: "trial", suspended: "suspended", cancelled: "cancelled",
};
const ACTIVE_TENANT_STATUSES = new Set(["active", "trial"]);
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("he-IL") : "—";
const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }) : "—";
const fmtMoney = (v: string | number | null | undefined, currency = "ILS") =>
  v === null || v === undefined || v === ""
    ? "—"
    : new Intl.NumberFormat("he-IL", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(v));

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
  allRows: Array<{ valid_from: string; valid_to?: string; contact_type?: string }>;
  statusRows: TenantStatusOut[];
  tenantId: string;
  templateOptions?: { value: string; label: string }[];
  onClose: () => void;
  onSaved: () => void;
  initialMode?: EditMode;
}

type FieldDef = {
  key: string; label: string; required?: boolean;
  type?: "text" | "email" | "select" | "checkbox" | "textarea" | "date";
  options?: { value: string; label: string }[];
  lookupKey?: string;
  helpText?: string;
};

const SECTION_FIELDS: Record<SectionKey, FieldDef[]> = {
  identity: [
    { key: "name_he",       label: "שם ארגון (עברית)", required: true },
    { key: "name_en",       label: "שם ארגון (אנגלית)" },
    { key: "tax_id",        label: 'ח.פ / ע.מ',        required: true },
    { key: "entity_type",   label: "סוג ישות",           required: true, lookupKey: "entity_type" },
    { key: "industry_code", label: "ענף תעשייה" },
    { key: "logo_url",      label: "לוגו" },
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
    { key: "template_id", label: "תבנית", type: "select" },
    { key: "billing_cycle", label: "מחזור חיוב",  required: true, type: "select",
      options: [{ value: "monthly", label: "חודשי" }, { value: "quarterly", label: "רבעוני" }, { value: "yearly", label: "שנתי" }] },
    { key: "currency",      label: "מטבע",         required: true, type: "select",
      options: [{ value: "ILS", label: "₪ שקל" }, { value: "USD", label: "$ דולר" }, { value: "EUR", label: "€ יורו" }] },
    { key: "billing_anchor_day", label: "יום חיוב קבוע", required: true, type: "select", helpText: "מגדירים פעם אחת את יום החיוב הקבוע. תאריך החיוב הבא יחושב אוטומטית לפי היום הזה." },
    { key: "discount_pct",   label: "הנחה %" },
    { key: "is_price_locked", label: "מחיר נעול", type: "checkbox", helpText: "כשזה פעיל, המחיר ללקוח נשאר קבוע ולא מתעדכן אוטומטית לפי מחירון חדש." },
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
  subscription: "הגדרות מנוי", status: "סטטוס",
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

function EditModal({ section, initialData, initialValidFrom, initialValidTo, allRows, statusRows, tenantId, templateOptions = [], onClose, onSaved, initialMode }: EditModalProps) {
  const [mode, setMode]           = useState<EditMode>(initialMode ?? "update");
  const [form, setForm]           = useState<Record<string, string>>(initialData);
  const [validFrom, setValidFrom] = useState<string>(initialValidFrom);
  const [validTo, setValidTo]     = useState<string>(initialValidTo);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [lookupOptions, setLookupOptions] = useState<Record<string, { value: string; label: string }[]>>({});

  const fields = SECTION_FIELDS[section].map((field) => {
    if (section === "subscription" && field.key === "template_id") {
      return {
        ...field,
        options: [{ value: "", label: "ללא תבנית" }, ...templateOptions],
      };
    }
    if (section === "subscription" && field.key === "billing_anchor_day") {
      return {
        ...field,
        options: Array.from({ length: 31 }, (_, index) => {
          const day = String(index + 1);
          return { value: day, label: day };
        }),
      };
    }
    return field;
  });

  const relevantRows = (() => {
    if (section !== "contact") return allRows;
    const contactType = form.contact_type?.trim();
    if (!contactType) return [];
    return allRows.filter((row) => row.contact_type === contactType);
  })();

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
    const p: Record<string, string | number | boolean | string[] | null> = {};
    for (const f of fields) {
      if (section === "subscription" && f.key === "selected_module_slugs") {
        p[f.key] = (form[f.key] ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
      } else if (section === "subscription" && f.key === "seat_count") {
        p[f.key] = parseInt(form[f.key] ?? "0", 10) || 0;
      } else if (section === "subscription" && f.key === "billing_anchor_day") {
        p[f.key] = Math.min(31, Math.max(1, parseInt(form[f.key] ?? "1", 10) || 1));
      } else if (f.type === "date") {
        p[f.key] = form[f.key]?.trim() ? form[f.key].trim() : null;
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
      dispatchTenantOptionsUpdated();
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
      dispatchTenantOptionsUpdated();
      onSaved(); onClose();
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "שגיאה בסגירת תקופה"));
    } finally { setSaving(false); }
  }

  async function handleSave(action: "update" | "add" | "set") {
    if (!validFrom) { setError("יש להזין תאריך תוקף"); return; }
    if (validTo && validTo < validFrom) {
      setError("תאריך הסיום חייב להיות מאוחר או שווה לתאריך ההתחלה");
      return;
    }
    setSaving(true); setError(null);

    // Front-end overlap check for הוספה only
    if (action === "add") {
      const d = new Date(validFrom);
      for (const row of relevantRows) {
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
      dispatchTenantOptionsUpdated();
      onSaved(); onClose();
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "שגיאה בשמירה"));
    } finally {
      setSaving(false);
    }
  }

  // Whether an active (open) row already exists — הוסף is blocked in that case
  // For contacts, only rows of the same contact_type should block/overlap.
  const hasActiveRow = relevantRows.some((r) => !r.valid_to);

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

  const activeRow = relevantRows.find((r) => !r.valid_to);

  return (
    <AdminModal onBackdropClick={onClose}>
      <AdminModalPanel className="max-w-6xl" dir="rtl" onClick={() => setDropdownOpen(false)}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className={`flex items-center justify-between border-b border-slate-200 px-6 py-5 ${headerBg}`}>
          <h2 className={`text-lg font-bold ${headerText}`}>
            {modalTitle}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/60 text-slate-500">
            <X size={16} />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto px-6 py-6 space-y-4">

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
          <div className={`space-y-4 ${mode === "add" && hasActiveRow ? "hidden" : ""}`}>
            <div className="grid gap-4 md:grid-cols-2">
            {fields.map((f) => (
              <div
                key={f.key}
                className={
                  section === "identity" && f.key === "logo_url"
                    ? "md:col-span-2"
                    : f.type === "textarea" || f.type === "checkbox"
                    ? "md:col-span-2"
                    : ""
                }
              >
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  {f.required && <span className="text-red-500 ml-0.5">*</span>}
                  {f.label}
                </label>
                <div>
                  {f.lookupKey ? (
                    <LookupInput
                      value={form[f.key] ?? ""}
                      options={lookupOptions[f.lookupKey] ?? []}
                      onChange={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
                    />
                  ) : f.type === "checkbox" ? (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        checked={form[f.key] === "true"}
                        onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: String(e.target.checked) }))}
                        className="w-4 h-4 rounded border-slate-300 text-brand-600"
                      />
                      <span className="text-xs text-slate-500">{form[f.key] === "true" ? "פעיל" : "כבוי"}</span>
                    </div>
                  ) : f.type === "textarea" ? (
                    <textarea
                      value={form[f.key] ?? ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      rows={2}
                      className={ADMIN_MODAL_TEXTAREA}
                    />
                  ) : f.type === "date" ? (
                    <div className="flex items-center gap-2">
                      <HebrewDatePicker
                        value={form[f.key] ?? ""}
                        onChange={(value) => setForm((prev) => ({ ...prev, [f.key]: value }))}
                        className={ADMIN_MODAL_INPUT}
                      />
                      {!!form[f.key] && (
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, [f.key]: "" }))}
                          className="text-xs text-slate-500 hover:text-slate-700"
                        >
                          נקה
                        </button>
                      )}
                    </div>
                  ) : section === "identity" && f.key === "logo_url" ? (
                    <LogoUploadField
                      value={form[f.key] ?? ""}
                      onChange={(value) => setForm((prev) => ({ ...prev, [f.key]: value }))}
                      storageKey={tenantId}
                      label=""
                      hint="העלה קובץ תמונה עבור לוגו הארגון"
                      className="pt-1"
                    />
                  ) : f.type === "select" && f.options ? (
                    <select
                      value={form[f.key] ?? ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      className={ADMIN_MODAL_INPUT}
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
                      className={ADMIN_MODAL_INPUT}
                    />
                  )}
                  {f.helpText ? (
                    <p className="mt-1 text-[11px] leading-4 text-slate-500">{f.helpText}</p>
                  ) : null}
                </div>
              </div>
            ))}
            </div>
          </div>

          {/* Date fields — hidden in add mode when blocked */}
          <div className={`border-t border-slate-200 pt-4 ${mode === "add" && hasActiveRow ? "hidden" : ""}`}>
            <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                <span className="text-red-500 ml-0.5">*</span>
                תוקף מתאריך
              </label>
              <HebrewDatePicker
                value={validFrom}
                onChange={setValidFrom}
                className={`${ADMIN_MODAL_INPUT}
                  ${mode === "add" ? "border-amber-400 bg-amber-50 font-semibold"
                  : mode === "set" ? "border-amber-400 bg-amber-50 font-semibold"
                  : "border-slate-300"}`}
              />
              {mode === "add" && <span className="text-xs text-amber-700 font-medium">תאריך תחילת תוקף חדש</span>}
              {mode === "set" && <span className="text-xs text-amber-700 font-medium">תחילת תקופת הקביעה</span>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                תוקף עד (אופציונלי)
              </label>
              <HebrewDatePicker
                value={validTo}
                onChange={setValidTo}
                className={`${ADMIN_MODAL_INPUT}
                  ${mode === "set" ? "border-amber-300 bg-amber-50" : "border-slate-300"}`}
              />
              {!validTo && <span className="mt-1 block text-xs text-slate-400">ריק = ללא תאריך סיום</span>}
              {validTo && <span className="text-xs text-blue-600 cursor-pointer hover:underline"
                onClick={() => setValidTo("")}>✕ נקה</span>}
            </div>
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
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
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
              <SplitActionButton
                primaryLabel={saving ? "שומר..." : "שמור"}
                onPrimaryClick={() => handleSave("update")}
                primaryDisabled={saving}
                menuOpen={dropdownOpen}
                onMenuToggle={() => setDropdownOpen((o) => !o)}
                minMenuWidthClassName="min-w-[150px]"
                actions={[
                  {
                    label: "רשומה חדשה",
                    onClick: () => switchToAddMode(),
                    disabled: hasActiveRow,
                    helperText: hasActiveRow ? "קיימת רשומה פעילה" : undefined,
                  },
                  {
                    label: "שמור",
                    onClick: () => {
                      setDropdownOpen(false);
                      handleSave("update");
                    },
                  },
                  {
                    label: "קבע תקופה",
                    onClick: () => switchToSetMode(),
                    tone: "warning",
                  },
                  {
                    label: "סגור תקופה",
                    onClick: () => switchToCloseMode(),
                    disabled: !hasActiveRow,
                    helperText: !hasActiveRow ? "אין שורה פעילה" : undefined,
                    tone: "warning",
                  },
                  {
                    label: "מחק שורה זו",
                    onClick: () => switchToDeleteMode(),
                    tone: "danger",
                  },
                ]}
              />
            </>
          )}
        </div>
      </AdminModalPanel>
    </AdminModal>
  );
}

function OrgStructureOverrideModal({
  tenantId,
  initialRow,
  onClose,
  onApplied,
}: {
  tenantId: string;
  initialRow: TenantOrgStructureConfigOut;
  onClose: () => void;
  onApplied: () => void;
}) {
  const levelOptions: { value: OrgStructureLevel; label: string; description: string }[] = [
    { value: "division", label: "חטיבה", description: "הרמה העליונה בשרשרת" },
    { value: "department", label: "אגף", description: "מתחת לחטיבה או כרמה ראשונה בארגון" },
    { value: "section", label: "מחלקה", description: "מתחת לאגף" },
    { value: "team", label: "צוות", description: "מתחת למחלקה או לרמה הפעילה שלפניה" },
  ];
  const [levels, setLevels] = useState<OrgStructureLevel[]>(initialRow.levels);
  const [isHierarchical, setIsHierarchical] = useState(initialRow.is_hierarchical);
  const [attachPositionToHierarchy, setAttachPositionToHierarchy] = useState(Boolean(initialRow.position_attachment_level));
  const [positionAttachmentLevel, setPositionAttachmentLevel] = useState<OrgStructureLevel | null>(
    initialRow.position_attachment_level && initialRow.levels.includes(initialRow.position_attachment_level)
      ? initialRow.position_attachment_level
      : initialRow.levels[initialRow.levels.length - 1] ?? null,
  );
  const [validFrom, setValidFrom] = useState(todayIsoDate());
  const [preview, setPreview] = useState<TenantOrgStructureOverridePreviewOut | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const availableAttachmentLevels = levelOptions.filter((option) => levels.includes(option.value));
  const nextAttachmentLevel = attachPositionToHierarchy
    ? (positionAttachmentLevel && levels.includes(positionAttachmentLevel)
      ? positionAttachmentLevel
      : (levels[levels.length - 1] ?? null))
    : null;

  function toggleLevel(level: OrgStructureLevel) {
    setPreview(null);
    setConfirmed(false);
    setLevels((current) => {
      const nextLevels = current.includes(level)
        ? current.filter((item) => item !== level)
        : levelOptions.filter((option) => [...current, level].includes(option.value)).map((option) => option.value);
      if (!nextLevels.length) {
        setPositionAttachmentLevel(null);
        return nextLevels;
      }
      if (!attachPositionToHierarchy) {
        return nextLevels;
      }
      if (!positionAttachmentLevel || !nextLevels.includes(positionAttachmentLevel)) {
        setPositionAttachmentLevel(nextLevels[nextLevels.length - 1]);
      }
      return nextLevels;
    });
  }

  async function handlePreview() {
    if (levels.length === 0) {
      setError("יש לבחור לפחות רמה ארגונית אחת.");
      return;
    }
    if (attachPositionToHierarchy && !nextAttachmentLevel) {
      setError("יש לבחור רמת שיוך לתפקיד.");
      return;
    }
    setLoadingPreview(true);
    setError(null);
    try {
      const result = await api.post<TenantOrgStructureOverridePreviewOut>(
        `/api/admin/tenants/${tenantId}/org-structure/preview-override`,
        {
          valid_from: validFrom,
          levels,
          position_attachment_level: nextAttachmentLevel,
          is_hierarchical: isHierarchical,
        },
      );
      setPreview(result);
    } catch (err) {
      setError(getApiErrorMessage(err, "לא ניתן לחשב השפעת שינוי חריג"));
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleApply() {
    if (!preview) {
      setError("יש לבצע preview לפני החלת השינוי.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.put(`/api/admin/tenants/${tenantId}/org-structure`, {
        action: "update",
        force_override: true,
        valid_from: validFrom,
        levels,
        position_attachment_level: nextAttachmentLevel,
        is_hierarchical: isHierarchical,
      });
      dispatchOrgStructureUpdated(tenantId);
      onApplied();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, "לא ניתן להחיל שינוי חריג למבנה הארגוני"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminModal onBackdropClick={onClose}>
      <AdminModalPanel className="max-w-3xl">
        <AdminModalHeader
          title="שינוי חריג למבנה הארגוני"
          subtitle="הפעולה זמינה לסופר אדמין בלבד. הנתונים לא יימחקו, אלא יותאמו לרמות הפעילות החדשות."
          onClose={onClose}
        />
        <AdminModalBody className="space-y-4">
          <AdminModalMessage tone="warning">
            המבנה הארגוני מוגדר פעם אחת ונעול. שינוי חריג יבצע התאמת נתונים אוטומטית ליחידות, תפקידים והעסקות עובדים.
          </AdminModalMessage>

          <div className={ADMIN_MODAL_GRID}>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold text-slate-700">רמות פעילות לפי סדר</div>
              <div className="mt-3 grid gap-2">
                {levelOptions.map((option) => (
                  <label key={option.value} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={levels.includes(option.value)}
                      onChange={() => toggleLevel(option.value)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300"
                    />
                    <span className="flex-1">
                      <span className="block font-semibold text-slate-800">{option.label}</span>
                      <span className="block text-[11px] text-slate-500">{option.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700">
                <div className="font-semibold text-slate-800">כללים קבועים</div>
                <label className="mt-3 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={isHierarchical}
                    onChange={(event) => {
                      setIsHierarchical(event.target.checked);
                      setPreview(null);
                      setConfirmed(false);
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300"
                  />
                  <span>
                    <span className="block font-semibold text-slate-800">המבנה היררכי ומקושר בין הרמות</span>
                    <span className="mt-1 block text-[11px] text-slate-500">
                      בטל כדי לאפשר מבנה ללא תלות אב-בן בין כל הרמות הפעילות.
                    </span>
                  </span>
                </label>

                <label className="mt-3 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={attachPositionToHierarchy}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setAttachPositionToHierarchy(checked);
                      if (checked && levels.length > 0 && !positionAttachmentLevel) {
                        setPositionAttachmentLevel(levels[levels.length - 1]);
                      }
                      setPreview(null);
                      setConfirmed(false);
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300"
                  />
                  <span>
                    <span className="block font-semibold text-slate-800">התפקיד משויך להיררכיה</span>
                    <span className="mt-1 block text-[11px] text-slate-500">
                      בטל כדי לאפשר תפקידים שלא מקושרים לשום רמה בהיררכיה.
                    </span>
                  </span>
                </label>

                {attachPositionToHierarchy ? (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                    <label className="block text-[11px] font-semibold text-slate-700">רמת שיוך התפקיד</label>
                    <select
                      value={positionAttachmentLevel ?? ""}
                      onChange={(event) => {
                        setPositionAttachmentLevel((event.target.value || null) as OrgStructureLevel | null);
                        setPreview(null);
                        setConfirmed(false);
                      }}
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700"
                    >
                      <option value="">בחר רמה</option>
                      {availableAttachmentLevels.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                    תפקידים יישמרו ללא שיוך להיררכיה.
                  </div>
                )}
              </div>

              {preview ? (
                <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-xs text-brand-900">
                  <div className="font-semibold">תצוגה מקדימה להשפעה</div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg bg-white/70 px-3 py-2">יחידות שיומרו: <strong>{preview.impact.converted_units_count}</strong></div>
                    <div className="rounded-lg bg-white/70 px-3 py-2">יחידות שיחוברו מחדש: <strong>{preview.impact.reparented_units_count}</strong></div>
                    <div className="rounded-lg bg-white/70 px-3 py-2">תפקידים שיושפעו: <strong>{preview.impact.affected_positions_count}</strong></div>
                    <div className="rounded-lg bg-white/70 px-3 py-2">רשומות העסקה שיושפעו: <strong>{preview.impact.affected_employments_count}</strong></div>
                  </div>
                  {preview.impact.warnings.length ? (
                    <div className="mt-3 space-y-2 text-[11px] text-brand-800">
                      {preview.impact.warnings.map((warning) => (
                        <div key={warning} className="rounded-lg border border-brand-100 bg-white/70 px-3 py-2">
                          {warning}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <AdminModalMessage>
                  תצוגה מקדימה תוצג כאן אחרי בחירת תאריך והרצת בדיקה, ורק אחריה ניתן יהיה להחיל את השינוי.
                </AdminModalMessage>
              )}
            </div>
          </div>

          <AdminDateFields
            fromField={
              <HebrewDatePicker
                value={validFrom}
                onChange={(value) => {
                  setValidFrom(value);
                  setPreview(null);
                  setConfirmed(false);
                }}
                className={ADMIN_MODAL_INPUT}
              />
            }
            toLabel="החלה"
            toField={
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                השינוי יחול מהתאריך שנבחר ללא תאריך סיום, תוך שמירת היסטוריה מלאה של המבנה הקודם.
              </div>
            }
          />

          {preview ? (
            <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-amber-300"
              />
              <span>
                <span className="block font-semibold">אני מאשר/ת לבצע שינוי חריג במבנה הארגוני</span>
                <span className="mt-1 block text-[11px] text-amber-800">
                  השינוי ישמר היסטוריה, ימיר רמות ויעדכן שיוכים רלוונטיים בלי למחוק נתוני עובדים.
                </span>
              </span>
            </label>
          ) : null}

          {error ? <AdminModalMessage tone="danger">{error}</AdminModalMessage> : null}
        </AdminModalBody>
        <AdminModalFooter>
          <button onClick={onClose} className={ADMIN_MODAL_ACTION_SECONDARY}>
            ביטול
          </button>
          <button
            onClick={handlePreview}
            disabled={loadingPreview || saving}
            className={ADMIN_MODAL_ACTION_WARNING}
          >
            {loadingPreview ? "מחשב..." : "תצוגה מקדימה"}
          </button>
          <button
            onClick={handleApply}
            disabled={saving || !preview || !confirmed}
            className={ADMIN_MODAL_ACTION_DANGER}
          >
            {saving ? "מחיל..." : "החל שינוי חריג"}
          </button>
        </AdminModalFooter>
      </AdminModalPanel>
    </AdminModal>
  );
}

// ─── Parent form ──────────────────────────────────────────────────────────────

function ParentForm({ tenant, onLogoUploaded }: { tenant: TenantOut; onLogoUploaded: (url: string) => Promise<void> }) {
  const statusVal = tenant.status?.status ?? "trial";
  const statusLabel = STATUS_LABELS[statusVal] ?? statusVal;
  const subscription = tenant.subscription;
  const identityAudit = getAuditStamp(tenant.identity ?? {});
  const pageCreatedBy = tenant.created_by ?? identityAudit.by;
  const pageUpdatedAt = tenant.updated_at ?? identityAudit.at;
  const pageUpdatedBy = tenant.updated_by ?? identityAudit.by;
  const billingCycleLabel = subscription?.billing_cycle ?? "—";
  const billingCycleDisplay = BILLING_CYCLE_LABELS[billingCycleLabel] ?? billingCycleLabel;
  const subscriptionCurrency = subscription?.currency ?? "ILS";
  const billingAnchorDisplay = subscription?.billing_anchor_day ? `בכל ${subscription.billing_anchor_day} לחודש` : "—";
  const cycleChargeLabel = BILLING_CYCLE_CHARGE_LABELS[billingCycleLabel] ?? "חיוב למחזור";
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
            <LogoUploadField
              storageKey={tenant.tenant_id}
              value={tenant.identity?.logo_url}
              onChange={onLogoUploaded}
              size={72}
              label=""
              hint="לחץ להעלאת לוגו"
              className="shrink-0"
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
                  מחזור {billingCycleDisplay}
                </span>
              </div>
            </div>
          </div>

          <div className="grid flex-1 min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-6">
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
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5">
              <div className="mb-1 text-[11px] font-medium text-emerald-700">מחיר חודשי</div>
              <div className="text-sm font-semibold text-emerald-900">
                {subscription ? fmtMoney(subscription.current_monthly_total_ils, subscriptionCurrency) : "—"}
              </div>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-2.5">
              <div className="mb-1 text-[11px] font-medium text-blue-700">מחיר שנתי</div>
              <div className="text-sm font-semibold text-blue-900">
                {subscription ? fmtMoney(subscription.current_yearly_total_ils, subscriptionCurrency) : "—"}
              </div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5">
              <div className="mb-1 text-[11px] font-medium text-amber-700">עלות הקמה</div>
              <div className="text-sm font-semibold text-amber-900">
                {subscription ? fmtMoney(subscription.current_setup_total_ils, subscriptionCurrency) : "—"}
              </div>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2.5">
              <div className="mb-1 text-[11px] font-medium text-rose-700">חיוב פתיחה</div>
              <div className="text-sm font-semibold text-rose-900">
                {subscription ? fmtMoney(subscription.initial_charge_total_ils, subscriptionCurrency) : "—"}
              </div>
              <div className="mt-1 text-[11px] text-rose-700/80">מחזור ראשון כולל הקמה</div>
            </div>
            <div className="rounded-xl border border-violet-200 bg-violet-50/80 px-3 py-2.5">
              <div className="mb-1 text-[11px] font-medium text-violet-700">החיוב הבא</div>
              <div className="text-sm font-semibold text-violet-900">
                {subscription ? fmtMoney(subscription.next_charge_total_ils, subscriptionCurrency) : "—"}
              </div>
              <div className="mt-1 text-[11px] text-violet-700/80">
                {subscription?.next_renewal_at ? `${cycleChargeLabel} ב-${fmtDate(subscription.next_renewal_at)}` : "תאריך חיוב הבא עדיין לא נקבע"}
              </div>
              <div className="mt-1 text-[11px] text-violet-700/80">יום חיוב קבוע: {billingAnchorDisplay}</div>
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
function sortRows<T extends { valid_from: string; valid_to?: string | null }>(rows: T[]): T[] {
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
    id: "subscription", label: "הגדרות מנוי",
    columns: [
      { key: "valid_from",    label: "תוקף מ",       required: true },
      { key: "valid_to",      label: "תוקף עד" },
      { key: "template_id",   label: "תבנית" },
      { key: "billing_cycle", label: "מחזור חיוב",   required: true },
      { key: "currency",      label: "מטבע",         required: true },
      { key: "billing_anchor_day", label: "יום חיוב" },
      { key: "discount_pct",  label: "הנחה %" },
      { key: "is_price_locked", label: "מחיר נעול" },
      { key: "current_monthly_total_ils", label: "לחודש" },
      { key: "current_yearly_total_ils", label: "לשנה" },
      { key: "current_setup_total_ils", label: "הקמה" },
      { key: "initial_charge_total_ils", label: "פתיחה" },
      { key: "next_charge_total_ils", label: "חיוב הבא" },
      { key: "next_renewal_at", label: "חידוש הבא" },
      { key: "created_at",    label: "תאריך שינוי" },
      { key: "created_by",    label: "בוצע ע\"י" },
    ],
    rows: sorted.map((r) => {
      const audit = getAuditStamp(r);
      return {
      valid_from:    fmtDate(r.valid_from),
      valid_to:      r.valid_to ? fmtDate(r.valid_to) : "—",
      template_id:   (r.template_id ? templateNames[r.template_id] : null) ?? "—",
      billing_cycle: BILLING_CYCLE_LABELS[r.billing_cycle] ?? r.billing_cycle,
      currency:      r.currency,
      billing_anchor_day: r.billing_anchor_day ? `כל ${r.billing_anchor_day} בחודש` : "—",
      discount_pct:  `${r.discount_pct}%`,
      is_price_locked: r.is_price_locked ? "כן" : "לא",
      current_monthly_total_ils: fmtMoney(r.current_monthly_total_ils, r.currency),
      current_yearly_total_ils: fmtMoney(r.current_yearly_total_ils, r.currency),
      current_setup_total_ils: fmtMoney(r.current_setup_total_ils, r.currency),
      initial_charge_total_ils: fmtMoney(r.initial_charge_total_ils, r.currency),
      next_charge_total_ils: fmtMoney(r.next_charge_total_ils, r.currency),
      next_renewal_at: fmtDate(r.next_renewal_at),
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

function buildOrgStructureTab(rows: TenantOrgStructureConfigOut[], onDblClick: (i: number) => void): ChildTab {
  const sorted = sortRows(rows);
  return {
    id: "org_structure",
    label: "מבנה ארגוני",
    columns: [
      { key: "valid_from", label: "תוקף מ", required: true },
      { key: "valid_to", label: "תוקף עד" },
      { key: "levels", label: "רמות פעילות" },
      { key: "position_attachment_level", label: "שיוך תפקיד" },
      { key: "is_hierarchical", label: "היררכי" },
      { key: "created_at", label: "תאריך שינוי" },
      { key: "created_by", label: "בוצע ע\"י" },
    ],
    rows: sorted.map((row) => {
      const audit = getAuditStamp(row);
      const summary = formatOrgStructureSummary(row);
      return {
        valid_from: fmtDate(row.valid_from),
        valid_to: row.valid_to ? fmtDate(row.valid_to) : "—",
        levels: summary.levelsText,
        position_attachment_level: summary.attachmentText,
        is_hierarchical: summary.hierarchyText,
        created_at: fmtDateTime(audit.at),
        created_by: audit.by ?? "—",
        _current: !row.valid_to,
        _valid_from_raw: row.valid_from,
        _valid_to_raw: row.valid_to ?? null,
      };
    }),
    temporalFilter: true,
    onRowDoubleClick: (index) => onDblClick(rows.indexOf(sorted[index])),
  };
}

function buildPaymentTrackingTab(
  rows: TenantPaymentTrackingItem[],
  onDblClick: (i: number) => void,
): ChildTab {
  const sorted = [...rows].sort((a, b) => (a.billing_period < b.billing_period ? 1 : -1));
  return {
    id: "payment_tracking",
    label: "מעקב תשלומים",
    columns: [
      { key: "billing_period", label: "חודש" },
      { key: "scheduled_charge_date", label: "תאריך חיוב" },
      { key: "status", label: "סטטוס" },
      { key: "amount_ils", label: "סכום" },
      { key: "paid_at", label: "שולם בתאריך" },
      { key: "external_ref", label: "אסמכתא" },
      { key: "notes", label: "הערות" },
      { key: "source", label: "מקור" },
    ],
    rows: sorted.map((row) => ({
      billing_period: row.billing_period,
      scheduled_charge_date: fmtDate(row.scheduled_charge_date),
      status: `${PAYMENT_TRACKING_STATUS_LABELS[row.status]}${row.is_overdue ? " • בפיגור" : ""}`,
      amount_ils: fmtMoney(row.amount_ils ?? null, "ILS"),
      paid_at: fmtDate(row.paid_at),
      external_ref: row.external_ref || "—",
      notes: row.notes || "—",
      source: row.source === "manual" ? "עודכן ידנית" : "אוטומטי מהמנוי",
      _current: row.source === "manual",
    })),
    temporalFilter: false,
    onRowDoubleClick: (i) => onDblClick(rows.indexOf(sorted[i])),
    emptyMessage: "אין עדיין חודשי מעקב זמינים",
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
    label: "מודולים בפועל",
    columns: [
      { key: "valid_from", label: "מתאריך", required: true },
      { key: "valid_to",   label: "בתוקף עד" },
      { key: "module_slug", label: "מודול" },
      { key: "source_type", label: "מקור" },
      { key: "status", label: "סטטוס" },
      { key: "seats", label: "מושבים למודול" },
      { key: "pricing_mode", label: "תמחור" },
      { key: "base_price", label: "בסיס" },
      { key: "per_seat", label: "למושב נוסף" },
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
  base_fee: "דמי מנוי", per_seat: "מושבים נוספים",
  setup_fee: "דמי הקמה", addon: "תוספת", credit: "זיכוי", manual: "ידני",
};

function periodShort(p: string) {
  const [y, m] = p.split("-");
  return `${ILS_MONTHS_SHORT[parseInt(m)]} ${y}`;
}

const DELETE_COUNT_LABELS: Record<string, string> = {
  identity_rows: "רשומות זהות",
  contact_rows: "רשומות קשר",
  address_rows: "רשומות כתובת",
  status_rows: "רשומות סטטוס",
  subscription_rows: "רשומות מנוי",
  subscription_module_rows: "רשומות מודולים",
  seat_change_logs: "לוג שינוי מושבים",
  billing_charges: "חיובים",
  invoices: "חשבוניות",
  invoice_lines: "שורות חשבונית",
  quotes: "הצעות מחיר",
  quote_lines: "שורות הצעה",
  billing_contracts: "חוזי חיוב",
  billing_contract_items: "שורות חוזה",
  billing_change_events: "אירועי חיוב",
  billing_bill_runs: "ריצות חיוב",
  billing_documents: "מסמכי חיוב",
  billing_document_lines: "שורות מסמך",
  billing_ledger_entries: "רשומות ספר עזר",
  audit_logs: "Audit logs",
};

function TenantDeleteModal({
  tenant,
  onClose,
  onDeleted,
}: {
  tenant: TenantOut;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [impact, setImpact] = useState<TenantDeleteImpact | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [purgeAuditLogs, setPurgeAuditLogs] = useState(false);
  const [deleteLogo, setDeleteLogo] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<TenantDeleteImpact>(
        `/api/admin/tenants/${tenant.tenant_id}/delete-impact?purge_audit_logs=${purgeAuditLogs ? "true" : "false"}&delete_logo=${deleteLogo ? "true" : "false"}`
      )
      .then((data) => {
        if (!cancelled) setImpact(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(getApiErrorMessage(e, "לא הצלחתי לטעון את פרטי המחיקה"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deleteLogo, purgeAuditLogs, tenant.tenant_id]);

  async function handleDelete() {
    if (!impact) return;
    if (confirmation.trim() !== impact.confirmation_phrase) {
      setError("יש להקליד את ביטוי האישור בדיוק כפי שמופיע.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post(`/api/admin/tenants/${tenant.tenant_id}/hard-delete`, {
        confirmation_phrase: confirmation.trim(),
        purge_audit_logs: purgeAuditLogs,
        delete_logo: deleteLogo,
      });
      dispatchTenantOptionsUpdated();
      onDeleted();
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "מחיקת הארגון נכשלה"));
    } finally {
      setSaving(false);
    }
  }

  const countEntries = impact
    ? Object.entries(impact.counts).filter(([, value]) => value > 0)
    : [];

  return (
    <AdminModal onBackdropClick={onClose}>
      <AdminModalPanel className="max-w-3xl" dir="rtl">
        <div className="flex items-center justify-between border-b border-red-200 bg-red-50 px-6 py-5">
          <div>
            <h3 className="text-sm font-semibold text-red-900">מחיקת ארגון לצמיתות</h3>
            <p className="mt-1 text-[11px] text-red-700">הפעולה מוחקת את הארגון ואת כל הנתונים המשויכים אליו ואינה ניתנת לשחזור.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/70 text-red-700"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-6 space-y-4">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900 space-y-1">
            <div><strong>ארגון:</strong> {tenant.identity?.name_he ?? "—"} ({tenant.org_number})</div>
            <div><strong>ח.פ / ע.מ:</strong> {tenant.identity?.tax_id ?? "—"}</div>
            <div>רק משתמש מסוג <strong>super admin</strong> יכול לבצע את הפעולה הזו.</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700">
              <input type="checkbox" checked={deleteLogo} onChange={(e) => setDeleteLogo(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
              <span>מחק גם את קובץ הלוגו מה־storage אם נמצא קובץ משויך.</span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700">
              <input type="checkbox" checked={purgeAuditLogs} onChange={(e) => setPurgeAuditLogs(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
              <span>מחק גם audit logs המשויכים לארגון הזה.</span>
            </label>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : impact ? (
            <>
              <div className="rounded-lg border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700">
                  נתונים שיימחקו
                </div>
                <div className="grid gap-x-6 gap-y-2 px-4 py-3 sm:grid-cols-2 text-xs text-slate-700">
                  {countEntries.map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between border-b border-slate-100 py-1">
                      <span>{DELETE_COUNT_LABELS[key] ?? key}</span>
                      <span className="font-semibold tabular-nums">{value}</span>
                    </div>
                  ))}
                  {countEntries.length === 0 && <div className="text-slate-500">לא נמצאו רשומות משויכות מעבר לרשומת הארגון עצמה.</div>}
                </div>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 space-y-2">
                <div>כדי לאשר, יש להקליד בדיוק את הביטוי הבא:</div>
                <code className="block rounded bg-white px-3 py-2 text-[12px] text-slate-900 border border-amber-200">{impact.confirmation_phrase}</code>
                {impact.logo_will_be_deleted ? (
                  <div>לוגו משויך יימחק מה־storage כחלק מהפעולה.</div>
                ) : (
                  <div>לא זוהה קובץ לוגו למחיקה ב־storage.</div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">ביטוי אישור</label>
                <input
                  type="text"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:border-red-400"
                  placeholder={impact.confirmation_phrase}
                />
              </div>
            </>
          ) : null}

          {error && (
            <div className="flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertCircle size={13} /> {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-1.5 text-xs border border-slate-300 bg-white text-slate-600 rounded hover:bg-slate-50">
            ביטול
          </button>
          <button
            onClick={handleDelete}
            disabled={loading || saving || !impact}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded font-semibold disabled:opacity-50"
          >
            <Trash2 size={12} />
            {saving ? "מוחק..." : "מחק ארגון וכל הנתונים"}
          </button>
        </div>
      </AdminModalPanel>
    </AdminModal>
  );
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
    <AdminModal onBackdropClick={onClose}>
      <AdminModalPanel className="max-w-5xl" dir="rtl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#dce4f0] px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-[#1a3a6e]">החל תבנית על הארגון</h3>
            <p className="mt-1 text-sm text-slate-600">הפעולה תעדכן את פרטי המנוי, המודולים והמושבים של הארגון מתאריך שתבחר.</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-200"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-auto grid gap-4 px-6 py-6 md:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
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
                  <span>מחזור: {BILLING_CYCLE_LABELS[selectedTemplate.default_billing_cycle] ?? selectedTemplate.default_billing_cycle}</span>
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

        {error ? (
          <div className="px-5 pb-3">
            <AdminModalMessage tone="danger">{error}</AdminModalMessage>
          </div>
        ) : null}

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
      </AdminModalPanel>
    </AdminModal>
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
  const [dropdownOpen, setDropdownOpen] = useState(false);
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

  function switchToMode(nextMode: ModuleMode) {
    setDropdownOpen(false);
    setError(null);
    if (nextMode === "add") {
      setValidFrom(today);
      setValidTo("");
    }
    setMode(nextMode);
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
    if (action !== "close" && action !== "delete" && validTo && validFrom && validTo < validFrom) {
      setError("תאריך הסיום חייב להיות מאוחר או שווה לתאריך ההתחלה");
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
  const areaCls = "min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:border-brand-400";
  const showPayloadForm = mode === "add" || mode === "update" || mode === "set";
  const titleMap: Record<ModuleMode, string> = {
    update: "עדכון — מודולים בפועל",
    add: "רשומה חדשה — מודולים בפועל",
    set: "קבע תקופה — מודולים בפועל",
    close: "סגירת תקופה — מודולים בפועל",
    delete: "מחיקת שורה — מודולים בפועל",
  };
  const headerBg =
    mode === "set" ? "bg-amber-50"
    : mode === "delete" ? "bg-red-50"
    : mode === "close" ? "bg-orange-50"
    : "bg-[#dce4f0]";
  const headerText =
    mode === "set" ? "text-amber-800"
    : mode === "delete" ? "text-red-800"
    : mode === "close" ? "text-orange-800"
    : "text-[#1a3a6e]";
  const subtitleMap: Record<ModuleMode, string> = {
    update: "עדכון שורת מודול קיימת תוך שמירה על מבנה זהה לשאר המסכים הטמפורליים.",
    add: "יצירת רשומת מודול חדשה עם טווח תוקף ומבנה זהה לשאר מסכי העריכה.",
    set: "קביעה מחליפה או מפצלת רשומות חופפות של אותו מודול בטווח התאריכים שתבחר.",
    close: "סגירת תקופה מסיימת את התוקף של השורה הקיימת ומשאירה אותה בהיסטוריה.",
    delete: "מחיקת שורה מסירה אותה לחלוטין מההיסטוריה של המודול.",
  };
  const isExistingRow = Boolean(initial);

  return (
    <AdminModal onBackdropClick={onClose}>
      <AdminModalPanel
        className="max-w-6xl"
        dir="rtl"
        onClick={() => setDropdownOpen(false)}
      >
        <div className={`flex items-center justify-between border-b border-slate-200 px-6 py-5 ${headerBg}`}>
          <div>
            <h3 className={`text-lg font-bold ${headerText}`}>{titleMap[mode]}</h3>
            <p className={`mt-1 text-sm ${mode === "update" || mode === "add" ? "text-slate-600" : headerText}`}>{subtitleMap[mode]}</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-200"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-auto grid gap-4 px-6 py-6 md:grid-cols-2">
          {mode === "set" && (
            <div className="md:col-span-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              הפעולה תחליף או תפצל כל רשומה חופפת של המודול בטווח התאריכים שתגדיר.
            </div>
          )}

          {showPayloadForm && (
            <>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">מודול</label>
            <select className={inputCls} value={form.module_slug} onChange={(e) => setField("module_slug", e.target.value)} disabled={isExistingRow || loading || saving}>
              <option value="">{loading ? "טוען מודולים..." : "בחר מודול"}</option>
              {modules.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">מקור</label>
            <select className={inputCls} value={form.source_type} onChange={(e) => setField("source_type", e.target.value)} disabled={saving}>
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
                <label className="mb-1 block text-xs font-semibold text-slate-600">מחיר למושב נוסף</label>
                <input className={inputCls} type="number" min="0" step="0.01" value={form.override_per_seat_ils} onChange={(e) => setField("override_per_seat_ils", e.target.value)} disabled={saving} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">דמי הקמה</label>
                <input className={inputCls} type="number" min="0" step="0.01" value={form.override_setup_fee_ils} onChange={(e) => setField("override_setup_fee_ils", e.target.value)} disabled={saving} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">מושבים כלולים במחיר הבסיס</label>
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
            <textarea className={areaCls} value={form.notes} onChange={(e) => setField("notes", e.target.value)} disabled={saving} />
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
        {error ? (
          <div className="px-5 pb-3">
            <AdminModalMessage tone="danger">{error}</AdminModalMessage>
          </div>
        ) : null}
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 rounded-b-xl">
          {mode === "delete" ? (
            <>
              <button onClick={() => switchToMode("update")} className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50">חזרה</button>
              <button
                onClick={() => runAction("delete")}
                disabled={saving || loading}
                className="rounded-md bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? "מוחק..." : "מחק שורה"}
              </button>
            </>
          ) : mode === "close" ? (
            <>
              <button onClick={() => switchToMode("update")} className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50">חזרה</button>
              <button
                onClick={() => runAction("close")}
                disabled={saving || loading}
                className="rounded-md bg-orange-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {saving ? "שומר..." : "סגור תקופה"}
              </button>
            </>
          ) : mode === "set" ? (
            <>
              <button onClick={() => switchToMode("update")} className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50">חזרה</button>
              <button
                onClick={() => runAction("set")}
                disabled={saving || loading}
                className="rounded-md bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {saving ? "שומר..." : "קבע תקופה"}
              </button>
            </>
          ) : mode === "add" ? (
            <>
              <button onClick={onClose} className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50">ביטול</button>
              <button
                onClick={() => runAction("add")}
                disabled={saving || loading}
                className="rounded-md bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? "שומר..." : "הוסף רשומה"}
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50">ביטול</button>
              <SplitActionButton
                primaryLabel={saving ? "שומר..." : "שמור"}
                onPrimaryClick={() => runAction("update")}
                primaryDisabled={saving || loading}
                menuOpen={dropdownOpen}
                onMenuToggle={() => setDropdownOpen((current) => !current)}
                minMenuWidthClassName="min-w-[150px]"
                buttonClassName="bg-brand-600 hover:bg-brand-700 text-white"
                actions={[
                  {
                    label: "רשומה חדשה",
                    onClick: () => switchToMode("add"),
                  },
                  {
                    label: "קבע תקופה",
                    onClick: () => switchToMode("set"),
                    tone: "warning",
                  },
                  {
                    label: "סגור תקופה",
                    onClick: () => switchToMode("close"),
                    tone: "warning",
                  },
                  {
                    label: "מחק שורה",
                    onClick: () => switchToMode("delete"),
                    tone: "danger",
                  },
                ]}
              />
            </>
          )}
        </div>
      </AdminModalPanel>
    </AdminModal>
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
    <AdminModal onBackdropClick={onClose}>
      <AdminModalPanel className="max-w-6xl" dir="rtl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#dce4f0] px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-[#1a3a6e]">רענון מנוי מתבנית</h3>
            <p className="mt-1 text-sm text-slate-600">המערכת תחשב פערים מול התבנית ותאפשר apply רק אחרי תצוגה מקדימה.</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-200"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-auto grid gap-4 px-6 py-6 md:grid-cols-[320px_minmax(0,1fr)]">
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
              <>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-2">
                  <div className="flex items-center justify-between"><span>חודשי נוכחי</span><span className="font-semibold">{fmtIls(preview.current_monthly_total_ils)}</span></div>
                  <div className="flex items-center justify-between"><span>חודשי מוצע</span><span className="font-semibold">{fmtIls(preview.proposed_monthly_total_ils)}</span></div>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-2"><span>דלתא</span><span className="font-bold">{fmtIls(String(parseFloat(preview.proposed_monthly_total_ils) - parseFloat(preview.current_monthly_total_ils)))}</span></div>
                </div>
                {parseFloat(preview.immediate_proration_total_ils) !== 0 && (
                  <div className={`mt-3 rounded-xl border p-4 text-xs ${parseFloat(preview.immediate_proration_total_ils) > 0 ? 'bg-orange-50 border-orange-200 text-orange-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm shrink-0">
                        {parseFloat(preview.immediate_proration_total_ils) > 0 ? '!' : '✓'}
                      </span>
                      {parseFloat(preview.immediate_proration_total_ils) > 0 ? 'חיוב יחסי מיידי' : 'זיכוי יחסי מיידי'}
                    </div>
                    <p className="opacity-90 mt-1 mb-2">
                      {parseFloat(preview.immediate_proration_total_ils) > 0 
                        ? 'בשל השינוי באמצע החודש, המערכת תיצור חיוב מיידי יחסי עבור הימים שנותרו עד לתחילת מחזור החיוב הבא של הלקוח.'
                        : 'בשל הפחתת מושבים או מודולים, המערכת תיצור זיכוי יחסי באופן מיידי על הימים שנותרו בחודש הנוכחי.'}
                    </p>
                    <div className="text-lg font-black">{fmtIls(preview.immediate_proration_total_ils)}</div>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">פערי מודולים ומושבים</div>
            <div className="max-h-[420px] overflow-auto">
              <table className="admin-data-table w-full text-xs">
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
        {error ? (
          <div className="px-5 pb-3">
            <AdminModalMessage tone="danger">{error}</AdminModalMessage>
          </div>
        ) : null}
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 rounded-b-xl">
          <button onClick={onClose} className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50">ביטול</button>
          <button onClick={handleApply} disabled={!preview || applying} className="rounded-md bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {applying ? "מחיל..." : "החל סנכרון"}
          </button>
        </div>
      </AdminModalPanel>
    </AdminModal>
  );
}

// ─── Tenant Invoice Detail Modal ──────────────────────────────────────────────

function InvoiceViewModal({
  invoice: initial, onClose, onUpdated, initialShowPaid = false,
}: { invoice: TenantInvoiceItem; onClose: () => void; onUpdated: () => void; initialShowPaid?: boolean }) {
  const [inv, setInv]         = useState<TenantInvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [showPaid, setShowPaid] = useState(initialShowPaid);
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payRef,  setPayRef]  = useState("");

  useEffect(() => {
    api.get<TenantInvoiceDetail>(`/api/admin/billing/documents/${initial.id}`)
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
    <AdminModal onBackdropClick={onClose}>
      <AdminModalPanel className="max-w-6xl" dir="rtl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#dce4f0] px-6 py-5 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-[#1a3a6e]">{initial.invoice_number}</span>
            <BillingStatusBadge cfg={st} />
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-200 text-slate-500"><X size={16} /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : inv ? (
          <div className="flex-1 overflow-auto px-6 py-6 space-y-4">
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
              <table className="admin-data-table w-full text-xs border-collapse">
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
                      <td className="cell-numeric px-3 py-1.5 border-b border-slate-100 font-medium">{fmtIls(line.amount_ils)}</td>
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
                <button onClick={() => doAction(`/api/admin/billing/documents/${initial.id}/mark-paid`, { payment_date: payDate, payment_ref: payRef || null })}
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
              <button onClick={() => doAction(`/api/admin/billing/documents/${initial.id}/finalize`, {})}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white rounded font-semibold disabled:opacity-50">
                <Send size={12} /> שלח ללקוח
              </button>
            )}
            <button onClick={() => window.open(`/admin/billing/documents/${initial.id}/print`, '_blank')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-900 text-white rounded font-semibold">
              <Printer size={12} /> הדפס / יצא ל-PDF
            </button>
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
      </AdminModalPanel>
    </AdminModal>
  );
}

function PaymentTrackingModal({
  tenantId,
  item: initial,
  onClose,
  onUpdated,
}: {
  tenantId: string;
  item: TenantPaymentTrackingItem;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [status, setStatus] = useState<TenantPaymentTrackingItem["status"]>(initial.status);
  const [paidAt, setPaidAt] = useState(initial.paid_at ?? "");
  const [amount, setAmount] = useState(initial.amount_ils ?? "");
  const [externalRef, setExternalRef] = useState(initial.external_ref ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await api.put(`/api/admin/tenants/${tenantId}/payment-tracking/${initial.billing_period}`, {
        status,
        paid_at: paidAt || null,
        amount_ils: amount.trim() ? amount.trim() : null,
        external_ref: externalRef.trim() || null,
        notes: notes.trim() || null,
      });
      onUpdated();
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "שגיאה בשמירת מעקב התשלום"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminModal onBackdropClick={onClose}>
      <AdminModalPanel className="max-w-5xl" dir="rtl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#dce4f0] px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-[#1a3a6e]">תיעוד תשלום חיצוני</h3>
            <p className="mt-1 text-sm text-slate-600">הגבייה עצמה נעשית במערכת נפרדת. כאן מתעדים מה קרה בפועל עבור {initial.billing_period}.</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-white/70"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-auto space-y-4 px-6 py-6">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-slate-400">חודש חיוב</div>
              <div className="mt-1 font-semibold text-slate-700">{initial.billing_period}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-slate-400">תאריך חיוב מחושב</div>
              <div className="mt-1 font-semibold text-slate-700">{fmtDate(initial.scheduled_charge_date)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">סטטוס</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TenantPaymentTrackingItem["status"])}
                className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-brand-400 focus:outline-none"
              >
                {Object.entries(PAYMENT_TRACKING_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">תאריך תשלום</label>
              <HebrewDatePicker
                value={paidAt}
                onChange={setPaidAt}
                className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-brand-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">סכום שתועד</label>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-brand-400 focus:outline-none"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">אסמכתא חיצונית</label>
              <input
                type="text"
                value={externalRef}
                onChange={(e) => setExternalRef(e.target.value)}
                className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-brand-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">הערות</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-brand-400 focus:outline-none"
              placeholder="לדוגמה: שולם בהעברה, ממתינים לאישור, שולם חלקית..."
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertCircle size={13} /> {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 rounded-b-xl border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button onClick={onClose} className="rounded border border-slate-300 bg-white px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
            ביטול
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-[#0d6efd] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#0b5ed7] disabled:opacity-50"
          >
            {saving ? "שומר..." : "שמור"}
          </button>
        </div>
      </AdminModalPanel>
    </AdminModal>
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
  const [paymentTracking, setPaymentTracking] = useState<TenantPaymentTrackingSummary | null>(null);
  const [billingSettings, setBillingSettings] = useState<BillingSettingsOut | null>(null);
  const [templateOptions, setTemplateOptions] = useState<TemplateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBillingInvoice, setSelectedBillingInvoice] = useState<{
    invoice: TenantInvoiceItem;
    showPaid?: boolean;
  } | null>(null);
  const [selectedPaymentTracking, setSelectedPaymentTracking] = useState<TenantPaymentTrackingItem | null>(null);
  const [showApplyTemplate, setShowApplyTemplate] = useState(false);
  const [showSyncTemplate, setShowSyncTemplate] = useState(false);
  const [showDeleteTenant, setShowDeleteTenant] = useState(false);
  const [showOrgStructureOverrideModal, setShowOrgStructureOverrideModal] = useState(false);
  const [moduleModalState, setModuleModalState] = useState<{ initial?: TenantSubscriptionModuleOut | null } | null>(null);
  const [editState, setEditState] = useState<{
    section: SectionKey;
    data: Record<string, string>;
    initialValidFrom: string;
    initialValidTo: string;
    allRows: Array<{ valid_from: string; valid_to?: string; contact_type?: string }>;
    initialMode?: EditMode;
  } | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get<TenantOut>(`/api/admin/tenants/${id}`),
      api.get<TenantHistory>(`/api/admin/tenants/${id}/history`),
      api.get<TemplateOption[]>("/api/admin/templates").catch(() => []),
      (BILLING_ENABLED
        ? api.get<TenantPaymentTrackingSummary>(`/api/admin/tenants/${id}/payment-tracking`).catch(() => null)
        : Promise.resolve(null)),
      (BILLING_ENABLED
        ? api.get<TenantBillingSummary>(`/api/admin/tenants/${id}/billing`).catch(() => null)
        : Promise.resolve(null)),
      (BILLING_ENABLED
        ? api.get<BillingSettingsOut>("/api/admin/billing/settings").catch(() => null)
        : Promise.resolve(null)),
    ])
      .then(([t, h, templates, tracking, b, settings]) => {
        setTenant(t);
        setHistory(h);
        setTemplateOptions(templates);
        setPaymentTracking(tracking);
        setBilling(b);
        setBillingSettings(settings);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleParentLogoChange = useCallback(async (logoUrl: string) => {
    if (!tenant?.identity) {
      throw new Error("לא נמצאה רשומת זהות פעילה לשמירת הלוגו");
    }

    const saved = await api.put<TenantOut>(`/api/admin/tenants/${tenant.tenant_id}`, {
      valid_from: tenant.identity.valid_from,
      valid_to: tenant.identity.valid_to ?? null,
      action: "update",
      identity: {
        name_he: tenant.identity.name_he,
        name_en: tenant.identity.name_en || null,
        tax_id: tenant.identity.tax_id,
        entity_type: tenant.identity.entity_type,
        logo_url: logoUrl || null,
        industry_code: tenant.identity.industry_code || null,
      },
    });
    dispatchTenantOptionsUpdated();

    setTenant(saved);
    setHistory((prev) => {
      if (!prev || !saved.identity) return prev;
      return {
        ...prev,
        identity: prev.identity.map((row) => (
          row.id === saved.identity?.id ? saved.identity : row
        )),
      };
    });
  }, [tenant]);

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
      allRows: items.map((r) => ({
        valid_from: r.valid_from,
        valid_to: r.valid_to,
        contact_type: "contact_type" in r ? r.contact_type : undefined,
      })),
    });
  }

  function openAddNew(section: SectionKey) {
    const fields = SECTION_FIELDS[section];
    const items = history
      ? (history[section] as Array<{ valid_from: string; valid_to?: string; contact_type?: string }>)
      : [];
    const baseDefaults = Object.fromEntries(fields.map((f) => [f.key, ""]));
    const defaults = section === "subscription"
      ? {
          ...baseDefaults,
          billing_cycle: "monthly",
          currency: "ILS",
          billing_anchor_day: String(tenant?.subscription?.billing_anchor_day ?? 1),
          is_price_locked: "false",
        }
      : baseDefaults;
    setEditState({
      section,
      data: defaults,
      initialValidFrom: "",
      initialValidTo: "",
      allRows: items.map((r) => ({
        valid_from: r.valid_from,
        valid_to: r.valid_to,
        contact_type: r.contact_type,
      })),
      initialMode: "add",
    });
  }

  const statusVal = tenant?.status?.status ?? "trial";
  const statusRows = history?.status ?? [];
  const templateNameMap = Object.fromEntries(templateOptions.map((item) => [item.id, item.name]));
  const canHardDeleteTenant = getStoredUser()?.role === "super_admin";
  const canForceOrgStructureOverride = getStoredUser()?.role === "super_admin" && !!tenant?.org_structure?.is_locked;

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
      { key: "actions", label: "" },
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
        actions: (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedBillingInvoice({ invoice: inv });
              }}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
            >
              פתח
            </button>
            {(inv.status === "sent" || inv.status === "overdue") && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedBillingInvoice({ invoice: inv, showPaid: true });
                }}
                className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
              >
                סמן כשולם
              </button>
            )}
          </div>
        ),
        pdf: (
          <div className="flex items-center gap-2">
            <a
              href={`/api/admin/billing/documents/${inv.id}/pdf`}
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
                href={`/api/admin/billing/documents/${inv.id}/pdf?variant=tax`}
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
      if (inv) setSelectedBillingInvoice({ invoice: inv });
    },
    emptyMessage: "אין חשבוניות — ניתן ליצור מדף ניהול חיובים",
  };

  const paymentTrackingTab = buildPaymentTrackingTab(
    paymentTracking?.items ?? [],
    (i) => {
      const item = paymentTracking?.items[i];
      if (item) setSelectedPaymentTracking(item);
    },
  );

  const childTabs: ChildTab[] = history ? [
    { ...buildIdentityTab(history.identity,         (i) => openEdit("identity",     i)), onAddClick: () => openAddNew("identity") },
    { ...buildContactTab(history.contact,           (i) => openEdit("contact",      i)), onAddClick: () => openAddNew("contact") },
    { ...buildAddressTab(history.address,           (i) => openEdit("address",      i)), onAddClick: () => openAddNew("address") },
    {
      ...buildSubscriptionTab(history.subscription, (i) => openEdit("subscription", i), templateNameMap),
      onAddClick: () => openAddNew("subscription"),
      toolbarNote: "כאן מנהלים את מסגרת המנוי: תבנית, מחזור חיוב, מטבע, הנחה ונעילת מחיר.",
    },
    tenant ? buildSubscriptionModulesTab(
      history.subscription_modules ?? [],
      (row) => setModuleModalState({ initial: row }),
      () => setModuleModalState({ initial: null }),
      {
        toolbarNote: "כאן מנהלים אילו מודולים באמת פעילים ללקוח, כולל מושבים, override והיסטוריית תוקף.",
      },
    ) : billingChargesTab,
    ...(BILLING_ENABLED ? [{
      ...paymentTrackingTab,
      toolbarNote: "כאן מתעדים ידנית אם כל חודש שולם, לא שולם או שולם חלקית במערכת החיצונית.",
    }] : []),
    {
      ...buildOrgStructureTab(
        history.org_structure ?? [],
        () => setShowOrgStructureOverrideModal(true),
      ),
      onAddClick: canForceOrgStructureOverride ? () => setShowOrgStructureOverrideModal(true) : undefined,
      toolbarNote: tenant?.org_structure?.is_locked
        ? "מבנה ארגוני מוגדר פעם אחת ונעול לשינוי. סופר אדמין יכול לפתוח מכאן שינוי חריג עם תצוגה מקדימה ואישור מפורש."
        : "מבנה ארגוני טרם ננעל.",
    },
    { ...buildStatusTab(history.status,             (i) => openEdit("status",       i)), onAddClick: () => openAddNew("status") },
    ...(BILLING_ENABLED ? [billingChargesTab, billingInvoicesTab] : []),
  ] : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gray-100">
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
            ...(canHardDeleteTenant ? [{
              label: "מחק ארגון",
              onClick: () => setShowDeleteTenant(true),
              icon: <Trash2 size={12} />,
            }] : []),
          ]}
          parentContent={tenant ? (
            <>
              <ParentForm
                tenant={tenant}
                onLogoUploaded={handleParentLogoChange}
              />
            </>
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
          templateOptions={templateOptions.map((item) => ({ value: item.id, label: item.name }))}
          onClose={() => setEditState(null)}
          onSaved={loadData}
          initialMode={editState.initialMode}
        />
      )}

      {selectedBillingInvoice && (
        <InvoiceViewModal
          invoice={selectedBillingInvoice.invoice}
          initialShowPaid={selectedBillingInvoice.showPaid}
          onClose={() => setSelectedBillingInvoice(null)}
          onUpdated={() => { setSelectedBillingInvoice(null); loadData(); }}
        />
      )}

      {selectedPaymentTracking && tenant && (
        <PaymentTrackingModal
          tenantId={tenant.tenant_id}
          item={selectedPaymentTracking}
          onClose={() => setSelectedPaymentTracking(null)}
          onUpdated={() => {
            setSelectedPaymentTracking(null);
            loadData();
          }}
        />
      )}

      {showOrgStructureOverrideModal && tenant?.org_structure ? (
        <OrgStructureOverrideModal
          tenantId={tenant.tenant_id}
          initialRow={tenant.org_structure}
          onClose={() => setShowOrgStructureOverrideModal(false)}
          onApplied={loadData}
        />
      ) : null}

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

      {showDeleteTenant && tenant && (
        <TenantDeleteModal
          tenant={tenant}
          onClose={() => setShowDeleteTenant(false)}
          onDeleted={() => {
            setShowDeleteTenant(false);
            router.push("/admin/tenants");
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
