"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ShieldCheck, UserRound } from "lucide-react";

import { api, ApiRequestError, isLoggedIn } from "@/lib/api";
import { CardPage, type ChildTab } from "@/components/layout/CardPage";
import { useWorkspace } from "@/components/layout/WorkspaceShell";
import {
  AdminDateFields,
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
} from "@/components/ui/AdminModal";
import { FormField } from "@/components/ui/FormField";
import { HebrewDatePicker } from "@/components/ui/HebrewDatePicker";
import { SplitActionButton } from "@/components/ui/SplitActionButton";

interface IdentityRow {
  id: string;
  first_name: string;
  last_name: string;
  id_number?: string;
  gender?: string;
  valid_from: string;
  valid_to?: string | null;
  created_at?: string;
  _current?: boolean;
  _valid_from_raw?: string;
  _valid_to_raw?: string | null;
}

interface PersonalRow {
  id: string;
  birth_date?: string;
  birth_country?: string;
  citizenship1?: string;
  citizenship2?: string;
  marital_status?: string;
  num_children?: number;
  valid_from: string;
  valid_to?: string | null;
  created_at?: string;
  _current?: boolean;
  _valid_from_raw?: string;
  _valid_to_raw?: string | null;
}

interface ContactRow {
  id: string;
  address1?: string;
  address2?: string;
  city?: string;
  zip_code?: string;
  country?: string;
  phone?: string;
  mobile?: string;
  home_phone?: string;
  fax?: string;
  email?: string;
  valid_from: string;
  valid_to?: string | null;
  created_at?: string;
  _current?: boolean;
  _valid_from_raw?: string;
  _valid_to_raw?: string | null;
}

interface EmploymentRow {
  id: string;
  org_unit_id?: string;
  org_unit_name?: string;
  position_id?: string;
  position_name?: string;
  company?: string;
  employment_type?: string;
  manager_id?: string;
  start_date?: string;
  valid_from: string;
  valid_to?: string | null;
  created_at?: string;
  _current?: boolean;
  _valid_from_raw?: string;
  _valid_to_raw?: string | null;
}

interface CompensationRow {
  id: string;
  comp_code?: string;
  comp_name?: string;
  amount?: number;
  percentage?: number;
  valid_from: string;
  valid_to?: string | null;
  created_at?: string;
  _current?: boolean;
  _valid_from_raw?: string;
  _valid_to_raw?: string | null;
}

interface BankRow {
  id: string;
  payment_code?: string;
  bank_code?: string;
  bank_name?: string;
  branch?: string;
  account?: string;
  pct_payment?: number;
  fixed_amount?: number;
  signature_date?: string;
  valid_from: string;
  valid_to?: string | null;
  created_at?: string;
  _current?: boolean;
  _valid_from_raw?: string;
  _valid_to_raw?: string | null;
}

interface EventRow {
  id: string;
  event_type: string;
  event_date: string;
  reason?: string;
  description?: string;
  created_at?: string;
}

interface TrainingRow {
  id: string;
  course_name: string;
  course_date?: string;
  score?: string;
  institute?: string;
  created_at?: string;
}

interface EmployeeCard {
  id: string;
  employee_number: string;
  status: string;
  full_name: string;
  id_number?: string;
  photo_url?: string;
  created_at?: string;
  identity: IdentityRow[];
  personal: PersonalRow[];
  contact: ContactRow[];
  employment: EmploymentRow[];
  compensation: CompensationRow[];
  bank: BankRow[];
  events: EventRow[];
  training: TrainingRow[];
}

interface LegacyEmployeeSummary {
  id: string;
  employee_number: string;
  full_name: string;
  is_active: boolean;
  start_date?: string | null;
  employment_status?: string | null;
  employment_type?: string | null;
  org_unit_name?: string | null;
  position_title?: string | null;
  manager_name?: string | null;
  branch_name?: string | null;
  work_site?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface LegacyEmployeeIdentity {
  id: string;
  first_name: string;
  last_name: string;
  gender?: string | null;
  legal_id_number?: string | null;
  birth_date?: string | null;
  marital_status?: string | null;
  nationality?: string | null;
  children_count?: number | null;
  country?: string | null;
  city?: string | null;
  postal_code?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  phone?: string | null;
  email?: string | null;
  valid_from: string;
  valid_to?: string | null;
  created_at?: string;
}

interface LegacyEmployeeEmployment {
  id: string;
  org_unit_id?: string | null;
  manager_employee_id?: string | null;
  position_id?: string | null;
  org_unit_name?: string | null;
  manager_name?: string | null;
  position_title?: string | null;
  employment_status?: string | null;
  employment_type?: string | null;
  start_date?: string | null;
  branch_name?: string | null;
  work_site?: string | null;
  valid_from: string;
  valid_to?: string | null;
  created_at?: string;
}

interface LegacyEmployeeDetail {
  employee: LegacyEmployeeSummary;
  current_identity?: LegacyEmployeeIdentity | null;
  current_employment?: LegacyEmployeeEmployment | null;
  identity_history?: LegacyEmployeeIdentity[];
  employment_history?: LegacyEmployeeEmployment[];
  timeline?: Array<{
    id: string;
    event_type: string;
    effective_date: string;
    notes?: string | null;
  }>;
  courses?: Array<{
    id: string;
    course_name: string;
    completion_date?: string | null;
    provider?: string | null;
  }>;
}

interface EmployeeOption {
  id: string;
  employee_number: string;
  full_name: string;
}

interface LookupOption {
  id: string;
  code?: string;
  name: string;
}

type TemporalSection = "identity" | "personal" | "contact" | "employment" | "compensation" | "bank";
type TemporalMode = "add" | "update" | "set" | "close" | "delete";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface TemporalModalState {
  section: TemporalSection;
  mode: TemporalMode;
  recordId?: string;
  prefill?: Record<string, unknown>;
}

function normalizeEmployeeCard(card: EmployeeCard | LegacyEmployeeDetail): EmployeeCard {
  if ("employee" in card) {
    const identityHistory = card.identity_history ?? (card.current_identity ? [card.current_identity] : []);
    const employmentHistory = card.employment_history ?? (card.current_employment ? [card.current_employment] : []);
    const activeIdentity = card.current_identity ?? identityHistory[0];
    const activeEmployment = card.current_employment ?? employmentHistory[0];

    return {
      id: card.employee.id,
      employee_number: card.employee.employee_number,
      status: card.employee.is_active ? "active" : "inactive",
      full_name: card.employee.full_name,
      id_number: activeIdentity?.legal_id_number ?? undefined,
      created_at: activeIdentity?.created_at,
      identity: identityHistory.map((row) => ({
        id: row.id,
        first_name: row.first_name,
        last_name: row.last_name,
        id_number: row.legal_id_number ?? undefined,
        gender: row.gender ?? undefined,
        valid_from: row.valid_from,
        valid_to: row.valid_to ?? undefined,
        created_at: row.created_at,
        _current: !row.valid_to,
        _valid_from_raw: row.valid_from,
        _valid_to_raw: row.valid_to ?? undefined,
      })),
      personal: identityHistory.map((row) => ({
        id: row.id,
        birth_date: row.birth_date ?? undefined,
        citizenship1: row.nationality ?? undefined,
        marital_status: row.marital_status ?? undefined,
        num_children: row.children_count ?? undefined,
        valid_from: row.valid_from,
        valid_to: row.valid_to ?? undefined,
        created_at: row.created_at,
        _current: !row.valid_to,
        _valid_from_raw: row.valid_from,
        _valid_to_raw: row.valid_to ?? undefined,
      })),
      contact: identityHistory.map((row) => ({
        id: row.id,
        address1: row.address_line1 ?? undefined,
        address2: row.address_line2 ?? undefined,
        city: row.city ?? undefined,
        zip_code: row.postal_code ?? undefined,
        country: row.country ?? undefined,
        phone: row.phone ?? undefined,
        email: row.email ?? undefined,
        valid_from: row.valid_from,
        valid_to: row.valid_to ?? undefined,
        created_at: row.created_at,
        _current: !row.valid_to,
        _valid_from_raw: row.valid_from,
        _valid_to_raw: row.valid_to ?? undefined,
      })),
      employment: employmentHistory.map((row) => ({
        id: row.id,
        org_unit_id: row.org_unit_id ?? undefined,
        org_unit_name: row.org_unit_name ?? undefined,
        position_id: row.position_id ?? undefined,
        position_name: row.position_title ?? undefined,
        employment_type: row.employment_type ?? undefined,
        manager_id: row.manager_employee_id ?? undefined,
        start_date: row.start_date ?? undefined,
        valid_from: row.valid_from,
        valid_to: row.valid_to ?? undefined,
        created_at: row.created_at,
        _current: !row.valid_to,
        _valid_from_raw: row.valid_from,
        _valid_to_raw: row.valid_to ?? undefined,
      })),
      compensation: [],
      bank: [],
      events: (card.timeline ?? []).map((row) => ({
        id: row.id,
        event_type: row.event_type,
        event_date: row.effective_date,
        description: row.notes ?? undefined,
      })),
      training: (card.courses ?? []).map((row) => ({
        id: row.id,
        course_name: row.course_name,
        course_date: row.completion_date ?? undefined,
        institute: row.provider ?? undefined,
      })),
    };
  }

  return {
    ...card,
    identity: card.identity ?? [],
    personal: card.personal ?? [],
    contact: card.contact ?? [],
    employment: card.employment ?? [],
    compensation: card.compensation ?? [],
    bank: card.bank ?? [],
    events: card.events ?? [],
    training: card.training ?? [],
  };
}

const fmtDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString("he-IL") : "—");

