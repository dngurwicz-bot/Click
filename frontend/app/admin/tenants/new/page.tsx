"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { api, getStoredUser, isLoggedIn } from "@/lib/api";
import { dispatchTenantOptionsUpdated } from "@/lib/workspaceTenants";
import { CardPage, type ChildTab } from "@/components/layout/CardPage";
import {
  TenantOrgStructureModal,
  formatOrgStructureSummary,
  type TenantOrgStructureConfigValue,
} from "@/components/tenants/TenantOrgStructureModal";
import { HebrewDatePicker } from "@/components/ui/HebrewDatePicker";
import {
  AdminDateFields,
  AdminField,
  AdminModal,
  AdminModalBody,
  AdminModalFooter,
  AdminModalHeader,
  AdminModalMessage,
  AdminModalPanel,
  ADMIN_MODAL_ACTION_PRIMARY,
  ADMIN_MODAL_ACTION_SECONDARY,
  ADMIN_MODAL_DATE_INPUT,
  ADMIN_MODAL_GRID,
  ADMIN_MODAL_INPUT,
  ADMIN_MODAL_TEXTAREA,
} from "@/components/ui/AdminModal";

interface AuditFields {
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
}

interface TenantIdentityDraft extends AuditFields {
  id: string;
  name_he: string;
  name_en?: string;
  tax_id: string;
  entity_type: string;
  logo_url?: string;
  industry_code?: string;
  valid_from: string;
  valid_to?: string | null;
}

interface TenantContactDraft extends AuditFields {
  id: string;
  contact_type: string;
  email: string;
  phone: string;
  phone_alt?: string;
  contact_name?: string;
  website?: string;
  valid_from: string;
  valid_to?: string | null;
}

interface TenantAddressDraft extends AuditFields {
  id: string;
  street: string;
  city: string;
  zip_code?: string;
  country: string;
  addr_type: string;
  valid_from: string;
  valid_to?: string | null;
}

interface TenantSubscriptionDraft extends AuditFields {
  id: string;
  billing_cycle: string;
  currency: string;
  template_id?: string;
  seat_count: number;
  selected_module_slugs: string[];
  discount_pct: string;
  is_price_locked: boolean;
  next_renewal_at?: string | null;
  valid_from: string;
  valid_to?: string | null;
}

interface TenantStatusDraft extends AuditFields {
  id: string;
  status: string;
  reason?: string;
  notes?: string;
  valid_from: string;
  valid_to?: string | null;
}

interface TenantSubscriptionModuleDraft extends AuditFields {
  id: string;
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
  default_billing_cycle: string;
  valid_to?: string | null;
  module_slugs: string[];
  discount_pct: string;
  is_price_locked: boolean;
  seat_count: number;
  pricing_summary: TemplatePricingSummary | null;
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
    pricing_summary_text?: string;
  } | null;
}

type SectionKey = "identity" | "contact" | "address" | "subscription" | "status";

type DraftState = {
  identity: TenantIdentityDraft[];
  contact: TenantContactDraft[];
  address: TenantAddressDraft[];
  subscription: TenantSubscriptionDraft[];
  status: TenantStatusDraft[];
  subscription_modules: TenantSubscriptionModuleDraft[];
};

type DraftSectionRowMap = {
  identity: TenantIdentityDraft;
  contact: TenantContactDraft;
  address: TenantAddressDraft;
  subscription: TenantSubscriptionDraft;
  status: TenantStatusDraft;
};

type DraftSectionFormMap = {
  identity: {
    name_he: string;
    name_en: string;
    tax_id: string;
    entity_type: string;
    industry_code: string;
    valid_from: string;
    valid_to: string;
  };
  contact: {
    contact_type: string;
    email: string;
    phone: string;
    phone_alt: string;
    contact_name: string;
    website: string;
    valid_from: string;
    valid_to: string;
  };
  address: {
    street: string;
    city: string;
    zip_code: string;
    country: string;
    addr_type: string;
    valid_from: string;
    valid_to: string;
  };
  subscription: {
    template_id: string;
    billing_cycle: string;
    currency: string;
    discount_pct: string;
    is_price_locked: boolean;
    valid_from: string;
    valid_to: string;
  };
  status: {
    status: string;
    reason: string;
    notes: string;
    valid_from: string;
    valid_to: string;
  };
};

const ENTITY_LABELS: Record<string, string> = {
  company: 'חברה בע"מ',
  self_employed: "עוסק מורשה",
  nonprofit: "עמותה",
  gov: "גוף ממשלתי",
};

const CONTACT_TYPE_LABELS: Record<string, string> = {
  main: "ראשי",
  billing: "חשבונאות",
  technical: "טכני",
  other: "אחר",
};

const STATUS_LABELS: Record<string, string> = {
  trial: "ניסיון",
  active: "פעיל",
  suspended: "מושהה",
  cancelled: "מבוטל",
};

const BILLING_CYCLE_LABELS: Record<string, string> = {
  monthly: "חודשי",
  quarterly: "רבעוני",
  yearly: "שנתי",
};

const STATUS_TYPE_MAP: Record<string, "active" | "trial" | "suspended" | "cancelled"> = {
  active: "active",
  trial: "trial",
  suspended: "suspended",
  cancelled: "cancelled",
};

const inputCls = ADMIN_MODAL_INPUT;
const areaCls = ADMIN_MODAL_TEXTAREA;

function todayIsoDate() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString("he-IL") : "—";
}

function fmtDateTime(d?: string | null) {
  return d ? new Date(d).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }) : "—";
}

