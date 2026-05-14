"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiRequestError, isLoggedIn, api } from "@/lib/api";
import { useWorkspace } from "@/components/layout/WorkspaceShell";
import { AdminActionBar, AdminCountLabel, AdminSearchField, AdminStatusBar, AdminTitleBar } from "@/components/layout/AdminShell";
import { Plus } from "lucide-react";
import {
  AdminModal,
  AdminModalBody,
  AdminModalFooter,
  AdminModalHeader,
  AdminModalMessage,
  AdminModalPanel,
  ADMIN_MODAL_ACTION_PRIMARY,
  ADMIN_MODAL_ACTION_SECONDARY,
  ADMIN_MODAL_INPUT,
} from "@/components/ui/AdminModal";
import { FormField } from "@/components/ui/FormField";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmployeeListItem {
  id: string;
  employee_number: string;
  full_name: string;
  id_number: string | null;
  status: string;
  created_at: string;
}

interface LegacyEmployeeListItem {
  id: string;
  employee_number: string;
  full_name: string;
  is_active?: boolean;
  created_at?: string;
}

interface EmployeeDetailIdentityFallback {
  id_number?: string | null;
  legal_id_number?: string | null;
}

interface EmployeeDetailFallback {
  id_number?: string | null;
  current_identity?: EmployeeDetailIdentityFallback | null;
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  active:     { label: "פעיל",    dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50" },
  inactive:   { label: "לא פעיל", dot: "bg-amber-400",   text: "text-amber-700",   bg: "bg-amber-50"   },
  terminated: { label: "מסיים",   dot: "bg-red-400",     text: "text-red-700",     bg: "bg-red-50"     },
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CFG[status] ?? { label: status, dot: "bg-slate-400", text: "text-slate-500", bg: "bg-slate-100" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

// ── New Employee Modal ────────────────────────────────────────────────────────

interface NewEmployeeModalProps {
  tenantId: string;
  employees: EmployeeListItem[];
  onClose: () => void;
  onCreated: (id: string) => void;
}

function NewEmployeeModal({ tenantId, employees, onClose, onCreated }: NewEmployeeModalProps) {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    id_number: "",
    employee_number_mode: "candidate" as "candidate" | "manual",
    employee_number: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }
  function digitsOnly(value: string) { return value.replace(/\D/g, "").slice(0, 9); }
  function todayIso() { return new Date().toISOString().slice(0, 10); }
  function getAutoEmployeeNumber() {
    const next = employees
      .map((employee) => Number.parseInt(employee.employee_number, 10))
      .filter((value) => Number.isFinite(value))
      .reduce((max, value) => Math.max(max, value), 0) + 1;
    return String(next).slice(0, 9);
  }
  function getUiError(err: unknown) {
    if (err instanceof ApiRequestError) {
      if (err.code === "EMPLOYEE_NUMBER_EXISTS") return "מספר עובד כבר קיים בארגון";
      if (err.code === "ID_NUMBER_EXISTS") return "תעודת זהות כבר קיימת בארגון";
      if (err.code === "BAD_EMPLOYEE_NUMBER") return "מספר עובד לא יכול להכיל יותר מ-9 ספרות";
      return err.error ?? err.message ?? "שגיאה ביצירת עובד";
    }
    if (err instanceof Error) return err.message;
    return "שגיאה ביצירת עובד";
  }
  function isLegacyCreateValidation(err: unknown) {
    if (!(err instanceof ApiRequestError) || err.status !== 422 || !Array.isArray(err.details)) return false;
    const locations = err.details
      .map((item) => (item && typeof item === "object" ? (item as { loc?: unknown }).loc : null))
      .filter((loc): loc is unknown[] => Array.isArray(loc))
      .map((loc) => loc.join("."));
    return ["body.tenant_id", "body.identity", "body.employment"].every((key) => locations.includes(key));
  }
  function buildLegacyPayload() {
    const employeeNumber = form.employee_number_mode === "manual" ? form.employee_number.trim() : getAutoEmployeeNumber();
    const currentDate = todayIso();
    return {
      tenant_id: tenantId,
      employee_number: employeeNumber,
      identity: {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        legal_id_type: "national_id",
        legal_id_number: form.id_number.trim(),
        valid_from: currentDate,
      },
      employment: {
        start_date: currentDate,
        employment_status: "active",
        employment_type: "employee",
        salary_type: "monthly",
        employment_scope_pct: 100,
        valid_from: currentDate,
      },
      documents: [],
    };
  }

  async function handleSave() {
    if (
      !form.first_name.trim() ||
      !form.last_name.trim() ||
      !form.id_number.trim() ||
      (form.employee_number_mode === "manual" && !form.employee_number.trim())
    ) {
      setError("יש למלא את כל שדות החובה");
      return;
    }
    if (employees.some((employee) => employee.id_number === form.id_number.trim())) {
      setError("תעודת זהות כבר קיימת בארגון");
      return;
    }
    if (
      form.employee_number_mode === "manual" &&
      employees.some((employee) => employee.employee_number === form.employee_number.trim())
    ) {
      setError("מספר עובד כבר קיים בארגון");
      return;
    }
    setSaving(true); setError(null);
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        id_number: form.id_number.trim(),
        employee_number_mode: form.employee_number_mode,
        employee_number: form.employee_number_mode === "manual" ? form.employee_number.trim() : undefined,
      };
      let res: { id: string; employee_number: string };
      try {
        res = await api.post<{ id: string; employee_number: string }>(
          `/api/core/employees?tenant_id=${tenantId}`,
          payload
        );
      } catch (err: unknown) {
        if (!isLegacyCreateValidation(err)) throw err;
        res = await api.post<{ id: string; employee_number: string }>(
          `/api/core/employees?tenant_id=${tenantId}`,
          buildLegacyPayload()
        );
      }
      onCreated(res.id);
    } catch (err: unknown) {
      setError(getUiError(err));
    } finally { setSaving(false); }
  }

