"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { isLoggedIn, api } from "@/lib/api";
import { CardPage } from "@/components/layout/CardPage";
import { FormField } from "@/components/ui/FormField";
import { HebrewDatePicker } from "@/components/ui/HebrewDatePicker";
import { AdminModal, AdminModalPanel } from "@/components/ui/AdminModal";
import { SplitActionButton } from "@/components/ui/SplitActionButton";
import { X, ChevronDown, ChevronUp } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MarketPriceAnchor {
  vendor: string;
  product: string;
  price_display: string;
  normalized_monthly_ils: string;
  basis: string;
  source_url: string;
}

interface PricingRecommendation {
  module_slug: string;
  module_name: string;
  market_category: string;
  benchmark_team_size: number;
  benchmark_window_ils: string;
  action: string;
  rationale: string;
  current_price?: {
    base_price_ils: string;
    per_seat_ils: string;
    included_seats: number;
    setup_fee_ils: string;
    overage_per_seat_ils?: string;
    pricing_policy_note?: string;
    pricing_summary_text?: string;
    valid_from: string;
  };
  recommended_price: {
    base_price_ils: string;
    per_seat_ils: string;
    included_seats: number;
    setup_fee_ils: string;
    overage_per_seat_ils?: string;
    pricing_policy_note?: string;
    pricing_summary_text?: string;
  };
  current_monthly_at_benchmark_ils: string;
  recommended_monthly_at_benchmark_ils: string;
  monthly_delta_ils: string;
  setup_delta_ils: string;
  anchors: MarketPriceAnchor[];
}

interface PricingResearchPayload {
  as_of: string;
  exchange_rate_usd_ils: string;
  exchange_rate_eur_ils: string;
  positioning: string;
  methodology: string;
  modules: PricingRecommendation[];
}

interface ModulePriceOut {
  id: string;
  module_slug: string;
  base_price_ils: string;
  per_seat_ils: string;
  included_seats: number;
  setup_fee_ils: string;
  overage_per_seat_ils?: string;
  pricing_policy_note?: string;
  pricing_summary_text?: string;
  valid_from: string;
  valid_to?: string;
  created_at: string;
}

