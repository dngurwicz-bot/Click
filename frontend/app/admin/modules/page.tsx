"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, api } from "@/lib/api";
import { AdminActionBar, AdminCountLabel, AdminSearchField, AdminStatusBar, AdminTitleBar } from "@/components/layout/AdminShell";

interface ModuleListItem {
  id: string;
  slug: string;
  name: string;
  description?: string;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  current_price?: {
    base_price_ils: string;
    valid_from: string;
  };
}

function fmt(val?: string) {
  if (!val) return "—";
  return `₪${parseFloat(val).toLocaleString("he-IL", { minimumFractionDigits: 2 })}`;
}

export default function ModulesPage() {
  const router = useRouter();
  const [modules, setModules] = useState<ModuleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  function loadModules() {
    setLoading(true);
    api.get<ModuleListItem[]>("/api/admin/modules")
      .then((moduleData) => {
        setModules([...moduleData].sort((a, b) => a.sort_order - b.sort_order));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    loadModules();
  }, [router]);

  const filtered = modules.filter((m) =>
    m.name.includes(search) || m.slug.includes(search)
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-50">

      <main className="flex-1 overflow-hidden flex flex-col">
        <AdminTitleBar title="מודולים ומחירון" onRefresh={loadModules} />

        <AdminActionBar
          start={<AdminSearchField value={search} onChange={setSearch} />}
          end={!loading ? <AdminCountLabel>{filtered.length} מודולים</AdminCountLabel> : undefined}
        />

        {/* ── Table ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto bg-white min-h-0">
          {loading ? (
            <div className="py-20 flex flex-col items-center gap-3 text-slate-400">
              <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">טוען...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-sm">לא נמצאו מודולים</div>
          ) : (
            <table className="admin-data-table w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">בתוקף מ-</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap w-8">סדר</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">שם המודול</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">מזהה</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">מחיר נוכחי</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, i) => (
                  <tr
                    key={m.slug}
                    className={`cursor-pointer transition-colors
                      ${i % 2 === 0 ? "bg-white hover:bg-brand-50/40" : "bg-slate-50/60 hover:bg-brand-50/40"}`}
                    onClick={() => router.push(`/admin/modules/${m.slug}`)}
                  >
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-500">
                      {m.current_price?.valid_from
                        ? new Date(m.current_price.valid_from).toLocaleDateString("he-IL")
                        : "—"}
                    </td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-400 text-center">{m.sort_order}</td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-800 font-medium">
                      {m.name}
                      {m.is_required && (
                        <span className="mr-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">נדרש</span>
                      )}
                    </td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-500 font-mono text-[11px]">{m.slug}</td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-600">{fmt(m.current_price?.base_price_ils)}</td>
                    <td className="px-4 py-2 border-b border-slate-100">
                      {m.is_active ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />פעיל
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />לא פעיל
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && <AdminStatusBar total={filtered.length} label="מודולים" />}
      </main>
    </div>
  );
}
