"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CardPage, type ChildTab, type FormTab } from "@/components/layout/CardPage";
import { AdminSectionCard } from "@/components/layout/AdminShell";
import { FormField } from "@/components/ui/FormField";
import { api, canManageSensitive, isLoggedIn } from "@/lib/api";
import {
  ADMIN_MODAL_ACTION_DANGER,
  ADMIN_MODAL_ACTION_PRIMARY,
  ADMIN_MODAL_ACTION_SECONDARY,
  ADMIN_MODAL_ACTION_WARNING,
  ADMIN_MODAL_DATE_INPUT,
  ADMIN_MODAL_GRID,
  ADMIN_MODAL_HELP,
  ADMIN_MODAL_INPUT,
  ADMIN_MODAL_LABEL,
  ADMIN_MODAL_TEXTAREA,
  AdminDateFields,
  AdminField,
  AdminModal,
  AdminModalBody,
  AdminModalFooter,
  AdminModalHeader,
  AdminModalMessage,
  AdminModalPanel,
} from "@/components/ui/AdminModal";
import { SplitActionButton } from "@/components/ui/SplitActionButton";
import { HebrewDatePicker } from "@/components/ui/HebrewDatePicker";

interface SelectOption {
  value: string;
  label: string;
}

interface EmployeeIdentity {
  id: string;
  valid_from: string;
  valid_to?: string | null;
  first_name: string;
  last_name: string;
  preferred_name?: string | null;
  email?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  immigration_date?: string | null;
  gender?: string | null;
  marital_status?: string | null;
  children_count?: number | null;
  spouse_name?: string | null;
  spouse_legal_id?: string | null;
  legal_id_type: string;
  legal_id_number?: string | null;
  nationality?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
}

interface EmployeeEmployment {
  id: string;
  valid_from: string;
  valid_to?: string | null;
  org_unit_id?: string | null;
  manager_employee_id?: string | null;
  position_id?: string | null;
  org_unit_name?: string | null;
  manager_name?: string | null;
  position_title?: string | null;
  employment_status: string;
  employment_type: string;
  salary_type: string;
  start_date: string;
  end_date?: string | null;
  employment_scope_pct: number;
  branch_name?: string | null;
  work_site?: string | null;
  time_clock_id?: string | null;
  notes?: string | null;
}

interface EmployeeCompensation {
  id: string;
  valid_from: string;
  valid_to?: string | null;
  base_salary?: number | null;
  currency: string;
  pay_cycle: string;
  cost_center?: string | null;
}

interface EmployeeDocument {
  id: string;
  document_type: string;
  file_name: string;
  status: string;
  issued_on?: string | null;
  expires_on?: string | null;
  storage_path?: string | null;
  notes?: string | null;
  valid_from: string;
  valid_to?: string | null;
}

interface EmployeeChild {
  id: string;
  child_name: string;
  last_name?: string | null;
  legal_id_number?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  military_service_status?: string | null;
  service_start_date?: string | null;
  service_end_date?: string | null;
  allowance_eligible?: boolean | null;
  notes?: string | null;
}

interface EmployeeBankAccount {
  id: string;
  valid_from: string;
  valid_to?: string | null;
  bank_code?: string | null;
  bank_name?: string | null;
  branch_number?: string | null;
  branch_description?: string | null;
  account_number?: string | null;
  account_holder_name?: string | null;
  payment_method?: string | null;
  payment_percent?: number | null;
  fixed_amount?: number | null;
  payment_priority?: number | null;
  company_name?: string | null;
  notes?: string | null;
}

interface EmployeeAward {
  id: string;
  award_type: string;
  award_date?: string | null;
  description?: string | null;
  granted_by?: string | null;
  notes?: string | null;
}

interface EmployeeCertification {
  id: string;
  valid_from: string;
  valid_to?: string | null;
  certification_type: string;
  issuer?: string | null;
  issued_on?: string | null;
  expires_on?: string | null;
  status?: string | null;
  notes?: string | null;
}

interface EmployeeCourse {
  id: string;
  valid_from: string;
  valid_to?: string | null;
  course_name: string;
  provider?: string | null;
  started_on?: string | null;
  completed_on?: string | null;
  status?: string | null;
  score?: string | null;
  notes?: string | null;
}

interface EmployeeSkill {
  id: string;
  skill_name: string;
  level?: string | null;
  category?: string | null;
  source?: string | null;
  assessed_on?: string | null;
  notes?: string | null;
}

interface EmployeeWorkBreak {
  id: string;
  valid_from: string;
  valid_to?: string | null;
  break_type: string;
  reason?: string | null;
  started_on?: string | null;
  ended_on?: string | null;
  approved_by?: string | null;
  notes?: string | null;
}

interface DepartmentMovement {
  effective_date: string;
  previous_org_unit_name?: string | null;
  next_org_unit_name?: string | null;
  position_title?: string | null;
  employment_status?: string | null;
}

interface PositionHistory {
  valid_from: string;
  valid_to?: string | null;
  position_title?: string | null;
  employment_type?: string | null;
  employment_status?: string | null;
  org_unit_name?: string | null;
  manager_name?: string | null;
}

interface TeamMember {
  employee_id: string;
  employee_number: string;
  full_name: string;
  employment_status?: string | null;
  org_unit_name?: string | null;
  position_title?: string | null;
  start_date?: string | null;
}

interface EmploymentEvent {
  id: string;
  event_type: string;
  effective_date: string;
  notes?: string | null;
  payload_json?: Record<string, unknown> | null;
  created_at?: string | null;
}

interface EmployeeDetailResponse {
  employee: {
    id: string;
    tenant_id: string;
    employee_number: string;
    full_name: string;
    email?: string | null;
    phone?: string | null;
    employment_status?: string | null;
    employment_type?: string | null;
    branch_name?: string | null;
    org_unit_name?: string | null;
    position_title?: string | null;
    manager_name?: string | null;
    work_site?: string | null;
  };
  current_identity?: EmployeeIdentity | null;
  current_employment?: EmployeeEmployment | null;
  current_compensation?: EmployeeCompensation | null;
  current_bank_account?: EmployeeBankAccount | null;
  documents: EmployeeDocument[];
  identity_history: EmployeeIdentity[];
  employment_history: EmployeeEmployment[];
  compensation_history: EmployeeCompensation[];
  bank_accounts: EmployeeBankAccount[];
  children: EmployeeChild[];
  awards: EmployeeAward[];
  certifications: EmployeeCertification[];
  courses: EmployeeCourse[];
  skills: EmployeeSkill[];
  work_breaks: EmployeeWorkBreak[];
  department_movements: DepartmentMovement[];
  position_history: PositionHistory[];
  team_members: TeamMember[];
  timeline?: EmploymentEvent[];
}

interface OrgUnitOption {
  id: string;
  code: string;
  name: string;
}

interface PositionOption {
  id: string;
  code: string;
  title: string;
}

interface EmployeeOption {
  id: string;
  employee_number: string;
  full_name: string;
}

type RecordFormValue = string | number | null;
type RecordForm = Record<string, RecordFormValue>;
type ModalKind =
  | "identity"
  | "employment"
  | "compensation"
  | "document"
  | "child"
  | "bank"
  | "award"
  | "certification"
  | "course"
  | "skill"
  | "work_break";

type TemporalAction = "update" | "add" | "set" | "close" | "delete";

interface ModalState {
  kind: ModalKind;
  title: string;
  form: RecordForm;
  recordId?: string | null;
  isNew?: boolean;
}

interface FieldConfig {
  name: string;
  label: string;
  type: "text" | "textarea" | "date" | "number" | "select";
  options?: SelectOption[];
  required?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
}

const STATUS_LABELS: Record<string, string> = {
  active: "פעיל",
  future: "עתידי",
  leave_of_absence: 'חל"ת',
  unpaid_leave: "חופשה ללא תשלום",
  terminated: "סיום העסקה",
  suspended: "מושהה",
};

const STATUS_TYPES: Record<string, "active" | "trial" | "suspended" | "cancelled"> = {
  active: "active",
  future: "trial",
  leave_of_absence: "suspended",
  unpaid_leave: "suspended",
  terminated: "cancelled",
  suspended: "suspended",
};

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  employee: "עובד",
  temporary: "זמני",
  contractor: "קבלן",
  intern: "מתמחה",
  consultant: "יועץ",
};

const SALARY_TYPE_LABELS: Record<string, string> = {
  monthly: "חודשי",
  hourly: "שעתי",
  daily: "יומי",
  global: "גלובלי",
};

const PAY_CYCLE_LABELS: Record<string, string> = {
  monthly: "חודשי",
  biweekly: "דו-שבועי",
  weekly: "שבועי",
  hourly: "שעתי",
};

const GENDER_LABELS: Record<string, string> = {
  female: "נקבה",
  male: "זכר",
  other: "אחר",
};

const LEGAL_ID_TYPE_LABELS: Record<string, string> = {
  national_id: "תעודת זהות",
  passport: "דרכון",
  resident: "תושב",
  other: "אחר",
};

const MARITAL_STATUS_LABELS: Record<string, string> = {
  single: "רווק/ה",
  married: "נשוי/אה",
  divorced: "גרוש/ה",
  widowed: "אלמן/ה",
  other: "אחר",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: "העברה בנקאית",
  cash: "מזומן",
  check: "המחאה",
};

