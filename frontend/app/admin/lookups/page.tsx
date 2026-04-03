"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, api } from "@/lib/api";
import { TopNav } from "@/components/layout/TopNav";
import { Plus, Search, HelpCircle, Printer, RefreshCw, Pencil, Trash2 } from "lucide-react";

interface LookupListItem {
  id: string;
  list_key: string;
  name_he: string;
  description?: string;
  is_system: boolean;
  is_active: boolean;
  item_count: number;
  created_at: string;
}

export default function LookupsPage() {
  const router = useRouter();
  const [lists, setLists] = useState<LookupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(l: LookupListItem, e: React.MouseEvent) {
    e.stopPropagation();
    if (l.is_system) { alert("לא ניתן למחוק רשימת מערכת"); return; }
    if (!confirm(`למחוק את הרשימה "${l.name_he}"?\nפעולה זו אינה הפיכה.`)) return;
    setDeletingId(l.id);
    try {
      await api.delete(`/api/admin/lookups/${l.list_key}`);
      loadLists();
    } catch {
      alert("שגיאה במחיקה");
    } finally {
      setDeletingId(null);
    }
  }

  function loadLists() {
    setLoading(true);
    api.get<LookupListItem[]>("/api/admin/lookups")
      .then(setLists)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    loadLists();
  }, [router]);

  const filtered = lists.filter((l) =>
    l.name_he.includes(search) || l.list_key.includes(search)
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <TopNav />
      <main className="flex-1 overflow-hidden flex flex-col">

        {/* Title Bar */}
        <div className="bg-white border-b border-slate-200 flex items-center justify-between px-3 py-1.5 shrink-0"
             style={{ boxShadow: "0 1px 0 0 #e2e8f0" }}>
          <div className="flex items-center gap-0.5">
            <button title="עזרה" className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <HelpCircle size={13} />
            </button>
            <button title="הדפסה" className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <Printer size={13} />
            </button>
            <button title="רענן" className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors" onClick={loadLists}>
              <RefreshCw size={13} />
            </button>
          </div>
          <h1 className="text-sm font-semibold tracking-wide" style={{ color: "#1c2831" }}>
            ניהול רשימות ארגוניות
          </h1>
        </div>

        {/* Action Bar */}
        <div className="bg-slate-50 border-b border-slate-200 flex items-center justify-between px-3 py-1.5 shrink-0 gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/admin/lookups/new")}
              className="flex items-center gap-1 bg-brand-600 hover:bg-brand-700 text-white
                         text-xs font-semibold px-3 py-1.5 rounded-md transition-colors shadow-sm"
            >
              <Plus size={12} />
              חדש
            </button>
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
            {!loading && <span>{filtered.length} רשימות</span>}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto bg-white min-h-0">
          {loading ? (
            <div className="py-20 flex flex-col items-center gap-3 text-slate-400">
              <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">טוען...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-sm">לא נמצאו רשימות</div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">שם הרשימה</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">מפתח</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">תיאור</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">פריטים</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">סטטוס</th>
                  <th className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 w-20" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((l, i) => (
                  <tr
                    key={l.id}
                    className={`cursor-pointer transition-colors
                      ${i % 2 === 0 ? "bg-white hover:bg-brand-50/40" : "bg-slate-50/60 hover:bg-brand-50/40"}`}
                    onClick={() => router.push(`/admin/lookups/${l.list_key}`)}
                  >
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-800 font-medium">
                      {l.name_he}
                      {l.is_system && (
                        <span className="mr-2 text-[10px] font-normal px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">מערכת</span>
                      )}
                    </td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-500 font-mono">{l.list_key}</td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-500">{l.description ?? "—"}</td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-600">{l.item_count}</td>
                    <td className="px-4 py-2 border-b border-slate-100">
                      {l.is_active ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />פעיל
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />לא פעיל
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 border-b border-slate-100" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-center">
                        <button
                          title="עריכה"
                          onClick={(e) => { e.stopPropagation(); router.push(`/admin/lookups/${l.list_key}`); }}
                          className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-brand-600 transition-colors"
                        >
                          <Pencil size={12} />
                        </button>
                        {!l.is_system && (
                          <button
                            title="מחיקה"
                            disabled={deletingId === l.id}
                            onClick={(e) => handleDelete(l, e)}
                            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-40"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
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
