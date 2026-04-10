"use client";

import { useState, FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { AdminGrandchildLayout, AdminSectionCard } from "@/components/layout/AdminShell";
import Link from "next/link";

const INPUT = "w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs text-right focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-colors";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1 text-right">{label}</label>
      {children}
    </div>
  );
}

export default function NewLookupListPage() {
  const router = useRouter();
  const [form, setForm] = useState({ list_key: "", name_he: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const payload = {
        list_key:    form.list_key.trim(),
        name_he:     form.name_he.trim(),
        description: form.description.trim() || null,
        is_active:   true,
      };
      await api.post("/api/admin/lookups", payload);
      router.push(`/admin/lookups/${payload.list_key}`);
    } catch (err: unknown) {
      const e = err as { error?: string; detail?: { error?: string } };
      setError(e?.error ?? e?.detail?.error ?? "שגיאה בשמירה");
    } finally { setSaving(false); }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
      <AdminGrandchildLayout
        title="רשימה חדשה"
        backHref="/admin/lookups"
        backLabel="ניהול רשימות"
        maxWidthClass="max-w-lg"
      >
          <form onSubmit={handleSubmit} className="space-y-4">
            <AdminSectionCard title="פרטי הרשימה">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="שם הרשימה *">
                    <input required className={INPUT} value={form.name_he} onChange={(e) => set("name_he", e.target.value)} />
                  </Field>
                  <Field label="מפתח (key) *">
                    <input required className={INPUT} value={form.list_key}
                      onChange={(e) => set("list_key", e.target.value.toLowerCase().replace(/\s/g, "_"))} />
                  </Field>
                </div>
                <Field label="תיאור">
                  <input className={INPUT} value={form.description} onChange={(e) => set("description", e.target.value)} />
                </Field>
              </div>
            </AdminSectionCard>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-xs text-red-700 text-right">{error}</div>
            )}

            <div className="flex justify-start gap-2 pb-4">
              <button
                type="submit"
                disabled={saving || !form.list_key || !form.name_he}
                className="flex items-center gap-1 bg-brand-600 hover:bg-brand-700 text-white
                           text-xs font-semibold px-4 py-1.5 rounded-md transition-colors shadow-sm disabled:opacity-60"
              >
                {saving ? "שומר..." : "שמור רשימה"}
              </button>
              <Link href="/admin/lookups"
                className="border border-slate-300 bg-white text-slate-600 text-xs px-4 py-1.5 rounded-md hover:bg-slate-50 transition-colors">
                ביטול
              </Link>
            </div>
          </form>
      </AdminGrandchildLayout>
    </div>
  );
}