const EVENT_LABELS: Record<string, string> = {
  hire: "קליטה",
  org_assignment_change: "שינוי שיוך ארגוני",
  status_change: "שינוי סטטוס",
  compensation_change: "שינוי שכר",
  leave_of_absence: "יציאה להפסקה",
  termination: "סיום העסקה",
  return_from_leave: "חזרה מהפסקה",
  identity_update: "עדכון פרטים אישיים",
  document_update: "עדכון מסמך",
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("he-IL") : "—";
}

function formatDateInput(value?: string | null) {
  return value ?? "";
}

function formatMoney(value?: number | string | null, currency = "ILS") {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function safe(value?: string | number | null) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function summarizePayload(payload?: Record<string, unknown> | null) {
  if (!payload || Object.keys(payload).length === 0) return "—";
  return Object.entries(payload)
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? `${value.length} פריטים` : String(value)}`)
    .join(" | ");
}

function sortTemporalRows<T extends { valid_from: string; valid_to?: string | null }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const aCurrent = !a.valid_to ? 1 : 0;
    const bCurrent = !b.valid_to ? 1 : 0;
    if (aCurrent !== bCurrent) return bCurrent - aCurrent;
    return new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime();
  });
}

function toSelectOptions(items: SelectOption[]) {
  return [{ value: "", label: "—" }, ...items];
}

function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: FieldConfig;
  value: RecordFormValue;
  onChange: (name: string, nextValue: RecordFormValue) => void;
}) {
  if (field.type === "textarea") {
    return (
      <AdminField label={field.label}>
        <textarea
          className={ADMIN_MODAL_TEXTAREA}
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={(event) => onChange(field.name, event.target.value)}
        />
      </AdminField>
    );
  }

  if (field.type === "date") {
    return (
      <AdminField label={field.label}>
        <HebrewDatePicker
          className={ADMIN_MODAL_DATE_INPUT}
          value={String(value ?? "")}
          onChange={(nextValue) => onChange(field.name, nextValue)}
        />
      </AdminField>
    );
  }

  if (field.type === "select") {
    return (
      <AdminField label={field.label}>
        <select
          className={ADMIN_MODAL_INPUT}
          value={String(value ?? "")}
          onChange={(event) => onChange(field.name, event.target.value)}
        >
          {(field.options ?? []).map((option) => (
            <option key={`${field.name}-${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </AdminField>
    );
  }

  return (
    <AdminField label={field.label}>
      <input
        className={ADMIN_MODAL_INPUT}
        type={field.type === "number" ? "number" : "text"}
        min={field.min}
        max={field.max}
        value={String(value ?? "")}
        placeholder={field.placeholder}
        onChange={(event) =>
          onChange(
            field.name,
            field.type === "number"
              ? event.target.value === ""
                ? null
                : Number(event.target.value)
              : event.target.value
          )
        }
      />
    </AdminField>
  );
}

function TemporalRecordModal({
  state,
  fields,
  onClose,
  onChange,
  onSubmit,
  warning,
}: {
  state: ModalState;
  fields: FieldConfig[];
  onClose: () => void;
  onChange: (name: string, value: RecordFormValue) => void;
  onSubmit: (action: TemporalAction) => Promise<void>;
  warning?: string;
}) {
  const [action, setAction] = useState<TemporalAction>(state.isNew ? "add" : "update");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setAction(state.isNew ? "add" : "update");
    setMenuOpen(false);
  }, [state]);

  const showFields = action !== "close" && action !== "delete";
  const showDateFields = action !== "delete";
  const message =
    action === "set"
      ? "פעולת קבע תקופה עלולה לפצל או להחליף רשומות חופפות."
      : action === "close"
      ? "הרשומה תישאר בהיסטוריה ותיסגר בתאריך הסיום שתבחר."
      : action === "delete"
      ? "מחיקה מבטלת את הרשומה לצמיתות."
      : warning;

  const footerButton =
    action === "close"
      ? ADMIN_MODAL_ACTION_WARNING
      : action === "delete"
      ? ADMIN_MODAL_ACTION_DANGER
      : ADMIN_MODAL_ACTION_PRIMARY;

  const footerLabel =
    action === "add"
      ? "הוסף רשומה"
      : action === "set"
      ? "קבע תקופה"
      : action === "close"
      ? "סגור תקופה"
      : action === "delete"
      ? "מחק רשומה"
      : "שמור";

  return (
    <AdminModal onBackdropClick={onClose}>
      <AdminModalPanel className="relative flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
        <AdminModalHeader title={state.title} subtitle="רשומת עובד טמפורלית" onClose={onClose} />
        <AdminModalBody className="space-y-4 overflow-y-auto">
          {message ? <AdminModalMessage tone={action === "delete" ? "danger" : action === "close" || action === "set" ? "warning" : "info"}>{message}</AdminModalMessage> : null}
          {showFields ? (
            <div className={ADMIN_MODAL_GRID}>
              {fields.map((field) => (
                <FieldRenderer
                  key={field.name}
                  field={field}
                  value={state.form[field.name] ?? ""}
                  onChange={onChange}
                />
              ))}
            </div>
          ) : null}
          {showDateFields ? (
            <AdminDateFields
              fromField={
                <HebrewDatePicker
                  className={ADMIN_MODAL_DATE_INPUT}
                  value={String(state.form.valid_from ?? "")}
                  onChange={(value) => onChange("valid_from", value)}
                />
              }
              toField={
                <HebrewDatePicker
                  className={ADMIN_MODAL_DATE_INPUT}
                  value={String(state.form.valid_to ?? "")}
                  onChange={(value) => onChange("valid_to", value)}
                />
              }
            />
          ) : null}
        </AdminModalBody>
        <AdminModalFooter>
          <button onClick={onClose} className={ADMIN_MODAL_ACTION_SECONDARY}>ביטול</button>
          {state.isNew ? (
            <button onClick={() => void onSubmit("add")} className={ADMIN_MODAL_ACTION_PRIMARY}>הוסף רשומה</button>
          ) : (
            <SplitActionButton
              primaryLabel={footerLabel}
              onPrimaryClick={() => void onSubmit(action)}
              menuOpen={menuOpen}
              onMenuToggle={() => setMenuOpen((open) => !open)}
              actions={[
                { label: "רשומה חדשה", onClick: () => { setAction("add"); setMenuOpen(false); } },
                { label: "שמור", onClick: () => { setAction("update"); setMenuOpen(false); } },
                { label: "קבע תקופה", tone: "warning", onClick: () => { setAction("set"); setMenuOpen(false); } },
                { label: "סגור תקופה", tone: "warning", onClick: () => { setAction("close"); setMenuOpen(false); } },
                { label: "מחק/בטל רשומה", tone: "danger", onClick: () => { setAction("delete"); setMenuOpen(false); } },
              ]}
              buttonClassName={footerButton.replace("rounded-md ", "")}
            />
          )}
        </AdminModalFooter>
      </AdminModalPanel>
    </AdminModal>
  );
}

function CrudRecordModal({
  state,
  fields,
  onClose,
  onChange,
  onSave,
  onDelete,
}: {
  state: ModalState;
  fields: FieldConfig[];
  onClose: () => void;
  onChange: (name: string, value: RecordFormValue) => void;
  onSave: () => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  return (
    <AdminModal onBackdropClick={onClose}>
      <AdminModalPanel className="relative flex max-h-[90vh] max-w-3xl flex-col overflow-hidden">
        <AdminModalHeader title={state.title} onClose={onClose} />
        <AdminModalBody className="space-y-4 overflow-y-auto">
          <div className={ADMIN_MODAL_GRID}>
            {fields.map((field) => (
              <FieldRenderer
                key={field.name}
                field={field}
                value={state.form[field.name] ?? ""}
                onChange={onChange}
              />
            ))}
          </div>
        </AdminModalBody>
        <AdminModalFooter>
          <button onClick={onClose} className={ADMIN_MODAL_ACTION_SECONDARY}>ביטול</button>
          {onDelete && !state.isNew ? (
            <button onClick={() => void onDelete()} className={ADMIN_MODAL_ACTION_DANGER}>מחק</button>
          ) : null}
          <button onClick={() => void onSave()} className={ADMIN_MODAL_ACTION_PRIMARY}>
            {state.isNew ? "הוסף" : "שמור"}
          </button>
        </AdminModalFooter>
      </AdminModalPanel>
    </AdminModal>
  );
}

function InnerTabs({
  tabs,
}: {
  tabs: { id: string; label: string; content: React.ReactNode }[];
}) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "");

  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  const currentTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div>{currentTab?.content}</div>
    </div>
  );
}

