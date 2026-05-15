"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, api } from "@/lib/api";
import { AdminActionBar, AdminCountLabel, AdminSearchField, AdminStatusBar, AdminTitleBar } from "@/components/layout/AdminShell";
import { TemporalFilterBar } from "@/components/ui/TemporalFilterBar";
import { HebrewDatePicker } from "@/components/ui/HebrewDatePicker";
import { AdminModal, AdminModalPanel } from "@/components/ui/AdminModal";
import { SplitActionButton } from "@/components/ui/SplitActionButton";
import {
  createDefaultTemporalFilterState,
  getTemporalFilterError,
  overlapsTemporalFilter,
  type TemporalFilterState,
} from "@/lib/temporalFilter";
import { X } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface TemplateOut {
  id: string;
  name: string;
  description: string | null;
  default_billing_cycle: string;
  trial_days: number;
  is_active: boolean;
  sort_order: number;
  target_industry: string | null;
  recommended_size: string | null;
  valid_from: string;
  valid_to: string | null;
  created_at: string;
  module_slugs: string[];
  modules?: TemplateModuleEntry[];
  seat_count: number;
  discount_pct: string;
  is_price_locked: boolean;
  module_pricing: TemplateModulePricing[];
  pricing_summary: TemplatePricingSummary | null;
}

interface TemplateModuleEntry {
  module_slug: string;
  seats_default?: number | null;
}

interface TemplateModuleFormEntry {
  module_slug: string;
  seats_default: string;
}

interface ModulePriceOut {
  base_price_ils: string;
  per_seat_ils: string;
  included_seats: number;
  setup_fee_ils: string;
  overage_per_seat_ils?: string;
  pricing_policy_note?: string;
  pricing_summary_text?: string;
}

interface ModuleOption {
  slug: string;
  name: string;
  is_active: boolean;
  current_price?: ModulePriceOut | null;
}

interface TemplateModulePricing {
  module_slug: string;
  module_name: string;
  has_active_price: boolean;
  base_price_ils: string;
  per_seat_ils: string;
  included_seats: number;
  setup_fee_ils: string;
  seat_count: number;
  billable_seats: number;
  recurring_total_ils: string;
  setup_total_ils: string;
  overage_per_seat_ils?: string;
  pricing_policy_note?: string;
  pricing_summary_text?: string;
}

interface TemplatePricingSummary {
  seat_count: number;
  discount_pct: string;
  is_price_locked: boolean;
  modules_count: number;
  recurring_before_discount_ils: string;
  recurring_after_discount_ils: string;
  setup_before_discount_ils: string;
  setup_after_discount_ils: string;
  total_before_discount_ils: string;
  total_after_discount_ils: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function toInput(d?: string | null): string {
  if (!d) return "";
  return d.slice(0, 10);
}

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("he-IL");
}

