"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { TopNav } from "@/components/layout/TopNav";
import Link from "next/link";
import { ArrowRight, HelpCircle } from "lucide-react";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

const INPUT = "w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs text-right focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-colors";
const SELECT = "w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-colors";

export default function NewTenantPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name_he: "", name_en: "", tax_id: "", entity_type: "company", logo_url: "",
    email: "", phone: "", contact_name: "", website: "",
    street: "", city: "", zip_code: "", country: "IL",
    package_slug: "starter", billing_cycle: "monthly",
    status: "trial",
  });

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload = {
        identity: { name_he: form.name_he, name_en: form.name_en || null, tax_id: form.tax_id, entity_type: form.entity_type, logo_url: form.logo_url || null },
        contact: { email: form.email, phone: form.phone, contact_name: form.contact_name || null, website: form.website || null },
        address: { street: form.street, city: form.city, zip_code: form.zip_code || null, country: form.country },
        subscription: { package_slug: form.package_slug, billing_cycle: form.billing_cycle },
        status: { status: form.status },
      };
      await api.post("/api/admin/tenants", payload);
      router.push("/admin/tenants");
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
          <Link href="/admin/tenants"
            className="text-xs text-slate-400 hover:text-brand-600 transition-colors flex items-center gap-1">
            <ArrowRight size={12} />
            ניהול ארגונים
          </Link>
          <span className="text-slate-300 text-xs">/</span>
          <h1 className="text-sm font-semibold tracking-wide" style={{ color: "#1c2831" }}>ארגון חדש</h1>
        </div>
      </div>

      {/* ── Form Content ────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-2xl px-4 py-5">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Identity */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">פרטי ארגון</h2>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                <Field label="שם בעברית *">
                  <input required className={INPUT} value={form.name_he} onChange={(e) => set("name_he", e.target.value)} />
                </Field>
                <Field label="שם באנגלית">
                  <input className={INPUT} value={form.name_en} onChange={(e) => set("name_en", e.target.value)} />
                </Field>
                <Field label="ח.פ / ע.מ *">
                  <input required className={INPUT} value={form.tax_id} onChange={(e) => set("tax_id", e.target.value)} />
                </Field>
                <Field label="סוג ישות *">
                  <select className={SELECT} value={form.entity_type} onChange={(e) => set("entity_type", e.target.value)}>
                    <option value="company">חברה</option>
                    <option value="self_employed">עצמאי</option>
                    <option value="nonprofit">עמותה</option>
                    <option value="gov">ממשלה</option>
                  </select>
                </Field>
              </div>
            </div>

            {/* Contact */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">פרטי קשר</h2>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                <Field label="דוא״ל *">
                  <input required type="email" className={INPUT} value={form.email} onChange={(e) => set("email", e.target.value)} />
                </Field>
                <Field label="טלפון *">
                  <input required className={INPUT} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                </Field>
                <Field label="איש קשר">
                  <input className={INPUT} value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
                </Field>
                <Field label="אתר">
                  <input className={INPUT} value={form.website} onChange={(e) => set("website", e.target.value)} />
                </Field>
              </div>
            </div>

            {/* Address */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">כתובת</h2>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                <Field label="רחוב *">
                  <input required className={INPUT} value={form.street} onChange={(e) => set("street", e.target.value)} />
                </Field>
                <Field label="עיר *">
                  <input required className={INPUT} value={form.city} onChange={(e) => set("city", e.target.value)} />
                </Field>
                <Field label="מיקוד">
                  <input className={INPUT} value={form.zip_code} onChange={(e) => set("zip_code", e.target.value)} />
                </Field>
                <Field label="מדינה">
                  <input className={INPUT} value={form.country} onChange={(e) => set("country", e.target.value)} />
                </Field>
              </div>
            </div>

            {/* Subscription */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">מנוי וסטטוס</h2>
              </div>
              <div className="p-4 grid grid-cols-3 gap-3">
                <Field label="חבילה">
                  <select className={SELECT} value={form.package_slug} onChange={(e) => set("package_slug", e.target.value)}>
                    <option value="starter">Starter</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </Field>
                <Field label="מחזור חיוב">
                  <select className={SELECT} value={form.billing_cycle} onChange={(e) => set("billing_cycle", e.target.value)}>
                    <option value="monthly">חודשי</option>
                    <option value="annual">שנתי</option>
                  </select>
                </Field>
                <Field label="סטטוס התחלתי">
                  <select className={SELECT} value={form.status} onChange={(e) => set("status", e.target.value)}>
                    <option value="trial">ניסיון</option>
                    <option value="active">פעיל</option>
                  </select>
                </Field>
              </div>
            </div>

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
                {loading ? "שומר..." : "שמור ארגון"}
              </button>
              <Link href="/admin/tenants"
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
