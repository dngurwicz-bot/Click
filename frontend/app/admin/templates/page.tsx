"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, api } from "@/lib/api";
import { TopNav } from "@/components/layout/TopNav";
import { HelpCircle, Printer, RefreshCw, Search, X } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface TemplateOut {
  id: string;
  name: string;
  description: string | null;
  default_package_slug: string | null;
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

const BILLING_CYCLE_LABELS: Record<string, string> = {
  monthly:   "חודשי",
  yearly:    "שנתי",
  quarterly: "רבעוני",
};

// ── Modal ──────────────────────────────────────────────────────────────────

type TemplateMode = "update" | "add" | "set" | "delete" | "close";

interface TemplateModalProps {
  templates: TemplateOut[];
  editRow?: TemplateOut;
  onClose: () => void;
  onSaved: () => void;
  modules: { slug: string; name: string }[];
}

function TemplateModal({ templates, editRow, onClose, onSaved, modules }: TemplateModalProps) {
  const today        = new Date().toISOString().slice(0, 10);
  const hasActiveRow = templates.some((r) => !r.valid_to);
  const activeRow    = templates.find((r) => !r.valid_to);

  const [mode,         setMode]         = useState<TemplateMode>(editRow ? "update" : "add");
  const [form,         setForm]         = useState({
    name:                  editRow?.name ?? "",
    description:           editRow?.description ?? "",
    default_package_slug:  editRow?.default_package_slug ?? "",
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
  const [selectedModules, setSelectedModules] = useState<string[]>(editRow?.module_slugs ?? []);

  function setF(k: string, v: string | boolean) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function switchToAddMode() {
    setMode("add");
    setForm({
      name: "", description: "", default_package_slug: "",
      default_billing_cycle: "monthly", trial_days: "30",
      is_active: true, sort_order: "10", target_industry: "", recommended_size: "",
    });
    setValidFrom(""); setError(null); setDropdownOpen(false); setSelectedModules([]);
  }
  function switchToSetMode()    { setMode("set");    setValidTo(""); setError(null); setDropdownOpen(false); setSelectedModules(editRow?.module_slugs ?? []); }
  function switchToUpdateMode() {
    setMode("update");
    setForm({
      name:                  editRow?.name ?? "",
      description:           editRow?.description ?? "",
      default_package_slug:  editRow?.default_package_slug ?? "",
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
  }
  function switchToDeleteMode() { setMode("delete"); setError(null); setDropdownOpen(false); }
  function switchToCloseMode()  { setMode("close");  setValidTo(""); setError(null); setDropdownOpen(false); }

  function buildBody(action: TemplateMode) {
    return {
      action,
      ...(action === "update" && editRow?.id ? { template_id: editRow.id } : {}),
      name:                  form.name,
      description:           form.description || null,
      default_package_slug:  form.default_package_slug || null,
      default_billing_cycle: form.default_billing_cycle,
      trial_days:            parseInt(form.trial_days) || 30,
      is_active:             form.is_active,
      sort_order:            parseInt(form.sort_order) || 10,
      target_industry:       form.target_industry || null,
      recommended_size:      form.recommended_size || null,
      ...(validFrom ? { valid_from: validFrom } : {}),
      valid_to: validTo || null,
      module_slugs: selectedModules,
    };
  }

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4" dir="rtl"
           onClick={() => setDropdownOpen(false)}>

        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-3 border-b border-slate-200 rounded-t-lg ${headerBg}`}>
          <h2 className={`text-sm font-bold ${headerText}`}>{modalTitle}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/60 text-slate-500"><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">

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
                <input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)}
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

            <div className={`space-y-3 ${mode === "add" && hasActiveRow ? "hidden" : ""}`}>
              {/* שם תבנית */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-600 w-28 shrink-0">
                  <span className="text-red-500 ml-0.5">*</span>
                  שם תבנית
                </label>
                <input type="text" value={form.name} onChange={(e) => setF("name", e.target.value)}
                  placeholder="שם התבנית" className={inputCls} />
              </div>

              {/* תיאור */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-600 w-28 shrink-0">תיאור</label>
                <input type="text" value={form.description} onChange={(e) => setF("description", e.target.value)}
                  placeholder="תיאור קצר (אופציונלי)" className={inputCls} />
              </div>

              {/* מסלול ברירת מחדל */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-600 w-28 shrink-0">מסלול ברירת מחדל</label>
                <input type="text" value={form.default_package_slug} onChange={(e) => setF("default_package_slug", e.target.value)}
                  placeholder="package-slug" className={inputCls} dir="ltr" />
              </div>

              {/* מחזור חיוב */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-600 w-28 shrink-0">מחזור חיוב</label>
                <select value={form.default_billing_cycle} onChange={(e) => setF("default_billing_cycle", e.target.value)}
                  className={inputCls}>
                  <option value="monthly">חודשי</option>
                  <option value="yearly">שנתי</option>
                  <option value="quarterly">רבעוני</option>
                </select>
              </div>

              {/* ימי ניסיון */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-600 w-28 shrink-0">ימי ניסיון</label>
                <input type="number" step="1" min="0" value={form.trial_days} onChange={(e) => setF("trial_days", e.target.value)}
                  className={inputCls} />
              </div>

              {/* תעשייה */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-600 w-28 shrink-0">תעשייה</label>
                <input type="text" value={form.target_industry} onChange={(e) => setF("target_industry", e.target.value)}
                  placeholder="תעשיית היעד (אופציונלי)" className={inputCls} />
              </div>

              {/* גודל מומלץ */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-600 w-28 shrink-0">גודל מומלץ</label>
                <input type="text" value={form.recommended_size} onChange={(e) => setF("recommended_size", e.target.value)}
                  placeholder="גודל ארגון מומלץ (אופציונלי)" className={inputCls} />
              </div>

              {/* פעיל */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-600 w-28 shrink-0">פעיל</label>
                <button type="button" onClick={() => setF("is_active", !form.is_active)}
                  className={`relative rounded-full transition-colors duration-200 ${form.is_active ? "bg-emerald-500" : "bg-slate-200"}`}
                  style={{ width: 32, height: 18 }}>
                  <span className={`absolute top-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${form.is_active ? "translate-x-[14px]" : "translate-x-0.5"}`}
                    style={{ width: 14, height: 14 }} />
                </button>
                <span className="text-xs text-slate-500">{form.is_active ? "פעיל" : "לא פעיל"}</span>
              </div>

              {/* מודולים */}
              <div>
                <label className="block text-xs text-slate-500 mb-1 text-right">מודולים בתבנית</label>
                <div className="border border-slate-200 rounded-md p-2 max-h-40 overflow-y-auto bg-slate-50">
                  {modules.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-2">אין מודולים</p>
                  )}
                  {modules.map(m => (
                    <label key={m.slug} className="flex items-center gap-2 px-2 py-1 hover:bg-white rounded cursor-pointer text-right">
                      <input
                        type="checkbox"
                        checked={selectedModules.includes(m.slug)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedModules(prev => [...prev, m.slug]);
                          else setSelectedModules(prev => prev.filter(s => s !== m.slug));
                        }}
                        className="rounded border-slate-300"
                      />
                      <span className="text-xs text-slate-700 flex-1 text-right">{m.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{m.slug}</span>
                    </label>
                  ))}
                </div>
                {selectedModules.length > 0 && (
                  <p className="text-[10px] text-slate-400 mt-1 text-right">{selectedModules.length} מודולים נבחרו</p>
                )}
              </div>
            </div>

            {/* Date fields */}
            <div className={`border-t border-slate-200 pt-3 space-y-2 ${mode === "add" && hasActiveRow ? "hidden" : ""}`}>
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-600 w-28 shrink-0">
                  <span className="text-red-500 ml-0.5">*</span>
                  תוקף מתאריך
                </label>
                <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)}
                  className={`${dateCls}
                    ${mode === "add" || mode === "set"
                      ? "border-amber-400 bg-amber-50 focus:border-amber-600 font-semibold"
                      : "border-slate-300 focus:border-blue-400"}`} />
                {mode === "add" && <span className="text-xs text-amber-700 font-medium">תאריך תחילת תוקף חדש</span>}
                {mode === "set" && <span className="text-xs text-amber-700 font-medium">תחילת תקופת הקביעה</span>}
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-600 w-28 shrink-0">תוהף עד (אופציונלי)</label>
                <input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)}
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
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-lg">
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
            /* UPDATE mode — split button [שמור | ▾] */
            <>
              <button onClick={onClose}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded text-slate-600 hover:bg-slate-100">
                ביטול
              </button>
              <div className="relative flex">
                <button onClick={(e) => { e.stopPropagation(); handleSave("update"); }} disabled={saving}
                  className="px-4 py-1.5 text-xs bg-[#0d6efd] hover:bg-[#0b5ed7] text-white rounded-r transition-colors disabled:opacity-50 border-l border-blue-400">
                  {saving ? "שומר..." : "שמור"}
                </button>
                <button onClick={(e) => { e.stopPropagation(); setDropdownOpen((o) => !o); }} disabled={saving}
                  className="px-2 py-1.5 text-xs bg-[#0d6efd] hover:bg-[#0b5ed7] text-white rounded-l transition-colors disabled:opacity-50">
                  ▾
                </button>
                {dropdownOpen && (
                  <div className="absolute bottom-full left-0 mb-1 bg-white border border-slate-200 rounded shadow-lg z-10 min-w-[160px] text-right">
                    <button onClick={(e) => { e.stopPropagation(); switchToAddMode(); }}
                      disabled={hasActiveRow}
                      className={`w-full px-4 py-2 text-xs text-right block border-b border-slate-100
                        ${hasActiveRow ? "text-slate-400 cursor-not-allowed bg-slate-50" : "text-slate-700 hover:bg-blue-50"}`}>
                      רשומה חדשה
                      {hasActiveRow && <span className="block text-[10px] text-slate-400 leading-tight">קיימת רשומה פעילה</span>}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); handleSave("update"); }}
                      className="w-full px-4 py-2 text-xs text-slate-700 hover:bg-blue-50 text-right block border-b border-slate-100">
                      שמור
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); switchToSetMode(); }}
                      className="w-full px-4 py-2 text-xs text-amber-700 hover:bg-amber-50 text-right block font-medium border-b border-slate-100">
                      קבע תקופה
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); switchToCloseMode(); }}
                      disabled={!hasActiveRow}
                      className={`w-full px-4 py-2 text-xs text-right block border-b border-slate-100
                        ${!hasActiveRow ? "text-slate-400 cursor-not-allowed" : "text-orange-700 hover:bg-orange-50"}`}>
                      סגור תקופה
                      {!hasActiveRow && <span className="block text-[10px] text-slate-400 leading-tight">אין שורה פעילה</span>}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); switchToDeleteMode(); }}
                      className="w-full px-4 py-2 text-xs text-red-700 hover:bg-red-50 text-right block font-medium">
                      מחק שורה זו
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function AdminTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateOut[]>([]);
  const [modules,   setModules]   = useState<{ slug: string; name: string; is_active: boolean }[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [modal,     setModal]     = useState<{ editRow?: TemplateOut } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  function loadData() {
    setLoading(true);
    setLoadError(null);
    Promise.all([
      api.get<TemplateOut[]>("/api/admin/templates"),
      api.get<{ slug: string; name: string; is_active: boolean }[]>("/api/admin/modules"),
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
    (t.target_industry ?? "").includes(search) ||
    (t.default_package_slug ?? "").includes(search)
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <TopNav />

      <main className="flex-1 overflow-hidden flex flex-col">

        {/* ── Title Bar */}
        <div className="bg-white border-b border-slate-200 flex items-center justify-between px-3 py-1.5 shrink-0"
             style={{ boxShadow: "0 1px 0 0 #e2e8f0" }}>
          <div className="flex items-center gap-0.5">
            <button title="עזרה"
              className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <HelpCircle size={13} />
            </button>
            <button title="הדפסה"
              className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <Printer size={13} />
            </button>
            <button title="רענן"
              className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              onClick={loadTemplates}>
              <RefreshCw size={13} />
            </button>
          </div>
          <h1 className="text-sm font-semibold tracking-wide" style={{ color: "#1c2831" }}>
            תבניות הקמה
          </h1>
        </div>

        {/* ── Action Bar */}
        <div className="bg-slate-50 border-b border-slate-200 flex items-center justify-between px-3 py-1.5 shrink-0 gap-4">
          <div className="flex items-center gap-2">
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

          <div className="flex items-center gap-3">
            {!loading && (
              <span className="text-xs text-slate-400 font-medium">{filtered.length} תבניות</span>
            )}
            <button
              onClick={() => setModal({})}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white
                         bg-brand-500 hover:bg-brand-600 rounded-lg transition-colors"
            >
              + חדש
            </button>
          </div>
        </div>

        {/* ── Table */}
        <div className="flex-1 overflow-auto bg-white min-h-0">
          {loadError ? (
            <div className="py-20 text-center text-red-500 text-sm">{loadError}</div>
          ) : loading ? (
            <div className="py-20 flex flex-col items-center gap-3 text-slate-400">
              <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">טוען...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-sm">לא נמצאו תבניות</div>
          ) : (
            <table className="w-full text-xs border-collapse" dir="rtl">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">שם</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">מסלול ברירת מחדל</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">מחזור חיוב</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">ימי ניסיון</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">מודולים</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">תעשייה</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">תוקף מ</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">תוקף עד</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => (
                  <tr
                    key={t.id}
                    onDoubleClick={() => setModal({ editRow: t })}
                    className={`transition-colors cursor-pointer
                      ${i % 2 === 0 ? "bg-white hover:bg-brand-50/40" : "bg-slate-50/60 hover:bg-brand-50/40"}`}
                  >
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-800 font-medium">
                      <div>
                        <div>{t.name}</div>
                        {t.description && (
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[200px]">{t.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-500 font-mono text-[11px]">
                      {t.default_package_slug ?? "—"}
                    </td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-600">
                      {BILLING_CYCLE_LABELS[t.default_billing_cycle] ?? t.default_billing_cycle}
                    </td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-600 text-center">
                      {t.trial_days}
                    </td>
                    <td className="px-4 py-2 border-b border-slate-100 text-center">
                      <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-medium bg-brand-100 text-brand-700 rounded-full">
                        {t.module_slugs?.length ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-500">
                      {t.target_industry ?? "—"}
                    </td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-500 whitespace-nowrap">
                      {fmtDate(t.valid_from)}
                    </td>
                    <td className="px-4 py-2 border-b border-slate-100 whitespace-nowrap">
                      {t.valid_to ? (
                        <span className="text-slate-500">{fmtDate(t.valid_to)}</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-700">פעיל</span>
                      )}
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
