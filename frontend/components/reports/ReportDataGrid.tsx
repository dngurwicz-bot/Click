"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsLeft, ChevronsRight } from "lucide-react";
import { ReportDatasetDefinition, ReportResult } from "./types";

interface ReportDataGridProps {
  result: ReportResult | null;
  activeDataset: ReportDatasetDefinition | null;
  loading: boolean;
}

type SortDir = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250];

export function ReportDataGrid({ result, activeDataset, loading }: ReportDataGridProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const getLabel = (columnId: string) => activeDataset?.fields.find((field) => field.id === columnId)?.label || columnId;

  const sortedRows = useMemo(() => {
    if (!result) return [];
    if (!sortCol) return result.rows;
    return [...result.rows].sort((a, b) => {
      const av = a[sortCol] ?? "";
      const bv = b[sortCol] ?? "";
      const numA = Number(av);
      const numB = Number(bv);
      const cmp = Number.isFinite(numA) && Number.isFinite(numB) ? numA - numB : String(av).localeCompare(String(bv), "he");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [result, sortCol, sortDir]);

  const handleSort = (columnId: string) => {
    if (sortCol === columnId) setSortDir((direction) => (direction === "asc" ? "desc" : "asc"));
    else {
      setSortCol(columnId);
      setSortDir("asc");
    }
    setPage(1);
  };

  useEffect(() => {
    setPage(1);
    setSortCol(null);
    setSortDir("asc");
  }, [result, activeDataset?.id]);

  if (loading) {
    return (
      <div className="flex h-full flex-col bg-white">
        <div className="border-b border-slate-300 bg-slate-100 px-3 py-2 text-xs text-slate-500">שולף נתונים...</div>
        <div className="flex-1 overflow-hidden">
          {Array.from({ length: 12 }).map((_, rowIndex) => (
            <div key={rowIndex} className={`flex h-8 items-center gap-3 border-b border-slate-100 px-3 ${rowIndex % 2 ? "bg-slate-50" : "bg-white"}`}>
              {Array.from({ length: 6 }).map((__, cellIndex) => (
                <div key={cellIndex} className="h-3 animate-pulse rounded bg-slate-200" style={{ width: 70 + cellIndex * 18 }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center bg-white text-sm text-slate-500">
        <AlertCircle size={18} className="ml-2 text-slate-400" />
        אין תוצאות להצגה.
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const visibleRows = sortedRows.slice(start, start + pageSize);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white" dir="rtl">
      {result.summary.length > 0 && (
        <div className="grid shrink-0 grid-cols-4 border-b border-slate-300 bg-slate-50">
          {result.summary.slice(0, 8).map((item, index) => (
            <div key={`${item.label}-${index}`} className="flex h-10 items-center justify-between border-l border-slate-200 px-3 text-xs last:border-l-0">
              <span className="text-slate-500">{item.label}</span>
              <span className="font-semibold text-slate-900">{item.value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {result.rows.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            לא נמצאו רשומות. נסה לשנות סינון או תקופה.
          </div>
        ) : (
          <table className="min-w-full border-separate border-spacing-0 text-right text-xs">
            <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700">
              <tr>
                <th className="w-12 border-b border-l border-slate-300 px-2 py-2 text-center font-semibold">#</th>
                {result.columns.map((column) => {
                  const active = sortCol === column;
                  return (
                    <th
                      key={column}
                      onClick={() => handleSort(column)}
                      className="cursor-pointer whitespace-nowrap border-b border-l border-slate-300 px-2 py-2 font-semibold hover:bg-slate-200"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>{getLabel(column)}</span>
                        {active ? sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} /> : <span className="w-3" />}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, rowIndex) => {
                const globalIndex = start + rowIndex;
                return (
                  <tr key={globalIndex} className={globalIndex % 2 ? "bg-slate-50" : "bg-white"}>
                    <td className="border-b border-l border-slate-200 px-2 py-1.5 text-center text-slate-500">{globalIndex + 1}</td>
                    {result.columns.map((column, columnIndex) => (
                      <td
                        key={column}
                        className={`whitespace-nowrap border-b border-l border-slate-200 px-2 py-1.5 ${
                          columnIndex === 0 ? "font-semibold text-slate-900" : "text-slate-700"
                        }`}
                      >
                        {row[column] ?? <span className="text-slate-400">-</span>}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {result.rows.length > 0 && (
        <div className="flex h-8 shrink-0 items-center justify-between border-t border-slate-300 bg-white px-3 text-[11px] text-slate-600">
          <div className="flex items-center gap-2">
            <span>שורות בעמוד</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="h-6 rounded border border-slate-300 bg-white px-1 text-[11px] outline-none"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          <span>
            {start + 1}-{Math.min(start + pageSize, sortedRows.length)} מתוך {sortedRows.length.toLocaleString()}
          </span>

          <div className="flex items-center gap-0.5">
            <button type="button" onClick={() => setPage(1)} disabled={safePage <= 1} className="rounded p-1 hover:bg-slate-100 disabled:opacity-30">
              <ChevronsRight size={13} />
            </button>
            <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={safePage <= 1} className="rounded p-1 hover:bg-slate-100 disabled:opacity-30">
              <ChevronRight size={13} />
            </button>
            <span className="min-w-16 text-center">עמוד {safePage} / {totalPages}</span>
            <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={safePage >= totalPages} className="rounded p-1 hover:bg-slate-100 disabled:opacity-30">
              <ChevronLeft size={13} />
            </button>
            <button type="button" onClick={() => setPage(totalPages)} disabled={safePage >= totalPages} className="rounded p-1 hover:bg-slate-100 disabled:opacity-30">
              <ChevronsLeft size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
