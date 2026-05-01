"use client";
import { useState, useMemo } from "react";
import { ReportDatasetDefinition, ReportResult } from "./types";
import {
  ChevronUp, ChevronDown, ChevronsLeft, ChevronsRight,
  ChevronLeft, ChevronRight, AlertCircle
} from "lucide-react";

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

  const getLabel = (colId: string) =>
    activeDataset?.fields.find((f) => f.id === colId)?.label || colId;

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
    setPage(1);
  };

  const sortedRows = useMemo(() => {
    if (!result) return [];
    if (!sortCol) return result.rows;
    return [...result.rows].sort((a, b) => {
      const av = a[sortCol] ?? "";
      const bv = b[sortCol] ?? "";
      const numA = parseFloat(av), numB = parseFloat(bv);
      const cmp = !isNaN(numA) && !isNaN(numB) ? numA - numB : String(av).localeCompare(String(bv), "he");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [result, sortCol, sortDir]);

  if (loading) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden bg-white">
        {/* Skeleton header */}
        <div className="border-b border-slate-200 bg-slate-100 px-4 py-2.5">
          <div className="flex gap-4">
            {[120, 90, 140, 100, 80].map((w, i) => (
              <div key={i} className="h-4 animate-pulse rounded bg-slate-200" style={{ width: w }} />
            ))}
          </div>
        </div>
        {/* Skeleton rows */}
        <div className="flex-1 overflow-hidden">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className={`flex items-center gap-4 border-b border-slate-100 px-4 py-3 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
              {[80, 130, 110, 95, 70].map((w, j) => (
                <div key={j} className="h-3 animate-pulse rounded bg-slate-100" style={{ width: w, animationDelay: `${i * 40 + j * 20}ms` }} />
              ))}
            </div>
          ))}
        </div>
        <div className="border-t border-slate-200 bg-white px-4 py-1.5 text-center text-[11px] text-slate-400 animate-pulse">
          שולף נתונים...
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 bg-white">
        <div className="text-center">
          <AlertCircle size={32} className="mx-auto mb-3 text-slate-200" />
          <p className="text-sm text-slate-500">הרץ את הדוח לקבלת תוצאות</p>
        </div>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const visibleRows = sortedRows.slice(start, start + pageSize);

  // Summary cards
  const summaryBar = result.summary.length > 0 && (
    <div className="shrink-0 flex flex-wrap gap-2 border-b border-slate-200 bg-gradient-to-l from-blue-50/30 to-white px-4 py-2.5">
      {result.summary.map((item, idx) => (
        <div key={idx} className="min-w-[100px] rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{item.label}</div>
          <div className="mt-0.5 text-base font-extrabold text-blue-700">{item.value}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white" dir="rtl">
      {summaryBar}

      {/* Data table */}
      <div className="flex-1 overflow-auto">
        {result.rows.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-slate-500 p-8">
            <div>
              <AlertCircle size={28} className="mx-auto mb-3 text-slate-200" />
              <p className="font-semibold text-slate-600 mb-1">לא נמצאו רשומות</p>
              <p className="text-slate-400 text-xs">נסה לשנות את הסינונים או להרחיב את טווח התאריכים.</p>
            </div>
          </div>
        ) : (
          <table className="min-w-full border-separate border-spacing-0 text-right text-xs" dir="rtl">
            {/* FROZEN HEADER */}
            <thead className="sticky top-0 z-10">
              <tr className="bg-[linear-gradient(180deg,#1e3a8a_0%,#1e40af_100%)]">
                {/* Row number column */}
                <th className="w-10 border-b border-blue-900 px-2 py-2.5 text-center text-[10px] font-bold text-blue-200 whitespace-nowrap">
                  #
                </th>
                {result.columns.map((col) => {
                  const isActive = sortCol === col;
                  return (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      className="group cursor-pointer select-none whitespace-nowrap border-b border-blue-900 px-3 py-2.5 font-bold text-[10px] uppercase tracking-wide text-white transition hover:bg-blue-700/50"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>{getLabel(col)}</span>
                        <span className={`flex flex-col transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-40"}`}>
                          {isActive && sortDir === "asc" ? (
                            <ChevronUp size={11} />
                          ) : isActive && sortDir === "desc" ? (
                            <ChevronDown size={11} />
                          ) : (
                            <ChevronUp size={10} className="text-blue-300" />
                          )}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {visibleRows.map((row, rowIdx) => {
                const globalIdx = start + rowIdx;
                const isAlt = globalIdx % 2 === 1;
                return (
                  <tr
                    key={rowIdx}
                    className={`group transition-colors ${isAlt ? "bg-slate-50/60" : "bg-white"} hover:bg-blue-50/50`}
                  >
                    <td className="border-b border-slate-100 px-2 py-2 text-center text-[10px] font-medium text-slate-400 group-hover:text-blue-400 transition w-10">
                      {globalIdx + 1}
                    </td>
                    {result.columns.map((col, colIdx) => (
                      <td
                        key={col}
                        className={`border-b border-slate-100 px-3 py-2 whitespace-nowrap text-xs ${
                          colIdx === 0
                            ? "font-semibold text-slate-800"
                            : "text-slate-600"
                        }`}
                      >
                        {row[col] ?? <span className="text-slate-300">—</span>}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* PAGINATION BAR */}
      {result.rows.length > 0 && (
        <div className="shrink-0 flex items-center justify-between gap-4 border-t border-slate-200 bg-slate-50/50 px-4 py-1.5">
          {/* Left: page size selector */}
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span>הצג</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-blue-200"
            >
              {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span>שורות בעמוד</span>
          </div>

          {/* Center: page info */}
          <div className="text-[11px] text-slate-500 font-medium">
            עמוד {safePage} מתוך {totalPages}
            &nbsp;·&nbsp;
            <span className="text-blue-600">{start + 1}–{Math.min(start + pageSize, sortedRows.length)}</span>
            {" "}מתוך {sortedRows.length.toLocaleString()} שורות
            {result.total > sortedRows.length && (
              <span className="text-slate-400"> (מוצגות {sortedRows.length} מתוך {result.total.toLocaleString()} כולל)</span>
            )}
          </div>

          {/* Right: pagination controls */}
          <div className="flex items-center gap-0.5">
            <button onClick={() => setPage(1)} disabled={safePage <= 1} className="rounded p-1 text-slate-400 hover:bg-slate-200 disabled:opacity-30 transition">
              <ChevronsRight size={14} />
            </button>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} className="rounded p-1 text-slate-400 hover:bg-slate-200 disabled:opacity-30 transition">
              <ChevronRight size={14} />
            </button>

            {/* Page number pills */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) pageNum = i + 1;
              else if (safePage <= 3) pageNum = i + 1;
              else if (safePage >= totalPages - 2) pageNum = totalPages - 4 + i;
              else pageNum = safePage - 2 + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`min-w-[28px] rounded px-2 py-1 text-[11px] font-medium transition ${
                    safePage === pageNum
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} className="rounded p-1 text-slate-400 hover:bg-slate-200 disabled:opacity-30 transition">
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => setPage(totalPages)} disabled={safePage >= totalPages} className="rounded p-1 text-slate-400 hover:bg-slate-200 disabled:opacity-30 transition">
              <ChevronsLeft size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
