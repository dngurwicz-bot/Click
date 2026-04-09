"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, isLoggedIn } from "@/lib/api";
import { TopNav } from "@/components/layout/TopNav";
import { AdminActionBar, AdminCountLabel, AdminSearchField, AdminStatusBar, AdminTitleBar } from "@/components/layout/AdminShell";

interface AuditLogItem {
  id: string;
  actor_id: string;
  actor_name?: string | null;
  actor_email?: string | null;
  actor_type: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  ip_address?: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  create: "יצירה",
  update: "עדכון",
  delete: "מחיקה",
};

const ENTITY_LABELS: Record<string, string> = {
  tenants: "ארגונים",
  lookups: "רשימות",
  modules: "מודולים",
  billing: "חיובים",
  invoices: "חשבוניות",
  users: "משתמשים",
  templates: "תבניות",
  audit: "Audit",
};

export default function AuditPage() {
  const router = useRouter();
  const [rows, setRows] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");

  const loadAudit = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (action) params.set("action", action);
    if (entityType) params.set("entity_type", entityType);
    params.set("limit", "200");

    api.get<AuditLogItem[]>(`/api/admin/audit?${params.toString()}`)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [action, entityType, search]);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    loadAudit();
  }, [loadAudit, router]);

  const entityOptions = useMemo(() => {
    const values = Array.from(new Set(rows.map((row) => row.entity_type))).sort();
    return values;
  }, [rows]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <TopNav />

      <main className="flex-1 overflow-hidden flex flex-col">
        <AdminTitleBar title="Audit Log" onRefresh={loadAudit} />

        <AdminActionBar
          start={<AdminSearchField value={search} onChange={setSearch} placeholder="חיפוש פעולה, ישות, שחקן..." widthClass="w-56" />}
          center={
            <div className="flex items-center gap-2">
              <select
                value={action}
                onChange={(event) => setAction(event.target.value)}
                className="px-2 py-1.5 text-xs border border-slate-300 bg-white rounded-md focus:outline-none focus:border-brand-400 text-right w-28"
              >
                <option value="">כל הפעולות</option>
                <option value="create">יצירה</option>
                <option value="update">עדכון</option>
                <option value="delete">מחיקה</option>
              </select>
              <select
                value={entityType}
                onChange={(event) => setEntityType(event.target.value)}
                className="px-2 py-1.5 text-xs border border-slate-300 bg-white rounded-md focus:outline-none focus:border-brand-400 text-right w-36"
              >
                <option value="">כל הישויות</option>
                {entityOptions.map((option) => (
                  <option key={option} value={option}>{ENTITY_LABELS[option] ?? option}</option>
                ))}
              </select>
              <button
                onClick={loadAudit}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-md transition-colors"
              >
                החל סינון
              </button>
            </div>
          }
          end={!loading ? <AdminCountLabel>{rows.length} פעולות</AdminCountLabel> : undefined}
        />

        <div className="flex-1 overflow-auto bg-white min-h-0">
          {loading ? (
            <div className="py-20 flex flex-col items-center gap-3 text-slate-400">
              <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">טוען...</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-sm">לא נמצאו פעולות Audit</div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr>
                  {["תאריך", "פעולה", "ישות", "שחקן", "מזהה רשומה", "IP"].map((header) => (
                    <th key={header} className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={index % 2 === 0 ? "bg-white hover:bg-brand-50/40" : "bg-slate-50/60 hover:bg-brand-50/40"}
                  >
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-500 whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString("he-IL")}
                    </td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-800 font-medium">
                      {ACTION_LABELS[row.action] ?? row.action}
                    </td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-600">
                      {ENTITY_LABELS[row.entity_type] ?? row.entity_type}
                    </td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-600">
                      <div>{row.actor_name || "—"}</div>
                      <div className="text-[10px] text-slate-400 direction-ltr">{row.actor_email || row.actor_id}</div>
                    </td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-500 font-mono text-[11px]">
                      {row.entity_id ?? "—"}
                    </td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-500">{row.ip_address ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && <AdminStatusBar total={rows.length} label="רשומות Audit" />}
      </main>
    </div>
  );
}