function todayIso() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function getApiError(err: unknown, fallback: string) {
  if (err instanceof ApiRequestError) return err.error ?? err.message ?? fallback;
  const candidate = err as { error?: string; details?: { error?: string } };
  return candidate?.error ?? candidate?.details?.error ?? fallback;
}

function toPrefillRecord<T extends object>(value: T | undefined): Record<string, unknown> | undefined {
  return value ? ({ ...value } as unknown as Record<string, unknown>) : undefined;
}

const STATUS_CFG: Record<string, "active" | "trial" | "suspended" | "cancelled"> = {
  active: "active",
  inactive: "trial",
  terminated: "suspended",
};

const STATUS_LABELS: Record<string, string> = {
  active: "פעיל",
  inactive: "לא פעיל",
  terminated: "מסיים",
};

const GENDER_MAP: Record<string, string> = {
  M: "זכר",
  F: "נקבה",
};

const MARITAL_MAP: Record<string, string> = {
  single: "רווק/ה",
  married: "נשוי/נשואה",
  divorced: "גרוש/ה",
  widowed: "אלמן/ה",
};

const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  full_time: "משרה מלאה",
  part_time: "משרה חלקית",
  contract: "חוזה",
  freelance: "עצמאי",
};

function ModalSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {description ? <p className="text-[11px] text-slate-500">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ModalField({
  label,
  required = false,
  span = 1,
  children,
}: {
  label: string;
  required?: boolean;
  span?: 1 | 2;
  children: ReactNode;
}) {
  return (
    <div className={span === 2 ? "md:col-span-2" : undefined}>
      <label className="mb-1 block text-xs font-semibold text-slate-600">
        {required ? <span className="text-red-500 ml-0.5">*</span> : null}
        {label}
      </label>
      {children}
    </div>
  );
}

function ModalTextField({
  label,
  value,
  onChange,
  required = false,
  type = "text",
  span = 1,
}: {
  label: string;
  value?: string | null;
  onChange: (value: string) => void;
  required?: boolean;
  type?: "text" | "email";
  span?: 1 | 2;
}) {
  return (
    <ModalField label={label} required={required} span={span}>
      <input
        type={type}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className={ADMIN_MODAL_INPUT}
      />
    </ModalField>
  );
}

function ModalSelectField({
  label,
  value,
  onChange,
  options,
  placeholder = "בחר...",
  span = 1,
}: {
  label: string;
  value?: string | null;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  span?: 1 | 2;
}) {
  return (
    <ModalField label={label} span={span}>
      <select className={ADMIN_MODAL_INPUT} value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </ModalField>
  );
}

function ModalDateField({
  label,
  value,
  onChange,
  span = 1,
}: {
  label: string;
  value?: string | null;
  onChange: (value: string) => void;
  span?: 1 | 2;
}) {
  return (
    <ModalField label={label} span={span}>
      <HebrewDatePicker value={value ?? ""} onChange={onChange} className={ADMIN_MODAL_INPUT} />
    </ModalField>
  );
}

const EVENT_TYPE_MAP: Record<string, string> = {
  hire: "גיוס",
  promotion: "קידום",
  transfer: "העברה",
  leave: "חופשה",
  termination: "סיום עבודה",
  other: "אחר",
};

function getSectionTitle(section: TemporalSection) {
  switch (section) {
    case "identity":
      return "פרטים כלליים";
    case "personal":
      return "פרטים אישיים";
    case "contact":
      return "פרטי קשר";
    case "employment":
      return "תפקיד ושיוך";
    case "compensation":
      return "שכר";
    case "bank":
      return "חשבון בנק";
  }
}

function buildTemporalRows<T extends { _current?: boolean; _valid_from_raw?: string; _valid_to_raw?: string | null }>(
  rows: T[],
  mapRow: (row: T) => Record<string, unknown>,
) {
  return rows.map((row) => ({
    ...mapRow(row),
    _current: row._current,
    _valid_from_raw: row._valid_from_raw,
    _valid_to_raw: row._valid_to_raw,
  }));
}

function TemporalModal({
  state,
  tenantId,
  employeeId,
  orgUnitOptions,
  positionOptions,
  managerOptions,
  onClose,
  onSaved,
}: {
  state: TemporalModalState;
  tenantId: string;
  employeeId: string;
  orgUnitOptions: LookupOption[];
  positionOptions: LookupOption[];
  managerOptions: EmployeeOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<TemporalMode>(state.mode);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [validFrom, setValidFrom] = useState((state.prefill?.valid_from as string) ?? todayIso());
  const [validTo, setValidTo] = useState((state.prefill?.valid_to as string) ?? "");
  const [form, setForm] = useState<Record<string, string>>(() => {
    const prefill = state.prefill ?? {};
    const next: Record<string, string> = {};
    Object.entries(prefill).forEach(([key, value]) => {
      if (!["id", "valid_from", "valid_to", "created_at", "_current", "_valid_from_raw", "_valid_to_raw"].includes(key)) {
        next[key] = value == null ? "" : String(value);
      }
    });
    return next;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function switchMode(nextMode: TemporalMode) {
    setDropdownOpen(false);
    setError(null);
    setMode(nextMode);
    if (nextMode === "add" || nextMode === "set") {
      setValidFrom(todayIso());
      setValidTo("");
    }
    if (nextMode === "close") {
      setValidTo(todayIso());
    }
  }

  function isPayloadValid() {
    if (mode === "close") return Boolean(validTo);
    if (mode === "set") return Boolean(validFrom && validTo) && isFormValid();
    if (mode === "delete") return Boolean(validFrom);
    return Boolean(validFrom) && isFormValid();
  }

  function isFormValid() {
    if (mode === "close" || mode === "delete") return true;

    if (state.section === "identity") {
      return Boolean(form.first_name?.trim() && form.last_name?.trim());
    }

    if (state.section === "compensation") {
      return Boolean(form.comp_code?.trim() || form.comp_name?.trim());
    }

    return true;
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const requestPath =
      state.section === "identity" || state.section === "personal" || state.section === "contact"
        ? `/api/core/employees/${employeeId}/identity/record`
        : `/api/core/employees/${employeeId}/${state.section}?tenant_id=${tenantId}`;

    const body: Record<string, unknown> = {
      action: mode,
      valid_from: validFrom || todayIso(),
    };

    if (validTo) body.valid_to = validTo;
    if (state.recordId) body.record_id = state.recordId;

    const toNum = (value: string) => (value ? Number(value) : undefined);
    const toDate = (value: string) => value || undefined;

    if (mode !== "delete" && mode !== "close") {
      if (state.section === "identity") {
        Object.assign(body, {
          first_name: form.first_name?.trim() || undefined,
          last_name: form.last_name?.trim() || undefined,
          legal_id_number: form.id_number?.trim() || undefined,
          gender: form.gender || undefined,
        });
      } else if (state.section === "personal") {
        Object.assign(body, {
          birth_date: toDate(form.birth_date),
          marital_status: form.marital_status || undefined,
          nationality: form.citizenship1?.trim() || undefined,
          children_count: form.num_children ? toNum(form.num_children) : undefined,
        });
      } else if (state.section === "contact") {
        Object.assign(body, {
          address_line1: form.address1?.trim() || undefined,
          address_line2: form.address2?.trim() || undefined,
          city: form.city?.trim() || undefined,
          postal_code: form.zip_code?.trim() || undefined,
          country: form.country?.trim() || undefined,
          phone: form.phone?.trim() || undefined,
          email: form.email?.trim() || undefined,
        });
      } else if (state.section === "employment") {
        Object.assign(body, {
          org_unit_id: form.org_unit_id || undefined,
          position_id: form.position_id || undefined,
          company: form.company?.trim() || undefined,
          employment_type: form.employment_type || undefined,
          manager_id: form.manager_id || undefined,
          start_date: toDate(form.start_date),
        });
      } else if (state.section === "compensation") {
        Object.assign(body, {
          comp_code: form.comp_code?.trim() || undefined,
          comp_name: form.comp_name?.trim() || undefined,
          amount: form.amount ? toNum(form.amount) : undefined,
          percentage: form.percentage ? toNum(form.percentage) : undefined,
        });
      } else if (state.section === "bank") {
        Object.assign(body, {
          payment_code: form.payment_code?.trim() || undefined,
          bank_code: form.bank_code?.trim() || undefined,
          bank_name: form.bank_name?.trim() || undefined,
          branch: form.branch?.trim() || undefined,
          account: form.account?.trim() || undefined,
          pct_payment: form.pct_payment ? toNum(form.pct_payment) : undefined,
          fixed_amount: form.fixed_amount ? toNum(form.fixed_amount) : undefined,
          signature_date: toDate(form.signature_date),
        });
      }
    }

    try {
      await api.put(requestPath, body);
      onSaved();
      onClose();
    } catch (err) {
      setError(getApiError(err, "לא ניתן לשמור את הרשומה"));
      setSaving(false);
      return;
    }

    setSaving(false);
  }

  const title =
    mode === "delete" ? `בטל רשומה — ${getSectionTitle(state.section)}`
    : mode === "set" ? `קבע תקופה — ${getSectionTitle(state.section)}`
    : mode === "close" ? `סגור תקופה — ${getSectionTitle(state.section)}`
    : mode === "add" ? `הוסף רשומה — ${getSectionTitle(state.section)}`
    : `עדכון — ${getSectionTitle(state.section)}`;

  return (
    <AdminModal onBackdropClick={onClose}>
      <AdminModalPanel className="relative max-w-3xl overflow-hidden" onClick={() => setDropdownOpen(false)}>
        <AdminModalHeader
          title={
            <span className="flex items-center gap-2 text-[#1a3a6e]">
              <span className="rounded-xl bg-white/60 p-2 text-brand-600">
                <ShieldCheck size={16} />
              </span>
              <span>{title}</span>
            </span>
          }
          onClose={onClose}
        />
        <AdminModalBody className="space-y-4">
          {mode === "delete" ? (
            <AdminModalMessage tone="danger">
              פעולה זו תבטל את הרשומה מההיסטוריה. השתמש בה רק אם הרשומה נפתחה בטעות.
            </AdminModalMessage>
          ) : null}

          {mode === "close" ? (
            <AdminModalMessage tone="warning">
              סגירת תקופה תשאיר את הרשומה בהיסטוריה ותגדיר לה תאריך סיום.
            </AdminModalMessage>
          ) : null}

          {mode === "set" ? (
            <AdminModalMessage tone="warning">
              קביעת תקופה תחליף, תפצל או תסיר רשומות חופפות של אותה ישות בטווח התאריכים שתבחר.
            </AdminModalMessage>
          ) : null}

          {mode !== "delete" && mode !== "close" ? (
            <>
              {state.section === "identity" ? (
                <ModalSection title="זהות בסיסית" description="פרטי הזיהוי העיקריים של העובד כפי שהם נתמכים כיום בכרטיס העובד.">
                  <div className={ADMIN_MODAL_GRID}>
                    <ModalTextField label="שם פרטי" required value={form.first_name ?? ""} onChange={(value) => setField("first_name", value)} />
                    <ModalTextField label="שם משפחה" required value={form.last_name ?? ""} onChange={(value) => setField("last_name", value)} />
                    <ModalTextField label="ת.ז." value={form.id_number ?? ""} onChange={(value) => setField("id_number", value)} />
                    <ModalSelectField
                      label="מגדר"
                      value={form.gender ?? ""}
                      onChange={(value) => setField("gender", value)}
                      options={[
                        { value: "M", label: "זכר" },
                        { value: "F", label: "נקבה" },
                      ]}
                    />
                  </div>
                </ModalSection>
              ) : null}

              {state.section === "personal" ? (
                <ModalSection title="פרטים אישיים" description="נתונים אישיים ודמוגרפיים של העובד לצרכי משאבי אנוש ודיווח.">
                  <div className={ADMIN_MODAL_GRID}>
                    <ModalDateField label="תאריך לידה" value={form.birth_date ?? ""} onChange={(value) => setField("birth_date", value)} />
                    <ModalTextField label="ארץ לידה" value={form.birth_country ?? ""} onChange={(value) => setField("birth_country", value)} />
                    <ModalTextField label="אזרחות 1" value={form.citizenship1 ?? ""} onChange={(value) => setField("citizenship1", value)} />
                    <ModalTextField label="אזרחות 2" value={form.citizenship2 ?? ""} onChange={(value) => setField("citizenship2", value)} />
                    <ModalSelectField
                      label="מצב משפחתי"
                      value={form.marital_status ?? ""}
                      onChange={(value) => setField("marital_status", value)}
                      options={[
                        { value: "single", label: "רווק/ה" },
                        { value: "married", label: "נשוי/נשואה" },
                        { value: "divorced", label: "גרוש/ה" },
                        { value: "widowed", label: "אלמן/ה" },
                      ]}
                    />
                    <ModalTextField label="מספר ילדים" value={form.num_children ?? ""} onChange={(value) => setField("num_children", value)} />
                  </div>
                </ModalSection>
              ) : null}

              {state.section === "contact" ? (
                <div className="space-y-4">
                  <ModalSection title="כתובת" description="מיקום וכתובת למשלוח, תקשורת ומסמכים.">
                    <div className={ADMIN_MODAL_GRID}>
                      <ModalTextField label="כתובת שורה 1" value={form.address1 ?? ""} onChange={(value) => setField("address1", value)} span={2} />
                      <ModalTextField label="כתובת שורה 2" value={form.address2 ?? ""} onChange={(value) => setField("address2", value)} span={2} />
                      <ModalTextField label="עיר" value={form.city ?? ""} onChange={(value) => setField("city", value)} />
                      <ModalTextField label="מיקוד" value={form.zip_code ?? ""} onChange={(value) => setField("zip_code", value)} />
                      <ModalTextField label="ארץ" value={form.country ?? ""} onChange={(value) => setField("country", value)} />
                    </div>
                  </ModalSection>

                  <ModalSection title="ערוצי קשר" description="פרטי ההתקשרות הישירים של העובד.">
                    <div className={ADMIN_MODAL_GRID}>
                      <ModalTextField label="טלפון" value={form.phone ?? ""} onChange={(value) => setField("phone", value)} />
                      <ModalTextField label="נייד" value={form.mobile ?? ""} onChange={(value) => setField("mobile", value)} />
                      <ModalTextField label="טלפון בית" value={form.home_phone ?? ""} onChange={(value) => setField("home_phone", value)} />
                      <ModalTextField label="פקס" value={form.fax ?? ""} onChange={(value) => setField("fax", value)} />
                      <ModalTextField label="דוא״ל" type="email" value={form.email ?? ""} onChange={(value) => setField("email", value)} span={2} />
                    </div>
                  </ModalSection>
                </div>
              ) : null}

              {state.section === "employment" ? (
                <div className="space-y-4">
                  <ModalSection title="שיוך ארגוני" description="היחידה, התפקיד והדיווח הישיר של העובד בארגון.">
                    <div className={ADMIN_MODAL_GRID}>
                      <ModalField label="יחידה ארגונית">
                        <select className={ADMIN_MODAL_INPUT} value={form.org_unit_id ?? ""} onChange={(event) => setField("org_unit_id", event.target.value)}>
                          <option value="">בחר יחידה</option>
                          {orgUnitOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.code ? `${option.code} - ${option.name}` : option.name}
                            </option>
                          ))}
                        </select>
                      </ModalField>
                      <ModalField label="תפקיד">
                        <select className={ADMIN_MODAL_INPUT} value={form.position_id ?? ""} onChange={(event) => setField("position_id", event.target.value)}>
                          <option value="">בחר תפקיד</option>
                          {positionOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.code ? `${option.code} - ${option.name}` : option.name}
                            </option>
                          ))}
                        </select>
                      </ModalField>
                      <ModalField label="מנהל ישיר" span={2}>
                        <select className={ADMIN_MODAL_INPUT} value={form.manager_id ?? ""} onChange={(event) => setField("manager_id", event.target.value)}>
                          <option value="">ללא מנהל משויך</option>
                          {managerOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {`${option.employee_number} - ${option.full_name}`}
                            </option>
                          ))}
                        </select>
                      </ModalField>
                    </div>
                  </ModalSection>

                  <ModalSection title="מאפייני העסקה" description="פרטי מסגרת ההעסקה כפי שהם מנוהלים בכרטיס העובד.">
                    <div className={ADMIN_MODAL_GRID}>
                      <ModalTextField label="חברה" value={form.company ?? ""} onChange={(value) => setField("company", value)} />
                      <ModalSelectField
                        label="סוג העסקה"
                        value={form.employment_type ?? ""}
                        onChange={(value) => setField("employment_type", value)}
                        options={[
                          { value: "full_time", label: "משרה מלאה" },
                          { value: "part_time", label: "משרה חלקית" },
                          { value: "contract", label: "חוזה" },
                          { value: "freelance", label: "עצמאי" },
                        ]}
                      />
                      <ModalDateField label="תאריך תחילה" value={form.start_date ?? ""} onChange={(value) => setField("start_date", value)} span={2} />
                    </div>
                  </ModalSection>
                </div>
              ) : null}

              {state.section === "compensation" ? (
                <ModalSection title="רכיב שכר" description="הגדרת רכיב התגמול, הערך וסוג החישוב.">
                  <div className={ADMIN_MODAL_GRID}>
                    <ModalTextField label="קוד רכיב" value={form.comp_code ?? ""} onChange={(value) => setField("comp_code", value)} />
                    <ModalTextField label="שם רכיב" value={form.comp_name ?? ""} onChange={(value) => setField("comp_name", value)} />
                    <ModalTextField label="סכום" value={form.amount ?? ""} onChange={(value) => setField("amount", value)} />
                    <ModalTextField label="אחוז" value={form.percentage ?? ""} onChange={(value) => setField("percentage", value)} />
                  </div>
                </ModalSection>
              ) : null}

              {state.section === "bank" ? (
                <div className="space-y-4">
                  <ModalSection title="נתוני העברה" description="הקודים והסימונים שמשמשים את מנגנון התשלום.">
                    <div className={ADMIN_MODAL_GRID}>
                      <ModalTextField label="קוד תשלום" value={form.payment_code ?? ""} onChange={(value) => setField("payment_code", value)} />
                      <ModalTextField label="% לתשלום" value={form.pct_payment ?? ""} onChange={(value) => setField("pct_payment", value)} />
                      <ModalTextField label="סכום קבוע" value={form.fixed_amount ?? ""} onChange={(value) => setField("fixed_amount", value)} />
                    </div>
                  </ModalSection>

                  <ModalSection title="חשבון בנק" description="פרטי הבנק שאליו ישויך התשלום לעובד.">
                    <div className={ADMIN_MODAL_GRID}>
                      <ModalTextField label="קוד בנק" value={form.bank_code ?? ""} onChange={(value) => setField("bank_code", value)} />
                      <ModalTextField label="שם בנק" value={form.bank_name ?? ""} onChange={(value) => setField("bank_name", value)} />
                      <ModalTextField label="סניף" value={form.branch ?? ""} onChange={(value) => setField("branch", value)} />
                      <ModalTextField label="חשבון" value={form.account ?? ""} onChange={(value) => setField("account", value)} />
                      <ModalDateField label="תאריך חתימה" value={form.signature_date ?? ""} onChange={(value) => setField("signature_date", value)} />
                    </div>
                  </ModalSection>
                </div>
              ) : null}
            </>
          ) : null}

          {mode === "close" ? (
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">עד תאריך</label>
              <HebrewDatePicker value={validTo} onChange={setValidTo} className={ADMIN_MODAL_INPUT} />
            </div>
          ) : mode !== "delete" ? (
            <AdminDateFields
              fromField={<HebrewDatePicker value={validFrom} onChange={setValidFrom} className={ADMIN_MODAL_INPUT} />}
              toField={<HebrewDatePicker value={validTo} onChange={setValidTo} className={ADMIN_MODAL_INPUT} />}
            />
          ) : null}

          {error ? <AdminModalMessage tone="danger">{error}</AdminModalMessage> : null}
        </AdminModalBody>
        <AdminModalFooter className="px-6">
          <button onClick={onClose} className={ADMIN_MODAL_ACTION_SECONDARY}>
            ביטול
          </button>

          {state.recordId && mode === "update" ? (
            <SplitActionButton
              primaryLabel={saving ? "שומר..." : "שמור"}
              onPrimaryClick={handleSave}
              primaryDisabled={saving || !isPayloadValid()}
              menuOpen={dropdownOpen}
              onMenuToggle={() => setDropdownOpen((open) => !open)}
              buttonClassName="bg-brand-600 hover:bg-brand-700 text-white"
              minMenuWidthClassName="min-w-[170px]"
              actions={[
                {
                  label: "רשומה חדשה",
                  onClick: () => switchMode("add"),
                },
                {
                  label: "קבע תקופה",
                  onClick: () => switchMode("set"),
                  tone: "warning",
                },
                {
                  label: "סגור תקופה",
                  onClick: () => switchMode("close"),
                  tone: "warning",
                },
                {
                  label: "בטל רשומה",
                  onClick: () => switchMode("delete"),
                  tone: "danger",
                },
              ]}
            />
          ) : (
            <button
              onClick={handleSave}
              disabled={saving || !isPayloadValid()}
              className={
                mode === "delete"
                  ? ADMIN_MODAL_ACTION_DANGER
                  : mode === "close" || mode === "set"
                    ? ADMIN_MODAL_ACTION_WARNING
                    : ADMIN_MODAL_ACTION_PRIMARY
              }
            >
              {saving
                ? "שומר..."
                : mode === "delete"
                  ? "בטל רשומה"
                  : mode === "close"
                    ? "סגור תקופה"
                    : mode === "set"
                      ? "קבע תקופה"
                      : mode === "add"
                        ? "הוסף רשומה"
                        : "שמור"}
            </button>
          )}
        </AdminModalFooter>
      </AdminModalPanel>
    </AdminModal>
  );
}