function InfoTable({
  columns,
  rows,
  emptyMessage,
}: {
  columns: { key: string; label: string; width?: string }[];
  rows: Array<Record<string, React.ReactNode>>;
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return <div className="py-8 text-center text-sm text-slate-400">{emptyMessage}</div>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full min-w-max text-xs">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={`px-3 py-2 text-right ${column.width ?? ""}`}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`row-${index}`} className="border-t border-slate-100">
              {columns.map((column) => (
                <td key={`${index}-${column.key}`} className={`px-3 py-2 align-top ${column.width ?? ""}`}>
                  {row[column.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ParentSummary({ data }: { data: EmployeeDetailResponse }) {
  const identity = data.current_identity;
  const employment = data.current_employment;
  const compensation = data.current_compensation;
  const bankAccount = data.current_bank_account;
  const currentValidity = employment?.valid_to
    ? `${formatDate(employment.valid_from)} עד ${formatDate(employment.valid_to)}`
    : employment?.valid_from
      ? `מ-${formatDate(employment.valid_from)}`
      : "—";
  const fieldGridClass = "grid gap-2 md:grid-cols-2 xl:grid-cols-3";
  const employmentStatusLabel =
    STATUS_LABELS[employment?.employment_status ?? data.employee.employment_status ?? ""] ??
    employment?.employment_status ??
    data.employee.employment_status ??
    "—";

  return (
    <div className="border-b border-slate-200 bg-white px-4 py-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-right">
          <div className="text-sm font-semibold text-slate-800">{data.employee.full_name}</div>
          <div className="text-xs text-slate-500">מספר עובד: {data.employee.employee_number}</div>
        </div>
        <div className="text-xs font-medium text-slate-500">
          סטטוס: <span className="text-slate-700">{employmentStatusLabel}</span>
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-[1.05fr_1.35fr]">
        <AdminSectionCard title="פרטי עובד">
          <div className={fieldGridClass}>
            <FormField label="מספר עובד" value={safe(data.employee.employee_number)} />
            <FormField label="שם עובד" value={safe(data.employee.full_name)} />
            <FormField label="מספר מזהה" value={safe(identity?.legal_id_number)} />
            <FormField label="סוג מזהה" value={safe(LEGAL_ID_TYPE_LABELS[identity?.legal_id_type ?? ""] ?? identity?.legal_id_type)} />
            <FormField label='דוא"ל' value={safe(identity?.email || data.employee.email)} />
            <FormField label="טלפון" value={safe(identity?.phone || data.employee.phone)} />
            <FormField label="מגדר" value={safe(GENDER_LABELS[identity?.gender ?? ""] ?? identity?.gender)} />
            <FormField label="תאריך לידה" value={safe(formatDate(identity?.birth_date))} />
            <FormField label="מצב משפחתי" value={safe(MARITAL_STATUS_LABELS[identity?.marital_status ?? ""] ?? identity?.marital_status)} />
          </div>
        </AdminSectionCard>
        <AdminSectionCard title="העסקה נוכחית">
          <div className={fieldGridClass}>
            <FormField label="סטטוס העסקה" value={safe(employmentStatusLabel)} />
            <FormField label="סוג העסקה" value={safe(EMPLOYMENT_TYPE_LABELS[employment?.employment_type ?? ""] ?? employment?.employment_type)} />
            <FormField label="תוקף נוכחי" value={safe(currentValidity)} />
            <FormField label="תחילת העסקה" value={safe(formatDate(employment?.start_date))} />
            <FormField label="אחוז משרה" value={safe(employment?.employment_scope_pct !== undefined ? `${employment.employment_scope_pct}%` : null)} />
            <FormField label="סוג שכר" value={safe(SALARY_TYPE_LABELS[employment?.salary_type ?? ""] ?? employment?.salary_type)} />
            <FormField label="שכר בסיס" value={safe(formatMoney(compensation?.base_salary, compensation?.currency ?? "ILS"))} />
            <FormField label="מחזור שכר" value={safe(PAY_CYCLE_LABELS[compensation?.pay_cycle ?? ""] ?? compensation?.pay_cycle)} />
            <FormField label="יחידה" value={safe(employment?.org_unit_name || data.employee.org_unit_name)} />
            <FormField label="מנהל ישיר" value={safe(employment?.manager_name || data.employee.manager_name)} />
            <FormField label="תפקיד" value={safe(employment?.position_title || data.employee.position_title)} />
            <FormField label="סניף" value={safe(employment?.branch_name || data.employee.branch_name)} />
            <FormField label="אתר עבודה" value={safe(employment?.work_site || data.employee.work_site)} />
            <FormField label="חשבון בנק פעיל" value={safe(bankAccount?.account_number)} />
          </div>
        </AdminSectionCard>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export default function CoreEmployeeDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const employeeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [data, setData] = useState<EmployeeDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [saving, setSaving] = useState(false);
  const [orgUnits, setOrgUnits] = useState<OrgUnitOption[]>([]);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);

  const hasSensitiveAccess = canManageSensitive("core");

  const loadData = useCallback(() => {
    setLoading(true);
    api.get<EmployeeDetailResponse>(`/api/core/employees/${employeeId}`)
      .then((payload) => {
        setData(payload);
        setError(null);
      })
      .catch((err: unknown) => setError((err as { message?: string })?.message ?? "שגיאה בטעינת העובד"))
      .finally(() => setLoading(false));
  }, [employeeId]);

  const loadOptions = useCallback((tenantId: string) => {
    Promise.all([
      api.get<OrgUnitOption[]>(`/api/core/org-units?tenant_id=${tenantId}`),
      api.get<PositionOption[]>(`/api/core/positions?tenant_id=${tenantId}`),
      api.get<EmployeeOption[]>(`/api/core/employees?tenant_id=${tenantId}`),
    ])
      .then(([orgUnitsData, positionsData, employeesData]) => {
        setOrgUnits(orgUnitsData);
        setPositions(positionsData);
        setEmployeeOptions(employeesData.filter((item) => item.id !== employeeId));
      })
      .catch(() => {
        setOrgUnits([]);
        setPositions([]);
        setEmployeeOptions([]);
      });
  }, [employeeId]);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    if (employeeId) {
      loadData();
    }
  }, [employeeId, loadData, router]);

  useEffect(() => {
    if (data?.employee.tenant_id) {
      loadOptions(data.employee.tenant_id);
    }
  }, [data?.employee.tenant_id, loadOptions]);

  function updateModalField(name: string, value: RecordFormValue) {
    setModal((current) => (current ? { ...current, form: { ...current.form, [name]: value } } : current));
  }

  function openModal(state: ModalState) {
    setModal(state);
  }

  function closeModal() {
    setModal(null);
    setSaving(false);
  }

  function buildIdentityForm(identity?: EmployeeIdentity | null): RecordForm {
    return {
      first_name: identity?.first_name ?? "",
      last_name: identity?.last_name ?? "",
      preferred_name: identity?.preferred_name ?? "",
      email: identity?.email ?? "",
      phone: identity?.phone ?? "",
      birth_date: formatDateInput(identity?.birth_date),
      immigration_date: formatDateInput(identity?.immigration_date),
      gender: identity?.gender ?? "",
      marital_status: identity?.marital_status ?? "",
      children_count: identity?.children_count ?? null,
      spouse_name: identity?.spouse_name ?? "",
      spouse_legal_id: identity?.spouse_legal_id ?? "",
      legal_id_type: identity?.legal_id_type ?? "national_id",
      legal_id_number: identity?.legal_id_number ?? "",
      nationality: identity?.nationality ?? "",
      address_line1: identity?.address_line1 ?? "",
      address_line2: identity?.address_line2 ?? "",
      city: identity?.city ?? "",
      postal_code: identity?.postal_code ?? "",
      country: identity?.country ?? "IL",
      emergency_contact_name: identity?.emergency_contact_name ?? "",
      emergency_contact_phone: identity?.emergency_contact_phone ?? "",
      valid_from: formatDateInput(identity?.valid_from),
      valid_to: formatDateInput(identity?.valid_to),
    };
  }

  function buildEmploymentForm(employment?: EmployeeEmployment | null): RecordForm {
    return {
      org_unit_id: employment?.org_unit_id ?? "",
      manager_employee_id: employment?.manager_employee_id ?? "",
      position_id: employment?.position_id ?? "",
      employment_status: employment?.employment_status ?? "active",
      employment_type: employment?.employment_type ?? "employee",
      salary_type: employment?.salary_type ?? "monthly",
      start_date: formatDateInput(employment?.start_date),
      end_date: formatDateInput(employment?.end_date),
      employment_scope_pct: employment?.employment_scope_pct ?? 100,
      branch_name: employment?.branch_name ?? "",
      work_site: employment?.work_site ?? "",
      time_clock_id: employment?.time_clock_id ?? "",
      notes: employment?.notes ?? "",
      valid_from: formatDateInput(employment?.valid_from),
      valid_to: formatDateInput(employment?.valid_to),
    };
  }

  function buildCompensationForm(compensation?: EmployeeCompensation | null): RecordForm {
    return {
      base_salary: compensation?.base_salary ?? null,
      currency: compensation?.currency ?? "ILS",
      pay_cycle: compensation?.pay_cycle ?? "monthly",
      cost_center: compensation?.cost_center ?? "",
      valid_from: formatDateInput(compensation?.valid_from),
      valid_to: formatDateInput(compensation?.valid_to),
    };
  }

  function buildDocumentForm(record?: EmployeeDocument): RecordForm {
    return {
      document_type: record?.document_type ?? "",
      file_name: record?.file_name ?? "",
      storage_path: record?.storage_path ?? "",
      issued_on: formatDateInput(record?.issued_on),
      expires_on: formatDateInput(record?.expires_on),
      status: record?.status ?? "active",
      notes: record?.notes ?? "",
      valid_from: formatDateInput(record?.valid_from),
      valid_to: formatDateInput(record?.valid_to),
    };
  }

  function buildChildForm(child?: EmployeeChild): RecordForm {
    return {
      child_name: child?.child_name ?? "",
      last_name: child?.last_name ?? "",
      legal_id_number: child?.legal_id_number ?? "",
      birth_date: formatDateInput(child?.birth_date),
      gender: child?.gender ?? "",
      military_service_status: child?.military_service_status ?? "",
      service_start_date: formatDateInput(child?.service_start_date),
      service_end_date: formatDateInput(child?.service_end_date),
      allowance_eligible: child?.allowance_eligible ? "yes" : "no",
      notes: child?.notes ?? "",
    };
  }

  function buildBankForm(record?: EmployeeBankAccount): RecordForm {
    return {
      bank_code: record?.bank_code ?? "",
      bank_name: record?.bank_name ?? "",
      branch_number: record?.branch_number ?? "",
      branch_description: record?.branch_description ?? "",
      account_number: record?.account_number ?? "",
      account_holder_name: record?.account_holder_name ?? "",
      payment_method: record?.payment_method ?? "bank_transfer",
      payment_percent: record?.payment_percent ?? null,
      fixed_amount: record?.fixed_amount ?? null,
      payment_priority: record?.payment_priority ?? null,
      company_name: record?.company_name ?? "",
      notes: record?.notes ?? "",
      valid_from: formatDateInput(record?.valid_from),
      valid_to: formatDateInput(record?.valid_to),
    };
  }

  function buildAwardForm(record?: EmployeeAward): RecordForm {
    return {
      award_type: record?.award_type ?? "",
      award_date: formatDateInput(record?.award_date),
      description: record?.description ?? "",
      granted_by: record?.granted_by ?? "",
      notes: record?.notes ?? "",
    };
  }

  function buildCertificationForm(record?: EmployeeCertification): RecordForm {
    return {
      certification_type: record?.certification_type ?? "",
      issuer: record?.issuer ?? "",
      issued_on: formatDateInput(record?.issued_on),
      expires_on: formatDateInput(record?.expires_on),
      status: record?.status ?? "",
      notes: record?.notes ?? "",
      valid_from: formatDateInput(record?.valid_from),
      valid_to: formatDateInput(record?.valid_to),
    };
  }

  function buildCourseForm(record?: EmployeeCourse): RecordForm {
    return {
      course_name: record?.course_name ?? "",
      provider: record?.provider ?? "",
      started_on: formatDateInput(record?.started_on),
      completed_on: formatDateInput(record?.completed_on),
      status: record?.status ?? "",
      score: record?.score ?? "",
      notes: record?.notes ?? "",
      valid_from: formatDateInput(record?.valid_from),
      valid_to: formatDateInput(record?.valid_to),
    };
  }

  function buildSkillForm(record?: EmployeeSkill): RecordForm {
    return {
      skill_name: record?.skill_name ?? "",
      level: record?.level ?? "",
      category: record?.category ?? "",
      source: record?.source ?? "",
      assessed_on: formatDateInput(record?.assessed_on),
      notes: record?.notes ?? "",
    };
  }

  function buildWorkBreakForm(record?: EmployeeWorkBreak): RecordForm {
    return {
      break_type: record?.break_type ?? "",
      reason: record?.reason ?? "",
      started_on: formatDateInput(record?.started_on),
      ended_on: formatDateInput(record?.ended_on),
      approved_by: record?.approved_by ?? "",
      notes: record?.notes ?? "",
      valid_from: formatDateInput(record?.valid_from),
      valid_to: formatDateInput(record?.valid_to),
    };
  }

  function normalizeChildPayload(form: RecordForm) {
    return {
      ...form,
      allowance_eligible:
        form.allowance_eligible === "yes"
          ? true
          : form.allowance_eligible === "no"
            ? false
            : null,
    };
  }

  async function submitModal(actionOverride?: TemporalAction) {
    if (!modal) return;
    setSaving(true);
    const action = actionOverride ?? "update";
    const form = modal.form;
    try {
      switch (modal.kind) {
        case "identity":
          await api.put(`/api/core/employees/${employeeId}/identity/record`, {
            action,
            ...form,
          });
          break;
        case "employment":
          await api.put(`/api/core/employees/${employeeId}/employment/record`, {
            action,
            ...form,
          });
          break;
        case "compensation":
          await api.put(`/api/core/employees/${employeeId}/compensation/record`, {
            action,
            ...form,
          });
          break;
        case "document":
          if (modal.isNew) {
            await api.post(`/api/core/employees/${employeeId}/documents`, form);
          } else {
            await api.put(`/api/core/employees/${employeeId}/documents/${modal.recordId}/record`, {
              action,
              ...form,
            });
          }
          break;
        case "child":
          if (modal.isNew) {
            await api.post(`/api/core/employees/${employeeId}/children`, normalizeChildPayload(form));
          } else {
            await api.put(`/api/core/employees/${employeeId}/children/${modal.recordId}`, normalizeChildPayload(form));
          }
          break;
        case "bank":
          if (modal.isNew) {
            await api.post(`/api/core/employees/${employeeId}/bank-accounts`, form);
          } else {
            await api.put(`/api/core/employees/${employeeId}/bank-accounts/${modal.recordId}/record`, {
              action,
              ...form,
            });
          }
          break;
        case "award":
          if (modal.isNew) {
            await api.post(`/api/core/employees/${employeeId}/awards`, form);
          } else {
            await api.put(`/api/core/employees/${employeeId}/awards/${modal.recordId}`, form);
          }
          break;
        case "certification":
          if (modal.isNew) {
            await api.post(`/api/core/employees/${employeeId}/certifications`, form);
          } else {
            await api.put(`/api/core/employees/${employeeId}/certifications/${modal.recordId}/record`, {
              action,
              ...form,
            });
          }
          break;
        case "course":
          if (modal.isNew) {
            await api.post(`/api/core/employees/${employeeId}/courses`, form);
          } else {
            await api.put(`/api/core/employees/${employeeId}/courses/${modal.recordId}/record`, {
              action,
              ...form,
            });
          }
          break;
        case "skill":
          if (modal.isNew) {
            await api.post(`/api/core/employees/${employeeId}/skills`, form);
          } else {
            await api.put(`/api/core/employees/${employeeId}/skills/${modal.recordId}`, form);
          }
          break;
        case "work_break":
          if (modal.isNew) {
            await api.post(`/api/core/employees/${employeeId}/work-breaks`, form);
          } else {
            await api.put(`/api/core/employees/${employeeId}/work-breaks/${modal.recordId}/record`, {
              action,
              ...form,
            });
          }
          break;
      }
      closeModal();
      loadData();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? "לא ניתן לשמור את הרשומה");
      setSaving(false);
    }
  }

  async function deleteModalRecord() {
    if (!modal?.recordId) return;
    setSaving(true);
    try {
      switch (modal.kind) {
        case "document":
        case "bank":
        case "certification":
        case "course":
        case "work_break":
          await submitModal("delete");
          return;
        case "child":
          await api.delete(`/api/core/employees/${employeeId}/children/${modal.recordId}`);
          break;
        case "award":
          await api.delete(`/api/core/employees/${employeeId}/awards/${modal.recordId}`);
          break;
        case "skill":
          await api.delete(`/api/core/employees/${employeeId}/skills/${modal.recordId}`);
          break;
        default:
          return;
      }
      closeModal();
      loadData();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? "לא ניתן למחוק את הרשומה");
      setSaving(false);
    }
  }

  const identityFields: FieldConfig[] = [
    { name: "first_name", label: "שם פרטי", type: "text" },
    { name: "last_name", label: "שם משפחה", type: "text" },
    { name: "preferred_name", label: "שם מועדף", type: "text" },
    { name: "email", label: 'דוא"ל', type: "text" },
    { name: "phone", label: "טלפון", type: "text" },
    { name: "birth_date", label: "תאריך לידה", type: "date" },
    { name: "immigration_date", label: "תאריך עליה", type: "date" },
    { name: "gender", label: "מגדר", type: "select", options: toSelectOptions([{ value: "female", label: "נקבה" }, { value: "male", label: "זכר" }, { value: "other", label: "אחר" }]) },
    { name: "marital_status", label: "מצב משפחתי", type: "select", options: toSelectOptions([{ value: "single", label: "רווק/ה" }, { value: "married", label: "נשוי/אה" }, { value: "divorced", label: "גרוש/ה" }, { value: "widowed", label: "אלמן/ה" }, { value: "other", label: "אחר" }]) },
    { name: "children_count", label: "מספר ילדים", type: "number", min: 0 },
    { name: "spouse_name", label: "שם בן/בת זוג", type: "text" },
    { name: "spouse_legal_id", label: "ת.ז בן/בת זוג", type: "text" },
    { name: "legal_id_type", label: "סוג מזהה", type: "select", options: toSelectOptions([{ value: "national_id", label: "תעודת זהות" }, { value: "passport", label: "דרכון" }, { value: "resident", label: "תושב" }, { value: "other", label: "אחר" }]) },
    { name: "legal_id_number", label: "מספר מזהה", type: "text" },
    { name: "nationality", label: "אזרחות", type: "text" },
    { name: "address_line1", label: "כתובת", type: "text" },
    { name: "address_line2", label: "כתובת 2", type: "text" },
    { name: "city", label: "עיר", type: "text" },
    { name: "postal_code", label: "מיקוד", type: "text" },
    { name: "country", label: "מדינה", type: "text" },
    { name: "emergency_contact_name", label: "איש קשר חירום", type: "text" },
    { name: "emergency_contact_phone", label: "טלפון חירום", type: "text" },
  ];

  const employmentFields: FieldConfig[] = [
    { name: "org_unit_id", label: "יחידה", type: "select", options: toSelectOptions(orgUnits.map((item) => ({ value: item.id, label: `${item.code} - ${item.name}` }))) },
    { name: "position_id", label: "תפקיד", type: "select", options: toSelectOptions(positions.map((item) => ({ value: item.id, label: `${item.code} - ${item.title}` }))) },
    { name: "manager_employee_id", label: "מנהל ישיר", type: "select", options: toSelectOptions(employeeOptions.map((item) => ({ value: item.id, label: `${item.employee_number} - ${item.full_name}` }))) },
    { name: "employment_status", label: "סטטוס העסקה", type: "select", options: toSelectOptions(Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))) },
    { name: "employment_type", label: "סוג העסקה", type: "select", options: toSelectOptions(Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => ({ value, label }))) },
    { name: "salary_type", label: "סוג שכר", type: "select", options: toSelectOptions(Object.entries(SALARY_TYPE_LABELS).map(([value, label]) => ({ value, label }))) },
    { name: "start_date", label: "תחילת העסקה", type: "date" },
    { name: "end_date", label: "סיום העסקה", type: "date" },
    { name: "employment_scope_pct", label: "אחוז משרה", type: "number", min: 0, max: 100 },
    { name: "branch_name", label: "סניף", type: "text" },
    { name: "work_site", label: "אתר עבודה", type: "text" },
    { name: "time_clock_id", label: "מספר כרטיס", type: "text" },
    { name: "notes", label: "הערות", type: "textarea" },
  ];

  const compensationFields: FieldConfig[] = [
    { name: "base_salary", label: "שכר בסיס", type: "number", min: 0 },
    { name: "currency", label: "מטבע", type: "text" },
    { name: "pay_cycle", label: "מחזור", type: "select", options: toSelectOptions(Object.entries(PAY_CYCLE_LABELS).map(([value, label]) => ({ value, label }))) },
    { name: "cost_center", label: "מרכז עלות", type: "text" },
  ];

  const documentFields: FieldConfig[] = [
    { name: "document_type", label: "סוג מסמך", type: "text" },
    { name: "file_name", label: "שם קובץ", type: "text" },
    { name: "storage_path", label: "קישור/נתיב", type: "text" },
    { name: "issued_on", label: "הונפק", type: "date" },
    { name: "expires_on", label: "בתוקף עד", type: "date" },
    { name: "status", label: "סטטוס", type: "text" },
    { name: "notes", label: "הערות", type: "textarea" },
  ];

  const childFields: FieldConfig[] = [
    { name: "child_name", label: "שם הילד", type: "text" },
    { name: "last_name", label: "שם משפחה", type: "text" },
    { name: "legal_id_number", label: "מספר זהות", type: "text" },
    { name: "birth_date", label: "תאריך לידה", type: "date" },
    { name: "gender", label: "מגדר", type: "select", options: toSelectOptions([{ value: "female", label: "נקבה" }, { value: "male", label: "זכר" }, { value: "other", label: "אחר" }]) },
    { name: "military_service_status", label: "מצב שירות", type: "text" },
    { name: "service_start_date", label: "תחילת שירות", type: "date" },
    { name: "service_end_date", label: "סיום שירות", type: "date" },
    { name: "allowance_eligible", label: "זכאי/ת להטבה", type: "select", options: toSelectOptions([{ value: "yes", label: "כן" }, { value: "no", label: "לא" }]) },
    { name: "notes", label: "הערות", type: "textarea" },
  ];

  const bankFields: FieldConfig[] = [
    { name: "bank_code", label: "קוד בנק", type: "text" },
    { name: "bank_name", label: "בנק", type: "text" },
    { name: "branch_number", label: "סניף", type: "text" },
    { name: "branch_description", label: "תיאור סניף", type: "text" },
    { name: "account_number", label: "מספר חשבון", type: "text" },
    { name: "account_holder_name", label: "בעל החשבון", type: "text" },
    { name: "payment_method", label: "אמצעי תשלום", type: "select", options: toSelectOptions(Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({ value, label }))) },
    { name: "payment_percent", label: "אחוז תשלום", type: "number", min: 0, max: 100 },
    { name: "fixed_amount", label: "סכום קבוע", type: "number", min: 0 },
    { name: "payment_priority", label: "עדיפות", type: "number", min: 1 },
    { name: "company_name", label: "חברה משלמת", type: "text" },
    { name: "notes", label: "הערות", type: "textarea" },
  ];

  const awardFields: FieldConfig[] = [
    { name: "award_type", label: "סוג הוקרה", type: "text" },
    { name: "award_date", label: "תאריך", type: "date" },
    { name: "granted_by", label: "ניתן על ידי", type: "text" },
    { name: "description", label: "תיאור", type: "textarea" },
    { name: "notes", label: "הערות", type: "textarea" },
  ];

  const certificationFields: FieldConfig[] = [
    { name: "certification_type", label: "הסמכה", type: "text" },
    { name: "issuer", label: "מנפיק", type: "text" },
    { name: "issued_on", label: "הונפק", type: "date" },
    { name: "expires_on", label: "בתוקף עד", type: "date" },
    { name: "status", label: "סטטוס", type: "text" },
    { name: "notes", label: "הערות", type: "textarea" },
  ];

  const courseFields: FieldConfig[] = [
    { name: "course_name", label: "קורס", type: "text" },
    { name: "provider", label: "ספק/מוסד", type: "text" },
    { name: "started_on", label: "התחלה", type: "date" },
    { name: "completed_on", label: "סיום", type: "date" },
    { name: "status", label: "סטטוס", type: "text" },
    { name: "score", label: "ציון", type: "text" },
    { name: "notes", label: "הערות", type: "textarea" },
  ];

  const skillFields: FieldConfig[] = [
    { name: "skill_name", label: "כישור", type: "text" },
    { name: "level", label: "רמה", type: "text" },
    { name: "category", label: "קטגוריה", type: "text" },
    { name: "source", label: "מקור", type: "text" },
    { name: "assessed_on", label: "נבדק בתאריך", type: "date" },
    { name: "notes", label: "הערות", type: "textarea" },
  ];

  const workBreakFields: FieldConfig[] = [
    { name: "break_type", label: "סוג הפסקה", type: "text" },
    { name: "reason", label: "סיבה", type: "textarea" },
    { name: "started_on", label: "מתאריך", type: "date" },
    { name: "ended_on", label: "עד תאריך", type: "date" },
    { name: "approved_by", label: "אושר על ידי", type: "text" },
    { name: "notes", label: "הערות", type: "textarea" },
  ];

  const formTabs: FormTab[] = useMemo(() => {
    if (!data) return [];
    const identity = data.current_identity;
    const employment = data.current_employment;
    const compensation = data.current_compensation;
    const bank = data.current_bank_account;

    return [
      {
        id: "personal",
        label: "פרטים אישיים",
        content: (
          <div className="bg-white p-4">
            <AdminSectionCard title="פרטים אישיים">
              <SectionHeader
                title="פרטים אישיים"
                subtitle="רשומת הזהות הפעילה של העובד, עם חלוקה פנימית לפי אזורי מידע"
                action={
                  <button
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                    onClick={() =>
                      openModal({
                        kind: "identity",
                        title: "עריכת פרטים אישיים",
                        form: buildIdentityForm(identity),
                        recordId: identity?.id ?? null,
                        isNew: !identity,
                      })
                    }
                  >
                    {identity ? "ערוך" : "הוסף"}
                  </button>
                }
              />
              <InnerTabs
                tabs={[
                  {
                    id: "personal-main",
                    label: "פרטים אישיים",
                    content: (
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        <FormField label="שם פרטי" value={safe(identity?.first_name)} />
                        <FormField label="שם משפחה" value={safe(identity?.last_name)} />
                        <FormField label="שם מועדף" value={safe(identity?.preferred_name)} />
                        <FormField label='דוא"ל' value={safe(identity?.email)} />
                        <FormField label="טלפון" value={safe(identity?.phone)} />
                        <FormField label="אזרחות ראשית" value={safe(identity?.nationality)} />
                        <FormField label="מגדר" value={safe(GENDER_LABELS[identity?.gender ?? ""] ?? identity?.gender)} />
                        <FormField label="תאריך לידה" value={safe(formatDate(identity?.birth_date))} />
                        <FormField label="תאריך עליה" value={safe(formatDate(identity?.immigration_date))} />
                        <FormField label="סוג מזהה" value={safe(LEGAL_ID_TYPE_LABELS[identity?.legal_id_type ?? ""] ?? identity?.legal_id_type)} />
                        <FormField label="מספר מזהה" value={safe(identity?.legal_id_number)} />
                        <FormField label="מדינה" value={safe(identity?.country)} />
                      </div>
                    ),
                  },
                  {
                    id: "personal-family",
                    label: "פרטי אישות ומשפחה",
                    content: (
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        <FormField label="מצב משפחתי" value={safe(MARITAL_STATUS_LABELS[identity?.marital_status ?? ""] ?? identity?.marital_status)} />
                        <FormField label="מספר ילדים" value={safe(identity?.children_count)} />
                        <FormField label="שם בן/בת זוג" value={safe(identity?.spouse_name)} />
                        <FormField label="ת.ז בן/בת זוג" value={safe(identity?.spouse_legal_id)} />
                        <FormField label="איש קשר חירום" value={safe(identity?.emergency_contact_name)} />
                        <FormField label="טלפון חירום" value={safe(identity?.emergency_contact_phone)} />
                      </div>
                    ),
                  },
                  {
                    id: "personal-extra",
                    label: "פרטים נוספים",
                    content: (
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        <FormField label="כתובת" value={safe(identity?.address_line1)} />
                        <FormField label="כתובת 2" value={safe(identity?.address_line2)} />
                        <FormField label="עיר" value={safe(identity?.city)} />
                        <FormField label="מיקוד" value={safe(identity?.postal_code)} />
                        <FormField label="רשומה פעילה מתאריך" value={safe(formatDate(identity?.valid_from))} />
                        <FormField label="רשומה פעילה עד" value={safe(formatDate(identity?.valid_to))} />
                      </div>
                    ),
                  },
                ]}
              />
            </AdminSectionCard>
          </div>
        ),
      },
      {
        id: "children",
        label: "פרטי ילדים",
        content: (
          <div className="bg-white p-4">
            <AdminSectionCard title="פרטי ילדים">
              <SectionHeader
                title="פרטי ילדים"
                subtitle="רשומות משפחתיות לא טמפורליות"
                action={
                  <button
                    className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                    onClick={() => openModal({ kind: "child", title: "הוספת ילד", form: buildChildForm(), isNew: true })}
                  >
                    הוסף
                  </button>
                }
              />
              {data.children.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">אין ילדים רשומים לעובד</div>
              ) : (
                <InfoTable
                  columns={[
                    { key: "child_name", label: "שם פרטי" },
                    { key: "last_name", label: "שם משפחה" },
                    { key: "legal_id_number", label: "מספר זהות" },
                    { key: "birth_date", label: "תאריך לידה" },
                    { key: "gender", label: "מגדר" },
                    { key: "military_service_status", label: "מצב שירות" },
                    { key: "allowance_eligible", label: "זכאות" },
                    { key: "actions", label: "פעולות" },
                  ]}
                  rows={data.children.map((child) => ({
                    child_name: child.child_name,
                    last_name: safe(child.last_name),
                    legal_id_number: safe(child.legal_id_number),
                    birth_date: formatDate(child.birth_date),
                    gender: GENDER_LABELS[child.gender ?? ""] ?? safe(child.gender),
                    military_service_status: safe(child.military_service_status),
                    allowance_eligible: child.allowance_eligible === null || child.allowance_eligible === undefined ? "—" : child.allowance_eligible ? "כן" : "לא",
                    actions: (
                      <button
                        className="text-brand-600 hover:underline"
                        onClick={() =>
                          openModal({
                            kind: "child",
                            title: "עריכת ילד",
                            form: buildChildForm(child),
                            recordId: child.id,
                            isNew: false,
                          })
                        }
                      >
                        ערוך
                      </button>
                    ),
                  }))}
                  emptyMessage="אין ילדים רשומים לעובד"
                />
              )}
            </AdminSectionCard>
          </div>
        ),
      },
      {
        id: "employment",
        label: "נתונים לחברה נוכחית",
        content: (
          <div className="bg-white p-4">
            <AdminSectionCard title="נתונים לחברה נוכחית">
              <SectionHeader
                title="נתונים לחברה נוכחית"
                subtitle="חלוקה פנימית לפרטים, הרשאות לנתונים ושונות"
                action={
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                      onClick={() =>
                        openModal({
                          kind: "employment",
                          title: "עריכת נתוני העסקה",
                          form: buildEmploymentForm(employment),
                          recordId: employment?.id ?? null,
                          isNew: !employment,
                        })
                      }
                    >
                      {employment ? "ערוך העסקה" : "הוסף העסקה"}
                    </button>
                    {hasSensitiveAccess ? (
                      <button
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                        onClick={() =>
                          openModal({
                            kind: "compensation",
                            title: "עריכת שכר",
                            form: buildCompensationForm(compensation),
                            recordId: compensation?.id ?? null,
                            isNew: !compensation,
                          })
                        }
                      >
                        {compensation ? "ערוך שכר" : "הוסף שכר"}
                      </button>
                    ) : null}
                  </div>
                }
              />
              <InnerTabs
                tabs={[
                  {
                    id: "employment-main",
                    label: "פרטים",
                    content: (
                      <div className="grid gap-4 xl:grid-cols-2">
                        <div className="grid gap-2 md:grid-cols-2">
                          <FormField label="יחידה" value={safe(employment?.org_unit_name)} />
                          <FormField label="תפקיד" value={safe(employment?.position_title)} />
                          <FormField label="מנהל ישיר" value={safe(employment?.manager_name)} />
                          <FormField label="סטטוס העסקה" value={safe(STATUS_LABELS[employment?.employment_status ?? ""] ?? employment?.employment_status)} />
                          <FormField label="סוג העסקה" value={safe(EMPLOYMENT_TYPE_LABELS[employment?.employment_type ?? ""] ?? employment?.employment_type)} />
                          <FormField label="סוג שכר" value={safe(SALARY_TYPE_LABELS[employment?.salary_type ?? ""] ?? employment?.salary_type)} />
                          <FormField label="תחילת העסקה" value={safe(formatDate(employment?.start_date))} />
                          <FormField label="סיום העסקה" value={safe(formatDate(employment?.end_date))} />
                          <FormField label="אחוז משרה" value={safe(employment?.employment_scope_pct !== undefined ? `${employment.employment_scope_pct}%` : null)} />
                          <FormField label="סניף" value={safe(employment?.branch_name)} />
                          <FormField label="אתר עבודה" value={safe(employment?.work_site)} />
                          <FormField label="מספר כרטיס" value={safe(employment?.time_clock_id)} />
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          <FormField label="שכר בסיס" value={safe(formatMoney(compensation?.base_salary, compensation?.currency ?? "ILS"))} />
                          <FormField label="מטבע" value={safe(compensation?.currency)} />
                          <FormField label="מחזור" value={safe(PAY_CYCLE_LABELS[compensation?.pay_cycle ?? ""] ?? compensation?.pay_cycle)} />
                          <FormField label="מרכז עלות" value={safe(compensation?.cost_center)} />
                          <FormField label="רשומת העסקה מתאריך" value={safe(formatDate(employment?.valid_from))} />
                          <FormField label="רשומת העסקה עד" value={safe(formatDate(employment?.valid_to))} />
                          {!hasSensitiveAccess ? <div className={`${ADMIN_MODAL_HELP} md:col-span-2`}>נתוני שכר מוצגים בהתאם להרשאות שלך.</div> : null}
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: "employment-permissions",
                    label: "הרשאות לנתונים",
                    content: (
                      <div className="space-y-4">
                        <InfoTable
                          columns={[
                            { key: "scope", label: "תחום" },
                            { key: "item", label: "פריט" },
                            { key: "access", label: "רמת גישה" },
                            { key: "notes", label: "הערה", width: "min-w-[220px]" },
                          ]}
                          rows={[
                            { scope: "חברה", item: safe(employment?.branch_name), access: "פעיל", notes: "חיבור ראשוני קיים דרך נתוני ההעסקה" },
                            { scope: "אתר עבודה", item: safe(employment?.work_site), access: "פעיל", notes: "שדות הרשאה מפורטים יתווספו כשה-API יורחב" },
                          ]}
                          emptyMessage="אין הרשאות להצגה"
                        />
                      </div>
                    ),
                  },
                  {
                    id: "employment-misc",
                    label: "שונות",
                    content: (
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        <FormField label="הערות" value={safe(employment?.notes)} />
                        <FormField label="שם עובד" value={safe(data.employee.full_name)} />
                        <FormField label="מספר עובד" value={safe(data.employee.employee_number)} />
                        <FormField label="מנהל ישיר" value={safe(data.employee.manager_name)} />
                        <FormField label="יחידה" value={safe(data.employee.org_unit_name)} />
                        <FormField label="אתר עבודה" value={safe(data.employee.work_site)} />
                      </div>
                    ),
                  },
                ]}
              />
            </AdminSectionCard>
          </div>
        ),
      },
      {
        id: "bank",
        label: "פרטי חשבון בנק לעובד",
        content: (
          <div className="bg-white p-4">
            <AdminSectionCard title="חשבון בנק פעיל">
              <SectionHeader
                title="חשבון בנק פעיל"
                subtitle={hasSensitiveAccess ? "היסטוריה טמפורלית מלאה" : "מידע רגיש מוגבל לפי הרשאה"}
                action={
                  hasSensitiveAccess ? (
                    <button
                      className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                      onClick={() =>
                        openModal({
                          kind: "bank",
                          title: "הוספת חשבון בנק",
                          form: buildBankForm(bank ?? undefined),
                          recordId: bank?.id ?? null,
                          isNew: !bank,
                        })
                      }
                    >
                      {bank ? "ערוך פעיל" : "הוסף"}
                    </button>
                  ) : null
                }
              />
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                <FormField label="קוד בנק" value={safe(bank?.bank_code)} />
                <FormField label="בנק" value={safe(bank?.bank_name)} />
                <FormField label="סניף" value={safe(bank?.branch_number)} />
                <FormField label="תיאור סניף" value={safe(bank?.branch_description)} />
                <FormField label="מספר חשבון" value={safe(bank?.account_number)} />
                <FormField label="בעל החשבון" value={safe(bank?.account_holder_name)} />
                <FormField label="אמצעי תשלום" value={safe(PAYMENT_METHOD_LABELS[bank?.payment_method ?? ""] ?? bank?.payment_method)} />
                <FormField label="אחוז תשלום" value={safe(bank?.payment_percent !== undefined && bank?.payment_percent !== null ? `${bank.payment_percent}%` : null)} />
                <FormField label="סכום קבוע" value={safe(formatMoney(bank?.fixed_amount, compensation?.currency ?? "ILS"))} />
                <FormField label="עדיפות" value={safe(bank?.payment_priority)} />
                <FormField label="חברה" value={safe(bank?.company_name)} />
                <FormField label="תוקף" value={safe(bank?.valid_from ? `${formatDate(bank.valid_from)}${bank.valid_to ? ` עד ${formatDate(bank.valid_to)}` : ""}` : null)} />
              </div>
              <div className="mt-5">
                <div className="mb-2 text-xs font-semibold text-slate-600">היסטוריה</div>
                {data.bank_accounts.length === 0 ? (
                  <div className="text-xs text-slate-400">אין היסטוריית חשבונות בנק</div>
                ) : (
                  <InfoTable
                    columns={[
                      { key: "valid_from", label: "מתאריך" },
                      { key: "valid_to", label: "עד תאריך" },
                      { key: "bank_code", label: "קוד בנק" },
                      { key: "bank_name", label: "בנק" },
                      { key: "branch_number", label: "סניף" },
                      { key: "account_number", label: "חשבון" },
                      { key: "payment_percent", label: "% תשלום" },
                      { key: "fixed_amount", label: "סכום קבוע" },
                      { key: "payment_priority", label: "עדיפות" },
                      { key: "actions", label: "פעולות" },
                    ]}
                    rows={sortTemporalRows(data.bank_accounts).map((record) => ({
                      valid_from: formatDate(record.valid_from),
                      valid_to: formatDate(record.valid_to),
                      bank_code: safe(record.bank_code),
                      bank_name: safe(record.bank_name),
                      branch_number: safe(record.branch_number),
                      account_number: safe(record.account_number),
                      payment_percent: safe(record.payment_percent !== undefined && record.payment_percent !== null ? `${record.payment_percent}%` : null),
                      fixed_amount: safe(formatMoney(record.fixed_amount, compensation?.currency ?? "ILS")),
                      payment_priority: safe(record.payment_priority),
                      actions: hasSensitiveAccess ? (
                        <button
                          className="text-brand-600 hover:underline"
                          onClick={() =>
                            openModal({
                              kind: "bank",
                              title: "עריכת חשבון בנק",
                              form: buildBankForm(record),
                              recordId: record.id,
                              isNew: false,
                            })
                          }
                        >
                          ערוך
                        </button>
                      ) : "—",
                    }))}
                    emptyMessage="אין היסטוריית חשבונות בנק"
                  />
                )}
              </div>
            </AdminSectionCard>
          </div>
        ),
      },
    ];
  }, [data, hasSensitiveAccess]);

  const childTabs: ChildTab[] = useMemo(() => {
    if (!data) return [];
    return [
      {
        id: "movements",
        label: "ניוד בין מחלקות",
        columns: [
          { key: "effective_date", label: "תאריך" },
          { key: "previous_org_unit_name", label: "יחידה קודמת" },
          { key: "next_org_unit_name", label: "יחידה חדשה" },
          { key: "position_title", label: "תפקיד" },
          { key: "employment_status", label: "סטטוס" },
          { key: "branch_name", label: "סניף" },
          { key: "work_site", label: "אתר עבודה" },
        ],
        rows: data.department_movements.map((row) => ({
          effective_date: formatDate(row.effective_date),
          previous_org_unit_name: safe(row.previous_org_unit_name),
          next_org_unit_name: safe(row.next_org_unit_name),
          position_title: safe(row.position_title),
          employment_status: safe(STATUS_LABELS[row.employment_status ?? ""] ?? row.employment_status),
          branch_name: safe(data.current_employment?.branch_name),
          work_site: safe(data.current_employment?.work_site),
        })),
        emptyMessage: "אין תנועות בין מחלקות להצגה",
      },
      {
        id: "jobs",
        label: "משרות לעובד",
        columns: [
          { key: "valid_from", label: "מתאריך" },
          { key: "valid_to", label: "עד תאריך" },
          { key: "position_title", label: "תפקיד" },
          { key: "employment_type", label: "סוג העסקה" },
          { key: "employment_status", label: "סטטוס" },
          { key: "org_unit_name", label: "יחידה" },
          { key: "manager_name", label: "מנהל" },
        ],
        rows: sortTemporalRows(data.employment_history).map((row) => ({
          valid_from: formatDate(row.valid_from),
          valid_to: formatDate(row.valid_to),
          position_title: safe(row.position_title),
          employment_type: safe(EMPLOYMENT_TYPE_LABELS[row.employment_type] ?? row.employment_type),
          employment_status: safe(STATUS_LABELS[row.employment_status] ?? row.employment_status),
          org_unit_name: safe(row.org_unit_name),
          manager_name: safe(row.manager_name),
          _current: !row.valid_to,
          _valid_from_raw: row.valid_from,
          _valid_to_raw: row.valid_to ?? null,
        })),
        temporalFilter: true,
        emptyMessage: "אין משרות להצגה",
      },
      {
        id: "position_history",
        label: "היסטוריה של תפקידים",
        columns: [
          { key: "valid_from", label: "מתאריך" },
          { key: "valid_to", label: "עד תאריך" },
          { key: "position_title", label: "תפקיד" },
          { key: "manager_name", label: "מנהל" },
          { key: "employment_status", label: "סטטוס" },
          { key: "org_unit_name", label: "יחידה" },
        ],
        rows: data.position_history.map((row) => ({
          valid_from: formatDate(row.valid_from),
          valid_to: formatDate(row.valid_to),
          position_title: safe(row.position_title),
          manager_name: safe(row.manager_name),
          employment_status: safe(STATUS_LABELS[row.employment_status ?? ""] ?? row.employment_status),
          org_unit_name: safe(row.org_unit_name),
          _current: !row.valid_to,
          _valid_from_raw: row.valid_from,
          _valid_to_raw: row.valid_to ?? null,
        })),
        temporalFilter: true,
        emptyMessage: "אין היסטוריית תפקידים להצגה",
      },
      {
        id: "team",
        label: "אנשים בצוות",
        columns: [
          { key: "employee_number", label: "מספר עובד" },
          { key: "full_name", label: "שם מלא" },
          { key: "position_title", label: "תפקיד" },
          { key: "org_unit_name", label: "יחידה" },
          { key: "employment_status", label: "סטטוס" },
          { key: "start_date", label: "תחילת העסקה" },
          { key: "open", label: "כרטיס" },
        ],
        rows: data.team_members.map((row) => ({
          employee_number: row.employee_number,
          full_name: row.full_name,
          position_title: safe(row.position_title),
          org_unit_name: safe(row.org_unit_name),
          employment_status: safe(STATUS_LABELS[row.employment_status ?? ""] ?? row.employment_status),
          start_date: formatDate(row.start_date),
          open: (
            <Link href={`/admin/core/${row.employee_id}`} className="text-brand-600 hover:underline">
              פתח כרטיס
            </Link>
          ),
        })),
        emptyMessage: "אין עובדים שמדווחים לעובד זה",
      },
      {
        id: "documents",
        label: "מסמכים",
        columns: [
          { key: "valid_from", label: "מתאריך" },
          { key: "valid_to", label: "עד תאריך" },
          { key: "document_type", label: "סוג מסמך" },
          { key: "file_name", label: "שם קובץ", width: "min-w-[220px]" },
          { key: "status", label: "סטטוס" },
          { key: "issued_on", label: "הונפק" },
          { key: "expires_on", label: "בתוקף עד" },
          { key: "notes", label: "הערות", width: "min-w-[220px]" },
        ],
        rows: sortTemporalRows(data.documents).map((row) => ({
          valid_from: formatDate(row.valid_from),
          valid_to: formatDate(row.valid_to),
          document_type: row.document_type,
          file_name: row.storage_path ? `${row.file_name} (${row.storage_path})` : row.file_name,
          status: safe(row.status),
          issued_on: formatDate(row.issued_on),
          expires_on: formatDate(row.expires_on),
          notes: safe(row.notes),
          _current: !row.valid_to,
          _valid_from_raw: row.valid_from ?? null,
          _valid_to_raw: row.valid_to ?? null,
        })),
        temporalFilter: true,
        onAddClick: () => openModal({ kind: "document", title: "הוספת מסמך", form: buildDocumentForm(), isNew: true }),
        onRowDoubleClick: (rowIndex) => {
          const row = sortTemporalRows(data.documents)[rowIndex];
          if (!row) return;
          openModal({ kind: "document", title: "עריכת מסמך", form: buildDocumentForm(row), recordId: row.id, isNew: false });
        },
        emptyMessage: "אין מסמכים להצגה",
      },
      {
        id: "timeline",
        label: "טיימליין",
        columns: [
          { key: "effective_date", label: "תאריך" },
          { key: "event_type", label: "אירוע" },
          { key: "notes", label: "הערות", width: "min-w-[220px]" },
          { key: "payload", label: "פירוט", width: "min-w-[260px]" },
          { key: "created_at", label: "נוצר" },
        ],
        rows: (data.timeline ?? []).map((row) => ({
          effective_date: formatDate(row.effective_date),
          event_type: safe(EVENT_LABELS[row.event_type] ?? row.event_type),
          notes: safe(row.notes),
          payload: summarizePayload(row.payload_json),
          created_at: formatDate(row.created_at),
        })),
        emptyMessage: "אין אירועים להצגה",
      },
      {
        id: "awards",
        label: "אותות הוקרה לעובד",
        columns: [
          { key: "award_date", label: "תאריך" },
          { key: "award_type", label: "סוג הוקרה" },
          { key: "granted_by", label: "ניתן על ידי" },
          { key: "description", label: "תיאור", width: "min-w-[220px]" },
        ],
        rows: [...data.awards]
          .sort((a, b) => new Date(b.award_date ?? "").getTime() - new Date(a.award_date ?? "").getTime())
          .map((row) => ({
            award_date: formatDate(row.award_date),
            award_type: row.award_type,
            granted_by: safe(row.granted_by),
            description: safe(row.description),
          })),
        onAddClick: () => openModal({ kind: "award", title: "הוספת אות הוקרה", form: buildAwardForm(), isNew: true }),
        onRowDoubleClick: (rowIndex) => {
          const row = [...data.awards].sort((a, b) => new Date(b.award_date ?? "").getTime() - new Date(a.award_date ?? "").getTime())[rowIndex];
          if (!row) return;
          openModal({ kind: "award", title: "עריכת אות הוקרה", form: buildAwardForm(row), recordId: row.id, isNew: false });
        },
        emptyMessage: "אין אותות הוקרה להצגה",
      },
      {
        id: "certifications",
        label: "הסמכות",
        columns: [
          { key: "valid_from", label: "מתאריך" },
          { key: "valid_to", label: "עד תאריך" },
          { key: "certification_type", label: "הסמכה" },
          { key: "issuer", label: "מנפיק" },
          { key: "status", label: "סטטוס" },
        ],
        rows: sortTemporalRows(data.certifications).map((row) => ({
          valid_from: formatDate(row.valid_from),
          valid_to: formatDate(row.valid_to),
          certification_type: row.certification_type,
          issuer: safe(row.issuer),
          status: safe(row.status),
          _current: !row.valid_to,
          _valid_from_raw: row.valid_from,
          _valid_to_raw: row.valid_to ?? null,
        })),
        temporalFilter: true,
        onAddClick: () => openModal({ kind: "certification", title: "הוספת הסמכה", form: buildCertificationForm(), isNew: true }),
        onRowDoubleClick: (rowIndex) => {
          const row = sortTemporalRows(data.certifications)[rowIndex];
          if (!row) return;
          openModal({ kind: "certification", title: "עריכת הסמכה", form: buildCertificationForm(row), recordId: row.id, isNew: false });
        },
        emptyMessage: "אין הסמכות להצגה",
      },
      {
        id: "courses",
        label: "קורסים",
        columns: [
          { key: "valid_from", label: "מתאריך" },
          { key: "valid_to", label: "עד תאריך" },
          { key: "course_name", label: "קורס" },
          { key: "provider", label: "ספק" },
          { key: "status", label: "סטטוס" },
        ],
        rows: sortTemporalRows(data.courses).map((row) => ({
          valid_from: formatDate(row.valid_from),
          valid_to: formatDate(row.valid_to),
          course_name: row.course_name,
          provider: safe(row.provider),
          status: safe(row.status),
          _current: !row.valid_to,
          _valid_from_raw: row.valid_from,
          _valid_to_raw: row.valid_to ?? null,
        })),
        temporalFilter: true,
        onAddClick: () => openModal({ kind: "course", title: "הוספת קורס", form: buildCourseForm(), isNew: true }),
        onRowDoubleClick: (rowIndex) => {
          const row = sortTemporalRows(data.courses)[rowIndex];
          if (!row) return;
          openModal({ kind: "course", title: "עריכת קורס", form: buildCourseForm(row), recordId: row.id, isNew: false });
        },
        emptyMessage: "אין קורסים להצגה",
      },
      {
        id: "skills",
        label: "כישורים",
        columns: [
          { key: "skill_name", label: "כישור" },
          { key: "level", label: "רמה" },
          { key: "category", label: "קטגוריה" },
          { key: "source", label: "מקור" },
          { key: "assessed_on", label: "נבדק בתאריך" },
        ],
        rows: data.skills.map((row) => ({
          skill_name: row.skill_name,
          level: safe(row.level),
          category: safe(row.category),
          source: safe(row.source),
          assessed_on: formatDate(row.assessed_on),
        })),
        onAddClick: () => openModal({ kind: "skill", title: "הוספת כישור", form: buildSkillForm(), isNew: true }),
        onRowDoubleClick: (rowIndex) => {
          const row = data.skills[rowIndex];
          if (!row) return;
          openModal({ kind: "skill", title: "עריכת כישור", form: buildSkillForm(row), recordId: row.id, isNew: false });
        },
        emptyMessage: "אין כישורים להצגה",
      },
      {
        id: "breaks",
        label: "הפסקות עבודה",
        columns: [
          { key: "valid_from", label: "מתאריך" },
          { key: "valid_to", label: "עד תאריך" },
          { key: "break_type", label: "סוג הפסקה" },
          { key: "approved_by", label: "אושר על ידי" },
          { key: "started_on", label: "תחילת הפסקה" },
        ],
        rows: sortTemporalRows(data.work_breaks).map((row) => ({
          valid_from: formatDate(row.valid_from),
          valid_to: formatDate(row.valid_to),
          break_type: row.break_type,
          approved_by: safe(row.approved_by),
          started_on: formatDate(row.started_on),
          _current: !row.valid_to,
          _valid_from_raw: row.valid_from,
          _valid_to_raw: row.valid_to ?? null,
        })),
        temporalFilter: true,
        onAddClick: () => openModal({ kind: "work_break", title: "הוספת הפסקת עבודה", form: buildWorkBreakForm(), isNew: true }),
        onRowDoubleClick: (rowIndex) => {
          const row = sortTemporalRows(data.work_breaks)[rowIndex];
          if (!row) return;
          openModal({ kind: "work_break", title: "עריכת הפסקת עבודה", form: buildWorkBreakForm(row), recordId: row.id, isNew: false });
        },
        emptyMessage: "אין הפסקות עבודה להצגה",
      },
    ];
  }, [data]);

  const currentStatus = data?.current_employment?.employment_status ?? data?.employee.employment_status ?? "";

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gray-100">
      <main className="flex-1 overflow-hidden">
        <CardPage
          title="כרטיס עובד"
          backHref="/admin/core"
          backLabel="CORE עובדים וארגון"
          status={
            data
              ? {
                  label: STATUS_LABELS[currentStatus] ?? currentStatus ?? "—",
                  type: STATUS_TYPES[currentStatus] ?? "trial",
                }
              : undefined
          }
          parentContent={data ? <ParentSummary data={data} /> : undefined}
          formTabs={formTabs}
          childTabs={childTabs}
          loading={loading}
        />
        {error && !loading ? (
          <div className="pointer-events-none absolute inset-x-4 top-24 z-20 mx-auto max-w-4xl">
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
              {error}
            </div>
          </div>
        ) : null}
        {saving ? (
          <div className="pointer-events-none fixed inset-0 z-40 bg-black/10">
            <div className="absolute left-1/2 top-8 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-xs font-medium text-slate-600 shadow">
              שומר...
            </div>
          </div>
        ) : null}
      </main>

      {modal?.kind === "identity" ? (
        <TemporalRecordModal
          state={modal}
          fields={hasSensitiveAccess ? identityFields : identityFields.filter((field) => !["legal_id_number", "spouse_legal_id"].includes(field.name))}
          onClose={closeModal}
          onChange={updateModalField}
          onSubmit={submitModal}
        />
      ) : null}

      {modal?.kind === "employment" ? (
        <TemporalRecordModal
          state={modal}
          fields={employmentFields}
          onClose={closeModal}
          onChange={updateModalField}
          onSubmit={submitModal}
        />
      ) : null}

      {modal?.kind === "compensation" ? (
        <TemporalRecordModal
          state={modal}
          fields={compensationFields}
          onClose={closeModal}
          onChange={updateModalField}
          onSubmit={submitModal}
          warning="נתוני שכר נשמרים היסטורית ונגישים רק לבעלי הרשאה מתאימה."
        />
      ) : null}

      {modal?.kind === "document" ? (
        <TemporalRecordModal
          state={modal}
          fields={documentFields}
          onClose={closeModal}
          onChange={updateModalField}
          onSubmit={submitModal}
        />
      ) : null}

      {modal?.kind === "bank" ? (
        <TemporalRecordModal
          state={modal}
          fields={bankFields}
          onClose={closeModal}
          onChange={updateModalField}
          onSubmit={submitModal}
          warning="פרטי חשבון בנק הם מידע רגיש."
        />
      ) : null}

      {modal?.kind === "certification" ? (
        <TemporalRecordModal
          state={modal}
          fields={certificationFields}
          onClose={closeModal}
          onChange={updateModalField}
          onSubmit={submitModal}
        />
      ) : null}

      {modal?.kind === "course" ? (
        <TemporalRecordModal
          state={modal}
          fields={courseFields}
          onClose={closeModal}
          onChange={updateModalField}
          onSubmit={submitModal}
        />
      ) : null}

      {modal?.kind === "work_break" ? (
        <TemporalRecordModal
          state={modal}
          fields={workBreakFields}
          onClose={closeModal}
          onChange={updateModalField}
          onSubmit={submitModal}
        />
      ) : null}

      {modal?.kind === "child" ? (
        <CrudRecordModal
          state={modal}
          fields={childFields}
          onClose={closeModal}
          onChange={updateModalField}
          onSave={() => submitModal()}
          onDelete={!modal.isNew ? deleteModalRecord : undefined}
        />
      ) : null}

      {modal?.kind === "award" ? (
        <CrudRecordModal
          state={modal}
          fields={awardFields}
          onClose={closeModal}
          onChange={updateModalField}
          onSave={() => submitModal()}
          onDelete={!modal.isNew ? deleteModalRecord : undefined}
        />
      ) : null}

      {modal?.kind === "skill" ? (
        <CrudRecordModal
          state={modal}
          fields={skillFields}
          onClose={closeModal}
          onChange={updateModalField}
          onSave={() => submitModal()}
          onDelete={!modal.isNew ? deleteModalRecord : undefined}
        />
      ) : null}
    </div>
  );
}
