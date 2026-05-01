"use client";

import { useState } from "react";
import { Calendar, CalendarRange, ChevronDown, X } from "lucide-react";
import { ReportDefinition } from "./types";

function toISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

function today(): Date {
  return new Date();
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function endOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 11, 31);
}

function formatHebrew(iso: string | null): string {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

type PresetId =
  | "as_of_today"
  | "as_of_month_start"
  | "range_this_month"
  | "range_last_month"
  | "range_3m"
  | "range_6m"
  | "range_12m"
  | "range_this_year"
  | "range_last_year";

interface Preset {
  id: PresetId;
  label: string;
  mode: "snapshot" | "range";
  compute: () => { as_of_date: string | null; date_from: string | null; date_to: string | null };
}

const PRESETS: Preset[] = [
  {
    id: "as_of_today",
    label: "היום",
    mode: "snapshot",
    compute: () => ({ as_of_date: toISO(today()), date_from: null, date_to: null }),
  },
  {
    id: "as_of_month_start",
    label: "תחילת חודש",
    mode: "snapshot",
    compute: () => ({ as_of_date: toISO(startOfMonth(today())), date_from: null, date_to: null }),
  },
  {
    id: "range_this_month",
    label: "חודש נוכחי",
    mode: "range",
    compute: () => ({ as_of_date: null, date_from: toISO(startOfMonth(today())), date_to: toISO(today()) }),
  },
  {
    id: "range_last_month",
    label: "חודש קודם",
    mode: "range",
    compute: () => {
      const previous = addMonths(today(), -1);
      return { as_of_date: null, date_from: toISO(startOfMonth(previous)), date_to: toISO(endOfMonth(previous)) };
    },
  },
  {
    id: "range_3m",
    label: "3 חודשים",
    mode: "range",
    compute: () => ({ as_of_date: null, date_from: toISO(addMonths(today(), -3)), date_to: toISO(today()) }),
  },
  {
    id: "range_6m",
    label: "6 חודשים",
    mode: "range",
    compute: () => ({ as_of_date: null, date_from: toISO(addMonths(today(), -6)), date_to: toISO(today()) }),
  },
  {
    id: "range_12m",
    label: "12 חודשים",
    mode: "range",
    compute: () => ({ as_of_date: null, date_from: toISO(addMonths(today(), -12)), date_to: toISO(today()) }),
  },
  {
    id: "range_this_year",
    label: "שנה נוכחית",
    mode: "range",
    compute: () => ({ as_of_date: null, date_from: toISO(startOfYear(today())), date_to: toISO(today()) }),
  },
  {
    id: "range_last_year",
    label: "שנה קודמת",
    mode: "range",
    compute: () => {
      const previous = new Date(today().getFullYear() - 1, 0, 1);
      return { as_of_date: null, date_from: toISO(startOfYear(previous)), date_to: toISO(endOfYear(previous)) };
    },
  },
];

interface DateRangeSelectorProps {
  definition: ReportDefinition;
  setDefinition: React.Dispatch<React.SetStateAction<ReportDefinition>>;
}

function getLabel(definition: ReportDefinition): string {
  if (definition.date_from && definition.date_to) return `${formatHebrew(definition.date_from)} - ${formatHebrew(definition.date_to)}`;
  if (definition.as_of_date) return `נכון ל-${formatHebrew(definition.as_of_date)}`;
  return "כל הנתונים";
}

export function DateRangeSelector({ definition, setDefinition }: DateRangeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(definition.date_from ?? "");
  const [customTo, setCustomTo] = useState(definition.date_to ?? "");
  const hasDate = !!(definition.date_from || definition.date_to || definition.as_of_date);
  const isRange = !!(definition.date_from && definition.date_to);
  const Icon = isRange ? CalendarRange : Calendar;

  const applyDates = (dates: { as_of_date: string | null; date_from: string | null; date_to: string | null }) => {
    setDefinition((prev) => ({ ...prev, ...dates, offset: 0 }));
    setOpen(false);
  };

  const clearDate = (event: React.MouseEvent) => {
    event.stopPropagation();
    applyDates({ as_of_date: null, date_from: null, date_to: null });
  };

  return (
    <div className="relative" dir="rtl">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-7 max-w-[220px] items-center gap-1.5 rounded border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        <Icon size={12} />
        <span className="truncate">{getLabel(definition)}</span>
        {hasDate && (
          <span title="נקה תאריך" onClick={clearDate} className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={10} />
          </span>
        )}
        <ChevronDown size={11} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-30 mt-1 w-[360px] border border-slate-300 bg-white shadow-lg">
            <div className="border-b border-slate-300 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">תקופת הדוח</div>
            <div className="grid grid-cols-2 gap-0 border-b border-slate-200">
              <div>
                <div className="border-b border-l border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600">נקודת זמן</div>
                {PRESETS.filter((preset) => preset.mode === "snapshot").map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyDates(preset.compute())}
                    className="block h-8 w-full border-b border-l border-slate-100 px-3 text-right text-xs text-slate-700 hover:bg-brand-50"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div>
                <div className="border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600">טווח תאריכים</div>
                {PRESETS.filter((preset) => preset.mode === "range").map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyDates(preset.compute())}
                    className="block h-8 w-full border-b border-slate-100 px-3 text-right text-xs text-slate-700 hover:bg-brand-50"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 p-3">
              <label className="text-[11px] text-slate-600">
                מתאריך
                <input
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  className="mt-1 h-7 w-full rounded border border-slate-300 px-2 text-xs outline-none focus:border-brand-500"
                />
              </label>
              <label className="text-[11px] text-slate-600">
                עד תאריך
                <input
                  type="date"
                  value={customTo}
                  min={customFrom}
                  onChange={(event) => setCustomTo(event.target.value)}
                  className="mt-1 h-7 w-full rounded border border-slate-300 px-2 text-xs outline-none focus:border-brand-500"
                />
              </label>
              <button
                type="button"
                disabled={!customFrom || !customTo}
                onClick={() => applyDates({ as_of_date: null, date_from: customFrom, date_to: customTo })}
                className="h-7 rounded border border-brand-600 bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
              >
                החל
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
