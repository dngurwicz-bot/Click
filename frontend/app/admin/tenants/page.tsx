"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isLoggedIn, api } from "@/lib/api";
import { TopNav } from "@/components/layout/TopNav";
import { AdminActionBar, AdminCountLabel, AdminSearchField, AdminTitleBar } from "@/components/layout/AdminShell";
import { Plus } from "lucide-react";

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
        <AdminTitleBar title="ניהול ארגונים" onRefresh={loadTenants} />

        <AdminActionBar
          start={
            <>
            <Link
              href="/admin/tenants/new"
              className="flex items-center gap-1 bg-brand-600 hover:bg-brand-700 text-white
                         text-xs font-semibold px-3 py-1.5 rounded-md transition-colors shadow-sm"
            >
              <Plus size={12} />
              חדש
            </Link>
            <AdminSearchField value={search} onChange={setSearch} />
            </>
          }
          end={!loading ? <AdminCountLabel>{filtered.length} ארגונים</AdminCountLabel> : undefined}
        />

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
