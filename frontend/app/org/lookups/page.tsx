"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, api } from "@/lib/api";
import { AdminActionBar, AdminCountLabel, AdminSearchField, AdminStatusBar, AdminTitleBar } from "@/components/layout/AdminShell";
import { Plus, Pencil, Trash2 } from "lucide-react";

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

export default function OrgLookupsPage() {
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
      await api.delete(`/api/org/lookups/${l.list_key}`);
      loadLists();
    } catch {
      alert("שגיאה במחיקה");
    } finally {
      setDeletingId(null);
    }
  }

  function loadLists() {
    setLoading(true);
    api.get<LookupListItem[]>("/api/org/lookups")
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
    <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
      <main className="flex-1 overflow-hidden flex flex-col">
        <AdminTitleBar title="ניהול רשימות ארגוניות" onRefresh={loadLists} />

        <AdminActionBar
          start={
            <>
            <button
              onClick={() => router.push("/org/lookups/new")}
              className="flex items-center gap-1 bg-brand-600 hover:bg-brand-700 text-white
                         text-xs font-semibold px-3 py-1.5 rounded-md transition-colors shadow-sm"
            >
              <Plus size={12} />
              חדש
            </button>
            <AdminSearchField value={search} onChange={setSearch} />
            </>
          }
          end={!loading ? <AdminCountLabel>{filtered.length} רשימות</AdminCountLabel> : undefined}
        />

        <div className="flex-1 overflow-auto bg-white min-h-0">
          {loading ? (
            <div className="py-20 flex flex-col items-center gap-3 text-slate-400">
              <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">טוען...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-sm">לא נמצאו רשימות</div>
          ) : (
            <table className="admin-data-table w-full text-xs border-collapse">
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
                    onClick={() => router.push(`/org/lookups/${l.list_key}`)}
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
                          onClick={(e) => { e.stopPropagation(); router.push(`/org/lookups/${l.list_key}`); }}
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

        {!loading && <AdminStatusBar total={filtered.length} label="רשימות" />}
      </main>
    </div>
  );
}