  return (
    <AdminModal onBackdropClick={onClose}>
      <AdminModalPanel className="max-w-sm">
        <AdminModalHeader title="עובד חדש" onClose={onClose} />
        <AdminModalBody className="space-y-3">
          {error && <AdminModalMessage tone="danger">{error}</AdminModalMessage>}
          <FormField label="שם פרטי" required value={form.first_name} readOnly={false} onChange={(v) => set("first_name", v)} />
          <FormField label="שם משפחה" required value={form.last_name} readOnly={false} onChange={(v) => set("last_name", v)} />
          <FormField label="ת.ז." required value={form.id_number} readOnly={false} onChange={(v) => set("id_number", digitsOnly(v))} />
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700">
              <span className="ml-0.5 text-red-400">*</span>
              מספר עובד
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, employee_number_mode: "candidate", employee_number: "" }))}
                className={`${form.employee_number_mode === "candidate" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600"} rounded-md border px-3 py-2 text-xs font-medium`}
              >
                מועמד
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, employee_number_mode: "manual" }))}
                className={`${form.employee_number_mode === "manual" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600"} rounded-md border px-3 py-2 text-xs font-medium`}
              >
                מספר ידני
              </button>
            </div>
            {form.employee_number_mode === "manual" ? (
              <FormField
                label="מספר עובד"
                required
                value={form.employee_number}
                readOnly={false}
                onChange={(v) => set("employee_number", digitsOnly(v))}
              />
            ) : (
              <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                לעובד במצב מועמד יוקצה מספר עובד אוטומטית בעת השמירה.
              </div>
            )}
            <div className="text-[11px] text-slate-400">עד 9 ספרות בלבד.</div>
          </div>
        </AdminModalBody>
        <AdminModalFooter>
          <button
            onClick={handleSave}
            disabled={
              saving ||
              !form.first_name.trim() ||
              !form.last_name.trim() ||
              !form.id_number.trim() ||
              (form.employee_number_mode === "manual" && !form.employee_number.trim())
            }
            className={ADMIN_MODAL_ACTION_PRIMARY}
          >
            {saving ? "יוצר..." : "צור עובד"}
          </button>
          <button onClick={onClose} className={ADMIN_MODAL_ACTION_SECONDARY}>ביטול</button>
        </AdminModalFooter>
      </AdminModalPanel>
    </AdminModal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CoreEmployeesPage() {
  const router = useRouter();
  const workspace = useWorkspace();
  const tenantId = workspace?.selectedTenantId ?? "";

  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);

  function normalizeEmployees(rows: Array<EmployeeListItem | LegacyEmployeeListItem>): EmployeeListItem[] {
    return rows.map((row) => {
      if ("status" in row) {
        return row;
      }
      return {
        id: row.id,
        employee_number: row.employee_number,
        full_name: row.full_name,
        id_number: null,
        status: row.is_active === false ? "inactive" : "active",
        created_at: row.created_at ?? "",
      };
    });
  }

  async function hydrateEmployeeIdNumbers(rows: EmployeeListItem[]) {
    const missingIdRows = rows.filter((row) => !row.id_number);
    if (missingIdRows.length === 0) return rows;

    const detailResults = await Promise.all(
      missingIdRows.map(async (row) => {
        try {
          const detail = await api.get<EmployeeDetailFallback>(`/api/core/employees/${row.id}?tenant_id=${tenantId}`);
          const idNumber = detail.id_number ?? detail.current_identity?.id_number ?? detail.current_identity?.legal_id_number ?? null;
          return [row.id, idNumber] as const;
        } catch {
          return [row.id, null] as const;
        }
      })
    );

    const idNumberByEmployeeId = new Map(detailResults);
    return rows.map((row) => ({
      ...row,
      id_number: row.id_number ?? idNumberByEmployeeId.get(row.id) ?? null,
    }));
  }

  function loadEmployees() {
    if (!tenantId) return;
    setLoading(true);
    api.get<EmployeeListItem[]>(`/api/core/employees?tenant_id=${tenantId}`)
      .then(normalizeEmployees)
      .then(hydrateEmployeeIdNumbers)
      .then(setEmployees)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
  }, [router]);

  useEffect(() => {
    if (tenantId) loadEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const filtered = employees.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.full_name.toLowerCase().includes(q) ||
      String(e.employee_number).includes(q) ||
      (e.id_number ?? "").includes(q)
    );
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
      <main className="flex-1 overflow-hidden flex flex-col">
        <AdminTitleBar title="עובדים" onRefresh={loadEmployees} />

        <AdminActionBar
          start={
            <>
              <button
                onClick={() => setShowNew(true)}
                disabled={!tenantId}
                className="flex items-center gap-1 bg-brand-600 hover:bg-brand-700 text-white
                           text-xs font-semibold px-3 py-1.5 rounded-md transition-colors shadow-sm
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={12} />
                חדש
              </button>
              <AdminSearchField value={search} onChange={setSearch} />
            </>
          }
          end={!loading && tenantId ? <AdminCountLabel>{filtered.length} עובדים</AdminCountLabel> : undefined}
        />

        <div className="flex-1 overflow-auto bg-white min-h-0">
          {!tenantId ? (
            <div className="py-20 text-center text-slate-400 text-sm">בחר ארגון כדי לראות עובדים</div>
          ) : loading ? (
            <div className="py-20 flex flex-col items-center gap-3 text-slate-400">
              <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">טוען...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-sm">
              {search ? "לא נמצאו עובדים התואמים לחיפוש" : "אין עובדים בארגון זה"}
            </div>
          ) : (
            <table className="admin-data-table w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr>
                  {["מס' עובד", "שם מלא", "ת.ז.", "סטטוס", "תאריך יצירה"].map((h) => (
                    <th key={h} className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr
                    key={e.id}
                    className={`cursor-pointer transition-colors ${i % 2 === 0 ? "bg-white hover:bg-brand-50/40" : "bg-slate-50/60 hover:bg-brand-50/40"}`}
                    onDoubleClick={() => router.push(`/admin/core/${e.id}?tenant_id=${tenantId}`)}
                    onClick={() => router.push(`/admin/core/${e.id}?tenant_id=${tenantId}`)}
                  >
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-500 font-mono">{e.employee_number}</td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-800 font-medium">{e.full_name}</td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-600">{e.id_number ?? "—"}</td>
                    <td className="px-4 py-2 border-b border-slate-100"><StatusBadge status={e.status} /></td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-500">
                      {e.created_at ? new Date(e.created_at).toLocaleDateString("he-IL") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && tenantId && (
          <AdminStatusBar total={filtered.length} label="עובדים" />
        )}
      </main>

      {showNew && tenantId && (
        <NewEmployeeModal
          tenantId={tenantId}
          employees={employees}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            loadEmployees();
          }}
        />
      )}
    </div>
  );
}
