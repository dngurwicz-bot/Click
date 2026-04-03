"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isLoggedIn, api } from "@/lib/api";
import { TopNav } from "@/components/layout/TopNav";
import { Plus, Search, HelpCircle, Printer, RefreshCw } from "lucide-react";

interface TenantListItem {
  tenant_id: string;
  name_he: string;
  status: string;
  package_slug: string;
  created_at: string;
}

const STATUS_LABEL: Record<string, { label: string; dotClass: string; textClass: string; bgClass: string }> = {
  trial:     { label: "ניסיון",  dotClass: "bg-amber-400",   textClass: "text-amber-700",   bgClass: "bg-amber-50"   },
  active:    { label: "פעיל",    dotClass: "bg-emerald-500",  textClass: "text-emerald-700",  bgClass: "bg-emerald-50"  },
  suspended: { label: "מושהה",   dotClass: "bg-red-500",      textClass: "text-red-700",      bgClass: "bg-red-50"     },
  cancelled: { label: "מבוטל",  dotClass: "bg-slate-400",    textClass: "text-slate-500",    bgClass: "bg-slate-100"  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_LABEL[status] ?? { label: status, dotClass: "bg-slate-400", textClass: "text-slate-500", bgClass: "bg-slate-100" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bgClass} ${cfg.textClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
      {cfg.label}
    </span>
  );
}

export default function TenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  function loadTenants() {
    setLoading(true);
    api.get<TenantListItem[]>("/api/admin/tenants")
      .then(setTenants)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    loadTenants();
  }, [router]);

  const filtered = tenants.filter((t) =>
    t.name_he.includes(search) || t.status.includes(search) || t.package_slug.includes(search)
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <TopNav />

      <main className="flex-1 overflow-hidden flex flex-col">

        {/* ── Title Bar ───────────────────────────────────────────── */}
        <div className="bg-white border-b border-slate-200 flex items-center justify-between px-3 py-1.5 shrink-0"
             style={{ boxShadow: "0 1px 0 0 #e2e8f0" }}>
          {/* LEFT: toolbar icons */}
          <div className="flex items-center gap-0.5">
            <button title="עזרה"
              className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <HelpCircle size={13} />
            </button>
            <button title="הדפסה"
              className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <Printer size={13} />
            </button>
            <button
              title="רענן"
              className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              onClick={loadTenants}
            >
              <RefreshCw size={13} />
            </button>
          </div>

          {/* RIGHT: page title */}
          <h1 className="text-sm font-semibold tracking-wide" style={{ color: "#1c2831" }}>
            ניהול ארגונים
          </h1>
        </div>

        {/* ── Action Bar ──────────────────────────────────────────── */}
        <div className="bg-slate-50 border-b border-slate-200 flex items-center justify-between px-3 py-1.5 shrink-0 gap-4">
          {/* RIGHT: new + search */}
          <div className="flex items-center gap-2">
            <Link
              href="/admin/tenants/new"
              className="flex items-center gap-1 bg-brand-600 hover:bg-brand-700 text-white
                         text-xs font-semibold px-3 py-1.5 rounded-md transition-colors shadow-sm"
            >
              <Plus size={12} />
              חדש
            </Link>
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

          {/* LEFT: count */}
          <div className="text-xs text-slate-400 font-medium">
            {!loading && <span>{filtered.length} ארגונים</span>}
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
            <div className="py-20 text-center text-slate-400 text-sm">לא נמצאו ארגונים</div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">
                    שם הארגון
                  </th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">
                    סטטוס
                  </th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">
                    חבילה
                  </th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">
                    תאריך הצטרפות
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => (
                  <tr
                    key={t.tenant_id}
                    className={`cursor-pointer transition-colors
                      ${i % 2 === 0 ? "bg-white hover:bg-brand-50/40" : "bg-slate-50/60 hover:bg-brand-50/40"}`}
                    onClick={() => router.push(`/admin/tenants/${t.tenant_id}`)}
                  >
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-800 font-medium">
                      {t.name_he}
                    </td>
                    <td className="px-4 py-2 border-b border-slate-100">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-600 capitalize">
                      {t.package_slug}
                    </td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-500">
                      {new Date(t.created_at).toLocaleDateString("he-IL")}
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