function fmtIls(v: string | number) {
  return `₪${parseFloat(String(v)).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function newAuditFields(): AuditFields {
  const currentUser = getStoredUser();
  return {
    created_at: new Date().toISOString(),
    created_by: currentUser?.email ?? currentUser?.id ?? "טיוטה",
  };
}

function sortRows<T extends { valid_from: string; valid_to?: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aCurrent = !a.valid_to ? 1 : 0;
    const bCurrent = !b.valid_to ? 1 : 0;
    if (aCurrent !== bCurrent) return bCurrent - aCurrent;
    return new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime();
  });
}

function getCurrentRow<T extends { valid_from: string; valid_to?: string | null }>(rows: T[]): T | null {
  const sorted = sortRows(rows);
  return sorted.find((row) => !row.valid_to) ?? sorted[0] ?? null;
}

function buildIdentityTab(rows: TenantIdentityDraft[], onDblClick: (i: number) => void): ChildTab {
  const sorted = sortRows(rows);
  return {
    id: "identity",
    label: "פרטי זהות",
    columns: [
      { key: "valid_from", label: "תוקף מ", required: true },
      { key: "valid_to", label: "תוקף עד" },
      { key: "name_he", label: "שם ארגון", required: true },
      { key: "name_en", label: "שם באנגלית" },
      { key: "tax_id", label: "ח.פ", required: true },
      { key: "entity_type", label: "סוג ישות", required: true },
      { key: "created_at", label: "תאריך שינוי" },
      { key: "created_by", label: "בוצע ע\"י" },
    ],
    rows: sorted.map((row) => ({
      valid_from: fmtDate(row.valid_from),
      valid_to: row.valid_to ? fmtDate(row.valid_to) : "—",
      name_he: row.name_he,
      name_en: row.name_en ?? "—",
      tax_id: row.tax_id,
      entity_type: ENTITY_LABELS[row.entity_type] ?? row.entity_type,
      created_at: fmtDateTime(row.updated_at ?? row.created_at),
      created_by: row.updated_by ?? row.created_by ?? "—",
      _current: !row.valid_to,
      _valid_from_raw: row.valid_from,
      _valid_to_raw: row.valid_to ?? null,
    })),
    temporalFilter: true,
    onRowDoubleClick: (i) => onDblClick(rows.indexOf(sorted[i])),
    emptyMessage: "אין רשומות זהות - לחץ להוספת רשומה",
  };
}

function buildContactTab(rows: TenantContactDraft[], onDblClick: (i: number) => void): ChildTab {
  const sorted = sortRows(rows);
  return {
    id: "contact",
    label: "פרטי קשר",
    columns: [
      { key: "valid_from", label: "תוקף מ", required: true },
      { key: "valid_to", label: "תוקף עד" },
      { key: "contact_type", label: "סוג", required: true },
      { key: "email", label: "אימייל", required: true },
      { key: "phone", label: "טלפון", required: true },
      { key: "contact_name", label: "איש קשר" },
      { key: "website", label: "אתר" },
      { key: "created_at", label: "תאריך שינוי" },
      { key: "created_by", label: "בוצע ע\"י" },
    ],
    rows: sorted.map((row) => ({
      valid_from: fmtDate(row.valid_from),
      valid_to: row.valid_to ? fmtDate(row.valid_to) : "—",
      contact_type: CONTACT_TYPE_LABELS[row.contact_type] ?? row.contact_type,
      email: row.email,
      phone: row.phone,
      contact_name: row.contact_name ?? "—",
      website: row.website ?? "—",
      created_at: fmtDateTime(row.updated_at ?? row.created_at),
      created_by: row.updated_by ?? row.created_by ?? "—",
      _current: !row.valid_to,
      _valid_from_raw: row.valid_from,
      _valid_to_raw: row.valid_to ?? null,
    })),
    temporalFilter: true,
    onRowDoubleClick: (i) => onDblClick(rows.indexOf(sorted[i])),
    emptyMessage: "אין רשומות קשר - לחץ להוספת רשומה",
  };
}

function buildAddressTab(rows: TenantAddressDraft[], onDblClick: (i: number) => void): ChildTab {
  const sorted = sortRows(rows);
  return {
    id: "address",
    label: "כתובת",
    columns: [
      { key: "valid_from", label: "תוקף מ", required: true },
      { key: "valid_to", label: "תוקף עד" },
      { key: "street", label: "רחוב", required: true },
      { key: "city", label: "עיר", required: true },
      { key: "zip_code", label: "מיקוד" },
      { key: "country", label: "מדינה", required: true },
      { key: "created_at", label: "תאריך שינוי" },
      { key: "created_by", label: "בוצע ע\"י" },
    ],
    rows: sorted.map((row) => ({
      valid_from: fmtDate(row.valid_from),
      valid_to: row.valid_to ? fmtDate(row.valid_to) : "—",
      street: row.street,
      city: row.city,
      zip_code: row.zip_code ?? "—",
      country: row.country,
      created_at: fmtDateTime(row.updated_at ?? row.created_at),
      created_by: row.updated_by ?? row.created_by ?? "—",
      _current: !row.valid_to,
      _valid_from_raw: row.valid_from,
      _valid_to_raw: row.valid_to ?? null,
    })),
    temporalFilter: true,
    onRowDoubleClick: (i) => onDblClick(rows.indexOf(sorted[i])),
    emptyMessage: "אין רשומות כתובת - לחץ להוספת רשומה",
  };
}

function buildSubscriptionTab(rows: TenantSubscriptionDraft[], templateNames: Record<string, string>, onDblClick: (i: number) => void): ChildTab {
  const sorted = sortRows(rows);
  return {
    id: "subscription",
    label: "הגדרות מנוי",
    columns: [
      { key: "valid_from", label: "תוקף מ", required: true },
      { key: "valid_to", label: "תוקף עד" },
      { key: "template_id", label: "תבנית" },
      { key: "billing_cycle", label: "מחזור חיוב", required: true },
      { key: "currency", label: "מטבע", required: true },
      { key: "discount_pct", label: "הנחה %" },
      { key: "is_price_locked", label: "מחיר נעול" },
      { key: "next_renewal_at", label: "חידוש הבא" },
      { key: "created_at", label: "תאריך שינוי" },
      { key: "created_by", label: "בוצע ע\"י" },
    ],
    rows: sorted.map((row) => ({
      valid_from: fmtDate(row.valid_from),
      valid_to: row.valid_to ? fmtDate(row.valid_to) : "—",
      template_id: (row.template_id ? templateNames[row.template_id] : null) ?? "—",
      billing_cycle: BILLING_CYCLE_LABELS[row.billing_cycle] ?? row.billing_cycle,
      currency: row.currency,
      discount_pct: `${row.discount_pct}%`,
      is_price_locked: row.is_price_locked ? "כן" : "לא",
      next_renewal_at: fmtDate(row.next_renewal_at),
      created_at: fmtDateTime(row.updated_at ?? row.created_at),
      created_by: row.updated_by ?? row.created_by ?? "—",
      _current: !row.valid_to,
      _valid_from_raw: row.valid_from,
      _valid_to_raw: row.valid_to ?? null,
    })),
    temporalFilter: true,
    onRowDoubleClick: (i) => onDblClick(rows.indexOf(sorted[i])),
    toolbarNote: "כאן מנהלים את מסגרת המנוי: תבנית, מחזור חיוב, מטבע, הנחה ונעילת מחיר.",
    emptyMessage: "אין הגדרות מנוי - לחץ להוספת רשומה",
  };
}

function buildStatusTab(rows: TenantStatusDraft[], onDblClick: (i: number) => void): ChildTab {
  const sorted = sortRows(rows);
  return {
    id: "status",
    label: "סטטוס",
    columns: [
      { key: "valid_from", label: "תוקף מ", required: true },
      { key: "valid_to", label: "תוקף עד" },
      { key: "status", label: "סטטוס", required: true },
      { key: "reason", label: "סיבה" },
      { key: "created_at", label: "תאריך שינוי" },
      { key: "created_by", label: "בוצע ע\"י" },
    ],
    rows: sorted.map((row) => ({
      valid_from: fmtDate(row.valid_from),
      valid_to: row.valid_to ? fmtDate(row.valid_to) : "—",
      status: STATUS_LABELS[row.status] ?? row.status,
      reason: row.reason ?? "—",
      created_at: fmtDateTime(row.updated_at ?? row.created_at),
      created_by: row.updated_by ?? row.created_by ?? "—",
      _current: !row.valid_to,
      _valid_from_raw: row.valid_from,
      _valid_to_raw: row.valid_to ?? null,
    })),
    temporalFilter: true,
    onRowDoubleClick: (i) => onDblClick(rows.indexOf(sorted[i])),
    emptyMessage: "אין סטטוס - לחץ להוספת רשומה",
  };
}

function buildSubscriptionModulesTab(rows: TenantSubscriptionModuleDraft[], onDblClick: (row: TenantSubscriptionModuleDraft) => void, onAddClick: () => void): ChildTab {
  const sorted = [...rows].sort((a, b) => {
    if (a.valid_from === b.valid_from) return a.module_slug.localeCompare(b.module_slug, "he");
    return a.valid_from < b.valid_from ? 1 : -1;
  });

  return {
    id: "subscription_modules",
    label: "מודולים בפועל",
    columns: [
      { key: "valid_from", label: "מתאריך", required: true },
      { key: "valid_to", label: "בתוקף עד" },
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
    rows: sorted.map((row) => ({
      valid_from: fmtDate(row.valid_from),
      valid_to: row.valid_to ? fmtDate(row.valid_to) : "—",
      module_slug: row.module_slug,
      source_type: row.source_type === "template" ? "תבנית" : "ידני",
      status: row.status === "active" ? "פעיל" : "הוסר",
      seats: row.seats,
      pricing_mode: row.pricing_mode === "override" ? "Override" : "מחירון",
      base_price: row.pricing_mode === "override" ? (row.override_base_price_ils ? fmtIls(row.override_base_price_ils) : "—") : "קטלוג",
      per_seat: row.pricing_mode === "override" ? (row.override_per_seat_ils ? fmtIls(row.override_per_seat_ils) : "—") : "קטלוג",
      setup_fee: row.pricing_mode === "override" ? (row.override_setup_fee_ils ? fmtIls(row.override_setup_fee_ils) : "—") : "קטלוג",
      created_at: fmtDateTime(row.updated_at ?? row.created_at),
      created_by: row.updated_by ?? row.created_by ?? "—",
      notes: row.notes ?? "—",
      _current: !row.valid_to,
      _valid_from_raw: row.valid_from,
      _valid_to_raw: row.valid_to ?? null,
    })),
    onRowDoubleClick: (index) => {
      const row = sorted[index];
      if (row) onDblClick(row);
    },
    onAddClick,
    temporalFilter: true,
    toolbarNote: "כאן מנהלים אילו מודולים באמת פעילים ללקוח, כולל מושבים ו-override.",
    emptyMessage: "אין מודולים במנוי - לחץ להוספת מודול",
  };
}

function emptySectionForm(section: SectionKey): DraftSectionFormMap[SectionKey] {
  const today = todayIsoDate();
  if (section === "identity") return { name_he: "", name_en: "", tax_id: "", entity_type: "company", industry_code: "", valid_from: today, valid_to: "" };
  if (section === "contact") return { contact_type: "main", email: "", phone: "", phone_alt: "", contact_name: "", website: "", valid_from: today, valid_to: "" };
  if (section === "address") return { street: "", city: "", zip_code: "", country: "IL", addr_type: "main", valid_from: today, valid_to: "" };
  if (section === "subscription") return { template_id: "", billing_cycle: "monthly", currency: "ILS", discount_pct: "0", is_price_locked: false, valid_from: today, valid_to: "" };
  return { status: "trial", reason: "", notes: "", valid_from: today, valid_to: "" };
}

function formFromSectionRow(section: SectionKey, row: any): any {
  if (section === "identity") {
    return {
      name_he: row.name_he,
      name_en: row.name_en ?? "",
      tax_id: row.tax_id,
      entity_type: row.entity_type,
      industry_code: row.industry_code ?? "",
      valid_from: row.valid_from,
      valid_to: row.valid_to ?? "",
    };
  }
  if (section === "contact") {
    return {
      contact_type: row.contact_type,
      email: row.email,
      phone: row.phone,
      phone_alt: row.phone_alt ?? "",
      contact_name: row.contact_name ?? "",
      website: row.website ?? "",
      valid_from: row.valid_from,
      valid_to: row.valid_to ?? "",
    };
  }
  if (section === "address") {
    return {
      street: row.street,
      city: row.city,
      zip_code: row.zip_code ?? "",
      country: row.country,
      addr_type: row.addr_type,
      valid_from: row.valid_from,
      valid_to: row.valid_to ?? "",
    };
  }
  if (section === "subscription") {
    return {
      template_id: row.template_id ?? "",
      billing_cycle: row.billing_cycle,
      currency: row.currency,
      discount_pct: row.discount_pct,
      is_price_locked: row.is_price_locked,
      valid_from: row.valid_from,
      valid_to: row.valid_to ?? "",
    };
  }
  return {
    status: row.status,
    reason: row.reason ?? "",
    notes: row.notes ?? "",
    valid_from: row.valid_from,
    valid_to: row.valid_to ?? "",
  };
}

function buildSectionRow(section: SectionKey, form: any, existing?: any): any {
  const audit = existing
    ? { ...existing, updated_at: new Date().toISOString(), updated_by: newAuditFields().created_by }
    : { id: crypto.randomUUID(), ...newAuditFields() };

  if (section === "identity") {
    return {
      id: audit.id,
      created_at: audit.created_at,
      created_by: audit.created_by,
      updated_at: audit.updated_at,
      updated_by: audit.updated_by,
      name_he: form.name_he,
      name_en: form.name_en || undefined,
      tax_id: form.tax_id,
      entity_type: form.entity_type,
      industry_code: form.industry_code || undefined,
      logo_url: existing?.logo_url,
      valid_from: form.valid_from,
      valid_to: form.valid_to || null,
    };
  }
  if (section === "contact") {
    return {
      id: audit.id,
      created_at: audit.created_at,
      created_by: audit.created_by,
      updated_at: audit.updated_at,
      updated_by: audit.updated_by,
      contact_type: form.contact_type,
      email: form.email,
      phone: form.phone,
      phone_alt: form.phone_alt || undefined,
      contact_name: form.contact_name || undefined,
      website: form.website || undefined,
      valid_from: form.valid_from,
      valid_to: form.valid_to || null,
    };
  }
  if (section === "address") {
    return {
      id: audit.id,
      created_at: audit.created_at,
      created_by: audit.created_by,
      updated_at: audit.updated_at,
      updated_by: audit.updated_by,
      street: form.street,
      city: form.city,
      zip_code: form.zip_code || undefined,
      country: form.country,
      addr_type: form.addr_type,
      valid_from: form.valid_from,
      valid_to: form.valid_to || null,
    };
  }
  if (section === "subscription") {
    return {
      id: audit.id,
      created_at: audit.created_at,
      created_by: audit.created_by,
      updated_at: audit.updated_at,
      updated_by: audit.updated_by,
      template_id: form.template_id || undefined,
      billing_cycle: form.billing_cycle,
      currency: form.currency,
      seat_count: existing?.seat_count ?? 0,
      selected_module_slugs: existing?.selected_module_slugs ?? [],
      discount_pct: form.discount_pct,
      is_price_locked: form.is_price_locked,
      next_renewal_at: existing?.next_renewal_at ?? null,
      valid_from: form.valid_from,
      valid_to: form.valid_to || null,
    };
  }
  return {
    id: audit.id,
    created_at: audit.created_at,
    created_by: audit.created_by,
    updated_at: audit.updated_at,
    updated_by: audit.updated_by,
    status: form.status,
    reason: form.reason || undefined,
    notes: form.notes || undefined,
    valid_from: form.valid_from,
    valid_to: form.valid_to || null,
  };
}

function DraftSectionModal({
  section,
  templates,
  initialRow,
  onClose,
  onSave,
}: {
  section: SectionKey;
  templates: TemplateOption[];
  initialRow: any;
  onClose: () => void;
  onSave: (row: any) => void;
}) {
  const [form, setForm] = useState<any>(() => initialRow ? formFromSectionRow(section, initialRow) : emptySectionForm(section));
  const [error, setError] = useState<string | null>(null);

  function patch(patch: Record<string, unknown>) {
    setForm((current: any) => ({ ...current, ...patch }));
  }

  function validate() {
    if (section === "identity") {
      if (!form.name_he.trim()) return "יש להזין שם ארגון";
      if (!form.tax_id.trim()) return "יש להזין ח.פ / ע.מ";
    }
    if (section === "contact") {
      if (!form.email.trim()) return "יש להזין אימייל";
      if (!form.phone.trim()) return "יש להזין טלפון";
    }
    if (section === "address") {
      if (!form.street.trim()) return "יש להזין רחוב";
      if (!form.city.trim()) return "יש להזין עיר";
    }
    if (!form.valid_from) return "יש להזין תאריך תחילה";
    return null;
  }

  function handleSave() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    onSave(buildSectionRow(section, form, initialRow ?? undefined));
  }

  const title = initialRow ? "עדכון רשומה" : "רשומה חדשה";
  const subtitle = `עריכת ${section === "identity" ? "פרטי זהות" : section === "contact" ? "פרטי קשר" : section === "address" ? "כתובת" : section === "subscription" ? "הגדרות מנוי" : "סטטוס"} בטיוטת הארגון.`;

  return (
    <AdminModal onBackdropClick={onClose}>
      <AdminModalPanel >
        <AdminModalHeader title={title} subtitle={subtitle} onClose={onClose} />
        <AdminModalBody>
        <div className={ADMIN_MODAL_GRID}>
          {section === "identity" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">שם ארגון (עברית)</label>
                <input className={inputCls} value={"name_he" in form ? form.name_he : ""} onChange={(e) => patch({ name_he: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">שם ארגון (אנגלית)</label>
                <input className={inputCls} value={"name_en" in form ? form.name_en : ""} onChange={(e) => patch({ name_en: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">ח.פ / ע.מ</label>
                <input className={inputCls} value={"tax_id" in form ? form.tax_id : ""} onChange={(e) => patch({ tax_id: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">סוג ישות</label>
                <select className={inputCls} value={"entity_type" in form ? form.entity_type : "company"} onChange={(e) => patch({ entity_type: e.target.value })} >
                  <option value="company">חברה</option>
                  <option value="self_employed">עצמאי</option>
                  <option value="nonprofit">עמותה</option>
                  <option value="gov">ממשלה</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-600">ענף תעשייה</label>
                <input className={inputCls} value={"industry_code" in form ? form.industry_code : ""} onChange={(e) => patch({ industry_code: e.target.value })} />
              </div>
            </>
          )}

          {section === "contact" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">סוג</label>
                <select className={inputCls} value={"contact_type" in form ? form.contact_type : "main"} onChange={(e) => patch({ contact_type: e.target.value })} >
                  <option value="main">ראשי</option>
                  <option value="billing">חשבונאות</option>
                  <option value="technical">טכני</option>
                  <option value="other">אחר</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">אימייל</label>
                <input className={inputCls} value={"email" in form ? form.email : ""} onChange={(e) => patch({ email: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">טלפון</label>
                <input className={inputCls} value={"phone" in form ? form.phone : ""} onChange={(e) => patch({ phone: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">טלפון נוסף</label>
                <input className={inputCls} value={"phone_alt" in form ? form.phone_alt : ""} onChange={(e) => patch({ phone_alt: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">איש קשר</label>
                <input className={inputCls} value={"contact_name" in form ? form.contact_name : ""} onChange={(e) => patch({ contact_name: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">אתר</label>
                <input className={inputCls} value={"website" in form ? form.website : ""} onChange={(e) => patch({ website: e.target.value })} />
              </div>
            </>
          )}

          {section === "address" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">רחוב</label>
                <input className={inputCls} value={"street" in form ? form.street : ""} onChange={(e) => patch({ street: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">עיר</label>
                <input className={inputCls} value={"city" in form ? form.city : ""} onChange={(e) => patch({ city: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">מיקוד</label>
                <input className={inputCls} value={"zip_code" in form ? form.zip_code : ""} onChange={(e) => patch({ zip_code: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">מדינה</label>
                <input className={inputCls} value={"country" in form ? form.country : "IL"} onChange={(e) => patch({ country: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-600">סוג כתובת</label>
                <select className={inputCls} value={"addr_type" in form ? form.addr_type : "main"} onChange={(e) => patch({ addr_type: e.target.value })} >
                  <option value="main">ראשית</option>
                  <option value="mailing">דואר</option>
                  <option value="branch">סניף</option>
                </select>
              </div>
            </>
          )}

          {section === "subscription" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">תבנית</label>
                <select className={inputCls} value={"template_id" in form ? form.template_id : ""} onChange={(e) => patch({ template_id: e.target.value })} >
                  <option value="">ללא תבנית</option>
                  {templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">מחזור חיוב</label>
                <select className={inputCls} value={"billing_cycle" in form ? form.billing_cycle : "monthly"} onChange={(e) => patch({ billing_cycle: e.target.value })} >
                  <option value="monthly">חודשי</option>
                  <option value="quarterly">רבעוני</option>
                  <option value="yearly">שנתי</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">מטבע</label>
                <select className={inputCls} value={"currency" in form ? form.currency : "ILS"} onChange={(e) => patch({ currency: e.target.value })} >
                  <option value="ILS">₪ שקל</option>
                  <option value="USD">$ דולר</option>
                  <option value="EUR">€ יורו</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">הנחה %</label>
                <input className={inputCls} type="number" min="0" step="0.01" value={"discount_pct" in form ? form.discount_pct : "0"} onChange={(e) => patch({ discount_pct: e.target.value })} />
              </div>
              <div className="md:col-span-2 flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2">
                <label className="text-xs font-semibold text-slate-600">מחיר נעול</label>
                <button
                  type="button"
                  onClick={() => patch({ is_price_locked: !("is_price_locked" in form && form.is_price_locked) })}
                  className={`relative rounded-full transition-colors duration-200 ${"is_price_locked" in form && form.is_price_locked ? "bg-emerald-500" : "bg-slate-200"}`}
                  style={{ width: 32, height: 18 }}
                >
                  <span
                    className={`absolute top-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${"is_price_locked" in form && form.is_price_locked ? "translate-x-[14px]" : "translate-x-0.5"}`}
                    style={{ width: 14, height: 14 }}
                  />
                </button>
              </div>
            </>
          )}

          {section === "status" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">סטטוס</label>
                <select className={inputCls} value={"status" in form ? form.status : "trial"} onChange={(e) => patch({ status: e.target.value })} >
                  <option value="trial">ניסיון</option>
                  <option value="active">פעיל</option>
                  <option value="suspended">מושהה</option>
                  <option value="cancelled">מבוטל</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">סיבת שינוי</label>
                <input className={inputCls} value={"reason" in form ? form.reason : ""} onChange={(e) => patch({ reason: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-600">הערות</label>
                <textarea className={areaCls} value={"notes" in form ? form.notes : ""} onChange={(e) => patch({ notes: e.target.value })} />
              </div>
            </>
          )}

        </div>
        <AdminDateFields
          fromField={<HebrewDatePicker value={form.valid_from} onChange={(value) => patch({ valid_from: value })} className={ADMIN_MODAL_DATE_INPUT} />}
          toField={<HebrewDatePicker value={form.valid_to} onChange={(value) => patch({ valid_to: value })} className={ADMIN_MODAL_DATE_INPUT} />}
        />
        {error ? <div className="mt-4"><AdminModalMessage tone="danger">{error}</AdminModalMessage></div> : null}
        </AdminModalBody>
        <AdminModalFooter>
          <button onClick={onClose} className={ADMIN_MODAL_ACTION_SECONDARY}>ביטול</button>
          <button onClick={handleSave} className={ADMIN_MODAL_ACTION_PRIMARY}>שמור</button>
        </AdminModalFooter>
      </AdminModalPanel>
    </AdminModal>
  );
}

function DraftModuleModal({
  modules,
  initialRow,
  onClose,
  onSave,
}: {
  modules: ModuleOption[];
  initialRow: TenantSubscriptionModuleDraft | null;
  onClose: () => void;
  onSave: (row: TenantSubscriptionModuleDraft) => void;
}) {
  const [form, setForm] = useState({
    module_slug: initialRow?.module_slug ?? "",
    source_type: initialRow?.source_type ?? "manual",
    status: initialRow?.status ?? "active",
    seats: String(initialRow?.seats ?? 0),
    pricing_mode: initialRow?.pricing_mode ?? "catalog",
    override_base_price_ils: initialRow?.override_base_price_ils ?? "",
    override_per_seat_ils: initialRow?.override_per_seat_ils ?? "",
    override_setup_fee_ils: initialRow?.override_setup_fee_ils ?? "",
    override_included_seats: initialRow?.override_included_seats != null ? String(initialRow.override_included_seats) : "",
    price_lock_reason: initialRow?.price_lock_reason ?? "",
    notes: initialRow?.notes ?? "",
    valid_from: initialRow?.valid_from ?? todayIsoDate(),
    valid_to: initialRow?.valid_to ?? "",
  });
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSave() {
    if (!form.module_slug) {
      setError("יש לבחור מודול");
      return;
    }
    if (!form.valid_from) {
      setError("יש להזין תאריך תחילה");
      return;
    }

    const audit = initialRow
      ? { ...initialRow, updated_at: new Date().toISOString(), updated_by: newAuditFields().created_by }
      : { id: crypto.randomUUID(), ...newAuditFields() };

    onSave({
      id: audit.id,
      created_at: audit.created_at,
      created_by: audit.created_by,
      updated_at: audit.updated_at,
      updated_by: audit.updated_by,
      module_slug: form.module_slug,
      source_type: form.source_type as "template" | "manual",
      status: form.status as "active" | "removed",
      seats: parseInt(form.seats, 10) || 0,
      pricing_mode: form.pricing_mode as "catalog" | "override",
      override_base_price_ils: form.override_base_price_ils || null,
      override_per_seat_ils: form.override_per_seat_ils || null,
      override_setup_fee_ils: form.override_setup_fee_ils || null,
      override_included_seats: form.override_included_seats ? parseInt(form.override_included_seats, 10) : null,
      price_lock_reason: form.price_lock_reason || null,
      notes: form.notes || null,
      valid_from: form.valid_from,
      valid_to: form.valid_to || null,
    });
  }

  return (
    <AdminModal onBackdropClick={onClose}>
      <AdminModalPanel >
        <AdminModalHeader
          title={initialRow ? "עדכון מודול מנוי" : "רשומת מודול חדשה"}
          subtitle="ניהול מודולים בפועל בטיוטת הארגון."
          onClose={onClose}
        />
        <AdminModalBody>
        <div className={ADMIN_MODAL_GRID}>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">מודול</label>
            <select className={inputCls} value={form.module_slug} onChange={(e) => setField("module_slug", e.target.value)} disabled={Boolean(initialRow)}>
              <option value="">בחר מודול</option>
              {modules.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">מקור</label>
            <select className={inputCls} value={form.source_type} onChange={(e) => setField("source_type", e.target.value)}>
              <option value="manual">ידני</option>
              <option value="template">תבנית</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">סטטוס</label>
            <select className={inputCls} value={form.status} onChange={(e) => setField("status", e.target.value)}>
              <option value="active">פעיל</option>
              <option value="removed">הוסר</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">מושבים למודול</label>
            <input className={inputCls} type="number" min="0" value={form.seats} onChange={(e) => setField("seats", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-600">מצב תמחור</label>
            <select className={inputCls} value={form.pricing_mode} onChange={(e) => setField("pricing_mode", e.target.value)}>
              <option value="catalog">מחירון פעיל</option>
              <option value="override">Override ללקוח</option>
            </select>
          </div>
          {form.pricing_mode === "override" ? (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">מחיר בסיס</label>
                <input className={inputCls} type="number" min="0" step="0.01" value={form.override_base_price_ils} onChange={(e) => setField("override_base_price_ils", e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">מחיר למושב נוסף</label>
                <input className={inputCls} type="number" min="0" step="0.01" value={form.override_per_seat_ils} onChange={(e) => setField("override_per_seat_ils", e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">דמי הקמה</label>
                <input className={inputCls} type="number" min="0" step="0.01" value={form.override_setup_fee_ils} onChange={(e) => setField("override_setup_fee_ils", e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">מושבים כלולים</label>
                <input className={inputCls} type="number" min="0" value={form.override_included_seats} onChange={(e) => setField("override_included_seats", e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-600">סיבת Override</label>
                <input className={inputCls} value={form.price_lock_reason} onChange={(e) => setField("price_lock_reason", e.target.value)} />
              </div>
            </>
          ) : null}
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-600">הערות</label>
            <textarea className={areaCls} value={form.notes} onChange={(e) => setField("notes", e.target.value)} />
          </div>
        </div>
        <AdminDateFields
          fromField={<HebrewDatePicker value={form.valid_from} onChange={(value) => setField("valid_from", value)} className={ADMIN_MODAL_DATE_INPUT} />}
          toField={<HebrewDatePicker value={form.valid_to} onChange={(value) => setField("valid_to", value)} className={ADMIN_MODAL_DATE_INPUT} />}
        />
        {error ? <div className="mt-4"><AdminModalMessage tone="danger">{error}</AdminModalMessage></div> : null}
        </AdminModalBody>
        <AdminModalFooter>
          <button onClick={onClose} className={ADMIN_MODAL_ACTION_SECONDARY}>ביטול</button>
          <button onClick={handleSave} className={ADMIN_MODAL_ACTION_PRIMARY}>שמור</button>
        </AdminModalFooter>
      </AdminModalPanel>
    </AdminModal>
  );
}

export default function NewTenantPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [draft, setDraft] = useState<DraftState>({
    identity: [],
    contact: [],
    address: [],
    subscription: [],
    status: [],
    subscription_modules: [],
  });
  const [orgStructure, setOrgStructure] = useState<TenantOrgStructureConfigValue>({
    levels: ["division", "department", "section", "team"],
    position_attachment_level: "team",
    is_hierarchical: true,
  });
  const [orgStructureConfigured, setOrgStructureConfigured] = useState(false);
  const [orgStructureOpen, setOrgStructureOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<{ section: SectionKey; rowId?: string } | null>(null);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    api.get<TemplateOption[]>("/api/admin/templates")
      .then((data) => setTemplates(data.filter((item) => !item.valid_to)))
      .catch(() => {});
    api.get<ModuleOption[]>("/api/admin/modules")
      .then((data) => setModules(data.filter((item) => item.is_active)))
      .catch(() => {});
  }, [router]);

  const currentIdentity = useMemo(() => getCurrentRow(draft.identity), [draft.identity]);
  const currentContact = useMemo(() => getCurrentRow(draft.contact), [draft.contact]);
  const currentAddress = useMemo(() => getCurrentRow(draft.address), [draft.address]);
  const currentSubscription = useMemo(() => getCurrentRow(draft.subscription), [draft.subscription]);
  const currentStatus = useMemo(() => getCurrentRow(draft.status), [draft.status]);
  const templateNameMap = useMemo(() => Object.fromEntries(templates.map((item) => [item.id, item.name])), [templates]);

  function upsertSectionRow(section: SectionKey, row: any) {
    setDraft((current) => ({
      ...current,
      [section]: current[section].some((item) => item.id === row.id)
        ? current[section].map((item) => (item.id === row.id ? row : item))
        : [...current[section], row],
    }));
    setEditingSection(null);
  }

  function upsertModuleRow(row: TenantSubscriptionModuleDraft) {
    setDraft((current) => ({
      ...current,
      subscription_modules: current.subscription_modules.some((item) => item.id === row.id)
        ? current.subscription_modules.map((item) => (item.id === row.id ? row : item))
        : [...current.subscription_modules, row],
      subscription: current.subscription.map((item) => ({
        ...item,
        selected_module_slugs: Array.from(new Set(
          [...current.subscription_modules.filter((module) => module.status === "active" && !module.valid_to).map((module) => module.module_slug), row.status === "active" && !row.valid_to ? row.module_slug : ""]
            .filter(Boolean),
        )),
      })),
    }));
    setEditingModuleId(null);
  }

  async function handleSubmit() {
    setError(null);
    const identity = currentIdentity;
    const contact = currentContact;
    const address = currentAddress;
    const subscription = currentSubscription;
    const status = currentStatus;

    if (!identity) return setError("יש להוסיף רשומה בלשונית פרטי זהות");
    if (!contact) return setError("יש להוסיף רשומה בלשונית פרטי קשר");
    if (!address) return setError("יש להוסיף רשומה בלשונית כתובת");
    if (!subscription) return setError("יש להוסיף רשומה בלשונית הגדרות מנוי");
    if (!status) return setError("יש להוסיף רשומה בלשונית סטטוס");
    if (!orgStructureConfigured) {
      setOrgStructureOpen(true);
      return setError("יש לבחור ולהגדיר מבנה ארגוני, שיוך תפקיד והאם המבנה היררכי לפני שמירת ארגון חדש");
    }

    setSaving(true);
    try {
      const activeModuleSlugs = Array.from(new Set(
        draft.subscription_modules
          .filter((item) => item.status === "active" && !item.valid_to)
          .map((item) => item.module_slug),
      ));

      await api.post("/api/admin/tenants", {
        identity: {
          name_he: identity.name_he,
          name_en: identity.name_en || null,
          tax_id: identity.tax_id,
          entity_type: identity.entity_type,
          logo_url: identity.logo_url || null,
          industry_code: identity.industry_code || null,
        },
        contact: {
          contact_type: contact.contact_type,
          email: contact.email,
          phone: contact.phone,
          phone_alt: contact.phone_alt || null,
          contact_name: contact.contact_name || null,
          website: contact.website || null,
        },
        address: {
          street: address.street,
          city: address.city,
          zip_code: address.zip_code || null,
          country: address.country,
          addr_type: address.addr_type,
        },
        subscription: {
          template_id: subscription.template_id || null,
          billing_cycle: subscription.billing_cycle,
          currency: subscription.currency,
          seat_count: activeModuleSlugs.length > 0 ? draft.subscription_modules.filter((item) => item.status === "active" && !item.valid_to).reduce((sum, item) => sum + item.seats, 0) : subscription.seat_count,
          selected_module_slugs: activeModuleSlugs,
          discount_pct: parseFloat(subscription.discount_pct) || 0,
          is_price_locked: subscription.is_price_locked,
        },
        status: {
          status: status.status,
          reason: status.reason || null,
          notes: status.notes || null,
        },
        org_structure: {
          levels: orgStructure.levels,
          position_attachment_level: orgStructure.position_attachment_level,
          is_hierarchical: orgStructure.is_hierarchical,
        },
      });
      dispatchTenantOptionsUpdated();
      router.push("/admin/tenants");
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      setError(apiErr.error ?? "שגיאה בשמירת הארגון");
    } finally {
      setSaving(false);
    }
  }

  const childTabs: ChildTab[] = [
    { ...buildIdentityTab(draft.identity, (i) => setEditingSection({ section: "identity", rowId: draft.identity[i]?.id })), onAddClick: () => setEditingSection({ section: "identity" }) },
    { ...buildContactTab(draft.contact, (i) => setEditingSection({ section: "contact", rowId: draft.contact[i]?.id })), onAddClick: () => setEditingSection({ section: "contact" }) },
    { ...buildAddressTab(draft.address, (i) => setEditingSection({ section: "address", rowId: draft.address[i]?.id })), onAddClick: () => setEditingSection({ section: "address" }) },
    { ...buildSubscriptionTab(draft.subscription, templateNameMap, (i) => setEditingSection({ section: "subscription", rowId: draft.subscription[i]?.id })), onAddClick: () => setEditingSection({ section: "subscription" }) },
    buildSubscriptionModulesTab(
      draft.subscription_modules,
      (row) => setEditingModuleId(row.id),
      () => setEditingModuleId("new"),
    ),
    { ...buildStatusTab(draft.status, (i) => setEditingSection({ section: "status", rowId: draft.status[i]?.id })), onAddClick: () => setEditingSection({ section: "status" }) },
  ];

  const editingSectionRow = editingSection
    ? draft[editingSection.section].find((row) => row.id === editingSection.rowId) ?? null
    : null;
  const editingModuleRow = editingModuleId && editingModuleId !== "new"
    ? draft.subscription_modules.find((row) => row.id === editingModuleId) ?? null
    : null;
  const orgStructureSummary = formatOrgStructureSummary(orgStructure);
  const orgStructureDisplay = orgStructureConfigured ? orgStructureSummary : {
    levelsText: "טרם נבחר",
    attachmentText: "טרם נבחר",
    hierarchyText: "טרם נבחר",
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gray-100">
      <CardPage
        title="כרטיס ארגון"
        backHref="/admin/tenants"
        backLabel="ניהול ארגונים"
        status={{ label: STATUS_LABELS[currentStatus?.status ?? "trial"] ?? "ניסיון", type: STATUS_TYPE_MAP[currentStatus?.status ?? "trial"] ?? "trial" }}
        parentContent={
          <>
            {error ? (
              <div className="mx-5 mt-4 mb-1 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-xs text-red-700">
                {error}
              </div>
            ) : null}
            <div className="mx-5 mt-4 rounded-2xl border border-slate-200 bg-white px-5 py-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-800">מבנה ארגוני</div>
                  <div className="mt-1 text-xs text-slate-500">כאן מגדירים אילו רמות יופיעו ללקוח ב־CLICK Core, האם המבנה היררכי ואיך תפקידים משויכים.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setOrgStructureOpen(true)}
                  className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                >
                  {orgStructureConfigured ? "ערוך רמות, תפקיד והיררכיה" : "בחר רמות, תפקיד והיררכיה"}
                </button>
              </div>
              {!orgStructureConfigured ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                  צריך לבחור כאן את המבנה הארגוני בזמן הקמת ארגון חדש, כולל שיוך תפקיד והאם המבנה היררכי.
                </div>
              ) : null}
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs">
                  <div className="text-slate-400">רמות פעילות</div>
                  <div className="mt-1 font-semibold text-slate-800">{orgStructureDisplay.levelsText}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs">
                  <div className="text-slate-400">שיוך תפקיד</div>
                  <div className="mt-1 font-semibold text-slate-800">{orgStructureDisplay.attachmentText}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs">
                  <div className="text-slate-400">מבנה היררכי</div>
                  <div className="mt-1 font-semibold text-slate-800">{orgStructureDisplay.hierarchyText}</div>
                </div>
              </div>
            </div>
          </>
        }
        primaryActions={[
          { label: "ביטול", onClick: () => router.push("/admin/tenants") },
          {
            label: saving ? "שומר..." : "שמור ארגון",
            onClick: handleSubmit,
            variant: "primary",
            disabled: saving,
          },
        ]}
        formTabs={[]}
        childTabs={childTabs}
      />

      {editingSection ? (
        <DraftSectionModal
          section={editingSection.section}
          templates={templates}
          initialRow={editingSectionRow}
          onClose={() => setEditingSection(null)}
          onSave={(row) => upsertSectionRow(editingSection.section, row)}
        />
      ) : null}

      {editingModuleId ? (
        <DraftModuleModal
          modules={modules}
          initialRow={editingModuleRow}
          onClose={() => setEditingModuleId(null)}
          onSave={upsertModuleRow}
        />
      ) : null}

      {orgStructureOpen ? (
        <TenantOrgStructureModal
          title="הגדרת מבנה ארגוני ללקוח"
          initialValue={orgStructure}
          onClose={() => setOrgStructureOpen(false)}
          onSave={(value) => {
            setOrgStructure(value);
            setOrgStructureConfigured(true);
            setError((current) => current?.includes("מבנה ארגוני") ? null : current);
            setOrgStructureOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
