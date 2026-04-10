"use client";

import { useCallback, useEffect, useState, ReactNode } from "react";
import { useRouter, useParams } from "next/navigation";
import { isLoggedIn, api } from "@/lib/api";
import { CardPage } from "@/components/layout/CardPage";
import { FormField } from "@/components/ui/FormField";
import { X } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface LookupItemOut {
  id: string;
  list_id: string;
  item_key: string;
  label_he: string;
  sort_order: number;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
}

interface LookupListOut {
  id: string;
  list_key: string;
  name_he: string;
  description?: string;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  items: LookupItemOut[];
}

// ── Item Modal ────────────────────────────────────────────────────────────────

interface ItemModalProps {
  listKey: string;
  item?: LookupItemOut;
  onClose: () => void;
  onSaved: () => void;
}

function ItemModal({ listKey, item, onClose, onSaved }: ItemModalProps) {
  const isNew = !item;
  const [form, setForm] = useState({
    item_key:   item?.item_key   ?? "",
    label_he:   item?.label_he   ?? "",
    sort_order: String(item?.sort_order ?? "0"),
    is_active:  item?.is_active  ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      if (isNew) {
        await api.post(`/api/admin/lookups/${listKey}/items`, {
          item_key:   form.item_key.trim(),
          label_he:   form.label_he.trim(),
          sort_order: Number(form.sort_order),
          is_active:  true,
        });
      } else {
        await api.put(`/api/admin/lookups/${listKey}/items/${item!.id}`, {
          label_he:   form.label_he.trim(),
          sort_order: Number(form.sort_order),
          is_active:  form.is_active,
        });
      }
      onSaved(); onClose();
    } catch (err: unknown) {
      const e = err as { error?: string; detail?: { error?: string } };
      setError(e?.error ?? e?.detail?.error ?? "שגיאה בשמירה");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-200 text-slate-400 transition-colors">
            <X size={14} />
          </button>
          <span className="text-sm font-semibold text-slate-700">
            {isNew ? "פריט חדש" : "עריכת פריט"}
          </span>
        </div>

        {/* Body */}
        <div className="px-4 py-4 space-y-3">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{error}</div>
          )}

          {isNew ? (
            <FormField
              label="מפתח (key)"
              required
              value={form.item_key}
              readOnly={false}
              onChange={(v) => set("item_key", v.toLowerCase().replace(/\s/g, "_"))}
            />
          ) : (
            <FormField label="מפתח (key)" value={item.item_key} readOnly />
          )}

          <FormField label="תיאור" required value={form.label_he} readOnly={false} onChange={(v) => set("label_he", v)} />
          <FormField label="סדר" value={form.sort_order} readOnly={false} onChange={(v) => set("sort_order", v)} />

          {!isNew && !item.is_system && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500 shrink-0" style={{ minWidth: "88px" }}>פעיל</label>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 text-brand-600"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-100 flex justify-start gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !form.label_he || (isNew && !form.item_key)}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-1.5 rounded-md transition-colors"
          >
            {saving ? "שומר..." : "שמור"}
          </button>
          <button
            onClick={onClose}
            className="border border-slate-300 bg-white text-slate-600 text-xs px-4 py-1.5 rounded-md hover:bg-slate-50 transition-colors"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LookupDetailPage() {
  const router = useRouter();
  const params = useParams();
  const listKey = params.key as string;

  const [data,    setData]    = useState<LookupListOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState<{ open: boolean; item?: LookupItemOut }>({ open: false });

  const loadData = useCallback(() => {
    setLoading(true);
    api.get<LookupListOut>(`/api/admin/lookups/${listKey}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [listKey]);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    loadData();
  }, [router, loadData]);

  if (loading || !data) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
        <main className="flex-1 flex items-center justify-center">
          <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  // ── Parent content: list metadata ─────────────────────────────────────────
  const parentContent = (
    <div className="px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-2">
      <FormField label="שם הרשימה" required value={data.name_he} readOnly />
      <FormField label="מפתח (key)" value={data.list_key} readOnly />
      <FormField label="תיאור" value={data.description ?? ""} readOnly />
      <FormField
        label="סטטוס"
        type="select"
        value={data.is_active ? "active" : "inactive"}
        options={[{ value: "active", label: "פעיל" }, { value: "inactive", label: "לא פעיל" }]}
        readOnly
      />
    </div>
  );

  // ── Child tab rows ────────────────────────────────────────────────────────
  const itemRows = data.items.map((item) => ({
    item_key:   <span className="font-mono text-slate-600">{item.item_key}</span>,
    label_he:   item.label_he,
    sort_order: item.sort_order,
    is_system: item.is_system
      ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">מערכת</span>
      : null,
    is_active: item.is_active
      ? <span className="inline-flex items-center gap-1 text-emerald-700"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />פעיל</span>
      : <span className="inline-flex items-center gap-1 text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-slate-300" />לא פעיל</span>,
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
      <main className="flex-1 overflow-hidden flex flex-col">
        <CardPage
          title={data.name_he}
          backHref="/admin/lookups"
          backLabel="רשימות"
          parentContent={parentContent}
          formTabs={[]}
          childTabs={[
            {
              id: "items",
              label: "פריטים",
              columns: [
                { key: "item_key",   label: "מפתח",  width: "w-40" },
                { key: "label_he",   label: "תיאור", required: true },
                { key: "sort_order", label: "סדר",   width: "w-20" },
                { key: "is_system",  label: "מערכת", width: "w-20" },
                { key: "is_active",  label: "פעיל",  width: "w-24" },
              ],
              rows: itemRows as Record<string, ReactNode>[],
              emptyMessage: "לחץ להוספת פריט חדש",
              onAddClick: () => setModal({ open: true, item: undefined }),
              onRowDoubleClick: (i) => setModal({ open: true, item: data.items[i] }),
            },
          ]}
        />
      </main>

      {modal.open && (
        <ItemModal
          listKey={listKey}
          item={modal.item}
          onClose={() => setModal({ open: false })}
          onSaved={loadData}
        />
      )}
    </div>
  );
}