function fmtMoney(v?: string | number | null): string {
  const n = typeof v === "number" ? v : parseFloat(v ?? "0");
  return `₪${n.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pricingSummaryText(price?: ModulePriceOut | null): string {
  if (!price) return "ללא מחירון פעיל.";
  if (price.pricing_summary_text) return price.pricing_summary_text;
  const overage = price.overage_per_seat_ils ?? price.per_seat_ils;
  return `${fmtMoney(price.base_price_ils)} לחודש כולל ${price.included_seats} מושבים, ואז ${fmtMoney(overage)} לכל מושב נוסף.`;
}

const BILLING_CYCLE_LABELS: Record<string, string> = {
  monthly:   "חודשי",
  yearly:    "שנתי",
  quarterly: "רבעוני",
};

function moduleEntriesFromTemplate(template?: TemplateOut): TemplateModuleFormEntry[] {
  if (!template) return [];
  const richEntries = template.modules?.length
    ? template.modules
    : (template.module_slugs ?? []).map((module_slug) => ({ module_slug, seats_default: null }));
  return richEntries.map((entry) => ({
    module_slug: entry.module_slug,
    seats_default: entry.seats_default == null ? "" : String(entry.seats_default),
  }));
}

function effectiveSeatCount(entry: TemplateModuleFormEntry, fallbackSeatCount: number): number {
  const parsed = entry.seats_default === "" ? fallbackSeatCount : parseInt(entry.seats_default, 10);
  return Math.max(Number.isFinite(parsed) ? parsed : fallbackSeatCount, 0);
}

function buildPricingPreview(selectedEntries: TemplateModuleFormEntry[], modules: ModuleOption[], seatCount: number, discountPct: number): TemplatePricingSummary {
  const rows = selectedEntries.map((entry) => {
    const slug = entry.module_slug;
    const matchedModule = modules.find((m) => m.slug === slug);
    const price = matchedModule?.current_price;
    const base = parseFloat(price?.base_price_ils ?? "0");
    const perSeat = parseFloat(price?.per_seat_ils ?? "0");
    const setup = parseFloat(price?.setup_fee_ils ?? "0");
    const included = price?.included_seats ?? 0;
    const moduleSeatCount = effectiveSeatCount(entry, seatCount);
    const billableSeats = Math.max(moduleSeatCount - included, 0);
    return {
      recurring: base + (perSeat * billableSeats),
      setup,
    };
  });

  const recurringBefore = rows.reduce((sum, row) => sum + row.recurring, 0);
  const setupBefore = rows.reduce((sum, row) => sum + row.setup, 0);
  const factor = 1 - (discountPct / 100);
  const recurringAfter = recurringBefore * factor;
  const setupAfter = setupBefore * factor;

  return {
    seat_count: seatCount,
    discount_pct: String(discountPct),
    is_price_locked: false,
    modules_count: selectedEntries.length,
    recurring_before_discount_ils: recurringBefore.toFixed(2),
    recurring_after_discount_ils: recurringAfter.toFixed(2),
    setup_before_discount_ils: setupBefore.toFixed(2),
    setup_after_discount_ils: setupAfter.toFixed(2),
    total_before_discount_ils: (recurringBefore + setupBefore).toFixed(2),
    total_after_discount_ils: (recurringAfter + setupAfter).toFixed(2),
  };
}

function buildPricingRows(selectedEntries: TemplateModuleFormEntry[], modules: ModuleOption[], seatCount: number) {
  return selectedEntries
    .map((entry) => {
      const slug = entry.module_slug;
      const matchedModule = modules.find((item) => item.slug === slug);
      if (!matchedModule) return null;
      const price = matchedModule.current_price;
      const base = parseFloat(price?.base_price_ils ?? "0");
      const perSeat = parseFloat(price?.per_seat_ils ?? "0");
      const setup = parseFloat(price?.setup_fee_ils ?? "0");
      const included = price?.included_seats ?? 0;
      const moduleSeatCount = effectiveSeatCount(entry, seatCount);
      const billableSeats = Math.max(moduleSeatCount - included, 0);
      return {
        slug,
        name: matchedModule.name,
        hasPrice: Boolean(price),
        base,
        perSeat,
        setup,
        included,
        seatCount: moduleSeatCount,
        billableSeats,
        recurring: base + (perSeat * billableSeats),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}

// ── Modal ──────────────────────────────────────────────────────────────────

type TemplateMode = "update" | "add" | "set" | "delete" | "close";

interface TemplateModalProps {
  templates: TemplateOut[];
  editRow?: TemplateOut;
  onClose: () => void;
  onSaved: () => void;
  modules: ModuleOption[];
}

function TemplateModal({ templates, editRow, onClose, onSaved, modules }: TemplateModalProps) {
  const today        = new Date().toISOString().slice(0, 10);
  const hasActiveRow = editRow ? templates.some((r) => !r.valid_to) : false;
  const activeRow    = templates.find((r) => !r.valid_to);

  const [mode,         setMode]         = useState<TemplateMode>(editRow ? "update" : "add");
  const [form,         setForm]         = useState({
    name:                  editRow?.name ?? "",
    description:           editRow?.description ?? "",
    default_billing_cycle: editRow?.default_billing_cycle ?? "monthly",
    trial_days:            String(editRow?.trial_days ?? 30),
    is_active:             editRow?.is_active ?? true,
    sort_order:            String(editRow?.sort_order ?? 10),
    target_industry:       editRow?.target_industry ?? "",
    recommended_size:      editRow?.recommended_size ?? "",
  });
  const [validFrom,      setValidFrom]      = useState<string>(toInput(editRow?.valid_from) || today);
  const [validTo,        setValidTo]        = useState<string>(toInput(editRow?.valid_to));
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [dropdownOpen,   setDropdownOpen]   = useState(false);
  const [selectedModuleEntries, setSelectedModuleEntries] = useState<TemplateModuleFormEntry[]>(() => moduleEntriesFromTemplate(editRow));
  const [seatCount, setSeatCount] = useState<string>(String(editRow?.seat_count ?? 0));
  const [discountPct, setDiscountPct] = useState<string>(editRow?.discount_pct ?? "0");
  const [isPriceLocked, setIsPriceLocked] = useState<boolean>(editRow?.is_price_locked ?? false);

  function setF(k: string, v: string | boolean) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function switchToAddMode() {
    setMode("add");
    setForm({
      name: "", description: "",
      default_billing_cycle: "monthly", trial_days: "30",
      is_active: true, sort_order: "10", target_industry: "", recommended_size: "",
    });
    setValidFrom(""); setError(null); setDropdownOpen(false); setSelectedModuleEntries([]);
    setSeatCount("0"); setDiscountPct("0"); setIsPriceLocked(false);
  }
  function switchToSetMode()    {
    setMode("set"); setValidTo(""); setError(null); setDropdownOpen(false); setSelectedModuleEntries(moduleEntriesFromTemplate(editRow));
    setSeatCount(String(editRow?.seat_count ?? 0)); setDiscountPct(editRow?.discount_pct ?? "0"); setIsPriceLocked(editRow?.is_price_locked ?? false);
  }
  function switchToUpdateMode() {
    setMode("update");
    setForm({
      name:                  editRow?.name ?? "",
      description:           editRow?.description ?? "",
      default_billing_cycle: editRow?.default_billing_cycle ?? "monthly",
      trial_days:            String(editRow?.trial_days ?? 30),
      is_active:             editRow?.is_active ?? true,
      sort_order:            String(editRow?.sort_order ?? 10),
      target_industry:       editRow?.target_industry ?? "",
      recommended_size:      editRow?.recommended_size ?? "",
    });
    setValidFrom(toInput(editRow?.valid_from) || today);
    setValidTo(toInput(editRow?.valid_to));
    setError(null);
    setSelectedModuleEntries(moduleEntriesFromTemplate(editRow));
    setSeatCount(String(editRow?.seat_count ?? 0));
    setDiscountPct(editRow?.discount_pct ?? "0");
    setIsPriceLocked(editRow?.is_price_locked ?? false);
  }
  function switchToDeleteMode() { setMode("delete"); setError(null); setDropdownOpen(false); }
  function switchToCloseMode()  { setMode("close");  setValidTo(""); setError(null); setDropdownOpen(false); }

  const selectedModuleSlugs = selectedModuleEntries.map((entry) => entry.module_slug);

  function selectAllModules() {
    setSelectedModuleEntries((prev) => {
      const bySlug = new Map(prev.map((entry) => [entry.module_slug, entry]));
      return modules.map((module) => bySlug.get(module.slug) ?? { module_slug: module.slug, seats_default: "" });
    });
  }

  function toggleModule(slug: string, checked: boolean) {
    setSelectedModuleEntries((prev) => {
      if (checked) {
        if (prev.some((entry) => entry.module_slug === slug)) return prev;
        return [...prev, { module_slug: slug, seats_default: "" }];
      }
      return prev.filter((entry) => entry.module_slug !== slug);
    });
  }

  function setModuleSeatDefault(slug: string, value: string) {
    setSelectedModuleEntries((prev) => prev.map((entry) => (
      entry.module_slug === slug ? { ...entry, seats_default: value } : entry
    )));
  }

  function buildBody(action: TemplateMode) {
    return {
      action,
      ...(action === "update" && editRow?.id ? { template_id: editRow.id } : {}),
      name:                  form.name,
      description:           form.description || null,
      default_billing_cycle: form.default_billing_cycle,
      trial_days:            parseInt(form.trial_days) || 30,
      is_active:             form.is_active,
      sort_order:            parseInt(form.sort_order) || 10,
      target_industry:       form.target_industry || null,
      recommended_size:      form.recommended_size || null,
      ...(validFrom ? { valid_from: validFrom } : {}),
      valid_to: validTo || null,
      module_slugs: selectedModuleSlugs,
      modules: selectedModuleEntries.map((entry) => ({
        module_slug: entry.module_slug,
        seats_default: entry.seats_default === "" ? null : Math.max(parseInt(entry.seats_default, 10) || 0, 0),
      })),
      seat_count: parseInt(seatCount) || 0,
      discount_pct: parseFloat(discountPct) || 0,
      is_price_locked: isPriceLocked,
    };
  }

  const pricingPreview = buildPricingPreview(
    selectedModuleEntries,
    modules,
    Math.max(parseInt(seatCount) || 0, 0),
    Math.max(parseFloat(discountPct) || 0, 0),
  );
  const previewRows = buildPricingRows(
    selectedModuleEntries,
    modules,
    Math.max(parseInt(seatCount) || 0, 0),
  );

  async function handleDelete() {
    setSaving(true); setError(null);
    try {
      await api.put(`/api/admin/templates/${editRow!.id}/record`, {
        action:     "delete",
        valid_from: toInput(editRow?.valid_from),
      });
      onSaved(); onClose();
    } catch (e: unknown) {
      const err = e as { error?: string; detail?: { error?: string } };
      setError(err?.error ?? err?.detail?.error ?? "שגיאה במחיקה");
    } finally { setSaving(false); }
  }

  async function handleClose() {
    if (!validTo) { setError("יש להזין תאריך גמר תוקף"); return; }
    setSaving(true); setError(null);
    try {
      await api.put(`/api/admin/templates/${editRow!.id}/record`, { action: "close", valid_to: validTo });
      onSaved(); onClose();
    } catch (e: unknown) {
      const err = e as { error?: string; detail?: { error?: string } };
      setError(err?.error ?? err?.detail?.error ?? "שגיאה בסגירת תקופה");
    } finally { setSaving(false); }
  }

  async function handleSave(action: "update" | "add" | "set") {
    if (!form.name.trim()) { setError("שם תבנית הוא שדה חובה"); return; }
    if (selectedModuleEntries.length === 0) { setError("תבנית חייבת לכלול לפחות מודול אחד"); return; }
    if (!validFrom) { setError("יש להזין תאריך תחילת תוקף"); return; }
    setSaving(true); setError(null);
    try {
      if (action === "add") {
        await api.post("/api/admin/templates", buildBody(action));
      } else {
        await api.put(`/api/admin/templates/${editRow!.id}/record`, buildBody(action));
      }
      onSaved(); onClose();
    } catch (e: unknown) {
      const err = e as { error?: string; detail?: { error?: string } };
      setError(err?.error ?? err?.detail?.error ?? "שגיאה בשמירה");
    } finally { setSaving(false); }
  }

  const modalTitle =
    mode === "add"    ? "תבנית חדשה"
    : mode === "set"    ? "קבע תקופה — תבנית"
    : mode === "delete" ? "מחיקת שורה — תבנית"
    : mode === "close"  ? "סגירת תקופה — תבנית"
    : "עדכון — תבנית";

  const headerBg =
    mode === "set"    ? "bg-amber-50"  :
    mode === "delete" ? "bg-red-50"    :
    mode === "close"  ? "bg-orange-50" :
    "bg-[#dce4f0]";

  const headerText =
    mode === "set"    ? "text-amber-800"  :
    mode === "delete" ? "text-red-800"    :
    mode === "close"  ? "text-orange-800" :
    "text-[#1a3a6e]";
  const inputCls = "border border-slate-300 rounded px-2 py-1 text-xs flex-1 focus:outline-none focus:border-blue-400 text-right";
  const dateCls  = "border rounded px-2 py-1 text-xs w-36 focus:outline-none font-mono";

  return (
    <AdminModal onBackdropClick={onClose}>
      <AdminModalPanel
        className="max-w-6xl"
        dir="rtl"
        onClick={() => setDropdownOpen(false)}
      >

        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b border-slate-200 ${headerBg}`}>
          <h2 className={`text-base font-bold ${headerText}`}>{modalTitle}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/60 text-slate-500"><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="space-y-3 overflow-y-auto px-8 py-6">

          {/* DELETE mode */}
          {mode === "delete" && (
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-300 rounded px-4 py-3 text-xs text-red-800 space-y-1.5">
                <div className="font-bold text-sm">⚠️ מחיקת שורה — פעולה בלתי הפיכה</div>
                <div>השורה מתאריך <strong>{fmtDate(editRow?.valid_from)}</strong>
                  {editRow?.valid_to ? ` עד ${fmtDate(editRow.valid_to)}` : " (פעילה)"} תימחק לחלוטין מהמאגר.</div>
                <div className="text-red-600">אם ברצונך רק לסיים את התוקף — השתמש ב<strong>סגור תקופה</strong> במקום.</div>
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">{error}</p>}
            </div>
          )}

          {/* CLOSE mode */}
          {mode === "close" && (
            <div className="space-y-3">
              <div className="bg-orange-50 border border-orange-200 rounded px-4 py-2 text-xs text-orange-800">
                סוגרת את השורה <strong>הפעילה</strong>{activeRow ? ` (מ-${fmtDate(activeRow.valid_from)})` : ""}
                {" "}על ידי הגדרת תאריך גמר תוקף.
              </div>
              <div className="flex items-center gap-3 pt-1">
                <label className="text-xs font-semibold text-slate-600 w-28 shrink-0">
                  <span className="text-red-500 ml-0.5">*</span>
                  תוקף עד (אחרון)
                </label>
                <HebrewDatePicker value={validTo} onChange={setValidTo}
                  className={`${dateCls} border-orange-400 bg-orange-50 focus:border-orange-600 font-semibold`} />
                <span className="text-xs text-orange-700">יום אחרון שהשורה בתוקף</span>
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">{error}</p>}
            </div>
          )}

          {/* Normal modes: update / add / set */}
          {(mode === "update" || mode === "add" || mode === "set") && (<>

            {/* הוסף blocked when active row exists */}
            {mode === "add" && hasActiveRow && (
              <div className="bg-blue-50 border border-blue-300 rounded px-4 py-3 text-xs text-blue-800 space-y-1">
                <div><strong>לא ניתן להוסיף רשומה חדשה</strong> — קיימת רשומה פעילה ללא תאריך סיום.</div>
                <div>לפתיחת תקופה חדשה: חזור ל<strong>שמור</strong> ושנה את תאריך התחילה לתאריך העתידי הרצוי.</div>
              </div>
            )}

            <div className={`space-y-4 ${mode === "add" && hasActiveRow ? "hidden" : ""}`}>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(360px,0.9fr)]">
                <div className="space-y-4">
                  <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="mb-3">
                      <h3 className="text-sm font-semibold text-slate-800">פרטי התבנית</h3>
                      <p className="text-[11px] text-slate-500">זהות, קהל יעד ותצורת ברירת המחדל של הארגון.</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-xs font-semibold text-slate-600">
                          <span className="text-red-500 ml-0.5">*</span>
                          שם תבנית
                        </label>
                        <input type="text" value={form.name} onChange={(e) => setF("name", e.target.value)}
                          placeholder="שם התבנית" className={inputCls} />
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-xs font-semibold text-slate-600">תיאור</label>
                        <input type="text" value={form.description} onChange={(e) => setF("description", e.target.value)}
                          placeholder="תיאור קצר וברור לצוות המכירות" className={inputCls} />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">מחזור חיוב</label>
                        <select value={form.default_billing_cycle} onChange={(e) => setF("default_billing_cycle", e.target.value)}
                          className={inputCls}>
                          <option value="monthly">חודשי</option>
                          <option value="yearly">שנתי</option>
                          <option value="quarterly">רבעוני</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">ימי ניסיון</label>
                        <input type="number" step="1" min="0" value={form.trial_days} onChange={(e) => setF("trial_days", e.target.value)}
                          className={inputCls} />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">סטטוס</label>
                        <div className="flex h-[34px] items-center gap-2 rounded border border-slate-300 bg-white px-3">
                          <button type="button" onClick={() => setF("is_active", !form.is_active)}
                            className={`relative rounded-full transition-colors duration-200 ${form.is_active ? "bg-emerald-500" : "bg-slate-200"}`}
                            style={{ width: 32, height: 18 }}>
                            <span className={`absolute top-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${form.is_active ? "translate-x-[14px]" : "translate-x-0.5"}`}
                              style={{ width: 14, height: 14 }} />
                          </button>
                          <span className="text-xs text-slate-600">{form.is_active ? "פעיל להצעה" : "טיוטה / לא פעיל"}</span>
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">תעשייה</label>
                        <input type="text" value={form.target_industry} onChange={(e) => setF("target_industry", e.target.value)}
                          placeholder="למשל: רפואה, שירותים, קמעונאות" className={inputCls} />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">גודל מומלץ</label>
                        <input type="text" value={form.recommended_size} onChange={(e) => setF("recommended_size", e.target.value)}
                          placeholder="למשל: 10-50 עובדים" className={inputCls} />
                      </div>
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800">תמחור ברירת מחדל</h3>
                        <p className="text-[11px] text-slate-500">הערכים כאן יועתקו לארגון ויזינו את החיובים בפועל.</p>
                      </div>
                      <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
                        {selectedModuleEntries.length} מודולים
                      </span>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">מושבים</label>
                        <input
                          type="number"
                          min="0"
                          value={seatCount}
                          onChange={(e) => setSeatCount(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">הנחה %</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={discountPct}
                          onChange={(e) => setDiscountPct(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">מחיר נעול</label>
                        <div className="flex h-[34px] items-center gap-2 rounded border border-slate-300 bg-slate-50 px-3">
                          <button
                            type="button"
                            onClick={() => setIsPriceLocked((value) => !value)}
                            className={`relative rounded-full transition-colors duration-200 ${isPriceLocked ? "bg-emerald-500" : "bg-slate-200"}`}
                            style={{ width: 32, height: 18 }}
                          >
                            <span
                              className={`absolute top-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${isPriceLocked ? "translate-x-[14px]" : "translate-x-0.5"}`}
                              style={{ width: 14, height: 14 }}
                            />
                          </button>
                          <span className="text-xs text-slate-600">{isPriceLocked ? "כן" : "לא"}</span>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800">הרכב מודולים</h3>
                        <p className="text-[11px] text-slate-500">בחירה חזותית עם מחיר בסיס, מושבים כלולים וחיוב רק על מושבים נוספים.</p>
                      </div>
                      <button
                        type="button"
                        onClick={selectAllModules}
                        className="text-[11px] font-medium text-brand-700 hover:underline"
                      >
                        בחר הכל
                      </button>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      {modules.length === 0 && (
                        <p className="col-span-full rounded-lg border border-dashed border-slate-300 py-6 text-center text-xs text-slate-400">אין מודולים זמינים</p>
                      )}
                      {modules.length > 0 && selectedModuleEntries.length === 0 && (
                        <p className="col-span-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          תבנית חייבת לכלול לפחות מודול אחד.
                        </p>
                      )}
                      {modules.map((module) => {
                        const entry = selectedModuleEntries.find((item) => item.module_slug === module.slug);
                        const selected = Boolean(entry);
                        const currentPrice = module.current_price;
                        return (
                          <label
                            key={module.slug}
                            className={`rounded-xl border p-3 transition-all cursor-pointer ${selected ? "border-brand-400 bg-brand-50/50 shadow-sm" : "border-slate-200 bg-slate-50/60 hover:border-slate-300"}`}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={(e) => {
                                  toggleModule(module.slug, e.target.checked);
                                }}
                                className="mt-1 rounded border-slate-300"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold text-slate-800">{module.name}</span>
                                  <span className="rounded-full bg-white px-2 py-0.5 font-mono text-[10px] text-slate-500">{module.slug}</span>
                                </div>
                                {currentPrice ? (
                                  <>
                                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                                      <span>בסיס {fmtMoney(currentPrice.base_price_ils)}</span>
                                      <span>למושב נוסף {fmtMoney(currentPrice.overage_per_seat_ils ?? currentPrice.per_seat_ils)}</span>
                                      <span>הקמה {fmtMoney(currentPrice.setup_fee_ils)}</span>
                                      <span>כולל {currentPrice.included_seats} מושבים</span>
                                    </div>
                                    <div className="mt-1 text-[11px] text-slate-500">{pricingSummaryText(currentPrice)}</div>
                                  </>
                                ) : (
                                  <div className="mt-2 text-[11px] text-amber-600">אין מחיר פעיל למודול זה</div>
                                )}
                                {selected && (
                                  <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-600">
                                    <span className="shrink-0">מושבים למודול</span>
                                    <input
                                      type="number"
                                      min="0"
                                      value={entry?.seats_default ?? ""}
                                      onChange={(e) => setModuleSeatDefault(module.slug, e.target.value)}
                                      onClick={(e) => e.stopPropagation()}
                                      placeholder={String(Math.max(parseInt(seatCount) || 0, 0))}
                                      className="w-20 rounded border border-slate-300 px-2 py-1 text-left text-[11px] focus:border-blue-400 focus:outline-none"
                                    />
                                    <span className="text-slate-400">ריק = ברירת מחדל</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                </div>

                <aside className="space-y-4">
                  <section className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold">סיכום כספי חי</h3>
                        <p className="mt-1 text-[11px] text-slate-300">כך הארגון ייראה במחזור הראשון אם נשתמש בתבנית הזו.</p>
                      </div>
                      <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-100">
                        {pricingPreview.modules_count} מודולים
                      </span>
                    </div>
                    <div className="mt-4 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">חודשי לפני הנחה</span>
                        <span className="font-semibold">{fmtMoney(pricingPreview.recurring_before_discount_ils)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">חודשי אחרי הנחה</span>
                        <span className="font-semibold text-emerald-300">{fmtMoney(pricingPreview.recurring_after_discount_ils)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">חד פעמי אחרי הנחה</span>
                        <span className="font-semibold">{fmtMoney(pricingPreview.setup_after_discount_ils)}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-white/10 pt-2">
                        <span className="font-semibold text-slate-100">סה&quot;כ מחזור ראשון</span>
                        <span className="text-lg font-bold">{fmtMoney(pricingPreview.total_after_discount_ils)}</span>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-slate-800">פירוט לפי מודול</h3>
                    <p className="mt-1 text-[11px] text-slate-500">קל להבין כאן מאיפה מגיע המחיר ואילו מושבים מחויבים בפועל.</p>
                    <div className="mt-3 space-y-2">
                      {previewRows.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-300 px-3 py-5 text-center text-xs text-slate-400">
                          בחר מודול אחד לפחות כדי לראות תמחור.
                        </div>
                      ) : previewRows.map((row) => (
                        <div key={row.slug} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="text-xs font-semibold text-slate-800">{row.name}</div>
                              <div className="text-[11px] text-slate-500">{row.slug}</div>
                            </div>
                            <div className="text-left">
                              <div className="text-xs font-semibold text-slate-900">{fmtMoney(row.recurring)}</div>
                              <div className="text-[11px] text-slate-500">חודשי</div>
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                            <span>בסיס {fmtMoney(row.base)}</span>
                            <span>למושב נוסף {fmtMoney(row.perSeat)}</span>
                            <span>מושבים לחיוב {row.billableSeats}</span>
                            <span>הקמה {fmtMoney(row.setup)}</span>
                            <span>כולל {row.included} מושבים</span>
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500">
                            {fmtMoney(row.base)} לחודש כולל {row.included} מושבים, ואז {fmtMoney(row.perSeat)} לכל מושב נוסף.
                          </div>
                          {!row.hasPrice && (
                            <div className="mt-2 text-[11px] text-amber-600">אין מחיר פעיל, לכן המודול לא תורם כרגע לסכום.</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                </aside>
              </div>
            </div>

            {/* Date fields */}
            <div className={`border-t border-slate-200 pt-3 space-y-2 ${mode === "add" && hasActiveRow ? "hidden" : ""}`}>
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-600 w-28 shrink-0">
                  <span className="text-red-500 ml-0.5">*</span>
                  תוקף מתאריך
                </label>
                <HebrewDatePicker value={validFrom} onChange={setValidFrom}
                  className={`${dateCls}
                    ${mode === "add" || mode === "set"
                      ? "border-amber-400 bg-amber-50 focus:border-amber-600 font-semibold"
                      : "border-slate-300 focus:border-blue-400"}`} />
                {mode === "add" && <span className="text-xs text-amber-700 font-medium">תאריך תחילת תוקף חדש</span>}
                {mode === "set" && <span className="text-xs text-amber-700 font-medium">תחילת תקופת הקביעה</span>}
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-600 w-28 shrink-0">תוקף עד (אופציונלי)</label>
                <HebrewDatePicker value={validTo} onChange={setValidTo}
                  className={`${dateCls}
                    ${mode === "set" ? "border-amber-300 bg-amber-50 focus:border-amber-500" : "border-slate-300 focus:border-blue-400"}`} />
                {!validTo && <span className="text-xs text-slate-400">ריק = ללא תאריך סיום</span>}
                {validTo && (
                  <span className="text-xs text-blue-600 cursor-pointer hover:underline" onClick={() => setValidTo("")}>✕ נקה</span>
                )}
              </div>
            </div>

            {/* קביעה warning */}
            {mode === "set" && (
              <div className="bg-amber-50 border border-amber-300 rounded px-3 py-2 text-xs text-amber-800">
                ⚠️ <strong>קביעה</strong> — פעולה חזקה: תחליף / תפצל / תמחק כל רשומה חופפת בתקופה המדווחת.
              </div>
            )}

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">{error}</p>
            )}
          </>)}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-8 py-4">
          {mode === "delete" ? (
            <>
              <button onClick={switchToUpdateMode}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded text-slate-600 hover:bg-slate-100">
                ← ביטול
              </button>
              <button onClick={handleDelete} disabled={saving}
                className="px-4 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50 font-semibold">
                {saving ? "מוחק..." : "מחק לצמיתות"}
              </button>
            </>
          ) : mode === "close" ? (
            <>
              <button onClick={switchToUpdateMode}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded text-slate-600 hover:bg-slate-100">
                ← ביטול
              </button>
              <button onClick={handleClose} disabled={saving}
                className="px-4 py-1.5 text-xs bg-orange-600 hover:bg-orange-700 text-white rounded disabled:opacity-50">
                {saving ? "שומר..." : "סגור תקופה"}
              </button>
            </>
          ) : mode === "add" ? (
            <>
              {editRow && (
                <button onClick={switchToUpdateMode}
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded text-slate-600 hover:bg-slate-100">
                  ← חזרה לשמור
                </button>
              )}
              <button onClick={onClose}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded text-slate-600 hover:bg-slate-100">
                ביטול
              </button>
              {!hasActiveRow && (
                <button onClick={() => handleSave("add")} disabled={saving}
                  className="px-4 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50">
                  {saving ? "שומר..." : "הוסף"}
                </button>
              )}
            </>
          ) : mode === "set" ? (
            <>
              <button onClick={switchToUpdateMode}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded text-slate-600 hover:bg-slate-100">
                ← חזרה לשמור
              </button>
              <button onClick={onClose}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded text-slate-600 hover:bg-slate-100">
                ביטול
              </button>
              <button onClick={() => handleSave("set")} disabled={saving}
                className="px-4 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded disabled:opacity-50">
                {saving ? "שומר..." : "קבע"}
              </button>
            </>
          ) : (
            /* UPDATE mode — split button [שמור | ▾] */
            <>
              <button onClick={onClose}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded text-slate-600 hover:bg-slate-100">
                ביטול
              </button>
              <SplitActionButton
                primaryLabel={saving ? "שומר..." : "שמור"}
                onPrimaryClick={() => handleSave("update")}
                primaryDisabled={saving}
                menuOpen={dropdownOpen}
                onMenuToggle={() => setDropdownOpen((o) => !o)}
                actions={[
                  {
                    label: "רשומה חדשה",
                    onClick: () => switchToAddMode(),
                    disabled: hasActiveRow,
                    helperText: hasActiveRow ? "קיימת רשומה פעילה" : undefined,
                  },
                  {
                    label: "שמור",
                    onClick: () => {
                      setDropdownOpen(false);
                      handleSave("update");
                    },
                  },
                  {
                    label: "קבע תקופה",
                    onClick: () => switchToSetMode(),
                    tone: "warning",
                  },
                  {
                    label: "סגור תקופה",
                    onClick: () => switchToCloseMode(),
                    disabled: !hasActiveRow,
                    helperText: !hasActiveRow ? "אין שורה פעילה" : undefined,
                    tone: "warning",
                  },
                  {
                    label: "מחק שורה זו",
                    onClick: () => switchToDeleteMode(),
                    tone: "danger",
                  },
                ]}
              />
            </>
          )}
        </div>
      </AdminModalPanel>
    </AdminModal>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function AdminTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateOut[]>([]);
  const [modules,   setModules]   = useState<ModuleOption[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [temporalFilter, setTemporalFilter] = useState<TemporalFilterState>(() => createDefaultTemporalFilterState());
  const [modal,     setModal]     = useState<{ editRow?: TemplateOut } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  function loadData() {
    setLoading(true);
    setLoadError(null);
    Promise.all([
      api.get<TemplateOut[]>("/api/admin/templates"),
      api.get<ModuleOption[]>("/api/admin/modules"),
    ])
      .then(([tmpl, mods]) => {
        setTemplates(tmpl);
        setModules(mods.filter((m) => m.is_active));
      })
      .catch((e: { error?: string; status?: number }) => {
        setLoadError(e?.error ?? "שגיאה בטעינת הנתונים");
      })
      .finally(() => setLoading(false));
  }

  function loadTemplates() {
    setLoading(true);
    setLoadError(null);
    api.get<TemplateOut[]>("/api/admin/templates")
      .then(setTemplates)
      .catch((e: { error?: string; status?: number }) => {
        setLoadError(e?.error ?? "שגיאה בטעינת תבניות");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    loadData();
  }, [router]);

  const filtered = templates.filter((t) =>
    t.name.includes(search) ||
    (t.target_industry ?? "").includes(search)
  );
  const temporalFilterError = getTemporalFilterError(temporalFilter);
  const visibleTemplates = filtered.filter((template) => (
    temporalFilterError || overlapsTemporalFilter({
      rowFrom: template.valid_from,
      rowTo: template.valid_to,
      filter: temporalFilter,
    })
  ));

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-50">

      <main className="flex-1 overflow-hidden flex flex-col">
        <AdminTitleBar title="תבניות הקמה" onRefresh={loadTemplates} />

        <AdminActionBar
          start={<AdminSearchField value={search} onChange={setSearch} />}
          end={
            <div className="flex items-center gap-3">
            {!loading && <AdminCountLabel>{visibleTemplates.length} תבניות</AdminCountLabel>}
            <button
              onClick={() => setModal({})}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white
                         bg-brand-500 hover:bg-brand-600 rounded-lg transition-colors"
            >
              + חדש
            </button>
            </div>
          }
        />

        {/* ── Table */}
        <div className="flex-1 overflow-auto bg-white min-h-0">
          <TemporalFilterBar
            filter={temporalFilter}
            onChange={setTemporalFilter}
            rowRanges={templates.map((template) => ({
              valid_from: template.valid_from,
              valid_to: template.valid_to,
            }))}
            idPrefix="templates-temporal"
          />

          {loadError ? (
            <div className="py-20 text-center text-red-500 text-sm">{loadError}</div>
          ) : loading ? (
            <div className="py-20 flex flex-col items-center gap-3 text-slate-400">
              <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">טוען...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-sm">לא נמצאו תבניות</div>
          ) : visibleTemplates.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-sm">
              {temporalFilterError ? "הטווח שנבחר אינו תקין" : "לא נמצאו תבניות עבור הסינון שנבחר"}
            </div>
          ) : (
            <table className="admin-data-table w-full text-xs border-collapse" dir="rtl">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">תוקף מ</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">תוקף עד</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">שם</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">מחזור חיוב</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">מושבים</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">הנחה</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">ימי ניסיון</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">מודולים</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">חודשי</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">הקמה</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">תעשייה</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {visibleTemplates.map((t, i) => (
                  <tr
                    key={t.id}
                    onDoubleClick={() => setModal({ editRow: t })}
                    className={`transition-colors cursor-pointer
                      ${i % 2 === 0 ? "bg-white hover:bg-brand-50/40" : "bg-slate-50/60 hover:bg-brand-50/40"}`}
                  >
                    <td className="cell-numeric px-4 py-2 border-b border-slate-100 text-slate-500 whitespace-nowrap">
                      {fmtDate(t.valid_from)}
                    </td>
                    <td className="px-4 py-2 border-b border-slate-100 whitespace-nowrap">
                      {t.valid_to ? (
                        <span className="text-slate-500">{fmtDate(t.valid_to)}</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-700">פעיל</span>
                      )}
                    </td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-800 font-medium">
                      <div>
                        <div>{t.name}</div>
                        {t.description && (
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[200px]">{t.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-600">
                      {BILLING_CYCLE_LABELS[t.default_billing_cycle] ?? t.default_billing_cycle}
                    </td>
                    <td className="cell-numeric px-4 py-2 border-b border-slate-100 text-slate-600">
                      {t.seat_count}
                    </td>
                    <td className="cell-numeric px-4 py-2 border-b border-slate-100 text-slate-600">
                      {parseFloat(t.discount_pct) > 0 ? `${t.discount_pct}%` : "—"}
                    </td>
                    <td className="cell-numeric px-4 py-2 border-b border-slate-100 text-slate-600">
                      {t.trial_days}
                    </td>
                    <td className="px-4 py-2 border-b border-slate-100">
                      <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-medium bg-brand-100 text-brand-700 rounded-full">
                        {t.module_slugs?.length ?? 0}
                      </span>
                    </td>
                    <td className="cell-numeric px-4 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                      {t.pricing_summary ? fmtMoney(t.pricing_summary.recurring_after_discount_ils) : "—"}
                    </td>
                    <td className="cell-numeric px-4 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                      {t.pricing_summary ? fmtMoney(t.pricing_summary.setup_after_discount_ils) : "—"}
                    </td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-500">
                      {t.target_industry ?? "—"}
                    </td>
                    <td className="px-4 py-2 border-b border-slate-100">
                      {t.is_active ? (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700">פעיל</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-500">לא פעיל</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && <AdminStatusBar total={visibleTemplates.length} label="תבניות" />}
      </main>

      {/* Modal */}
      {modal !== null && (
        <TemplateModal
          templates={templates}
          editRow={modal.editRow}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); loadTemplates(); }}
          modules={modules}
        />
      )}
    </div>
  );
}
