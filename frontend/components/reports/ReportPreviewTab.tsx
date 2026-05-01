"use client";
import { BarChart3, AlertCircle, Clock, Database, Rows3, Play } from "lucide-react";
import { ReportDefinition, ReportDatasetDefinition, ReportResult } from "./types";
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
    <div className="flex h-full flex-col overflow-hidden bg-slate-100" dir="rtl">

      {/* Info bar */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="flex items-center gap-1 font-semibold text-slate-700">
            <BarChart3 size={13} className="text-blue-600" />
            {title || "דוח ללא שם"}
          </span>
          <span className="text-slate-300">|</span>
          <span className="flex items-center gap-1 text-slate-500">
            <Database size={11} />
            {activeDataset?.label ?? definition.dataset}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{definition.columns.length} עמודות</span>
          {definition.filters.length > 0 && (
            <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-amber-700">{definition.filters.length} סינונים</span>
          )}
          {definition.group_by.length > 0 && (
            <span className="rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5 text-violet-700">מקובץ לפי {definition.group_by.length}</span>
          )}
          {/* Date range badge */}
          {definition.date_from && definition.date_to && (
            <span className="rounded-full bg-violet-100 border border-violet-300 px-2 py-0.5 font-semibold text-violet-800 flex items-center gap-1">
              <span>🔄</span>
              {definition.date_from.split("-").reverse().join("/")} – {definition.date_to.split("-").reverse().join("/")}
            </span>
          )}
          {definition.as_of_date && !definition.date_from && (
            <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-blue-700 flex items-center gap-1">
              <span>📸</span>
              נכון ל-{definition.as_of_date.split("-").reverse().join("/")}
            </span>
          )}

          <div className="flex-1" />

          {/* Run button in preview */}
          <button
            onClick={onRunQuery}
            disabled={!definition.dataset || running || definition.columns.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? (
              <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <Play size={11} fill="currentColor" />
            )}
            {running ? "מריץ..." : "הרץ דוח"}
          </button>
        </div>
      </div>

      {/* Data area */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-lg m-2 border border-slate-200 bg-white shadow-sm">
        {definition.columns.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-slate-400 p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
              <AlertCircle size={28} className="text-slate-300" />
            </div>
            <div className="text-center">
              <h3 className="mb-1 font-bold text-slate-600">לא נבחרו שדות</h3>
              <p className="text-sm">חזור לשלב 1 &quot;בחירת שדות&quot; ובחר לפחות עמודה אחת.</p>
            </div>
          </div>
        ) : !result && !running ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-slate-400 p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
              <BarChart3 size={28} className="text-blue-300" />
            </div>
            <div className="text-center">
              <h3 className="mb-1 font-bold text-slate-600">הדוח מוכן להרצה</h3>
              <p className="text-sm">לחץ על &quot;הרץ דוח&quot; בסרגל הכלים העליון לשליפת הנתונים.</p>
            </div>
            <button
              onClick={onRunQuery}
              disabled={definition.columns.length === 0}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
            >
              <Play size={14} fill="currentColor" />
              הרץ דוח עכשיו
            </button>
          </div>
        ) : (
          <ReportDataGrid result={result} activeDataset={activeDataset} loading={running && !result} />
        )}
      </div>

      {/* ═══ STATUS BAR ═══ */}
      <div className="shrink-0 flex items-center justify-between border-t border-slate-200 bg-white px-4 py-1.5 text-[11px] text-slate-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Database size={10} className="text-slate-400" />
            {activeDataset?.label ?? definition.dataset}
          </span>
          {result && (
            <>
              <span className="h-3 w-px bg-slate-200" />
              <span className="flex items-center gap-1 text-blue-600 font-medium">
                <Rows3 size={10} />
                {result.rows.length.toLocaleString()} / {result.total.toLocaleString()} שורות
              </span>
              {result.execution_time_ms !== undefined && (
                <>
                  <span className="h-3 w-px bg-slate-200" />
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {result.execution_time_ms}ms
                  </span>
                </>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {running && (
            <span className="flex items-center gap-1 text-amber-600 font-medium animate-pulse">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
              שולף נתונים...
            </span>
          )}
          {result && !running && (
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              הדוח הורץ בהצלחה
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
