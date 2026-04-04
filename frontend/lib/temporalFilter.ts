"use client";

export const OPEN_ENDED_DATE = "9999-12-31";

export type TemporalFilterMode = "current_month" | "month_range" | "date_range";

export interface TemporalFilterState {
  mode: TemporalFilterMode;
  fromMonth: string;
  toMonth: string;
  fromDate: string;
  toDate: string;
}

export function normalizeIsoDate(value?: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

export function getCurrentMonthValue(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function createDefaultTemporalFilterState(now = new Date()): TemporalFilterState {
  const currentMonth = getCurrentMonthValue(now);
  return {
    mode: "current_month",
    fromMonth: currentMonth,
    toMonth: currentMonth,
    fromDate: "",
    toDate: "",
  };
}

export function monthStart(month: string): string {
  return `${month}-01`;
}

export function monthEnd(month: string): string {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr);
  const lastDay = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  return `${month}-${String(lastDay).padStart(2, "0")}`;
}

export function formatMonthDisplay(month?: string): string {
  if (!month) return "MM/YYYY";
  const [year, monthPart] = month.split("-");
  return `${monthPart}/${year}`;
}

export function parseMonthInput(value?: string | null): {
  normalized: string | null;
  error: string | null;
} {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return { normalized: null, error: null };
  }

  if (!/^\d{2}\/\d{4}$/.test(trimmed)) {
    return {
      normalized: null,
      error: 'יש להזין חודש בפורמט MM/YYYY, למשל 02/2026.',
    };
  }

  const [monthPart, yearPart] = trimmed.split("/");
  const month = Number(monthPart);
  const year = Number(yearPart);

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return {
      normalized: null,
      error: "החודש חייב להיות בין 01 ל-12.",
    };
  }

  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    return {
      normalized: null,
      error: "יש להזין שנה בת 4 ספרות.",
    };
  }

  return {
    normalized: `${yearPart}-${monthPart}`,
    error: null,
  };
}

export function splitMonthValue(month?: string): { year: string; month: string } {
  if (!month) return { year: "", month: "" };
  const [year, monthPart] = month.split("-");
  return { year, month: monthPart };
}

export function joinMonthValue(year: string, month: string): string {
  if (!year || !month) return "";
  return `${year}-${month}`;
}

export function isMonthRangeInvalid(fromMonth: string, toMonth: string): boolean {
  return Boolean(fromMonth && toMonth && fromMonth > toMonth);
}

export function isDateRangeInvalid(fromDate: string, toDate: string): boolean {
  return Boolean(fromDate && toDate && fromDate > toDate);
}

export function getTemporalFilterError(state: TemporalFilterState): string | null {
  if (state.mode === "date_range") {
    return isDateRangeInvalid(state.fromDate, state.toDate)
      ? 'טווח התאריכים אינו תקין: שדה "מתאריך" מאוחר מ-"עד תאריך".'
      : null;
  }

  return isMonthRangeInvalid(state.fromMonth, state.toMonth)
    ? 'טווח החודשים אינו תקין: שדה "מ-" מאוחר מ-"עד".'
    : null;
}

export function overlapsMonthRange(params: {
  rowFrom?: string | null;
  rowTo?: string | null;
  filterFromMonth?: string;
  filterToMonth?: string;
}): boolean {
  const rowStart = normalizeIsoDate(params.rowFrom);
  if (!rowStart) return true;

  const rowEnd = normalizeIsoDate(params.rowTo) ?? OPEN_ENDED_DATE;
  const filterStart = params.filterFromMonth ? monthStart(params.filterFromMonth) : null;
  const filterEnd = params.filterToMonth ? monthEnd(params.filterToMonth) : null;

  if (!filterStart && !filterEnd) return true;
  if (filterStart && rowEnd < filterStart) return false;
  if (filterEnd && rowStart > filterEnd) return false;
  return true;
}

export function overlapsExactDateRange(params: {
  rowFrom?: string | null;
  rowTo?: string | null;
  filterFromDate?: string;
  filterToDate?: string;
}): boolean {
  const rowStart = normalizeIsoDate(params.rowFrom);
  if (!rowStart) return true;

  const rowEnd = normalizeIsoDate(params.rowTo) ?? OPEN_ENDED_DATE;
  const filterStart = normalizeIsoDate(params.filterFromDate) ?? null;
  const filterEnd = normalizeIsoDate(params.filterToDate) ?? null;

  if (!filterStart && !filterEnd) return true;
  if (filterStart && rowEnd < filterStart) return false;
  if (filterEnd && rowStart > filterEnd) return false;
  return true;
}

export function overlapsTemporalFilter(params: {
  rowFrom?: string | null;
  rowTo?: string | null;
  filter: TemporalFilterState;
}): boolean {
  if (params.filter.mode === "date_range") {
    return overlapsExactDateRange({
      rowFrom: params.rowFrom,
      rowTo: params.rowTo,
      filterFromDate: params.filter.fromDate,
      filterToDate: params.filter.toDate,
    });
  }

  return overlapsMonthRange({
    rowFrom: params.rowFrom,
    rowTo: params.rowTo,
    filterFromMonth: params.filter.fromMonth,
    filterToMonth: params.filter.toMonth,
  });
}

export function getTemporalFilterYearOptions(values: Array<string | null | undefined>, now = new Date()): string[] {
  const currentYear = now.getFullYear();
  const years = values
    .map((value) => normalizeIsoDate(value))
    .filter((value): value is string => Boolean(value))
    .map((value) => Number(value.slice(0, 4)))
    .filter((value) => Number.isFinite(value));

  const minYear = years.length ? Math.min(...years, currentYear) : currentYear - 3;
  const maxYear = years.length ? Math.max(...years, currentYear) : currentYear + 3;
  const startYear = Math.max(2000, minYear - 1);
  const endYear = maxYear + 1;
  const options: string[] = [];

  for (let year = endYear; year >= startYear; year -= 1) {
    options.push(String(year));
  }

  return options;
}
