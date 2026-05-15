"use client";

import { Suspense, type ReactNode, useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Trash2, UserRound } from "lucide-react";

import { api, ApiRequestError, isLoggedIn } from "@/lib/api";
import { useTenantOrgStructureItems, type TenantOrgStructureConfig } from "@/lib/orgStructureConfig";
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
  birth_place?: string;
  immigration_date?: string;
  citizenship1?: string;
  citizenship2?: string;
  marital_status?: string;
  prev_marital_status?: string;
  marital_status_change_date?: string;
  num_children?: number;
  prev_surname?: string;
  father_name?: string;
  // spouse
  spouse_first_name?: string;
  spouse_last_name?: string;
  spouse_id_number?: string;
  spouse_workplace?: string;
  spouse_birth_date?: string;
  spouse_immigration_date?: string;
  spouse_mobile?: string;
  spouse_work_phone?: string;
  // additional
  license_number?: string;
  license_issue_year?: string;
  license_type?: string;
  license_expiry?: string;
  health_fund?: string;
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
  branch_name?: string;
  work_site?: string;
  employment_type?: string;
  employment_status?: string;
  salary_type?: string;
  manager_id?: string;
  manager_name?: string;
  start_date?: string;
  end_date?: string;
  valid_from: string;
  valid_to?: string | null;
  created_at?: string;
  _current?: boolean;
  _valid_from_raw?: string;
  _valid_to_raw?: string | null;
}

interface CompensationRow {
  id: string;
  base_salary?: string | number;
  currency?: string;
  pay_cycle?: string;
  cost_center?: string;
  valid_from: string;
  valid_to?: string | null;
  created_at?: string;
  _current?: boolean;
  _valid_from_raw?: string;
  _valid_to_raw?: string | null;
}

interface BankRow {
  bank_code?: string;
  id: string;
  bank_name?: string;
  branch?: string;
  branch_description?: string;
  account?: string;
  account_holder_name?: string;
  payment_method?: string;
  pct_payment?: string | number;
  fixed_amount?: string | number;
  payment_priority?: number;
  company_name?: string;
  notes?: string;
  valid_from: string;
  valid_to?: string | null;
  created_at?: string;
  _current?: boolean;
  _valid_from_raw?: string;
  _valid_to_raw?: string | null;
}

interface ChildRow {
  id: string;
  first_name: string;
  last_name?: string;
  gender?: string;
  id_number?: string;
  birth_date?: string;
  receives_allowance?: boolean;
  recruitment_date?: string;
  release_date?: string;
  study_start_date?: string;
  study_end_date?: string;
  in_custody?: boolean;
  notes?: string;
  created_at?: string;
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
  children: ChildRow[];
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
  salary_type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  branch_name?: string | null;
  work_site?: string | null;
  valid_from: string;
  valid_to?: string | null;
  created_at?: string;
}

interface LegacyEmployeeCompensation {
  id: string;
  base_salary?: string | null;
  currency?: string | null;
  pay_cycle?: string | null;
  cost_center?: string | null;
  valid_from: string;
  valid_to?: string | null;
  created_at?: string;
}

interface LegacyEmployeeBankAccount {
  id: string;
  bank_code?: string | null;
  bank_name?: string | null;
  branch_number?: string | null;
  branch_description?: string | null;
  account_number?: string | null;
  account_holder_name?: string | null;
  payment_method?: string | null;
  payment_percent?: string | null;
  fixed_amount?: string | null;
  payment_priority?: number | null;
  company_name?: string | null;
  notes?: string | null;
  valid_from: string;
  valid_to?: string | null;
  created_at?: string;
}

interface LegacyEmployeeCourse {
  id: string;
  course_name: string;
  provider?: string | null;
  started_on?: string | null;
  completed_on?: string | null;
  status?: string | null;
  score?: string | null;
  notes?: string | null;
  created_at?: string;
}

interface LegacyEmployeeDetail {
  employee: LegacyEmployeeSummary;
  current_identity?: LegacyEmployeeIdentity | null;
  current_employment?: LegacyEmployeeEmployment | null;
  current_compensation?: LegacyEmployeeCompensation | null;
  current_bank_account?: LegacyEmployeeBankAccount | null;
  identity_history?: LegacyEmployeeIdentity[];
  employment_history?: LegacyEmployeeEmployment[];
  compensation_history?: LegacyEmployeeCompensation[];
  bank_accounts?: LegacyEmployeeBankAccount[];
  timeline?: Array<{
    id: string;
    event_type: string;
    effective_date: string;
    notes?: string | null;
  }>;
  courses?: LegacyEmployeeCourse[];
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
  title?: string;
  unit_type?: "division" | "department" | "section" | "team";
  parent_id?: string | null;
}

type OrgStructureLevel = "division" | "department" | "section" | "team";
type OrgUnitAssignments = Partial<Record<OrgStructureLevel, string>>;

const ORG_STRUCTURE_LEVEL_LABELS: Record<OrgStructureLevel, string> = {
  division: "חטיבה",
  department: "אגף",
  section: "מחלקה",
  team: "צוות",
};

