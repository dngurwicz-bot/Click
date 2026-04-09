"use client";

import { useEffect, useState } from "react";
import { HebrewDatePicker } from "@/components/ui/HebrewDatePicker";
import {
  createDefaultTemporalFilterState,
  formatMonthDisplay,
  getTemporalFilterError,
  parseMonthInput,
  type TemporalFilterMode,
  type TemporalFilterState,
} from "@/lib/temporalFilter";

type RowRange = {
  valid_from?: string | null;
  valid_to?: string | null;
};

function modeLabel(mode: TemporalFilterMode) {
  if (mode === "current_month") return "חודש נוכחי";
  if (mode === "month_range") return "לפי חודש";
  return "לפי תאריכים";
}

function MonthField({
  label,
  value,
  onChange,
  error,
  idPrefix,
}: {
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  error?: string | null;
  idPrefix: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-slate-500 whitespace-nowrap" htmlFor={idPrefix}>{label}</label>
      <div className="flex items-center gap-2">
        <input
          id={idPrefix}
          inputMode="numeric"
          placeholder="MM/YYYY"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`w-24 rounded-md border bg-white px-3 py-1.5 text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-100 ${
            error ? "border-red-300 focus:border-red-400" : "border-slate-300 focus:border-brand-400"
          }`}
          dir="ltr"
        />
      </div>
    </div>
  );
}

export function TemporalFilterBar({
  filter,
  onChange,
  rowRanges,
  idPrefix,
}: {
  filter: TemporalFilterState;
  onChange: (nextFilter: TemporalFilterState) => void;
  rowRanges: RowRange[];
  idPrefix: string;
}) {
  const [monthDrafts, setMonthDrafts] = useState(() => ({
    fromMonth: formatMonthDisplay(filter.fromMonth),
    toMonth: formatMonthDisplay(filter.toMonth),
  }));

  useEffect(() => {
    setMonthDrafts({
      fromMonth: formatMonthDisplay(filter.fromMonth),
      toMonth: formatMonthDisplay(filter.toMonth),
    });
  }, [filter.fromMonth, filter.toMonth]);

  void rowRanges;

  const fromMonthParse = parseMonthInput(monthDrafts.fromMonth);
  const toMonthParse = parseMonthInput(monthDrafts.toMonth);
  const monthInputError = fromMonthParse.error ?? toMonthParse.error;
  const errorMessage = monthInputError ?? getTemporalFilterError(filter);

  function setMode(mode: TemporalFilterMode) {
    if (mode === "current_month") {
      onChange(createDefaultTemporalFilterState());
      return;
    }

    onChange({ ...filter, mode });
  }

  function normalizeMonthDraft(value: string): string {
    if (/^\d{6}$/.test(value)) {
      return `${value.slice(0, 2)}/${value.slice(2)}`;
    }
    return value;
  }

  function updateMonthDraft(field: "fromMonth" | "toMonth", nextValue: string) {
    const formatted = normalizeMonthDraft(nextValue);
    setMonthDrafts((prev) => ({ ...prev, [field]: formatted }));

    const parsed = parseMonthInput(formatted);
    if (parsed.error) return;

    onChange({
      ...filter,
      [field]: parsed.normalized ?? "",
    });
  }

  return (
    <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
      <div className="flex flex-wrap items-center gap-3">
        {(["current_month", "month_range", "date_range"] as TemporalFilterMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setMode(mode)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
              filter.mode === mode
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-100"
            }`}
          >
            {modeLabel(mode)}
          </button>
        ))}

        {filter.mode === "current_month" && (
          <>
            <div className="text-xs font-semibold text-slate-700">חודש נוכחי</div>
            <div className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs font-semibold text-slate-700">
              {formatMonthDisplay(filter.fromMonth)}
            </div>
          </>
        )}

        {filter.mode === "month_range" && (
          <>
            <div className="text-xs font-semibold text-slate-700 whitespace-nowrap">סינון לפי חודש</div>
            <MonthField
              label="מ-"
              value={monthDrafts.fromMonth}
              onChange={(nextValue) => updateMonthDraft("fromMonth", nextValue)}
              error={fromMonthParse.error}
              idPrefix={`${idPrefix}-from-month`}
            />
            <MonthField
              label="עד"
              value={monthDrafts.toMonth}
              onChange={(nextValue) => updateMonthDraft("toMonth", nextValue)}
              error={toMonthParse.error}
              idPrefix={`${idPrefix}-to-month`}
            />
          </>
        )}

        {filter.mode === "date_range" && (
          <>
            <div className="text-xs font-semibold text-slate-700 whitespace-nowrap">סינון לפי תאריכים</div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 whitespace-nowrap" htmlFor={`${idPrefix}-from-date`}>מתאריך</label>
              <HebrewDatePicker
                id={`${idPrefix}-from-date`}
                value={filter.fromDate}
                onChange={(v) => onChange({ ...filter, fromDate: v })}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs focus:border-brand-400 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 whitespace-nowrap" htmlFor={`${idPrefix}-to-date`}>עד תאריך</label>
              <HebrewDatePicker
                id={`${idPrefix}-to-date`}
                value={filter.toDate}
                onChange={(v) => onChange({ ...filter, toDate: v })}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs focus:border-brand-400 focus:outline-none"
              />
            </div>
          </>
        )}

        <button
          type="button"
          onClick={() => onChange(createDefaultTemporalFilterState())}
          className="mr-auto text-xs font-medium text-brand-700 hover:text-brand-800"
        >
          נקה
        </button>
      </div>

      {errorMessage && (
        <div className="mt-2 text-xs text-red-600">{errorMessage}</div>
      )}
    </div>
  );
}
