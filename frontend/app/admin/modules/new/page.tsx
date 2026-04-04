"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { TopNav } from "@/components/layout/TopNav";
import { AdminGrandchildLayout, AdminSectionCard } from "@/components/layout/AdminShell";
import Link from "next/link";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

const INPUT  = "w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs text-right focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-colors";
const SELECT = "w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-colors";

export default function NewModulePage() {
  const router = useRouter();
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name:        "",
    slug:        "",
    description: "",
    sort_order:  "10",
    is_active:   "true",
    is_required: "false",
  });

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.slug.trim()) {
      setError("שם ו-slug הם שדות חובה");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api.post("/api/admin/modules", {
        slug:        form.slug.trim(),
        name:        form.name.trim(),
        description: form.description.trim() || null,
        sort_order:  parseInt(form.sort_order) || 10,
        is_active:   form.is_active   === "true",
        is_required: form.is_required === "true",
      });
      router.push(`/admin/modules/${form.slug.trim()}`);
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      setError(apiErr.error ?? "שגיאה בשמירה");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <TopNav />
      <AdminGrandchildLayout
        title="מודול חדש"
        backHref="/admin/modules"
        backLabel="מודולים ומחירון"
        maxWidthClass="max-w-2xl"
      >
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* פרטי מודול */}
            <AdminSectionCard title="פרטי מודול">
              <div className="grid grid-cols-2 gap-3">
                <Field label="שם המודול *">
                  <input
                    required
                    className={INPUT}
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="לדוגמה: CLICK Flow"
                  />
                </Field>
                <Field label="מזהה (slug) *">
                  <input
                    required
                    className={INPUT + " font-mono text-left"}
                    value={form.slug}
                    onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                    placeholder="flow"
                    dir="ltr"
                  />
                </Field>
                <div className="col-span-2">
                  <Field label="תיאור">
                    <textarea
                      className={INPUT + " resize-none"}
                      rows={2}
                      value={form.description}
                      onChange={(e) => set("description", e.target.value)}
                      placeholder="תיאור קצר של המודול..."
                    />
                  </Field>
                </div>
              </div>
            </AdminSectionCard>

            {/* הגדרות */}
            <AdminSectionCard title="הגדרות">
              <div className="grid grid-cols-3 gap-3">
                <Field label="סטטוס">
                  <select className={SELECT} value={form.is_active} onChange={(e) => set("is_active", e.target.value)}>
                    <option value="true">פעיל</option>
                    <option value="false">לא פעיל</option>
                  </select>
                </Field>
                <Field label="חובה">
                  <select className={SELECT} value={form.is_required} onChange={(e) => set("is_required", e.target.value)}>
                    <option value="false">לא</option>
                    <option value="true">כן</option>
                  </select>
                </Field>
                <Field label="סדר תצוגה">
                  <input
                    type="number"
                    min={1}
                    className={INPUT}
                    value={form.sort_order}
                    onChange={(e) => set("sort_order", e.target.value)}
                  />
                </Field>
              </div>
            </AdminSectionCard>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-xs text-red-700">{error}</div>
            )}

            <div className="flex justify-start gap-2 pb-4">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-1 bg-brand-600 hover:bg-brand-700 text-white
                           text-xs font-semibold px-4 py-1.5 rounded-md transition-colors shadow-sm disabled:opacity-60"
              >
                {loading ? "שומר..." : "שמור מודול"}
              </button>
              <Link href="/admin/modules"
                className="border border-slate-300 bg-white text-slate-600 text-xs px-4 py-1.5 rounded-md hover:bg-slate-50 transition-colors">
                ביטול
              </Link>
            </div>

          </form>
      </AdminGrandchildLayout>
    </div>
  );
}
