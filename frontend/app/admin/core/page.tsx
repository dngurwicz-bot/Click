"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, isLoggedIn } from "@/lib/api";
import {
  AdminActionBar,
  AdminCountLabel,
  AdminSearchField,
  AdminStatusBar,
  AdminTitleBar,
} from "@/components/layout/AdminShell";
import { useWorkspace } from "@/components/layout/WorkspaceShell";
import { HebrewDatePicker } from "@/components/ui/HebrewDatePicker";
import {
  AdminModal,
  AdminModalBody,
  AdminModalFooter,
  AdminModalHeader,
  AdminModalMessage,
  AdminModalPanel,
  ADMIN_MODAL_ACTION_PRIMARY,
  ADMIN_MODAL_ACTION_SECONDARY,
  ADMIN_MODAL_DATE_INPUT,
  ADMIN_MODAL_INPUT,
} from "@/components/ui/AdminModal";
import { TemporalFilterBar } from "@/components/ui/TemporalFilterBar";
import {
  createDefaultTemporalFilterState,
  getTemporalFilterError,
  overlapsTemporalFilter,
  type TemporalFilterState,
} from "@/lib/temporalFilter";
import { FolderTree, Plus, ShieldCheck } from "lucide-react";

interface EmployeeListItem {
  id: string;
  tenant_id: string;
  employee_number: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  employment_status?: string | null;
  employment_type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  org_unit_name?: string | null;
  manager_name?: string | null;
  position_title?: string | null;
  branch_name?: string | null;
  work_site?: string | null;
}

interface EmployeeCreatePayload {
  tenant_id: string;
  employee_number: string;
  external_ref?: string | null;
  identity: {
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
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    postal_code?: string | null;
    country?: string | null;
    bank_name?: string | null;
    bank_branch?: string | null;
    bank_account?: string | null;
  };
  employment: {
    employment_status: string;
    employment_type: string;
    salary_type: string;
    start_date: string;
    employment_scope_pct: number;
    branch_name?: string | null;
    work_site?: string | null;
    time_clock_id?: string | null;
    notes?: string | null;
  };
  compensation?: {
    base_salary: number;
    currency: string;
    pay_cycle: string;
    cost_center?: string | null;
  };
}

function statusLabel(value?: string | null): string {
  switch (value) {
    case "active":
      return "פעיל";
    case "leave_of_absence":
      return "חל\"ת";
    case "unpaid_leave":
      return "חופשה ללא תשלום";
    case "terminated":
      return "סיום העסקה";
    case "future":
      return "עתידי";
    case "suspended":
      return "מושהה";
    default:
      return value || "—";
  }
}

function employmentTypeLabel(value?: string | null): string {
  switch (value) {
    case "employee":
      return "עובד";
    case "contractor":
      return "קבלן";
    case "temporary":
      return "זמני";
    case "intern":
      return "מתמחה";
    case "consultant":
      return "יועץ";
    default:
      return value || "—";
  }
}