function getOrgUnitAssignmentsFromSelection(
  selectedOrgUnitId: string | undefined,
  orgUnitOptions: LookupOption[],
): OrgUnitAssignments {
  if (!selectedOrgUnitId) return {};

  const unitsById = new Map(orgUnitOptions.map((unit) => [unit.id, unit]));
  const assignments: OrgUnitAssignments = {};
  let currentUnit = unitsById.get(selectedOrgUnitId);

  while (currentUnit?.unit_type) {
    assignments[currentUnit.unit_type] = currentUnit.id;
    currentUnit = currentUnit.parent_id ? unitsById.get(currentUnit.parent_id) : undefined;
  }

  return assignments;
}

function getDeepestSelectedOrgUnitId(levels: OrgStructureLevel[], assignments: OrgUnitAssignments) {
  for (let index = levels.length - 1; index >= 0; index -= 1) {
    const selectedId = assignments[levels[index]];
    if (selectedId) return selectedId;
  }
  return "";
}

function getOrgUnitOptionsForLevel(
  level: OrgStructureLevel,
  levels: OrgStructureLevel[],
  assignments: OrgUnitAssignments,
  orgUnitOptions: LookupOption[],
  isHierarchical: boolean,
) {
  const levelIndex = levels.indexOf(level);
  if (levelIndex === -1) return [];

  return orgUnitOptions.filter((option) => {
    if (option.unit_type !== level) return false;
    if (!isHierarchical || levelIndex === 0) return true;
    const parentLevel = levels[levelIndex - 1];
    const selectedParentId = assignments[parentLevel];
    if (!selectedParentId) return false;
    return option.parent_id === selectedParentId;
  });
}

