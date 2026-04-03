"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, api } from "@/lib/api";
import { TopNav } from "@/components/layout/TopNav";
import { Search, HelpCircle, Printer, RefreshCw } from "lucide-react";

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
      .then((data) => setModules([...data].sort((a, b) => a.sort_order - b.sort_order)))
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
    <div className="min-h-screen flex flex-col bg-slate-50">
      <TopNav />

      <main className="flex-1 overflow-hidden flex flex-col">

        {/* ── Title Bar ───────────────────────────────────────────── */}
        <div className="bg-white border-b border-slate-200 flex items-center justify-between px-3 py-1.5 shrink-0"
             style={{ boxShadow: "0 1px 0 0 #e2e8f0" }}>
          <div className="flex items-center gap-0.5">
            <button title="עזרה"
              className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <HelpCircle size={13} />
            </button>
            <button title="הדפסה"
              className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <Printer size={13} />
            </button>
            <button title="רענן"
              className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              onClick={loadModules}>
              <RefreshCw size={13} />
            </button>
          </div>
          <h1 className="text-sm font-semibold tracking-wide" style={{ color: "#1c2831" }}>
            מודולים ומחירון
          </h1>
        </div>

        {/* ── Action Bar ──────────────────────────────────────────── */}
        <div className="bg-slate-50 border-b border-slate-200 flex items-center justify-between px-3 py-1.5 shrink-0 gap-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="חיפוש..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-8 pl-3 py-1.5 text-xs border border-slate-300 bg-white rounded-md
                           focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100
                           text-right w-48 transition-colors"
              />
            </div>
          </div>
          <div className="text-xs text-slate-400 font-medium">
            {!loading && <span>{filtered.length} מודולים</span>}
          </div>
        </div>

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
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap w-8">סדר</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">שם המודול</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">מזהה</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">מחיר נוכחי</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">בתוקף מ-</th>
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
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-400 text-center">{m.sort_order}</td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-800 font-medium">
                      {m.name}
                      {m.is_required && (
                        <span className="mr-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">נדרש</span>
                      )}
                    </td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-500 font-mono text-[11px]">{m.slug}</td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-600">{fmt(m.current_price?.base_price_ils)}</td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-500">
                      {m.current_price?.valid_from
                        ? new Date(m.current_price.valid_from).toLocaleDateString("he-IL")
                        : "—"}
                    </td>
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

      </main>
    </div>
  );
}
