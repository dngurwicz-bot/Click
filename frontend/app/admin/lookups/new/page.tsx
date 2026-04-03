"use client";

import { useState, FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { TopNav } from "@/components/layout/TopNav";
import Link from "next/link";
import { ArrowRight, HelpCircle } from "lucide-react";

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
    <div className="min-h-screen flex flex-col bg-slate-50">
      <TopNav />

      {/* ── Title Bar ───────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 flex items-center justify-between px-3 py-1.5 shrink-0"
           style={{ boxShadow: "0 1px 0 0 #e2e8f0" }}>
        <div className="flex items-center gap-0.5">
          <button title="עזרה"
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <HelpCircle size={13} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/lookups"
            className="text-xs text-slate-400 hover:text-brand-600 transition-colors flex items-center gap-1">
            <ArrowRight size={12} />
            ניהול רשימות
          </Link>
          <span className="text-slate-300 text-xs">/</span>
          <h1 className="text-sm font-semibold tracking-wide" style={{ color: "#1c2831" }}>רשימה חדשה</h1>
        </div>
      </div>

      {/* ── Form Content ────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-lg px-4 py-5">
          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">פרטי הרשימה</h2>
              </div>
              <div className="p-4 space-y-3">
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
            </div>

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
        </div>
      </main>
    </div>
  );
}