interface ModuleWithHistory {
  id: string;
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  color_hex?: string;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  current_price?: ModulePriceOut;
  price_history: ModulePriceOut[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(val?: string) {
  if (!val) return "—";
  return `₪${parseFloat(val).toLocaleString("he-IL", { minimumFractionDigits: 2 })}`;
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("he-IL");
}

function toInput(d?: string | null): string {
  if (!d) return "";
  return d.slice(0, 10);
}

function pricingSummaryText(price?: {
  base_price_ils: string;
  per_seat_ils: string;
  included_seats: number;
  overage_per_seat_ils?: string;
  pricing_summary_text?: string;
} | null) {
  if (!price) return "ללא מחירון פעיל.";
  if (price.pricing_summary_text) return price.pricing_summary_text;
  return `${fmt(price.base_price_ils)} לחודש כולל ${price.included_seats} מושבים, ואז ${fmt(price.overage_per_seat_ils ?? price.per_seat_ils)} לכל מושב נוסף.`;
}

// ── Edit Module Modal ──────────────────────────────────────────────────────────

interface EditModuleModalProps {
  data: ModuleWithHistory;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

function EditModuleModal({ data, onClose, onSaved, onDeleted }: EditModuleModalProps) {
  const [form, setForm] = useState({
    name:        data.name,
    description: data.description ?? "",
    icon:        data.icon ?? "",
    color_hex:   data.color_hex ?? "",
    sort_order:  String(data.sort_order),
    is_active:   data.is_active   ? "true" : "false",
    is_required: data.is_required ? "true" : "false",
  });
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [confirmDel,   setConfirmDel]   = useState(false);

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!form.name.trim()) { setError("שם המודול הוא שדה חובה"); return; }
    setSaving(true); setError(null);
    try {
      await api.put(`/api/admin/modules/${data.slug}`, {
        name:        form.name.trim(),
        description: form.description.trim() || null,
        icon:        form.icon.trim() || null,
        color_hex:   form.color_hex.trim() || null,
        sort_order:  parseInt(form.sort_order) || 10,
        is_active:   form.is_active   === "true",
        is_required: form.is_required === "true",
      });
      onSaved(); onClose();
    } catch (err: unknown) {
      const e = err as { error?: string };
      setError(e?.error ?? "שגיאה בשמירה");
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    setSaving(true); setError(null);
    try {
      await api.delete(`/api/admin/modules/${data.slug}`);
      onDeleted();
    } catch (err: unknown) {
      const e = err as { error?: string };
      setError(e?.error ?? "שגיאה במחיקה");
      setConfirmDel(false);
    } finally { setSaving(false); }
  }

  const inputCls = "border border-slate-300 rounded px-2 py-1 text-xs flex-1 focus:outline-none focus:border-blue-400";

  if (confirmDel) {
    return (
      <AdminModal onBackdropClick={onClose}>
        <AdminModalPanel className="max-w-5xl" dir="rtl">
          <div className="flex items-center justify-between border-b border-slate-200 bg-red-50 px-6 py-5">
            <h2 className="text-lg font-bold text-red-800">מחיקת מודול — {data.name}</h2>
            <button onClick={onClose} className="p-1 rounded hover:bg-white/60 text-slate-500"><X size={16} /></button>
          </div>
          <div className="flex-1 overflow-auto px-6 py-6">
            <div className="mx-auto w-full max-w-5xl space-y-3">
            <div className="bg-red-50 border border-red-300 rounded px-4 py-3 text-xs text-red-800 space-y-1.5">
              <div className="font-bold text-sm">⚠️ מחיקת מודול — פעולה בלתי הפיכה</div>
              <div>המודול <strong>{data.name}</strong> ({data.slug}) יימחק לצמיתות כולל כל היסטוריית המחירים שלו.</div>
            </div>
            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">{error}</p>}
          </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <button onClick={() => setConfirmDel(false)}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded text-slate-600 hover:bg-slate-100">
              ← ביטול
            </button>
            <button onClick={handleDelete} disabled={saving}
              className="px-4 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50 font-semibold">
              {saving ? "מוחק..." : "מחק לצמיתות"}
            </button>
          </div>
        </AdminModalPanel>
      </AdminModal>
    );
  }

  return (
    <AdminModal onBackdropClick={onClose}>
      <AdminModalPanel className="max-w-5xl" dir="rtl" onClick={() => setDropdownOpen(false)}>

        <div className="flex items-center justify-between border-b border-slate-200 bg-[#dce4f0] px-6 py-5">
          <h2 className="text-lg font-bold text-[#1a3a6e]">עדכון — פרטי מודול</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/60 text-slate-500"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-6">
          <div className="mx-auto w-full max-w-5xl space-y-3">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{error}</div>}

          {[
            { key: "name",        label: "שם המודול",  required: true },
            { key: "description", label: "תיאור" },
            { key: "icon",        label: "אייקון" },
            { key: "color_hex",   label: "צבע (hex)",   mono: true },
          ].map(({ key, label, required, mono }) => (
            <div key={key} className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-600 w-28 shrink-0">
                {required && <span className="text-red-500 ml-0.5">*</span>}
                {label}
              </label>
              <input
                value={form[key as keyof typeof form]}
                onChange={(e) => set(key, e.target.value)}
                className={`${inputCls}${mono ? " font-mono" : ""}`}
              />
            </div>
          ))}

          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-600 w-28 shrink-0">סטטוס</label>
            <select value={form.is_active} onChange={(e) => set("is_active", e.target.value)} className={inputCls}>
              <option value="true">פעיל</option>
              <option value="false">לא פעיל</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-600 w-28 shrink-0">חובה</label>
            <select value={form.is_required} onChange={(e) => set("is_required", e.target.value)} className={inputCls}>
              <option value="false">לא</option>
              <option value="true">כן</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-600 w-28 shrink-0">סדר תצוגה</label>
            <input type="number" value={form.sort_order} onChange={(e) => set("sort_order", e.target.value)} className={inputCls} />
          </div>
        </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button onClick={onClose}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded text-slate-600 hover:bg-slate-100 transition-colors">
            ביטול
          </button>
          <SplitActionButton
            primaryLabel={saving ? "שומר..." : "שמור"}
            onPrimaryClick={() => handleSave()}
            primaryDisabled={saving}
            menuOpen={dropdownOpen}
            onMenuToggle={() => setDropdownOpen((o) => !o)}
            minMenuWidthClassName="min-w-[150px]"
            actions={[
              {
                label: "שמור",
                onClick: () => {
                  setDropdownOpen(false);
                  handleSave();
                },
              },
              {
                label: "מחק מודול זה",
                onClick: () => {
                  setDropdownOpen(false);
                  setConfirmDel(true);
                },
                tone: "danger",
              },
            ]}
          />
        </div>
      </AdminModalPanel>
    </AdminModal>
  );
}

// ── Price Modal (full temporal) ────────────────────────────────────────────────

type PriceMode = "update" | "add" | "set" | "delete" | "close";

interface PriceModalProps {
  slug: string;
  priceHistory: ModulePriceOut[];
  editRow?: ModulePriceOut;   // row opened by double-click
  onClose: () => void;
  onSaved: () => void;
}

function PriceModal({ slug, priceHistory, editRow, onClose, onSaved }: PriceModalProps) {
  const today         = new Date().toISOString().slice(0, 10);
  const hasActiveRow  = priceHistory.some((r) => !r.valid_to);
  const activeRow     = priceHistory.find((r) => !r.valid_to);

  const [mode,         setMode]         = useState<PriceMode>(editRow ? "update" : "add");
  const [form,         setForm]         = useState({
    base_price_ils: editRow?.base_price_ils ?? "0",
    per_seat_ils:   editRow?.per_seat_ils   ?? "0",
    included_seats: String(editRow?.included_seats ?? 0),
    setup_fee_ils:  editRow?.setup_fee_ils  ?? "0",
  });
  const [validFrom,    setValidFrom]    = useState<string>(toInput(editRow?.valid_from) || today);
  const [validTo,      setValidTo]      = useState<string>(toInput(editRow?.valid_to));
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  function setF(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  function switchToAddMode() {
    setMode("add");
    setForm({ base_price_ils: "0", per_seat_ils: "0", included_seats: "0", setup_fee_ils: "0" });
    setValidFrom(""); setError(null); setDropdownOpen(false);
  }
  function switchToSetMode() {
    setMode("set"); setValidTo(""); setError(null); setDropdownOpen(false);
  }
  function switchToUpdateMode() {
    setMode("update");
    setForm({
      base_price_ils: editRow?.base_price_ils ?? "0",
      per_seat_ils:   editRow?.per_seat_ils   ?? "0",
      included_seats: String(editRow?.included_seats ?? 0),
      setup_fee_ils:  editRow?.setup_fee_ils  ?? "0",
    });
    setValidFrom(toInput(editRow?.valid_from) || today);
    setValidTo(toInput(editRow?.valid_to));
    setError(null);
  }
  function switchToDeleteMode() { setMode("delete"); setError(null); setDropdownOpen(false); }
  function switchToCloseMode()  { setMode("close");  setValidTo(""); setError(null); setDropdownOpen(false); }

  function buildBody(action: PriceMode) {
    return {
      action,
      // Send row id for "update" so backend can identify the exact row
      ...(action === "update" && editRow?.id ? { price_id: editRow.id } : {}),
      base_price_ils: parseFloat(form.base_price_ils) || 0,
      per_seat_ils:   parseFloat(form.per_seat_ils)   || 0,
      included_seats: parseInt(form.included_seats)   || 0,
      setup_fee_ils:  parseFloat(form.setup_fee_ils)  || 0,
      ...(validFrom ? { valid_from: validFrom } : {}),
      // Always send valid_to — null means open-ended / user cleared it
      valid_to: validTo || null,
    };
  }

  async function handleDelete() {
    setSaving(true); setError(null);
    try {
      await api.put(`/api/admin/modules/${slug}/price`, {
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
      await api.put(`/api/admin/modules/${slug}/price`, { action: "close", valid_to: validTo });
      onSaved(); onClose();
    } catch (e: unknown) {
      const err = e as { error?: string; detail?: { error?: string } };
      setError(err?.error ?? err?.detail?.error ?? "שגיאה בסגירת תקופה");
    } finally { setSaving(false); }
  }

  async function handleSave(action: "update" | "add" | "set") {
    if (!validFrom) { setError("יש להזין תאריך תחילת תוקף"); return; }
    setSaving(true); setError(null);
    try {
      await api.put(`/api/admin/modules/${slug}/price`, buildBody(action));
      onSaved(); onClose();
    } catch (e: unknown) {
      const err = e as { error?: string; detail?: { error?: string } };
      setError(err?.error ?? err?.detail?.error ?? "שגיאה בשמירה");
    } finally { setSaving(false); }
  }

  const modalTitle =
    mode === "add"    ? "רשומה חדשה — מחירון"
    : mode === "set"    ? "קבע תקופה — מחירון"
    : mode === "delete" ? "מחיקת שורה — מחירון"
    : mode === "close"  ? "סגירת תקופה — מחירון"
    : "עדכון — מחירון";

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
      <AdminModalPanel className="max-w-5xl" dir="rtl" onClick={() => setDropdownOpen(false)}>

        {/* Header */}
        <div className={`flex items-center justify-between border-b border-slate-200 px-6 py-5 ${headerBg}`}>
          <h2 className={`text-lg font-bold ${headerText}`}>{modalTitle}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/60 text-slate-500"><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-6">
          <div className="mx-auto w-full max-w-5xl space-y-3">

          {/* מחיקה mode */}
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

          {/* סגירת תקופה mode */}
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
                <HebrewDatePicker
                  value={validTo}
                  onChange={setValidTo}
                  className={`${dateCls} border-orange-400 bg-orange-50 focus:border-orange-600 font-semibold`}
                />
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

            {/* Price fields */}
            <div className={`space-y-3 ${mode === "add" && hasActiveRow ? "hidden" : ""}`}>
              {[
                { key: "base_price_ils",  label: "מחיר בסיס (₪)",   required: true },
                { key: "per_seat_ils",    label: "מחיר למושב נוסף (₪)" },
                { key: "included_seats",  label: "מושבים כלולים" },
                { key: "setup_fee_ils",   label: "דמי הקמה (₪)" },
              ].map(({ key, label, required }) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="text-xs font-semibold text-slate-600 w-28 shrink-0">
                    {required && <span className="text-red-500 ml-0.5">*</span>}
                    {label}
                  </label>
                  <input
                    type="number" step={key === "included_seats" ? "1" : "0.01"}
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setF(key, e.target.value)}
                    className={inputCls}
                  />
                </div>
              ))}
            </div>

            {/* Date fields */}
            <div className={`border-t border-slate-200 pt-3 space-y-2 ${mode === "add" && hasActiveRow ? "hidden" : ""}`}>
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-600 w-28 shrink-0">
                  <span className="text-red-500 ml-0.5">*</span>
                  תוקף מתאריך
                </label>
                <HebrewDatePicker
                  value={validFrom}
                  onChange={setValidFrom}
                  className={`${dateCls}
                    ${mode === "add" || mode === "set"
                      ? "border-amber-400 bg-amber-50 focus:border-amber-600 font-semibold"
                      : "border-slate-300 focus:border-blue-400"}`}
                />
                {mode === "add" && <span className="text-xs text-amber-700 font-medium">תאריך תחילת תוקף חדש</span>}
                {mode === "set" && <span className="text-xs text-amber-700 font-medium">תחילת תקופת הקביעה</span>}
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-600 w-28 shrink-0">
                  תוקף עד (אופציונלי)
                </label>
                <HebrewDatePicker
                  value={validTo}
                  onChange={setValidTo}
                  className={`${dateCls}
                    ${mode === "set" ? "border-amber-300 bg-amber-50 focus:border-amber-500" : "border-slate-300 focus:border-blue-400"}`}
                />
                {!validTo && <span className="text-xs text-slate-400">ריק = ללא תאריך סיום</span>}
                {validTo && (
                  <span className="text-xs text-blue-600 cursor-pointer hover:underline"
                    onClick={() => setValidTo("")}>✕ נקה</span>
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
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
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
              <button onClick={switchToUpdateMode}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded text-slate-600 hover:bg-slate-100">
                ← חזרה לשמור
              </button>
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
            /* עדכון mode — split button [שמור | ▾] */
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ModuleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const slug   = params.slug as string;

  const [data,          setData]          = useState<ModuleWithHistory | null>(null);
  const [benchmark,     setBenchmark]     = useState<PricingRecommendation | null>(null);
  const [benchmarkOpen, setBenchmarkOpen] = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [editModal,     setEditModal]     = useState(false);
  const [priceModal,    setPriceModal]    = useState(false);
  const [editRow,       setEditRow]       = useState<ModulePriceOut | undefined>(undefined);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get<ModuleWithHistory>(`/api/admin/modules/${slug}`),
      api.get<PricingResearchPayload>("/api/admin/modules/pricing-recommendations"),
    ])
      .then(([moduleData, researchData]) => {
        setData(moduleData);
        const rec = researchData.modules.find((m) => m.module_slug === slug) ?? null;
        setBenchmark(rec);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    loadData();
  }, [router, loadData]);

  function openNewPrice() {
    setEditRow(undefined);
    setPriceModal(true);
  }

  function openEditPrice(rowIndex: number) {
    if (!data) return;
    const row = data.price_history[rowIndex];
    if (!row) return;
    setEditRow({ ...row });
    setPriceModal(true);
  }

  if (loading || !data) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
        <main className="flex-1 flex items-center justify-center">
          <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  // ── Parent content ───────────────────────────────────────────────────────────
  const parentContent = (
    <>
      <div className="px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-2">
        <FormField label="שם המודול"    value={data.name}                          readOnly />
        <FormField label="מזהה (slug)"  value={data.slug}                          readOnly />
        <FormField label="תיאור"        value={data.description ?? "—"}            readOnly />
        <FormField
          label="סטטוס"
          type="select"
          value={data.is_active ? "active" : "inactive"}
          options={[{ value: "active", label: "פעיל" }, { value: "inactive", label: "לא פעיל" }]}
          readOnly
        />
        <FormField label="חובה"         value={data.is_required ? "כן" : "לא"}    readOnly />
        <FormField label="סדר תצוגה"   value={String(data.sort_order)}            readOnly />
        {data.icon      && <FormField label="אייקון"  value={data.icon}      readOnly />}
        {data.color_hex && <FormField label="צבע"     value={data.color_hex} readOnly />}
      </div>

      {/* ── Benchmark Card ───────────────────────────────────────── */}
      {benchmark && (
        <div className="mx-4 mb-3 rounded-xl border border-indigo-200 bg-indigo-50/40 overflow-hidden">
          {/* Header — always visible */}
          <button
            type="button"
            onClick={() => setBenchmarkOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-right hover:bg-indigo-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-indigo-800">סקר שוק ו-Benchmark</span>
              <span className="text-[11px] text-indigo-600 bg-indigo-100 rounded-full px-2 py-0.5">
                {benchmark.market_category}
              </span>
              <span className="text-[11px] text-slate-600">
                עוגן: {benchmark.benchmark_window_ils} ל-{benchmark.benchmark_team_size} משתמשים
              </span>
              <span className="inline-flex rounded-full bg-brand-50 text-brand-700 px-2 py-0.5 text-[11px] font-medium">
                {benchmark.action}
              </span>
            </div>
            {benchmarkOpen
              ? <ChevronUp size={14} className="text-indigo-500 shrink-0" />
              : <ChevronDown size={14} className="text-indigo-500 shrink-0" />
            }
          </button>

          {/* Expanded detail */}
          {benchmarkOpen && (
            <div className="px-4 pb-4 space-y-3" dir="rtl">
              {/* Rationale */}
              <p className="text-xs text-slate-600 leading-5">{benchmark.rationale}</p>

              {/* Price comparison */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white rounded-lg border border-slate-200 px-3 py-2">
                  <div className="text-slate-500 text-[11px] mb-1">נוכחי ל-{benchmark.benchmark_team_size} משתמשים</div>
                  <div className="font-bold text-slate-800 text-sm">{fmt(benchmark.current_monthly_at_benchmark_ils)}/חודש</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {pricingSummaryText(benchmark.current_price)}
                  </div>
                  <div className="text-[11px] text-slate-400">הקמה {fmt(benchmark.current_price?.setup_fee_ils)}</div>
                </div>
                <div className="bg-white rounded-lg border border-brand-200 px-3 py-2">
                  <div className="text-brand-600 text-[11px] mb-1">מומלץ ל-{benchmark.benchmark_team_size} משתמשים</div>
                  <div className="font-bold text-brand-800 text-sm">{fmt(benchmark.recommended_monthly_at_benchmark_ils)}/חודש</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {pricingSummaryText(benchmark.recommended_price)}
                  </div>
                  <div className="text-[11px] text-slate-400">הקמה {fmt(benchmark.recommended_price.setup_fee_ils)}</div>
                </div>
              </div>

              {/* Delta */}
              <div className="flex items-center gap-4 text-xs">
                <span className="text-slate-500">שינוי חודשי:</span>
                <span className={`font-semibold ${parseFloat(benchmark.monthly_delta_ils) > 0 ? "text-amber-700" : parseFloat(benchmark.monthly_delta_ils) < 0 ? "text-emerald-700" : "text-slate-600"}`}>
                  {parseFloat(benchmark.monthly_delta_ils) > 0 ? "+" : ""}{fmt(benchmark.monthly_delta_ils)}
                </span>
                <span className="text-slate-400 mx-1">|</span>
                <span className="text-slate-500">שינוי הקמה:</span>
                <span className={`font-semibold ${parseFloat(benchmark.setup_delta_ils) > 0 ? "text-amber-700" : parseFloat(benchmark.setup_delta_ils) < 0 ? "text-emerald-700" : "text-slate-600"}`}>
                  {parseFloat(benchmark.setup_delta_ils) > 0 ? "+" : ""}{fmt(benchmark.setup_delta_ils)}
                </span>
              </div>

              {/* Anchors table */}
              <div>
                <div className="text-[11px] font-semibold text-slate-500 mb-1">מקורות השוואה</div>
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <table className="admin-data-table w-full text-[11px]">
                    <thead className="bg-slate-100 text-slate-500">
                      <tr>
                        <th className="text-right px-3 py-1.5 font-semibold">ספק / מוצר</th>
                        <th className="text-right px-3 py-1.5 font-semibold">מחיר</th>
                        <th className="text-right px-3 py-1.5 font-semibold">נורמלי (₪/חודש)</th>
                        <th className="text-right px-3 py-1.5 font-semibold">בסיס</th>
                      </tr>
                    </thead>
                    <tbody>
                      {benchmark.anchors.map((anchor, i) => (
                        <tr key={`${anchor.vendor}-${anchor.product}`} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                          <td className="px-3 py-1.5 border-t border-slate-100">
                            <a
                              href={anchor.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-brand-700 hover:text-brand-800 underline underline-offset-1"
                            >
                              {anchor.vendor} / {anchor.product}
                            </a>
                          </td>
                          <td className="px-3 py-1.5 border-t border-slate-100 text-slate-600">{anchor.price_display}</td>
                          <td className="px-3 py-1.5 border-t border-slate-100 text-slate-700">
                            {anchor.normalized_monthly_ils !== "0.00" ? fmt(anchor.normalized_monthly_ils) : "לא שקוף"}
                          </td>
                          <td className="px-3 py-1.5 border-t border-slate-100 text-slate-500">{anchor.basis}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );

  // ── Price history rows ───────────────────────────────────────────────────────
  const priceRows = data.price_history.map((p) => ({
    _current:       !p.valid_to,
    _valid_from_raw: p.valid_from,
    _valid_to_raw: p.valid_to ?? null,
    base_price_ils: fmt(p.base_price_ils),
    per_seat_ils:   fmt(p.overage_per_seat_ils ?? p.per_seat_ils),
    included_seats: p.included_seats,
    setup_fee_ils:  fmt(p.setup_fee_ils),
    valid_from:     fmtDate(p.valid_from),
    valid_to: p.valid_to ? (
      fmtDate(p.valid_to)
    ) : (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />פעיל
      </span>
    ),
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
      <main className="flex-1 overflow-hidden flex flex-col">
        <CardPage
          title={data.name}
          backHref="/admin/modules"
          backLabel="מודולים"
          status={data.is_active
            ? { label: "פעיל",    type: "active" }
            : { label: "לא פעיל", type: "cancelled" }}
          primaryActions={[
            { label: "ערוך",      onClick: () => setEditModal(true), variant: "default"  },
            { label: "מחיר חדש", onClick: openNewPrice,             variant: "primary"  },
          ]}
          parentContent={parentContent}
          formTabs={[]}
          childTabs={[
            {
              id: "prices",
              label: "מחירון",
              columns: [
                { key: "valid_from",      label: "תוקף מתאריך",     width: "w-28" },
                { key: "valid_to",        label: "תוקף עד",         width: "w-28" },
                { key: "base_price_ils",  label: "מחיר בסיס",      width: "w-32" },
                { key: "per_seat_ils",    label: "למושב נוסף",      width: "w-28" },
                { key: "included_seats",  label: "מושבים כלולים",  width: "w-32" },
                { key: "setup_fee_ils",   label: "דמי הקמה",        width: "w-28" },
              ],
              rows: priceRows as Record<string, React.ReactNode>[],
              temporalFilter: true,
              emptyMessage: "אין רשומות מחיר — לחץ להוספה",
              onAddClick: openNewPrice,
              onRowDoubleClick: openEditPrice,
            },
          ]}
        />
      </main>

      {editModal && (
        <EditModuleModal
          data={data}
          onClose={() => setEditModal(false)}
          onSaved={loadData}
          onDeleted={() => router.replace("/admin/modules")}
        />
      )}

      {priceModal && (
        <PriceModal
          slug={slug}
          priceHistory={data.price_history}
          editRow={editRow}
          onClose={() => setPriceModal(false)}
          onSaved={loadData}
        />
      )}
    </div>
  );
}