function EventModal({
  tenantId,
  employeeId,
  onClose,
  onSaved,
}: {
  tenantId: string;
  employeeId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ event_type: "", event_date: todayIso(), reason: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    if (!form.event_type || !form.event_date) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/api/core/employees/${employeeId}/events?tenant_id=${tenantId}`, {
        event_type: form.event_type,
        event_date: form.event_date,
        reason: form.reason || undefined,
        description: form.description || undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(getApiError(err, "שגיאה בשמירה"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminModal onBackdropClick={onClose}>
      <AdminModalPanel className="max-w-md overflow-hidden">
        <AdminModalHeader title="הוסף אירוע" onClose={onClose} />
        <AdminModalBody className="space-y-3">
          {error ? <AdminModalMessage tone="danger">{error}</AdminModalMessage> : null}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">סוג אירוע *</label>
            <select className={ADMIN_MODAL_INPUT} value={form.event_type} onChange={(event) => setField("event_type", event.target.value)}>
              <option value="">בחר...</option>
              <option value="hire">גיוס</option>
              <option value="promotion">קידום</option>
              <option value="transfer">העברה</option>
              <option value="leave">חופשה</option>
              <option value="termination">סיום עבודה</option>
              <option value="other">אחר</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">תאריך *</label>
            <HebrewDatePicker value={form.event_date} onChange={(value) => setField("event_date", value)} className={ADMIN_MODAL_INPUT} />
          </div>
          <FormField label="סיבה" value={form.reason} readOnly={false} onChange={(value) => setField("reason", value)} />
          <FormField label="תיאור" value={form.description} readOnly={false} onChange={(value) => setField("description", value)} />
        </AdminModalBody>
        <AdminModalFooter>
          <button onClick={handleSave} disabled={saving || !form.event_type || !form.event_date} className={ADMIN_MODAL_ACTION_PRIMARY}>
            {saving ? "שומר..." : "שמור"}
          </button>
          <button onClick={onClose} className={ADMIN_MODAL_ACTION_SECONDARY}>
            ביטול
          </button>
        </AdminModalFooter>
      </AdminModalPanel>
    </AdminModal>
  );
}

function TrainingModal({
  tenantId,
  employeeId,
  onClose,
  onSaved,
}: {
  tenantId: string;
  employeeId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ course_name: "", course_date: "", score: "", institute: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    if (!form.course_name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/api/core/employees/${employeeId}/training?tenant_id=${tenantId}`, {
        course_name: form.course_name.trim(),
        course_date: form.course_date || undefined,
        score: form.score || undefined,
        institute: form.institute || undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(getApiError(err, "שגיאה בשמירה"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminModal onBackdropClick={onClose}>
      <AdminModalPanel className="max-w-md overflow-hidden">
        <AdminModalHeader title="הוסף קורס" onClose={onClose} />
        <AdminModalBody className="space-y-3">
          {error ? <AdminModalMessage tone="danger">{error}</AdminModalMessage> : null}
          <FormField label="שם קורס" required value={form.course_name} readOnly={false} onChange={(value) => setField("course_name", value)} />
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">תאריך</label>
            <HebrewDatePicker value={form.course_date} onChange={(value) => setField("course_date", value)} className={ADMIN_MODAL_INPUT} />
          </div>
          <FormField label="ציון" value={form.score} readOnly={false} onChange={(value) => setField("score", value)} />
          <FormField label="גוף מלמד" value={form.institute} readOnly={false} onChange={(value) => setField("institute", value)} />
        </AdminModalBody>
        <AdminModalFooter>
          <button onClick={handleSave} disabled={saving || !form.course_name.trim()} className={ADMIN_MODAL_ACTION_PRIMARY}>
            {saving ? "שומר..." : "שמור"}
          </button>
          <button onClick={onClose} className={ADMIN_MODAL_ACTION_SECONDARY}>
            ביטול
          </button>
        </AdminModalFooter>
      </AdminModalPanel>
    </AdminModal>
  );
}

function StatusModal({
  tenantId,
  employeeId,
  current,
  onClose,
  onSaved,
}: {
  tenantId: string;
  employeeId: string;
  current: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/api/core/employees/${employeeId}/status?tenant_id=${tenantId}`, { status });
      onSaved();
      onClose();
    } catch (err) {
      setError(getApiError(err, "שגיאה בשמירה"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminModal onBackdropClick={onClose}>
      <AdminModalPanel className="max-w-sm overflow-hidden">
        <AdminModalHeader title="שינוי סטטוס עובד" onClose={onClose} />
        <AdminModalBody className="space-y-3">
          {error ? <AdminModalMessage tone="danger">{error}</AdminModalMessage> : null}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">סטטוס</label>
            <select className={ADMIN_MODAL_INPUT} value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="active">פעיל</option>
              <option value="inactive">לא פעיל</option>
              <option value="terminated">מסיים</option>
            </select>
          </div>
          {status === "terminated" ? (
            <AdminModalMessage tone="warning">שינוי לסטטוס מסיים הוא פעולה משמעותית המשפיעה על כל מחזור החיים של העובד.</AdminModalMessage>
          ) : null}
        </AdminModalBody>
        <AdminModalFooter>
          <button
            onClick={handleSave}
            disabled={saving || status === current}
            className={status === "terminated" ? ADMIN_MODAL_ACTION_DANGER : ADMIN_MODAL_ACTION_PRIMARY}
          >
            {saving ? "שומר..." : "שמור"}
          </button>
          <button onClick={onClose} className={ADMIN_MODAL_ACTION_SECONDARY}>
            ביטול
          </button>
        </AdminModalFooter>
      </AdminModalPanel>
    </AdminModal>
  );
}

function DeleteEmployeeModal({
  tenantId,
  employeeId,
  employeeNumber,
  fullName,
  onClose,
  onDeleted,
}: {
  tenantId: string;
  employeeId: string;
  employeeNumber: string;
  fullName: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setSaving(true);
    setError(null);
    try {
      await api.delete(`/api/core/employees/${employeeId}?tenant_id=${tenantId}`);
      onDeleted();
    } catch (err) {
      setError(getApiError(err, "לא ניתן למחוק את העובד"));
      setSaving(false);
    }
  }

  return (
    <AdminModal onBackdropClick={onClose}>
      <AdminModalPanel className="max-w-md overflow-hidden">
        <AdminModalHeader title="מחיקת עובד" onClose={onClose} />
        <AdminModalBody className="space-y-4">
          <AdminModalMessage tone="danger">
            <strong>פעולה בלתי הפיכה.</strong> העובד <strong>{fullName}</strong> (מס׳ עובד {employeeNumber}) יימחק יחד עם
            היסטוריית הפרטים, השיוכים, השכר, חשבונות הבנק, האירועים והקורסים שלו.
          </AdminModalMessage>
          <AdminModalMessage tone="warning">
            אם רצית רק להפסיק פעילות, עדיף להשתמש בשינוי סטטוס או סגירת תקופה במקום מחיקה מלאה.
          </AdminModalMessage>
          {error ? <AdminModalMessage tone="danger">{error}</AdminModalMessage> : null}
        </AdminModalBody>
        <AdminModalFooter>
          <button onClick={handleDelete} disabled={saving} className={ADMIN_MODAL_ACTION_DANGER}>
            {saving ? "מוחק..." : "מחק עובד"}
          </button>
          <button onClick={onClose} disabled={saving} className={ADMIN_MODAL_ACTION_SECONDARY}>
            ביטול
          </button>
        </AdminModalFooter>
      </AdminModalPanel>
    </AdminModal>
  );
}

export default function EmployeeCardPage() {
  const router = useRouter();
  const params = useParams();
  const employeeRouteParam = params.id as string;
  const workspace = useWorkspace();
  const tenantId = workspace?.selectedTenantId ?? "";

  const [card, setCard] = useState<EmployeeCard | null>(null);
  const [resolvedEmployeeId, setResolvedEmployeeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [temporalModal, setTemporalModal] = useState<TemporalModalState | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [orgUnitOptions, setOrgUnitOptions] = useState<LookupOption[]>([]);
  const [positionOptions, setPositionOptions] = useState<LookupOption[]>([]);
  const [managerOptions, setManagerOptions] = useState<EmployeeOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadCard = useCallback(() => {
    if (!tenantId) return;
    setLoading(true);
    setLoadError(null);

    const resolveEmployeeId = async () => {
      if (UUID_PATTERN.test(employeeRouteParam)) return employeeRouteParam;

      const employees = await api.get<EmployeeOption[]>(`/api/core/employees?tenant_id=${tenantId}`);
      const match = employees.find((employee) => String(employee.employee_number) === employeeRouteParam);
      if (!match) {
        throw new Error(`Employee ${employeeRouteParam} not found`);
      }
      return match.id;
    };

    resolveEmployeeId()
      .then((employeeId) => {
        setResolvedEmployeeId(employeeId);
        return api.get<EmployeeCard>(`/api/core/employees/${employeeId}?tenant_id=${tenantId}`);
      })
      .then((data) => setCard(normalizeEmployeeCard(data)))
      .catch((error) => {
        console.error(error);
        setCard(null);
        setResolvedEmployeeId(null);
        setLoadError("לא הצלחנו לטעון את פרטי העובד. בדוק שהעובד קיים בארגון הפעיל.");
      })
      .finally(() => setLoading(false));
  }, [employeeRouteParam, tenantId]);

  const loadEmploymentLookups = useCallback(() => {
    if (!tenantId) {
      setOrgUnitOptions([]);
      setPositionOptions([]);
      setManagerOptions([]);
      return;
    }

    Promise.all([
      api.get<Array<{ id: string; code?: string; name: string }>>(`/api/core/org-units?tenant_id=${tenantId}`),
      api.get<Array<{ id: string; code?: string; name: string }>>(`/api/core/positions?tenant_id=${tenantId}`),
      api.get<EmployeeOption[]>(`/api/core/employees?tenant_id=${tenantId}`),
    ])
      .then(([orgUnits, positions, employees]) => {
        setOrgUnitOptions(orgUnits);
        setPositionOptions(positions);
        setManagerOptions(employees);
      })
      .catch(console.error);
  }, [tenantId]);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    if (!tenantId) return;
    loadCard();
    loadEmploymentLookups();
  }, [tenantId, loadCard, loadEmploymentLookups]);

  const identityRows = card?.identity ?? [];
  const personalRows = card?.personal ?? [];
  const contactRows = card?.contact ?? [];
  const employmentRows = card?.employment ?? [];
  const compensationRows = card?.compensation ?? [];
  const bankRows = card?.bank ?? [];

  const activeIdent = identityRows.find((row) => row._current) ?? identityRows[0];
  const activePersonal = personalRows.find((row) => row._current) ?? personalRows[0];
  const activeContact = contactRows.find((row) => row._current) ?? contactRows[0];
  const activeEmployment = employmentRows.find((row) => row._current) ?? employmentRows[0];
  const activeCompensation = compensationRows.find((row) => row._current) ?? compensationRows[0];
  const activeBank = bankRows.find((row) => row._current) ?? bankRows[0];

  function openTemporal(section: TemporalSection, row?: Record<string, unknown>, mode: TemporalMode = row ? "update" : "add") {
    setTemporalModal({
      section,
      mode,
      recordId: typeof row?.id === "string" ? row.id : undefined,
      prefill: row,
    });
  }

  const childTabs: ChildTab[] = [
    {
      id: "identity",
      label: "פרטים כלליים",
      temporalFilter: true,
      emptyMessage: "אין פרטי זהות רשומים",
      columns: [
        { key: "first_name", label: "שם פרטי" },
        { key: "last_name", label: "שם משפחה" },
        { key: "id_number", label: "ת.ז." },
        { key: "gender", label: "מגדר" },
        { key: "valid_from", label: "מ-" },
        { key: "valid_to", label: "עד" },
      ],
      rows: buildTemporalRows(identityRows, (row) => ({
        first_name: row.first_name,
        last_name: row.last_name,
        id_number: row.id_number ?? "—",
        gender: row.gender ? GENDER_MAP[row.gender] ?? row.gender : "—",
        valid_from: fmtDate(row.valid_from),
        valid_to: fmtDate(row.valid_to),
      })),
      onAddClick: () => openTemporal("identity"),
      onRowDoubleClick: (index) => {
        const row = identityRows[index];
        if (row) openTemporal("identity", toPrefillRecord(row));
      },
    },
    {
      id: "personal",
      label: "פרטים אישיים",
      temporalFilter: true,
      emptyMessage: "אין פרטים אישיים רשומים",
      columns: [
        { key: "birth_date", label: "תאריך לידה" },
        { key: "birth_country", label: "ארץ לידה" },
        { key: "marital_status", label: "מצב משפחתי" },
        { key: "num_children", label: "מס' ילדים" },
        { key: "valid_from", label: "מ-" },
        { key: "valid_to", label: "עד" },
      ],
      rows: buildTemporalRows(personalRows, (row) => ({
        birth_date: fmtDate(row.birth_date),
        birth_country: row.birth_country ?? "—",
        marital_status: row.marital_status ? MARITAL_MAP[row.marital_status] ?? row.marital_status : "—",
        num_children: row.num_children ?? "—",
        valid_from: fmtDate(row.valid_from),
        valid_to: fmtDate(row.valid_to),
      })),
      onAddClick: () => openTemporal("personal"),
      onRowDoubleClick: (index) => {
        const row = personalRows[index];
        if (row) openTemporal("personal", toPrefillRecord(row));
      },
    },
    {
      id: "contact",
      label: "פרטי קשר",
      temporalFilter: true,
      emptyMessage: "אין פרטי קשר רשומים",
      columns: [
        { key: "address", label: "כתובת" },
        { key: "city", label: "עיר" },
        { key: "phone", label: "טלפון" },
        { key: "mobile", label: "נייד" },
        { key: "email", label: 'דוא"ל' },
        { key: "valid_from", label: "מ-" },
        { key: "valid_to", label: "עד" },
      ],
      rows: buildTemporalRows(contactRows, (row) => ({
        address: [row.address1, row.address2].filter(Boolean).join(", ") || "—",
        city: row.city ?? "—",
        phone: row.phone ?? "—",
        mobile: row.mobile ?? "—",
        email: row.email ?? "—",
        valid_from: fmtDate(row.valid_from),
        valid_to: fmtDate(row.valid_to),
      })),
      onAddClick: () => openTemporal("contact"),
      onRowDoubleClick: (index) => {
        const row = contactRows[index];
        if (row) openTemporal("contact", toPrefillRecord(row));
      },
    },
    {
      id: "employment",
      label: "תפקיד ושיוך",
      temporalFilter: true,
      emptyMessage: "אין רשומות העסקה",
      columns: [
        { key: "org_unit_name", label: "יחידה ארגונית" },
        { key: "position_name", label: "תפקיד" },
        { key: "company", label: "חברה" },
        { key: "employment_type", label: "סוג העסקה" },
        { key: "start_date", label: "תאריך תחילה" },
        { key: "valid_from", label: "מ-" },
        { key: "valid_to", label: "עד" },
      ],
      rows: buildTemporalRows(employmentRows, (row) => ({
        org_unit_name: row.org_unit_name ?? "—",
        position_name: row.position_name ?? "—",
        company: row.company ?? "—",
        employment_type: row.employment_type ? EMPLOYMENT_TYPE_MAP[row.employment_type] ?? row.employment_type : "—",
        start_date: fmtDate(row.start_date),
        valid_from: fmtDate(row.valid_from),
        valid_to: fmtDate(row.valid_to),
      })),
      onAddClick: () => openTemporal("employment"),
      onRowDoubleClick: (index) => {
        const row = employmentRows[index];
        if (row) openTemporal("employment", toPrefillRecord(row));
      },
    },
    {
      id: "compensation",
      label: "שכר",
      temporalFilter: true,
      emptyMessage: "אין רכיבי שכר",
      columns: [
        { key: "comp_code", label: "קוד" },
        { key: "comp_name", label: "שם רכיב" },
        { key: "amount", label: "סכום" },
        { key: "percentage", label: "%" },
        { key: "valid_from", label: "מ-" },
        { key: "valid_to", label: "עד" },
      ],
      rows: buildTemporalRows(compensationRows, (row) => ({
        comp_code: row.comp_code ?? "—",
        comp_name: row.comp_name ?? "—",
        amount: row.amount ?? "—",
        percentage: row.percentage ?? "—",
        valid_from: fmtDate(row.valid_from),
        valid_to: fmtDate(row.valid_to),
      })),
      onAddClick: () => openTemporal("compensation"),
      onRowDoubleClick: (index) => {
        const row = compensationRows[index];
        if (row) openTemporal("compensation", toPrefillRecord(row));
      },
    },
    {
      id: "bank",
      label: "חשבון בנק",
      temporalFilter: true,
      emptyMessage: "אין חשבונות בנק",
      columns: [
        { key: "bank_name", label: "בנק" },
        { key: "branch", label: "סניף" },
        { key: "account", label: "חשבון" },
        { key: "pct_payment", label: "% לתשלום" },
        { key: "fixed_amount", label: "סכום קבוע" },
        { key: "valid_from", label: "מ-" },
        { key: "valid_to", label: "עד" },
      ],
      rows: buildTemporalRows(bankRows, (row) => ({
        bank_name: row.bank_name ?? "—",
        branch: row.branch ?? "—",
        account: row.account ?? "—",
        pct_payment: row.pct_payment ?? "—",
        fixed_amount: row.fixed_amount ?? "—",
        valid_from: fmtDate(row.valid_from),
        valid_to: fmtDate(row.valid_to),
      })),
      onAddClick: () => openTemporal("bank"),
      onRowDoubleClick: (index) => {
        const row = bankRows[index];
        if (row) openTemporal("bank", toPrefillRecord(row));
      },
    },
    {
      id: "training",
      label: "קורסים",
      emptyMessage: "אין קורסים",
      columns: [
        { key: "course_name", label: "שם קורס" },
        { key: "course_date", label: "תאריך" },
        { key: "score", label: "ציון" },
        { key: "institute", label: "גוף מלמד" },
      ],
      rows: (card?.training ?? []).map((row) => ({
        course_name: row.course_name,
        course_date: fmtDate(row.course_date),
        score: row.score ?? "—",
        institute: row.institute ?? "—",
      })),
      onAddClick: () => setShowTrainingModal(true),
    },
    {
      id: "events",
      label: "אירועים",
      emptyMessage: "אין אירועים",
      columns: [
        { key: "event_type", label: "סוג אירוע" },
        { key: "event_date", label: "תאריך" },
        { key: "reason", label: "סיבה" },
        { key: "description", label: "תיאור" },
      ],
      rows: (card?.events ?? []).map((row) => ({
        event_type: EVENT_TYPE_MAP[row.event_type] ?? row.event_type,
        event_date: fmtDate(row.event_date),
        reason: row.reason ?? "—",
        description: row.description ?? "—",
      })),
      onAddClick: () => setShowEventModal(true),
    },
  ];

  const parentContent = (
    <div className="border-b border-slate-200 bg-white px-4 py-4">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-l from-white to-slate-50 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <UserRound size={24} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-slate-800">
                {card?.full_name ?? "כרטיס עובד"}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                מס׳ עובד: {card?.employee_number ?? "—"}
              </div>
              <div className="text-xs text-slate-500">
                ת.ז.: {card?.id_number ?? "—"}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-right">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">תפקיד נוכחי</div>
              <div className="text-xs font-medium text-slate-700">{activeEmployment?.position_name ?? "—"}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-right">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">יחידה ארגונית</div>
              <div className="text-xs font-medium text-slate-700">{activeEmployment?.org_unit_name ?? "—"}</div>
            </div>
            <button
              type="button"
              onClick={() => setShowStatusModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50"
            >
              <ShieldCheck size={13} className="text-brand-600" />
              שנה סטטוס
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-100">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">פרטי קשר</div>
            <div className="mt-1 text-xs text-slate-700">{activeContact?.email ?? activeContact?.mobile ?? "אין נתון פעיל"}</div>
          </div>
          <div className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-100">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">תאריך תחילה</div>
            <div className="mt-1 text-xs text-slate-700">{fmtDate(activeEmployment?.start_date)}</div>
          </div>
          <div className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-100">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">מצב משפחתי</div>
            <div className="mt-1 text-xs text-slate-700">
              {activePersonal?.marital_status ? MARITAL_MAP[activePersonal.marital_status] ?? activePersonal.marital_status : "—"}
            </div>
          </div>
          <div className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-100">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">רכיב שכר נוכחי</div>
            <div className="mt-1 text-xs text-slate-700">{activeCompensation?.comp_name ?? activeBank?.bank_name ?? "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );

  const statusType = card ? STATUS_CFG[card.status] : undefined;
  const statusLabel = card ? STATUS_LABELS[card.status] ?? card.status : undefined;

  return (
    <>
      {loadError && !loading ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {loadError}
        </div>
      ) : null}
      <CardPage
        title={card ? `${card.full_name} — עובד ${card.employee_number}` : "כרטיס עובד"}
        backHref="/admin/core"
        backLabel="רשימת עובדים"
        status={statusType && statusLabel ? { label: statusLabel, type: statusType } : undefined}
        primaryActions={card ? [{
          label: "מחק עובד",
          onClick: () => setShowDeleteModal(true),
        }] : []}
        parentContent={parentContent}
        parentContentMode="compact"
        formTabs={[]}
        childTabs={childTabs}
        childTabsStorageKey="click_employee_card_tab_order"
        loading={loading}
      />

      {temporalModal && tenantId && resolvedEmployeeId ? (
        <TemporalModal
          state={temporalModal}
          tenantId={tenantId}
          employeeId={resolvedEmployeeId}
          orgUnitOptions={orgUnitOptions}
          positionOptions={positionOptions}
          managerOptions={managerOptions}
          onClose={() => setTemporalModal(null)}
          onSaved={loadCard}
        />
      ) : null}

      {showEventModal && tenantId && resolvedEmployeeId ? (
        <EventModal
          tenantId={tenantId}
          employeeId={resolvedEmployeeId}
          onClose={() => setShowEventModal(false)}
          onSaved={loadCard}
        />
      ) : null}

      {showTrainingModal && tenantId && resolvedEmployeeId ? (
        <TrainingModal
          tenantId={tenantId}
          employeeId={resolvedEmployeeId}
          onClose={() => setShowTrainingModal(false)}
          onSaved={loadCard}
        />
      ) : null}

      {showStatusModal && tenantId && card && resolvedEmployeeId ? (
        <StatusModal
          tenantId={tenantId}
          employeeId={resolvedEmployeeId}
          current={card.status}
          onClose={() => setShowStatusModal(false)}
          onSaved={loadCard}
        />
      ) : null}

      {showDeleteModal && tenantId && card && resolvedEmployeeId ? (
        <DeleteEmployeeModal
          tenantId={tenantId}
          employeeId={resolvedEmployeeId}
          employeeNumber={card.employee_number}
          fullName={card.full_name}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => {
            setShowDeleteModal(false);
            router.push("/admin/core");
          }}
        />
      ) : null}
    </>
  );
}
