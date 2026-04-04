"use client";

import { useEffect, useState } from "react";
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
      <label className="text-xs text-slate-500" htmlFor={idPrefix}>{label}</label>
      <div className="flex flex-col gap-1">
        <input
          id={idPrefix}
          inputMode="numeric"
          placeholder="MM/YYYY"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`rounded-md border bg-white px-3 py-1.5 text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-100 ${
            error ? "border-red-300 focus:border-red-400" : "border-slate-300 focus:border-brand-400"
          }`}
          dir="ltr"
        />
        <span className="text-[10px] text-slate-400">לדוגמה 02/2026</span>
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

  function updateMonthDraft(field: "fromMonth" | "toMonth", nextValue: string) {
    setMonthDrafts((prev) => ({ ...prev, [field]: nextValue }));

    const parsed = parseMonthInput(nextValue);
    if (parsed.error) return;

    onChange({
      ...filter,
      [field]: parsed.normalized ?? "",
    });
  }

  return (
    <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
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

        <button
          type="button"
          onClick={() => onChange(createDefaultTemporalFilterState())}
          className="mr-auto text-xs font-medium text-brand-700 hover:text-brand-800"
        >
          נקה
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-end gap-3">
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
            <div className="text-xs font-semibold text-slate-700">סינון לפי חודש</div>
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
            <div className="text-xs font-semibold text-slate-700">סינון לפי תאריכים</div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500" htmlFor={`${idPrefix}-from-date`}>מתאריך</label>
              <input
                id={`${idPrefix}-from-date`}
                type="date"
                value={filter.fromDate}
                onChange={(e) => onChange({ ...filter, fromDate: e.target.value })}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs focus:border-brand-400 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500" htmlFor={`${idPrefix}-to-date`}>עד תאריך</label>
              <input
                id={`${idPrefix}-to-date`}
                type="date"
                value={filter.toDate}
                onChange={(e) => onChange({ ...filter, toDate: e.target.value })}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs focus:border-brand-400 focus:outline-none"
              />
            </div>
          </>
        )}
      </div>

      {errorMessage && (
        <div className="mt-2 text-xs text-red-600">{errorMessage}</div>
      )}
    </div>
  );
}
