"use client";

import { BarChart3, Clock, Database, Play, Rows3 } from "lucide-react";
import { ReportDatasetDefinition, ReportDefinition, ReportResult } from "./types";
import { ReportDataGrid } from "./ReportDataGrid";

interface ReportPreviewTabProps {
  definition: ReportDefinition;
  activeDataset: ReportDatasetDefinition | null;
  result: ReportResult | null;
  loading: boolean;
  running: boolean;
  title: string;
  onRunQuery: () => void;
}

export function ReportPreviewTab({
  definition,
  activeDataset,
  result,
  loading,
  running,
  title,
  onRunQuery,
}: ReportPreviewTabProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white" dir="rtl">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-slate-300 bg-white px-3">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <BarChart3 size={14} className="text-brand-700" />
          <span className="truncate font-semibold text-slate-900">{title || "דוח ללא שם"}</span>
          <span className="text-slate-300">|</span>
          <span className="flex items-center gap-1 text-slate-600">
            <Database size={12} />
            {activeDataset?.label ?? definition.dataset}
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-600">{definition.columns.length} עמודות</span>
          <span className="text-slate-600">{definition.filters.length} סינונים</span>
          <span className="text-slate-600">{definition.group_by.length} קיבוצים</span>
        </div>

        <button
          type="button"
          onClick={onRunQuery}
          disabled={!definition.dataset || running || definition.columns.length === 0}
          className="inline-flex h-7 items-center gap-1.5 rounded border border-brand-700 bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {running ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/35 border-t-white" /> : <Play size={12} fill="currentColor" />}
          {running ? "מריץ" : "הרץ דוח"}
        </button>
      </div>

      {definition.columns.length === 0 ? (
        <div className="flex flex-1 items-center justify-center bg-white text-sm text-slate-500">
          בחר לפחות עמודה אחת לפני הרצת הדוח.
        </div>
      ) : !result && !running ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-white text-sm text-slate-500">
          <span>הדוח מוכן להרצה.</span>
          <button
            type="button"
            onClick={onRunQuery}
            className="inline-flex h-8 items-center gap-1.5 rounded border border-brand-700 bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700"
          >
            <Play size={12} fill="currentColor" />
            הרץ דוח עכשיו
          </button>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden">
          <ReportDataGrid result={result} activeDataset={activeDataset} loading={loading || (running && !result)} />
        </div>
      )}

      <div className="flex h-7 shrink-0 items-center justify-between border-t border-slate-300 bg-white px-3 text-[11px] text-slate-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Database size={11} />
            {activeDataset?.label ?? definition.dataset}
          </span>
          {result && (
            <span className="flex items-center gap-1">
              <Rows3 size={11} />
              {result.rows.length.toLocaleString()} / {result.total.toLocaleString()} שורות
            </span>
          )}
          {result?.execution_time_ms !== undefined && (
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {result.execution_time_ms}ms
            </span>
          )}
        </div>
        <span>{running ? "שולף נתונים..." : result ? "הדוח הורץ בהצלחה" : "ממתין להרצה"}</span>
      </div>
    </div>
  );
}
