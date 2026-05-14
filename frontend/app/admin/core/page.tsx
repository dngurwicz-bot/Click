"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, api } from "@/lib/api";
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
  employee_number: number;
  full_name: string;
  id_number: string | null;
  status: string;
  created_at: string;
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
  onClose: () => void;
  onCreated: (id: string) => void;
}

function NewEmployeeModal({ tenantId, onClose, onCreated }: NewEmployeeModalProps) {
  const [form, setForm] = useState({ first_name: "", last_name: "", id_number: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!form.first_name.trim() || !form.last_name.trim()) return;
    setSaving(true); setError(null);
    try {
      const res = await api.post<{ id: string; employee_number: number }>(
        `/api/core/employees?tenant_id=${tenantId}`,
        { first_name: form.first_name.trim(), last_name: form.last_name.trim(), id_number: form.id_number.trim() || undefined }
      );
      onCreated(res.id);
    } catch (err: unknown) {
      const e = err as { error?: string; details?: { error?: string } };
      setError(e?.error ?? e?.details?.error ?? "שגיאה ביצירת עובד");
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
          <FormField label="ת.ז." value={form.id_number} readOnly={false} onChange={(v) => set("id_number", v)} />
        </AdminModalBody>
        <AdminModalFooter>
          <button onClick={handleSave} disabled={saving || !form.first_name || !form.last_name} className={ADMIN_MODAL_ACTION_PRIMARY}>
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

  function loadEmployees() {
    if (!tenantId) return;
    setLoading(true);
    api.get<EmployeeListItem[]>(`/api/core/employees?tenant_id=${tenantId}`)
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
                    onDoubleClick={() => router.push(`/admin/core/${e.id}`)}
                    onClick={() => router.push(`/admin/core/${e.id}`)}
                  >
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-500 font-mono">{e.employee_number}</td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-800 font-medium">{e.full_name}</td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-600">{e.id_number ?? "—"}</td>
                    <td className="px-4 py-2 border-b border-slate-100"><StatusBadge status={e.status} /></td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-500">
                      {new Date(e.created_at).toLocaleDateString("he-IL")}
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
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setShowNew(false);
            router.push(`/admin/core/${id}`);
          }}
        />
      )}
    </div>
  );
}