function statusBadgeClass(value?: string | null): string {
  switch (value) {
    case "active":
      return "bg-emerald-50 text-emerald-700";
    case "future":
      return "bg-sky-50 text-sky-700";
    case "leave_of_absence":
    case "unpaid_leave":
      return "bg-amber-50 text-amber-700";
    case "terminated":
      return "bg-red-50 text-red-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function CreateEmployeeModal({
  tenantId,
  onClose,
  onSaved,
}: {
  tenantId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<EmployeeCreatePayload>({
    tenant_id: tenantId,
    employee_number: "",
    external_ref: "",
    identity: {
      first_name: "",
      last_name: "",
      preferred_name: "",
      email: "",
      phone: "",
      birth_date: "",
      immigration_date: "",
      gender: "",
      marital_status: "",
      children_count: null,
      spouse_name: "",
      spouse_legal_id: "",
      legal_id_type: "national_id",
      legal_id_number: "",
      address_line1: "",
      address_line2: "",
      city: "",
      postal_code: "",
      country: "IL",
      bank_name: "",
      bank_branch: "",
      bank_account: "",
    },
    employment: {
      employment_status: "active",
      employment_type: "employee",
      salary_type: "monthly",
      start_date: new Date().toISOString().slice(0, 10),
      employment_scope_pct: 100,
      branch_name: "",
      work_site: "",
      time_clock_id: "",
      notes: "",
    },
    compensation: {
      base_salary: 0,
      currency: "ILS",
      pay_cycle: "monthly",
      cost_center: "",
    },
  });

  function updateIdentity<K extends keyof EmployeeCreatePayload["identity"]>(key: K, value: EmployeeCreatePayload["identity"][K]) {
    setForm((current) => ({ ...current, identity: { ...current.identity, [key]: value } }));
  }

  function updateEmployment<K extends keyof EmployeeCreatePayload["employment"]>(key: K, value: EmployeeCreatePayload["employment"][K]) {
    setForm((current) => ({ ...current, employment: { ...current.employment, [key]: value } }));
  }

  function updateCompensation<K extends keyof NonNullable<EmployeeCreatePayload["compensation"]>>(key: K, value: NonNullable<EmployeeCreatePayload["compensation"]>[K]) {
    setForm((current) => ({
      ...current,
      compensation: { ...(current.compensation ?? { base_salary: 0, currency: "ILS", pay_cycle: "monthly" }), [key]: value },
    }));
  }

  async function handleSave() {
    if (!form.employee_number.trim() || !form.identity.first_name.trim() || !form.identity.last_name.trim()) {
      setError("מספר עובד, שם פרטי ושם משפחה הם שדות חובה");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: EmployeeCreatePayload = {
        ...form,
        identity: {
          ...form.identity,
          birth_date: form.identity.birth_date || null,
          immigration_date: form.identity.immigration_date || null,
          gender: form.identity.gender || null,
          marital_status: form.identity.marital_status || null,
          spouse_name: form.identity.spouse_name || null,
          spouse_legal_id: form.identity.spouse_legal_id || null,
          address_line1: form.identity.address_line1 || null,
          address_line2: form.identity.address_line2 || null,
          postal_code: form.identity.postal_code || null,
          legal_id_number: form.identity.legal_id_number || null,
          bank_name: form.identity.bank_name || null,
          bank_branch: form.identity.bank_branch || null,
          bank_account: form.identity.bank_account || null,
        },
        employment: {
          ...form.employment,
          branch_name: form.employment.branch_name || null,
          work_site: form.employment.work_site || null,
          time_clock_id: form.employment.time_clock_id || null,
          notes: form.employment.notes || null,
        },
      };
      await api.post("/api/core/employees", payload);
      onSaved();
    } catch (err: unknown) {
      const message =
        (err as { message?: string })?.message ||
        (err as { details?: { error?: string } })?.details?.error ||
        "לא ניתן לשמור את העובד";
      setError(message);
      setSaving(false);
    }
  }

  const inputCls = ADMIN_MODAL_INPUT;
  const dateCls = ADMIN_MODAL_DATE_INPUT;

  return (
    <AdminModal onBackdropClick={onClose}>
      <AdminModalPanel className="relative flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
        <AdminModalHeader
          title={
            <span className="flex items-center gap-2 text-[#1a3a6e]">
              <span className="rounded-xl bg-white/60 p-2 text-brand-600"><ShieldCheck size={16} /></span>
              <span>קליטת עובד חדש</span>
            </span>
          }
          onClose={onClose}
        />
        <AdminModalBody className="grid flex-1 gap-5 overflow-y-auto px-6 py-5 md:grid-cols-2">
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">פרטים כלליים</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <input className={inputCls} placeholder="מספר עובד" value={form.employee_number} onChange={(e) => setForm((c) => ({ ...c, employee_number: e.target.value }))} />
              <input className={inputCls} placeholder="מספר חיצוני" value={form.external_ref ?? ""} onChange={(e) => setForm((c) => ({ ...c, external_ref: e.target.value }))} />
              <input className={inputCls} placeholder="שם פרטי" value={form.identity.first_name} onChange={(e) => updateIdentity("first_name", e.target.value)} />
              <input className={inputCls} placeholder="שם משפחה" value={form.identity.last_name} onChange={(e) => updateIdentity("last_name", e.target.value)} />
              <input className={inputCls} placeholder="שם מועדף" value={form.identity.preferred_name ?? ""} onChange={(e) => updateIdentity("preferred_name", e.target.value)} />
              <select className={inputCls} value={form.identity.legal_id_type} onChange={(e) => updateIdentity("legal_id_type", e.target.value)}>
                <option value="national_id">תעודת זהות</option>
                <option value="passport">דרכון</option>
                <option value="resident">תושב</option>
                <option value="other">אחר</option>
              </select>
              <input className={inputCls} placeholder="מספר מזהה" value={form.identity.legal_id_number ?? ""} onChange={(e) => updateIdentity("legal_id_number", e.target.value)} />
              <select className={inputCls} value={form.identity.gender ?? ""} onChange={(e) => updateIdentity("gender", e.target.value)}>
                <option value="">מגדר</option>
                <option value="female">נקבה</option>
                <option value="male">זכר</option>
                <option value="other">אחר</option>
              </select>
              <HebrewDatePicker className={dateCls} value={form.identity.birth_date ?? ""} onChange={(value) => updateIdentity("birth_date", value)} />
            </div>
            <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">כתובת וטלפון</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <input className={inputCls} placeholder="דוא״ל" value={form.identity.email ?? ""} onChange={(e) => updateIdentity("email", e.target.value)} />
              <input className={inputCls} placeholder="טלפון" value={form.identity.phone ?? ""} onChange={(e) => updateIdentity("phone", e.target.value)} />
              <input className={inputCls} placeholder="כתובת" value={form.identity.address_line1 ?? ""} onChange={(e) => updateIdentity("address_line1", e.target.value)} />
              <input className={inputCls} placeholder="כתובת 2" value={form.identity.address_line2 ?? ""} onChange={(e) => updateIdentity("address_line2", e.target.value)} />
              <input className={inputCls} placeholder="עיר" value={form.identity.city ?? ""} onChange={(e) => updateIdentity("city", e.target.value)} />
              <input className={inputCls} placeholder="מיקוד" value={form.identity.postal_code ?? ""} onChange={(e) => updateIdentity("postal_code", e.target.value)} />
            </div>
          </section>
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">פרטים אישיים וחברה נוכחית</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <HebrewDatePicker className={dateCls} value={form.employment.start_date} onChange={(value) => updateEmployment("start_date", value)} />
              <select className={inputCls} value={form.employment.employment_status} onChange={(e) => updateEmployment("employment_status", e.target.value)}>
                <option value="active">פעיל</option>
                <option value="future">עתידי</option>
              </select>
              <select className={inputCls} value={form.employment.employment_type} onChange={(e) => updateEmployment("employment_type", e.target.value)}>
                <option value="employee">עובד</option>
                <option value="temporary">זמני</option>
                <option value="contractor">קבלן</option>
                <option value="intern">מתמחה</option>
                <option value="consultant">יועץ</option>
              </select>
              <select className={inputCls} value={form.employment.salary_type} onChange={(e) => updateEmployment("salary_type", e.target.value)}>
                <option value="monthly">חודשי</option>
                <option value="hourly">שעתי</option>
                <option value="daily">יומי</option>
                <option value="global">גלובלי</option>
              </select>
              <select className={inputCls} value={form.identity.marital_status ?? ""} onChange={(e) => updateIdentity("marital_status", e.target.value)}>
                <option value="">מצב משפחתי</option>
                <option value="single">רווק/ה</option>
                <option value="married">נשוי/אה</option>
                <option value="divorced">גרוש/ה</option>
                <option value="widowed">אלמן/ה</option>
                <option value="other">אחר</option>
              </select>
              <HebrewDatePicker className={dateCls} value={form.identity.immigration_date ?? ""} onChange={(value) => updateIdentity("immigration_date", value)} />
              <input className={inputCls} type="number" min={0} placeholder="מספר ילדים" value={form.identity.children_count ?? ""} onChange={(e) => updateIdentity("children_count", e.target.value ? Number(e.target.value) : null)} />
              <input className={inputCls} placeholder="שם בן/בת זוג" value={form.identity.spouse_name ?? ""} onChange={(e) => updateIdentity("spouse_name", e.target.value)} />
              <input className={inputCls} placeholder="ת.ז בן/בת זוג" value={form.identity.spouse_legal_id ?? ""} onChange={(e) => updateIdentity("spouse_legal_id", e.target.value)} />
              <input className={inputCls} type="number" min={0} max={100} placeholder="אחוז משרה" value={form.employment.employment_scope_pct} onChange={(e) => updateEmployment("employment_scope_pct", Number(e.target.value))} />
              <input className={inputCls} placeholder="סניף" value={form.employment.branch_name ?? ""} onChange={(e) => updateEmployment("branch_name", e.target.value)} />
              <input className={inputCls} placeholder="אתר עבודה" value={form.employment.work_site ?? ""} onChange={(e) => updateEmployment("work_site", e.target.value)} />
              <input className={inputCls} placeholder="מספר כרטיס מגנטי" value={form.employment.time_clock_id ?? ""} onChange={(e) => updateEmployment("time_clock_id", e.target.value)} />
            </div>
            <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">שכר ובנק</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <input className={inputCls} type="number" min={0} placeholder="שכר בסיס" value={form.compensation?.base_salary ?? 0} onChange={(e) => updateCompensation("base_salary", Number(e.target.value))} />
              <input className={inputCls} placeholder="מרכז עלות" value={form.compensation?.cost_center ?? ""} onChange={(e) => updateCompensation("cost_center", e.target.value)} />
              <input className={inputCls} placeholder="בנק" value={form.identity.bank_name ?? ""} onChange={(e) => updateIdentity("bank_name", e.target.value)} />
              <input className={inputCls} placeholder="סניף בנק" value={form.identity.bank_branch ?? ""} onChange={(e) => updateIdentity("bank_branch", e.target.value)} />
              <input className={inputCls} placeholder="חשבון בנק" value={form.identity.bank_account ?? ""} onChange={(e) => updateIdentity("bank_account", e.target.value)} />
            </div>
          </section>
          {error ? <AdminModalMessage tone="danger" className="md:col-span-2">{error}</AdminModalMessage> : null}
        </AdminModalBody>
        <AdminModalFooter className="px-6">
          <button onClick={onClose} className={ADMIN_MODAL_ACTION_SECONDARY}>ביטול</button>
          <button onClick={handleSave} disabled={saving} className={ADMIN_MODAL_ACTION_PRIMARY}>
            {saving ? "שומר..." : "צור עובד"}
          </button>
        </AdminModalFooter>
      </AdminModalPanel>
    </AdminModal>
  );
}

export default function CoreEmployeesPage() {
  const router = useRouter();
  const workspace = useWorkspace();
  const tenantId = workspace?.selectedTenantId ?? "";
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [temporalFilter, setTemporalFilter] = useState<TemporalFilterState>(() => createDefaultTemporalFilterState());

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
    }
  }, [router]);

  function loadEmployees(nextTenantId: string) {
    if (!nextTenantId) return;
    setLoading(true);
    api.get<EmployeeListItem[]>(`/api/core/employees?tenant_id=${nextTenantId}`)
      .then(setEmployees)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (tenantId) loadEmployees(tenantId);
  }, [tenantId]);

  const filteredEmployees = useMemo(
    () =>
      employees.filter((row) =>
        [row.employee_number, row.full_name, row.email ?? "", row.org_unit_name ?? "", row.position_title ?? "", row.manager_name ?? "", row.branch_name ?? "", row.work_site ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())
      ),
    [employees, search]
  );
  const temporalFilterError = getTemporalFilterError(temporalFilter);
  const visibleEmployees = useMemo(
    () =>
      filteredEmployees.filter((row) =>
        temporalFilterError ||
        overlapsTemporalFilter({
          rowFrom: row.start_date,
          rowTo: row.end_date,
          filter: temporalFilter,
        })
      ),
    [filteredEmployees, temporalFilter, temporalFilterError]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <AdminTitleBar title="CORE עובדים וארגון" onRefresh={() => loadEmployees(tenantId)} />
        <AdminActionBar
          start={
            <AdminSearchField value={search} onChange={setSearch} placeholder="חיפוש עובד..." />
          }
          end={
            <div className="flex items-center gap-2">
              {!loading ? <AdminCountLabel>{visibleEmployees.length} עובדים</AdminCountLabel> : null}
              <Link
                href={tenantId ? `/admin/core/structure?tenant_id=${tenantId}` : "/admin/core/structure"}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                <FolderTree size={12} />
                מבנה ארגוני
              </Link>
              <button
                onClick={() => setShowCreate(true)}
                disabled={!tenantId}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                <Plus size={12} />
                עובד חדש
              </button>
            </div>
          }
        />
        {!loading ? (
          <TemporalFilterBar
            filter={temporalFilter}
            onChange={setTemporalFilter}
            rowRanges={employees.map((row) => ({
              valid_from: row.start_date,
              valid_to: row.end_date,
            }))}
            idPrefix="core-employees-temporal"
          />
        ) : null}
        <div className="flex-1 overflow-auto bg-white">
          {loading ? (
            <div className="flex py-20 items-center justify-center text-sm text-slate-400">טוען עובדים...</div>
          ) : visibleEmployees.length === 0 ? (
            <div className="flex py-20 items-center justify-center text-sm text-slate-400">
              {temporalFilterError ? temporalFilterError : "לא נמצאו עובדים עבור הסינון שנבחר"}
            </div>
          ) : (
            <table className="admin-data-table w-full border-collapse text-xs">
              <thead className="sticky top-0 z-10">
                <tr>
                  {["מתאריך", "עד תאריך", "מספר עובד", "שם מלא", "סטטוס", "סוג העסקה", "סניף", "אתר עבודה", "יחידה", "תפקיד", "מנהל"].map((label) => (
                    <th key={label} className="border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-right font-semibold text-slate-600">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleEmployees.map((employee, index) => (
                  <tr
                    key={employee.id}
                    onClick={() => router.push(`/admin/core/${employee.id}`)}
                    className={`cursor-pointer transition-colors ${index % 2 === 0 ? "bg-white hover:bg-brand-50/40" : "bg-slate-50/60 hover:bg-brand-50/40"}`}
                  >
                    <td className="border-b border-slate-100 px-4 py-2 text-slate-500">
                      {employee.start_date ? new Date(employee.start_date).toLocaleDateString("he-IL") : "—"}
                    </td>
                    <td className="border-b border-slate-100 px-4 py-2 text-slate-500">
                      {employee.end_date ? new Date(employee.end_date).toLocaleDateString("he-IL") : "—"}
                    </td>
                    <td className="border-b border-slate-100 px-4 py-2 text-slate-700">{employee.employee_number}</td>
                    <td className="border-b border-slate-100 px-4 py-2 font-medium text-slate-800">{employee.full_name}</td>
                    <td className="border-b border-slate-100 px-4 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(employee.employment_status)}`}>
                        {statusLabel(employee.employment_status)}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-4 py-2 text-slate-600">{employmentTypeLabel(employee.employment_type)}</td>
                    <td className="border-b border-slate-100 px-4 py-2 text-slate-600">{employee.branch_name || "—"}</td>
                    <td className="border-b border-slate-100 px-4 py-2 text-slate-600">{employee.work_site || "—"}</td>
                    <td className="border-b border-slate-100 px-4 py-2 text-slate-600">{employee.org_unit_name || "—"}</td>
                    <td className="border-b border-slate-100 px-4 py-2 text-slate-600">{employee.position_title || "—"}</td>
                    <td className="border-b border-slate-100 px-4 py-2 text-slate-600">{employee.manager_name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {!loading ? <AdminStatusBar total={visibleEmployees.length} label="עובדים" /> : null}
      </main>
      {showCreate && tenantId ? (
        <CreateEmployeeModal
          tenantId={tenantId}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            loadEmployees(tenantId);
          }}
        />
      ) : null}
    </div>
  );
}
