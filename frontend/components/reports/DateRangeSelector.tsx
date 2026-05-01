"use client";
import { useState } from "react";
import { Calendar, CalendarRange, ChevronDown, X } from "lucide-react";
import { ReportDefinition } from "./types";

// ── helpers ───────────────────────────────────────────────────────────────────
function toISO(d: Date): string {
  return d.toISOString().split("T")[0];
}
function today(): Date { return new Date(); }
function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}
function endOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 11, 31);
}
function formatHebrew(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ── Presets ───────────────────────────────────────────────────────────────────
type PresetId =
  | "as_of_today" | "as_of_month_start" | "as_of_month_end"
  | "range_this_month" | "range_last_month"
  | "range_3m" | "range_6m" | "range_12m"
  | "range_this_year" | "range_last_year"
  | "custom";

interface Preset {
  id: PresetId;
  label: string;
  emoji: string;
  isRange: boolean;
  compute: () => { as_of_date: string | null; date_from: string | null; date_to: string | null };
}

const PRESETS: Preset[] = [
  {
    id: "as_of_today",
    label: "היום",
    emoji: "📌",
    isRange: false,
    compute: () => ({ as_of_date: toISO(today()), date_from: null, date_to: null }),
  },
  {
    id: "as_of_month_start",
    label: "תחילת החודש",
    emoji: "🗓",
    isRange: false,
    compute: () => ({ as_of_date: toISO(startOfMonth(today())), date_from: null, date_to: null }),
  },
  {
    id: "range_this_month",
    label: "החודש הנוכחי",
    emoji: "📅",
    isRange: true,
    compute: () => ({ as_of_date: null, date_from: toISO(startOfMonth(today())), date_to: toISO(today()) }),
  },
  {
    id: "range_last_month",
    label: "החודש הקודם",
    emoji: "⏪",
    isRange: true,
    compute: () => {
      const prev = addMonths(today(), -1);
      return { as_of_date: null, date_from: toISO(startOfMonth(prev)), date_to: toISO(endOfMonth(prev)) };
    },
  },
  {
    id: "range_3m",
    label: "3 חודשים אחרונים",
    emoji: "📊",
    isRange: true,
    compute: () => ({ as_of_date: null, date_from: toISO(addMonths(today(), -3)), date_to: toISO(today()) }),
  },
  {
    id: "range_6m",
    label: "6 חודשים אחרונים",
    emoji: "📈",
    isRange: true,
    compute: () => ({ as_of_date: null, date_from: toISO(addMonths(today(), -6)), date_to: toISO(today()) }),
  },
  {
    id: "range_12m",
    label: "12 חודשים אחרונים",
    emoji: "📆",
    isRange: true,
    compute: () => ({ as_of_date: null, date_from: toISO(addMonths(today(), -12)), date_to: toISO(today()) }),
  },
  {
    id: "range_this_year",
    label: "שנה נוכחית",
    emoji: "🏦",
    isRange: true,
    compute: () => ({ as_of_date: null, date_from: toISO(startOfYear(today())), date_to: toISO(today()) }),
  },
  {
    id: "range_last_year",
    label: "שנה קודמת",
    emoji: "📋",
    isRange: true,
    compute: () => {
      const prev = new Date(today().getFullYear() - 1, 0, 1);
      return { as_of_date: null, date_from: toISO(startOfYear(prev)), date_to: toISO(endOfYear(prev)) };
    },
  },
  {
    id: "custom",
    label: "מותאם אישית",
    emoji: "✏️",
    isRange: true,
    compute: () => ({ as_of_date: null, date_from: null, date_to: null }),
  },
];

// ── Component ─────────────────────────────────────────────────────────────────
interface DateRangeSelectorProps {
  definition: ReportDefinition;
  setDefinition: React.Dispatch<React.SetStateAction<ReportDefinition>>;
}

function getActiveLabel(def: ReportDefinition): string {
  if (def.date_from && def.date_to) {
    return `${formatHebrew(def.date_from)} – ${formatHebrew(def.date_to)}`;
  }
  if (def.as_of_date) {
    return `נכון ל-${formatHebrew(def.as_of_date)}`;
  }
  return "כל הנתונים";
}

function getActiveModeIcon(def: ReportDefinition): React.ElementType {
  return def.date_from ? CalendarRange : Calendar;
}

export function DateRangeSelector({ definition, setDefinition }: DateRangeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(definition.date_from ?? "");
  const [customTo, setCustomTo] = useState(definition.date_to ?? "");

  const isRange = !!(definition.date_from && definition.date_to);
  const hasDate = !!(definition.date_from || definition.date_to || definition.as_of_date);
  const Icon = getActiveModeIcon(definition);
  const label = getActiveLabel(definition);

  const applyPreset = (preset: Preset) => {
    const vals = preset.compute();
    if (preset.id === "custom") {
      // Don't close — let user pick dates
      setDefinition((prev) => ({ ...prev, as_of_date: null, date_from: null, date_to: null, offset: 0 }));
      return;
    }
    setDefinition((prev) => ({ ...prev, ...vals, offset: 0 }));
    setOpen(false);
  };

  const applyCustom = () => {
    if (!customFrom || !customTo) return;
    setDefinition((prev) => ({ ...prev, as_of_date: null, date_from: customFrom, date_to: customTo, offset: 0 }));
    setOpen(false);
  };

  const clearDate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDefinition((prev) => ({ ...prev, as_of_date: null, date_from: null, date_to: null, offset: 0 }));
  };

  const asOfPresets = PRESETS.filter((p) => !p.isRange);
  const rangePresets = PRESETS.filter((p) => p.isRange && p.id !== "custom");

  return (
    <div className="relative" dir="rtl">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 h-8 rounded-lg border px-2.5 text-xs font-medium transition ${
          isRange
            ? "border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100"
            : hasDate
            ? "border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100"
            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        <Icon size={13} />
        <span className="hidden sm:inline max-w-[160px] truncate">{label}</span>
        {hasDate && (
          <span
            onClick={clearDate}
            className="mr-0.5 flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
            title="נקה תאריך"
          >
            <X size={10} />
          </span>
        )}
        <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 z-30 mt-1.5 w-72 rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">

            {/* Header */}
            <div className="bg-gradient-to-l from-blue-50 to-white px-4 py-3 border-b border-slate-100">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-0.5">תקופת הדוח</div>
              <p className="text-xs text-slate-600">
                {isRange
                  ? "🔄 מצב טווח — שורה לכל שינוי בתקופה"
                  : hasDate
                  ? "📸 מצב נקודת זמן — snapshot"
                  : "ℹ️ ללא סינון תאריך — כל הנתונים"}
              </p>
            </div>

            <div className="p-3 space-y-3">
              {/* As-of presets */}
              <div>
                <div className="mb-1.5 px-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  📸 נקודת זמן (snapshot)
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {asOfPresets.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => applyPreset(preset)}
                      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-right text-xs transition ${
                        definition.as_of_date === preset.compute().as_of_date && !definition.date_from
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-slate-50 text-slate-700 hover:bg-blue-50 hover:text-blue-800"
                      }`}
                    >
                      <span>{preset.emoji}</span>
                      <span className="font-medium">{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">או</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>

              {/* Range presets */}
              <div>
                <div className="mb-1.5 px-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  🔄 טווח תאריכים (שורה לכל שינוי)
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {rangePresets.map((preset) => {
                    const vals = preset.compute();
                    const isActive = definition.date_from === vals.date_from && definition.date_to === vals.date_to;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => applyPreset(preset)}
                        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-right text-xs transition ${
                          isActive
                            ? "bg-violet-600 text-white shadow-sm"
                            : "bg-slate-50 text-slate-700 hover:bg-violet-50 hover:text-violet-800"
                        }`}
                      >
                        <span>{preset.emoji}</span>
                        <span className="font-medium">{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom range */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">✏️ טווח מותאם</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">מתאריך</label>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">עד תאריך</label>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      min={customFrom}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-100"
                    />
                  </div>
                </div>
                <button
                  onClick={applyCustom}
                  disabled={!customFrom || !customTo}
                  className="mt-2 w-full rounded-lg bg-violet-600 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  החל טווח
                </button>
              </div>

              {/* Info box when range mode active */}
              {isRange && (
                <div className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-[11px] text-violet-800">
                  <strong>מצב טווח פעיל:</strong> הדוח יציג שורה לכל גרסה/שינוי של כל לקוח בתקופה זו.
                  אם לקוח שינה תבנית — יופיעו 2 שורות.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