type TemporalSection = "identity" | "personal" | "spouse" | "additional" | "contact" | "employment" | "compensation" | "bank";
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
        branch_name: row.branch_name ?? undefined,
        work_site: row.work_site ?? undefined,
        employment_type: row.employment_type ?? undefined,
        employment_status: row.employment_status ?? undefined,
        manager_id: row.manager_employee_id ?? undefined,
        manager_name: row.manager_name ?? undefined,
        salary_type: row.salary_type ?? undefined,
        start_date: row.start_date ?? undefined,
        end_date: row.end_date ?? undefined,
        valid_from: row.valid_from,
        valid_to: row.valid_to ?? undefined,
        created_at: row.created_at,
        _current: !row.valid_to,
        _valid_from_raw: row.valid_from,
        _valid_to_raw: row.valid_to ?? undefined,
      })),
      compensation: (card.compensation_history ?? (card.current_compensation ? [card.current_compensation] : [])).map((row) => ({
        id: row.id,
        base_salary: row.base_salary ?? undefined,
        currency: row.currency ?? undefined,
        pay_cycle: row.pay_cycle ?? undefined,
        cost_center: row.cost_center ?? undefined,
        valid_from: row.valid_from,
        valid_to: row.valid_to ?? undefined,
        created_at: row.created_at,
        _current: !row.valid_to,
        _valid_from_raw: row.valid_from,
        _valid_to_raw: row.valid_to ?? undefined,
      })),
      bank: (card.bank_accounts ?? (card.current_bank_account ? [card.current_bank_account] : [])).map((row) => ({
        id: row.id,
        bank_code: row.bank_code ?? undefined,
        bank_name: row.bank_name ?? undefined,
        branch: row.branch_number ?? undefined,
        branch_description: row.branch_description ?? undefined,
        account: row.account_number ?? undefined,
        account_holder_name: row.account_holder_name ?? undefined,
        payment_method: row.payment_method ?? undefined,
        pct_payment: row.payment_percent ?? undefined,
        fixed_amount: row.fixed_amount ?? undefined,
        payment_priority: row.payment_priority ?? undefined,
        company_name: row.company_name ?? undefined,
        notes: row.notes ?? undefined,
        valid_from: row.valid_from,
        valid_to: row.valid_to ?? undefined,
        created_at: row.created_at,
        _current: !row.valid_to,
        _valid_from_raw: row.valid_from,
        _valid_to_raw: row.valid_to ?? undefined,
      })),
      children: [],
      events: (card.timeline ?? []).map((row) => ({
        id: row.id,
        event_type: row.event_type,
        event_date: row.effective_date,
        description: row.notes ?? undefined,
      })),
      training: (card.courses ?? []).map((row) => ({
        id: row.id,
        course_name: row.course_name,
        course_date: row.completed_on ?? row.started_on ?? undefined,
        score: row.score ?? undefined,
        institute: row.provider ?? undefined,
        created_at: row.created_at,
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
    children: card.children ?? [],
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
  employee: "עובד",
  contractor: "קבלן",
  temporary: "זמני",
  intern: "מתמחה",
  consultant: "יועץ",
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
    case "spouse":
      return "פרטי בן הזוג";
    case "additional":
      return "פרטים נוספים";
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
  tenantConfig,
  orgUnitOptions,
  positionOptions,
  managerOptions,
  onClose,
  onSaved,
}: {
  state: TemporalModalState;
  tenantId: string;
  employeeId: string;
  tenantConfig: TenantOrgStructureConfig | null;
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
  const [orgUnitAssignments, setOrgUnitAssignments] = useState<OrgUnitAssignments>(() =>
    getOrgUnitAssignmentsFromSelection((state.prefill?.org_unit_id as string | undefined) ?? undefined, orgUnitOptions),
  );
  const activeOrgLevels = tenantConfig?.levels ?? [];
  const showHierarchicalOrgAssignment = state.section === "employment" && activeOrgLevels.length > 0;

  useEffect(() => {
    if (state.section !== "employment") return;
    setOrgUnitAssignments(getOrgUnitAssignmentsFromSelection(form.org_unit_id || undefined, orgUnitOptions));
  }, [form.org_unit_id, orgUnitOptions, state.section]);

  function setField(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleOrgUnitLevelChange(level: OrgStructureLevel, value: string) {
    setOrgUnitAssignments((current) => {
      const nextAssignments: OrgUnitAssignments = {};
      const changedLevelIndex = activeOrgLevels.indexOf(level);

      activeOrgLevels.forEach((currentLevel, index) => {
        if (index < changedLevelIndex) {
          if (current[currentLevel]) nextAssignments[currentLevel] = current[currentLevel];
          return;
        }
        if (index === changedLevelIndex && value) {
          nextAssignments[currentLevel] = value;
        }
      });

      setField("org_unit_id", getDeepestSelectedOrgUnitId(activeOrgLevels, nextAssignments));
      return nextAssignments;
    });
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
      return Boolean(form.amount?.trim());
    }

    return true;
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const requestMethod =
      state.section === "bank" && !state.recordId && mode === "add" ? "post" : "put";
    const requestPath =
      state.section === "identity" || state.section === "personal" || state.section === "spouse" || state.section === "additional" || state.section === "contact"
        ? `/api/core/employees/${employeeId}/identity/record`
      : state.section === "employment"
        ? `/api/core/employees/${employeeId}/employment/record`
      : state.section === "compensation"
        ? `/api/core/employees/${employeeId}/compensation/record`
      : state.section === "bank" && state.recordId
        ? `/api/core/employees/${employeeId}/bank-accounts/${state.recordId}/record`
      : state.section === "bank"
        ? `/api/core/employees/${employeeId}/bank-accounts`
      : `/api/core/employees/${employeeId}/${state.section}?tenant_id=${tenantId}`;

    const body: Record<string, unknown> = {
      ...(requestMethod === "put" ? { action: mode } : {}),
      valid_from: validFrom || todayIso(),
    };

    if (validTo) body.valid_to = validTo;

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
          birth_country: form.birth_country?.trim() || undefined,
          birth_place: form.birth_place?.trim() || undefined,
          immigration_date: toDate(form.immigration_date),
          marital_status: form.marital_status || undefined,
          prev_marital_status: form.prev_marital_status || undefined,
          marital_status_change_date: toDate(form.marital_status_change_date),
          nationality: form.citizenship1?.trim() || undefined,
          citizenship2: form.citizenship2?.trim() || undefined,
          children_count: form.num_children ? toNum(form.num_children) : undefined,
          prev_surname: form.prev_surname?.trim() || undefined,
          father_name: form.father_name?.trim() || undefined,
        });
      } else if (state.section === "spouse") {
        Object.assign(body, {
          spouse_first_name: form.spouse_first_name?.trim() || undefined,
          spouse_last_name: form.spouse_last_name?.trim() || undefined,
          spouse_id_number: form.spouse_id_number?.trim() || undefined,
          spouse_workplace: form.spouse_workplace?.trim() || undefined,
          spouse_birth_date: toDate(form.spouse_birth_date),
          spouse_immigration_date: toDate(form.spouse_immigration_date),
          spouse_mobile: form.spouse_mobile?.trim() || undefined,
          spouse_work_phone: form.spouse_work_phone?.trim() || undefined,
        });
      } else if (state.section === "additional") {
        Object.assign(body, {
          license_number: form.license_number?.trim() || undefined,
          license_issue_year: form.license_issue_year?.trim() || undefined,
          license_type: form.license_type?.trim() || undefined,
          license_expiry: toDate(form.license_expiry),
          health_fund: form.health_fund?.trim() || undefined,
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
          branch_name: form.company?.trim() || undefined,
          work_site: form.work_site?.trim() || undefined,
          employment_type: form.employment_type || undefined,
          employment_status: form.employment_status || undefined,
          salary_type: form.salary_type || undefined,
          manager_employee_id: form.manager_id || undefined,
          start_date: toDate(form.start_date),
          end_date: toDate(form.end_date),
        });
      } else if (state.section === "compensation") {
        Object.assign(body, {
          base_salary: form.amount ? toNum(form.amount) : undefined,
          currency: form.currency?.trim() || undefined,
          pay_cycle: form.pay_cycle || undefined,
          cost_center: form.cost_center?.trim() || undefined,
        });
      } else if (state.section === "bank") {
        Object.assign(body, {
          bank_code: form.bank_code?.trim() || undefined,
          bank_name: form.bank_name?.trim() || undefined,
          branch_number: form.branch?.trim() || undefined,
          branch_description: form.branch_description?.trim() || undefined,
          account_number: form.account?.trim() || undefined,
          account_holder_name: form.account_holder_name?.trim() || undefined,
          payment_method: form.payment_method || undefined,
          payment_percent: form.pct_payment ? toNum(form.pct_payment) : undefined,
          fixed_amount: form.fixed_amount ? toNum(form.fixed_amount) : undefined,
          payment_priority: form.payment_priority ? toNum(form.payment_priority) : undefined,
          company_name: form.company_name?.trim() || undefined,
          notes: form.notes?.trim() || undefined,
        });
      }
    }

    try {
      if (requestMethod === "post") {
        await api.post(requestPath, body);
      } else {
        await api.put(requestPath, body);
      }
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
                    <ModalTextField label="ארץ לידה" value={form.birth_country ?? ""} onChange={(value) => setField("birth_country", value)} />
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
                    <ModalDateField label="תאריך לידה" value={form.birth_date ?? ""} onChange={(value) => setField("birth_date", value)} />
                    <ModalSelectField
                      label="מצב משפחתי קודם"
                      value={form.prev_marital_status ?? ""}
                      onChange={(value) => setField("prev_marital_status", value)}
                      options={[
                        { value: "single", label: "רווק/ה" },
                        { value: "married", label: "נשוי/נשואה" },
                        { value: "divorced", label: "גרוש/ה" },
                        { value: "widowed", label: "אלמן/ה" },
                      ]}
                    />
                    <ModalDateField label="תאריך עליה" value={form.immigration_date ?? ""} onChange={(value) => setField("immigration_date", value)} />
                    <ModalDateField label="ת. שינוי מצב משפחתי" value={form.marital_status_change_date ?? ""} onChange={(value) => setField("marital_status_change_date", value)} />
                    <ModalTextField label="מקום לידה" value={form.birth_place ?? ""} onChange={(value) => setField("birth_place", value)} />
                    <ModalTextField label="מס' ילדים" value={form.num_children ?? ""} onChange={(value) => setField("num_children", value)} />
                    <ModalTextField label="אזרחות 1" value={form.citizenship1 ?? ""} onChange={(value) => setField("citizenship1", value)} />
                    <ModalTextField label="שם משפחה קודם" value={form.prev_surname ?? ""} onChange={(value) => setField("prev_surname", value)} />
                    <ModalTextField label="אזרחות 2" value={form.citizenship2 ?? ""} onChange={(value) => setField("citizenship2", value)} />
                    <ModalTextField label="שם האב" value={form.father_name ?? ""} onChange={(value) => setField("father_name", value)} />
                  </div>
                </ModalSection>
              ) : null}

              {state.section === "spouse" ? (
                <ModalSection title="פרטי בן הזוג" description="פרטי בן או בת הזוג של העובד.">
                  <div className={ADMIN_MODAL_GRID}>
                    <ModalTextField label="שם בן/בת זוג" value={form.spouse_first_name ?? ""} onChange={(value) => setField("spouse_first_name", value)} />
                    <ModalTextField label="טלפון ניד" value={form.spouse_mobile ?? ""} onChange={(value) => setField("spouse_mobile", value)} />
                    <ModalTextField label="שם משפחה" value={form.spouse_last_name ?? ""} onChange={(value) => setField("spouse_last_name", value)} />
                    <ModalTextField label="טלפון בעבודה" value={form.spouse_work_phone ?? ""} onChange={(value) => setField("spouse_work_phone", value)} />
                    <ModalTextField label="מספר זהות" value={form.spouse_id_number ?? ""} onChange={(value) => setField("spouse_id_number", value)} />
                    <ModalTextField label="מקום עבודה" value={form.spouse_workplace ?? ""} onChange={(value) => setField("spouse_workplace", value)} />
                    <ModalDateField label="תאריך לידה" value={form.spouse_birth_date ?? ""} onChange={(value) => setField("spouse_birth_date", value)} />
                    <ModalDateField label="תאריך עליה" value={form.spouse_immigration_date ?? ""} onChange={(value) => setField("spouse_immigration_date", value)} />
                  </div>
                </ModalSection>
              ) : null}

              {state.section === "additional" ? (
                <ModalSection title="פרטים נוספים" description="רישיון נהיגה וקופת חולים.">
                  <div className={ADMIN_MODAL_GRID}>
                    <ModalTextField label="מס. רישיון נהיגה" value={form.license_number ?? ""} onChange={(value) => setField("license_number", value)} />
                    <ModalTextField label="שנת הוצאת רישיון" value={form.license_issue_year ?? ""} onChange={(value) => setField("license_issue_year", value)} />
                    <ModalTextField label="סוג רישיון" value={form.license_type ?? ""} onChange={(value) => setField("license_type", value)} />
                    <ModalDateField label="חוקף רישיון נהיגה" value={form.license_expiry ?? ""} onChange={(value) => setField("license_expiry", value)} />
                    <ModalTextField label="קופת חולים" value={form.health_fund ?? ""} onChange={(value) => setField("health_fund", value)} />
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
                      <ModalTextField label="דוא״ל" type="email" value={form.email ?? ""} onChange={(value) => setField("email", value)} span={2} />
                    </div>
                  </ModalSection>
                </div>
              ) : null}

              {state.section === "employment" ? (
                <div className="space-y-4">
                  <ModalSection title="שיוך ארגוני" description="היחידה, התפקיד והדיווח הישיר של העובד בארגון.">
                    <div className={ADMIN_MODAL_GRID}>
                      {showHierarchicalOrgAssignment ? (
                        activeOrgLevels.map((level) => {
                          const options = getOrgUnitOptionsForLevel(
                            level,
                            activeOrgLevels,
                            orgUnitAssignments,
                            orgUnitOptions,
                            tenantConfig?.is_hierarchical ?? true,
                          );
                          const parentLevel = activeOrgLevels[activeOrgLevels.indexOf(level) - 1];
                          const isDisabled = Boolean(
                            tenantConfig?.is_hierarchical &&
                            parentLevel &&
                            !orgUnitAssignments[parentLevel],
                          );

                          return (
                            <ModalField key={level} label={ORG_STRUCTURE_LEVEL_LABELS[level]}>
                              <select
                                className={ADMIN_MODAL_INPUT}
                                value={orgUnitAssignments[level] ?? ""}
                                onChange={(event) => handleOrgUnitLevelChange(level, event.target.value)}
                                disabled={isDisabled}
                              >
                                <option value="">{`בחר ${ORG_STRUCTURE_LEVEL_LABELS[level]}`}</option>
                                {options.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.code ? `${option.code} - ${option.name}` : option.name}
                                  </option>
                                ))}
                              </select>
                            </ModalField>
                          );
                        })
                      ) : (
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
                      )}
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
                      <ModalTextField label="סניף / חברה" value={form.company ?? ""} onChange={(value) => setField("company", value)} />
                      <ModalTextField label="אתר עבודה" value={form.work_site ?? ""} onChange={(value) => setField("work_site", value)} />
                      <ModalSelectField
                        label="סוג העסקה"
                        value={form.employment_type ?? ""}
                        onChange={(value) => setField("employment_type", value)}
                        options={[
                          { value: "employee", label: "עובד" },
                          { value: "contractor", label: "קבלן" },
                          { value: "temporary", label: "זמני" },
                          { value: "intern", label: "מתמחה" },
                          { value: "consultant", label: "יועץ" },
                        ]}
                      />
                      <ModalSelectField
                        label="סטטוס העסקה"
                        value={form.employment_status ?? ""}
                        onChange={(value) => setField("employment_status", value)}
                        options={[
                          { value: "active", label: "פעיל" },
                          { value: "leave_of_absence", label: "חופשה" },
                          { value: "unpaid_leave", label: "חל\"ת" },
                          { value: "terminated", label: "סיום" },
                          { value: "future", label: "עתידי" },
                          { value: "suspended", label: "מושהה" },
                        ]}
                      />
                      <ModalSelectField
                        label="בסיס שכר"
                        value={form.salary_type ?? ""}
                        onChange={(value) => setField("salary_type", value)}
                        options={[
                          { value: "monthly", label: "חודשי" },
                          { value: "hourly", label: "שעתי" },
                          { value: "daily", label: "יומי" },
                          { value: "global", label: "גלובלי" },
                        ]}
                      />
                      <ModalDateField label="תאריך תחילה" value={form.start_date ?? ""} onChange={(value) => setField("start_date", value)} />
                      <ModalDateField label="תאריך סיום" value={form.end_date ?? ""} onChange={(value) => setField("end_date", value)} />
                    </div>
                  </ModalSection>
                </div>
              ) : null}

              {state.section === "compensation" ? (
                <ModalSection title="מאפייני שכר" description="פרטי השכר הנתמכים כיום בכרטיס העובד.">
                  <div className={ADMIN_MODAL_GRID}>
                    <ModalTextField label="שכר בסיס" value={form.amount ?? ""} onChange={(value) => setField("amount", value)} />
                    <ModalTextField label="מטבע" value={form.currency ?? ""} onChange={(value) => setField("currency", value)} />
                    <ModalSelectField
                      label="מחזור תשלום"
                      value={form.pay_cycle ?? ""}
                      onChange={(value) => setField("pay_cycle", value)}
                      options={[
                        { value: "monthly", label: "חודשי" },
                        { value: "biweekly", label: "דו שבועי" },
                        { value: "weekly", label: "שבועי" },
                      ]}
                    />
                    <ModalTextField label="מרכז עלות" value={form.cost_center ?? ""} onChange={(value) => setField("cost_center", value)} />
                  </div>
                </ModalSection>
              ) : null}

              {state.section === "bank" ? (
                <div className="space-y-4">
                  <ModalSection title="נתוני תשלום" description="הגדרות העברת התשלום הנתמכות כיום במערכת.">
                    <div className={ADMIN_MODAL_GRID}>
                      <ModalSelectField
                        label="שיטת תשלום"
                        value={form.payment_method ?? ""}
                        onChange={(value) => setField("payment_method", value)}
                        options={[
                          { value: "bank_transfer", label: "העברה בנקאית" },
                          { value: "check", label: "שיק" },
                          { value: "cash", label: "מזומן" },
                        ]}
                      />
                      <ModalTextField label="% לתשלום" value={form.pct_payment ?? ""} onChange={(value) => setField("pct_payment", value)} />
                      <ModalTextField label="סכום קבוע" value={form.fixed_amount ?? ""} onChange={(value) => setField("fixed_amount", value)} />
                      <ModalTextField label="עדיפות" value={form.payment_priority ?? ""} onChange={(value) => setField("payment_priority", value)} />
                      <ModalTextField label="חברה" value={form.company_name ?? ""} onChange={(value) => setField("company_name", value)} />
                    </div>
                  </ModalSection>

                  <ModalSection title="חשבון בנק" description="פרטי הבנק שאליו ישויך התשלום לעובד.">
                    <div className={ADMIN_MODAL_GRID}>
                      <ModalTextField label="קוד בנק" value={form.bank_code ?? ""} onChange={(value) => setField("bank_code", value)} />
                      <ModalTextField label="שם בנק" value={form.bank_name ?? ""} onChange={(value) => setField("bank_name", value)} />
                      <ModalTextField label="מספר סניף" value={form.branch ?? ""} onChange={(value) => setField("branch", value)} />
                      <ModalTextField label="תיאור סניף" value={form.branch_description ?? ""} onChange={(value) => setField("branch_description", value)} />
                      <ModalTextField label="חשבון" value={form.account ?? ""} onChange={(value) => setField("account", value)} />
                      <ModalTextField label="שם בעל החשבון" value={form.account_holder_name ?? ""} onChange={(value) => setField("account_holder_name", value)} />
                      <ModalField label="הערות" span={2}>
                        <textarea
                          value={form.notes ?? ""}
                          onChange={(event) => setField("notes", event.target.value)}
                          className={`${ADMIN_MODAL_INPUT} min-h-[88px]`}
                        />
                      </ModalField>
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

function ChildModal({
  tenantId,
  employeeId,
  editRow,
  onClose,
  onSaved,
}: {
  tenantId: string;
  employeeId: string;
  editRow?: ChildRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    first_name: editRow?.first_name ?? "",
    last_name: editRow?.last_name ?? "",
    gender: editRow?.gender ?? "",
    id_number: editRow?.id_number ?? "",
    birth_date: editRow?.birth_date ?? "",
    receives_allowance: editRow?.receives_allowance ?? false,
    recruitment_date: editRow?.recruitment_date ?? "",
    release_date: editRow?.release_date ?? "",
    study_start_date: editRow?.study_start_date ?? "",
    study_end_date: editRow?.study_end_date ?? "",
    in_custody: editRow?.in_custody ?? false,
    notes: editRow?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField(key: string, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    if (!form.first_name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || undefined,
        gender: form.gender || undefined,
        id_number: form.id_number.trim() || undefined,
        birth_date: form.birth_date || undefined,
        receives_allowance: form.receives_allowance,
        recruitment_date: form.recruitment_date || undefined,
        release_date: form.release_date || undefined,
        study_start_date: form.study_start_date || undefined,
        study_end_date: form.study_end_date || undefined,
        in_custody: form.in_custody,
        notes: form.notes.trim() || undefined,
      };
      if (editRow?.id) {
        await api.put(`/api/core/employees/${employeeId}/children/${editRow.id}`, body);
      } else {
        await api.post(`/api/core/employees/${employeeId}/children`, body);
      }
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
      <AdminModalPanel className="max-w-2xl overflow-hidden">
        <AdminModalHeader title={editRow ? "עריכת ילד" : "הוסף ילד"} onClose={onClose} />
        <AdminModalBody className="space-y-4">
          {error ? <AdminModalMessage tone="danger">{error}</AdminModalMessage> : null}
          <ModalSection title="פרטי הילד">
            <div className={ADMIN_MODAL_GRID}>
              <ModalTextField label="שם ילד" required value={form.first_name} onChange={(value) => setField("first_name", value)} />
              <ModalTextField label="שם משפחה" value={form.last_name} onChange={(value) => setField("last_name", value)} />
              <ModalSelectField
                label="מגדר"
                value={form.gender}
                onChange={(value) => setField("gender", value)}
                options={[
                  { value: "M", label: "זכר" },
                  { value: "F", label: "נקבה" },
                ]}
              />
              <ModalTextField label="מספר זהות" value={form.id_number} onChange={(value) => setField("id_number", value)} />
              <ModalDateField label="תאריך לידה" value={form.birth_date} onChange={(value) => setField("birth_date", value)} />
              <ModalField label="מקבל קצבת ילדים?">
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    checked={form.receives_allowance}
                    onChange={(e) => setField("receives_allowance", e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600"
                  />
                  <span className="text-xs text-slate-600">כן</span>
                </div>
              </ModalField>
              <ModalField label="ילד בחוקת העובד?">
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    checked={form.in_custody}
                    onChange={(e) => setField("in_custody", e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600"
                  />
                  <span className="text-xs text-slate-600">כן</span>
                </div>
              </ModalField>
            </div>
          </ModalSection>
          <ModalSection title="לימודים ושירות">
            <div className={ADMIN_MODAL_GRID}>
              <ModalDateField label="תאריך גיוס" value={form.recruitment_date} onChange={(value) => setField("recruitment_date", value)} />
              <ModalDateField label="תאריך שחרור" value={form.release_date} onChange={(value) => setField("release_date", value)} />
              <ModalDateField label="תאריך תחילת לימודים" value={form.study_start_date} onChange={(value) => setField("study_start_date", value)} />
              <ModalDateField label="תאריך סיום לימודים" value={form.study_end_date} onChange={(value) => setField("study_end_date", value)} />
              <ModalTextField label="הערה" value={form.notes} onChange={(value) => setField("notes", value)} span={2} />
            </div>
          </ModalSection>
        </AdminModalBody>
        <AdminModalFooter>
          <button onClick={handleSave} disabled={saving || !form.first_name.trim()} className={ADMIN_MODAL_ACTION_PRIMARY}>
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
      const notes = [form.reason, form.description].filter((value) => value.trim()).join(" — ");
      await api.post(`/api/core/employees/${employeeId}/events`, {
        event_type: form.event_type,
        effective_date: form.event_date,
        notes: notes || undefined,
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
      await api.post(`/api/core/employees/${employeeId}/courses`, {
        course_name: form.course_name.trim(),
        completed_on: form.course_date || undefined,
        score: form.score || undefined,
        provider: form.institute || undefined,
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

function EmployeeCardPageContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const employeeRouteParam = params.id as string;
  const workspace = useWorkspace();
  const initialTenant = searchParams.get("tenant_id") || "";
  const tenantId = workspace?.selectedTenantId ?? "";
  const { tenantConfig } = useTenantOrgStructureItems(tenantId);

  const [card, setCard] = useState<EmployeeCard | null>(null);
  const [resolvedEmployeeId, setResolvedEmployeeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [temporalModal, setTemporalModal] = useState<TemporalModalState | null>(null);
  const [showChildModal, setShowChildModal] = useState(false);
  const [editingChild, setEditingChild] = useState<ChildRow | undefined>(undefined);
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
      api.get<Array<{ id: string; code?: string; name: string; unit_type?: OrgStructureLevel; parent_id?: string | null }>>(
        `/api/core/org-units?tenant_id=${tenantId}`,
      ),
      api.get<Array<{ id: string; code?: string; name?: string; title?: string }>>(`/api/core/positions?tenant_id=${tenantId}`),
      api.get<EmployeeOption[]>(`/api/core/employees?tenant_id=${tenantId}`),
    ])
      .then(([orgUnits, positions, employees]) => {
        setOrgUnitOptions(orgUnits);
        setPositionOptions(positions.map((position) => ({
          id: position.id,
          code: position.code,
          name: position.name ?? position.title ?? "—",
          title: position.title,
        })));
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
    if (initialTenant && workspace && initialTenant !== workspace.selectedTenantId) {
      workspace.setSelectedTenantId(initialTenant);
    }
  }, [initialTenant, workspace]);

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

  const filteredPersonalRows = personalRows.filter((row) =>
    row.birth_date || row.birth_country || row.birth_place || row.immigration_date ||
    row.citizenship1 || row.citizenship2 || row.marital_status || row.num_children != null ||
    row.prev_marital_status || row.marital_status_change_date || row.prev_surname || row.father_name
  );
  const filteredContactRows = contactRows.filter((row) =>
    row.address1 || row.address2 || row.city || row.zip_code || row.country ||
    row.phone || row.mobile || row.home_phone || row.fax || row.email
  );
  const spouseRows = personalRows.filter((row) =>
    row.spouse_first_name || row.spouse_last_name || row.spouse_id_number ||
    row.spouse_workplace || row.spouse_birth_date || row.spouse_immigration_date ||
    row.spouse_mobile || row.spouse_work_phone
  );
  const additionalRows = personalRows.filter((row) =>
    row.license_number || row.license_issue_year || row.license_type ||
    row.license_expiry || row.health_fund
  );

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
        { key: "citizenship", label: "אזרחות" },
        { key: "marital_status", label: "מצב משפחתי" },
        { key: "num_children", label: "מס' ילדים" },
        { key: "valid_from", label: "מ-" },
        { key: "valid_to", label: "עד" },
      ],
      rows: buildTemporalRows(filteredPersonalRows, (row) => ({
        birth_date: fmtDate(row.birth_date),
        birth_country: row.birth_country ?? "—",
        citizenship: row.citizenship1 ?? "—",
        marital_status: row.marital_status ? MARITAL_MAP[row.marital_status] ?? row.marital_status : "—",
        num_children: row.num_children ?? "—",
        valid_from: fmtDate(row.valid_from),
        valid_to: fmtDate(row.valid_to),
      })),
      onAddClick: () => openTemporal("personal"),
      onRowDoubleClick: (index) => {
        const row = filteredPersonalRows[index];
        if (row) openTemporal("personal", toPrefillRecord(row));
      },
    },
    {
      id: "spouse",
      label: "פרטי בן הזוג",
      temporalFilter: true,
      emptyMessage: "אין פרטי בן/בת זוג רשומים",
      columns: [
        { key: "spouse_name", label: "שם בן/בת הזוג" },
        { key: "spouse_id_number", label: "מספר זהות" },
        { key: "spouse_birth_date", label: "תאריך לידה" },
        { key: "spouse_mobile", label: "טלפון ניד" },
        { key: "valid_from", label: "מ-" },
        { key: "valid_to", label: "עד" },
      ],
      rows: buildTemporalRows(spouseRows, (row) => ({
        spouse_name: [row.spouse_first_name, row.spouse_last_name].filter(Boolean).join(" ") || "—",
        spouse_id_number: row.spouse_id_number ?? "—",
        spouse_birth_date: fmtDate(row.spouse_birth_date),
        spouse_mobile: row.spouse_mobile ?? "—",
        valid_from: fmtDate(row.valid_from),
        valid_to: fmtDate(row.valid_to),
      })),
      onAddClick: () => openTemporal("spouse"),
      onRowDoubleClick: (index) => {
        const row = spouseRows[index];
        if (row) openTemporal("spouse", toPrefillRecord(row));
      },
    },
    {
      id: "additional",
      label: "פרטים נוספים",
      temporalFilter: true,
      emptyMessage: "אין פרטים נוספים רשומים",
      columns: [
        { key: "license_number", label: "מס. רישיון נהיגה" },
        { key: "license_type", label: "סוג רישיון" },
        { key: "license_expiry", label: "תוקף רישיון" },
        { key: "health_fund", label: "קופת חולים" },
        { key: "valid_from", label: "מ-" },
        { key: "valid_to", label: "עד" },
      ],
      rows: buildTemporalRows(additionalRows, (row) => ({
        license_number: row.license_number ?? "—",
        license_type: row.license_type ?? "—",
        license_expiry: fmtDate(row.license_expiry),
        health_fund: row.health_fund ?? "—",
        valid_from: fmtDate(row.valid_from),
        valid_to: fmtDate(row.valid_to),
      })),
      onAddClick: () => openTemporal("additional"),
      onRowDoubleClick: (index) => {
        const row = additionalRows[index];
        if (row) openTemporal("additional", toPrefillRecord(row));
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
        { key: "email", label: 'דוא"ל' },
        { key: "valid_from", label: "מ-" },
        { key: "valid_to", label: "עד" },
      ],
      rows: buildTemporalRows(filteredContactRows, (row) => ({
        address: [row.address1, row.address2].filter(Boolean).join(", ") || "—",
        city: row.city ?? "—",
        phone: row.phone ?? "—",
        email: row.email ?? "—",
        valid_from: fmtDate(row.valid_from),
        valid_to: fmtDate(row.valid_to),
      })),
      onAddClick: () => openTemporal("contact"),
      onRowDoubleClick: (index) => {
        const row = filteredContactRows[index];
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
        { key: "branch_name", label: "סניף / חברה" },
        { key: "manager_name", label: "מנהל" },
        { key: "employment_type", label: "סוג העסקה" },
        { key: "start_date", label: "תאריך תחילה" },
        { key: "valid_from", label: "מ-" },
        { key: "valid_to", label: "עד" },
      ],
      rows: buildTemporalRows(employmentRows, (row) => ({
        org_unit_name: row.org_unit_name ?? "—",
        position_name: row.position_name ?? "—",
        branch_name: row.branch_name ?? "—",
        manager_name: row.manager_name ?? "—",
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
        { key: "base_salary", label: "שכר בסיס" },
        { key: "currency", label: "מטבע" },
        { key: "pay_cycle", label: "מחזור" },
        { key: "cost_center", label: "מרכז עלות" },
        { key: "valid_from", label: "מ-" },
        { key: "valid_to", label: "עד" },
      ],
      rows: buildTemporalRows(compensationRows, (row) => ({
        base_salary: row.base_salary ?? "—",
        currency: row.currency ?? "—",
        pay_cycle: row.pay_cycle ?? "—",
        cost_center: row.cost_center ?? "—",
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
        { key: "payment_method", label: "שיטת תשלום" },
        { key: "pct_payment", label: "% לתשלום" },
        { key: "valid_from", label: "מ-" },
        { key: "valid_to", label: "עד" },
      ],
      rows: buildTemporalRows(bankRows, (row) => ({
        bank_name: row.bank_name ?? "—",
        branch: row.branch ?? "—",
        account: row.account ?? "—",
        payment_method: row.payment_method ?? "—",
        pct_payment: row.pct_payment ?? "—",
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
      id: "children",
      label: "פרטי ילדים",
      emptyMessage: "אין ילדים רשומים",
      columns: [
        { key: "child_name", label: "שם" },
        { key: "gender", label: "מגדר" },
        { key: "birth_date", label: "תאריך לידה" },
        { key: "id_number", label: "ת.ז." },
        { key: "receives_allowance", label: "קצבת ילדים" },
        { key: "in_custody", label: "בחוקת העובד" },
      ],
      rows: (card?.children ?? []).map((row) => ({
        child_name: [row.first_name, row.last_name].filter(Boolean).join(" "),
        gender: row.gender ? GENDER_MAP[row.gender] ?? row.gender : "—",
        birth_date: fmtDate(row.birth_date),
        id_number: row.id_number ?? "—",
        receives_allowance: row.receives_allowance ? "כן" : "לא",
        in_custody: row.in_custody ? "כן" : "לא",
      })),
      onAddClick: () => { setEditingChild(undefined); setShowChildModal(true); },
      onRowDoubleClick: (index) => {
        const row = card?.children[index];
        if (row) { setEditingChild(row); setShowChildModal(true); }
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
            <div className="mt-1 text-xs text-slate-700">{activeCompensation?.base_salary ?? activeBank?.bank_name ?? "—"}</div>
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
        primaryActions={
          card && resolvedEmployeeId
            ? [
                {
                  label: "שינוי סטטוס",
                  onClick: () => setShowStatusModal(true),
                },
                {
                  label: "מחק עובד",
                  onClick: () => setShowDeleteModal(true),
                  icon: <Trash2 size={14} />,
                },
              ]
            : []
        }
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
          tenantConfig={tenantConfig}
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

      {showStatusModal && tenantId && resolvedEmployeeId && card ? (
        <StatusModal
          tenantId={tenantId}
          employeeId={resolvedEmployeeId}
          current={card.status}
          onClose={() => setShowStatusModal(false)}
          onSaved={() => {
            setShowStatusModal(false);
            loadCard();
          }}
        />
      ) : null}

      {showDeleteModal && tenantId && resolvedEmployeeId && card ? (
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

      {showChildModal && tenantId && resolvedEmployeeId ? (
        <ChildModal
          tenantId={tenantId}
          employeeId={resolvedEmployeeId}
          editRow={editingChild}
          onClose={() => { setShowChildModal(false); setEditingChild(undefined); }}
          onSaved={loadCard}
        />
      ) : null}

    </>
  );
}

export default function EmployeeCardPage() {
  return (
    <Suspense fallback={<main className="flex min-h-0 flex-1 items-center justify-center text-sm text-slate-400">טוען כרטיס עובד...</main>}>
      <EmployeeCardPageContent />
    </Suspense>
  );
}
