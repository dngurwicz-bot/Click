"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, isLoggedIn } from "@/lib/api";
import { AdminGrandchildLayout, AdminSectionCard } from "@/components/layout/AdminShell";
import { LogoUploadField } from "@/components/tenants/LogoUploadField";
import Link from "next/link";

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

interface TemplatePricingSummary {
  seat_count: number;
  modules_count: number;
  recurring_after_discount_ils: string;
  setup_after_discount_ils: string;
  total_after_discount_ils: string;
}

interface TemplateOption {
  id: string;
  name: string;
  default_billing_cycle: string;
  valid_to?: string | null;
  module_slugs: string[];
  discount_pct: string;
  is_price_locked: boolean;
  seat_count: number;
  pricing_summary: TemplatePricingSummary | null;
}

function fmtMoney(v?: string | null) {
  const n = parseFloat(v ?? "0");
  return `₪${n.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function NewTenantPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [logoStorageKey] = useState(() => `draft-${crypto.randomUUID()}`);

  const [form, setForm] = useState({
    name_he: "", name_en: "", tax_id: "", entity_type: "company", logo_url: "",
    email: "", phone: "", contact_name: "", website: "",
    street: "", city: "", zip_code: "", country: "IL",
    billing_cycle: "monthly",
    seat_count: "0",
    selected_module_slugs: [] as string[],
    discount_pct: "0", is_price_locked: false,
    status: "trial",
    template_id: "",
  });

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    api.get<TemplateOption[]>("/api/admin/templates")
      .then((templateData) => {
        setTemplates(templateData.filter((template) => !template.valid_to));
      })
      .catch(() => {})
      .finally(() => setTemplatesLoading(false));
  }, [router]);

  const selectedTemplate = templates.find((template) => template.id === form.template_id) ?? null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload = {
        identity: { name_he: form.name_he, name_en: form.name_en || null, tax_id: form.tax_id, entity_type: form.entity_type, logo_url: form.logo_url || null },
        contact: { email: form.email, phone: form.phone, contact_name: form.contact_name || null, website: form.website || null },
        address: { street: form.street, city: form.city, zip_code: form.zip_code || null, country: form.country },
        subscription: {
          template_id: form.template_id || null,
          billing_cycle: form.billing_cycle,
          seat_count: parseInt(form.seat_count, 10) || 0,
          selected_module_slugs: form.selected_module_slugs,
          discount_pct: parseFloat(form.discount_pct) || 0,
          is_price_locked: form.is_price_locked,
        },
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
    <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
      <AdminGrandchildLayout
        title="ארגון חדש"
        backHref="/admin/tenants"
        backLabel="ניהול ארגונים"
        maxWidthClass="max-w-2xl"
      >
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Identity */}
            <AdminSectionCard title="פרטי ארגון">
              <div className="grid grid-cols-2 gap-3">
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
                <div className="col-span-2">
                  <LogoUploadField
                    value={form.logo_url}
                    onChange={(value) => set("logo_url", value)}
                    storageKey={logoStorageKey}
                    hint="העלה קובץ תמונה של לוגו הארגון"
                  />
                </div>
              </div>
            </AdminSectionCard>

            {/* Contact */}
            <AdminSectionCard title="פרטי קשר">
              <div className="grid grid-cols-2 gap-3">
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
            </AdminSectionCard>

            {/* Address */}
            <AdminSectionCard title="כתובת">
              <div className="grid grid-cols-2 gap-3">
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
            </AdminSectionCard>

            {/* Subscription */}
            <AdminSectionCard title="מנוי וסטטוס">
              <div className="grid grid-cols-3 gap-3">
                <Field label="תבנית הקמה">
                  <select
                    className={SELECT}
                    value={form.template_id}
                    onChange={(e) => {
                      const templateId = e.target.value;
                      const template = templates.find((item) => item.id === templateId);
                      setForm((current) => ({
                        ...current,
                        template_id: templateId,
                        billing_cycle: template?.default_billing_cycle || current.billing_cycle,
                        seat_count: String(template?.seat_count ?? current.seat_count),
                        selected_module_slugs: template?.module_slugs ?? current.selected_module_slugs,
                        discount_pct: template?.discount_pct || current.discount_pct,
                        is_price_locked: template?.is_price_locked ?? current.is_price_locked,
                      }));
                    }}
                    disabled={templatesLoading}
                  >
                    <option value="">{templatesLoading ? "טוען תבניות..." : "ללא תבנית"}</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="מחזור חיוב">
                  <select className={SELECT} value={form.billing_cycle} onChange={(e) => set("billing_cycle", e.target.value)}>
                    <option value="monthly">חודשי</option>
                    <option value="quarterly">רבעוני</option>
                    <option value="yearly">שנתי</option>
                  </select>
                </Field>
                <Field label="הנחה %">
                  <input className={INPUT} type="number" min="0" step="0.01" value={form.discount_pct} onChange={(e) => set("discount_pct", e.target.value)} />
                </Field>
                <Field label="מושבים לחיוב">
                  <input className={INPUT} type="number" min="0" step="1" value={form.seat_count} onChange={(e) => set("seat_count", e.target.value)} />
                </Field>
                <Field label="מחיר נעול">
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, is_price_locked: !current.is_price_locked }))}
                    className={`relative rounded-full transition-colors duration-200 ${form.is_price_locked ? "bg-emerald-500" : "bg-slate-200"}`}
                    style={{ width: 32, height: 18 }}
                  >
                    <span
                      className={`absolute top-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${form.is_price_locked ? "translate-x-[14px]" : "translate-x-0.5"}`}
                      style={{ width: 14, height: 14 }}
                    />
                  </button>
                </Field>
                <Field label="סטטוס התחלתי">
                  <select className={SELECT} value={form.status} onChange={(e) => set("status", e.target.value)}>
                    <option value="trial">ניסיון</option>
                    <option value="active">פעיל</option>
                  </select>
                </Field>
              </div>
              {selectedTemplate?.pricing_summary && (
                <div className="px-4 pb-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs space-y-2">
                    <div className="font-semibold text-slate-700">תמחור מתבנית: {selectedTemplate.name}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">מודולים</span>
                      <span className="font-semibold text-slate-800">{selectedTemplate.pricing_summary.modules_count}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">מושבים</span>
                      <span className="font-semibold text-slate-800">{selectedTemplate.pricing_summary.seat_count}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">חודשי משוער</span>
                      <span className="font-semibold text-slate-800">{fmtMoney(selectedTemplate.pricing_summary.recurring_after_discount_ils)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">דמי הקמה משוערים</span>
                      <span className="font-semibold text-slate-800">{fmtMoney(selectedTemplate.pricing_summary.setup_after_discount_ils)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                      <span className="text-slate-600 font-semibold">סה&quot;כ מחזור ראשון</span>
                      <span className="font-bold text-slate-900">{fmtMoney(selectedTemplate.pricing_summary.total_after_discount_ils)}</span>
                    </div>
                    {selectedTemplate.module_slugs.length > 0 && (
                      <div className="border-t border-slate-200 pt-2 text-[11px] text-slate-500">
                        מודולים: {selectedTemplate.module_slugs.join(", ")}
                      </div>
                    )}
                  </div>
                </div>
              )}
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
                {loading ? "שומר..." : "שמור ארגון"}
              </button>
              <Link href="/admin/tenants"
                className="border border-slate-300 bg-white text-slate-600 text-xs px-4 py-1.5 rounded-md hover:bg-slate-50 transition-colors">
                ביטול
              </Link>
            </div>
          </form>
      </AdminGrandchildLayout>
    </div>
  );
}
