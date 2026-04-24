"use client";
import { Play, Download, Save, BarChart3, AlertCircle } from "lucide-react";
import { ReportDefinition, ReportDatasetDefinition, ReportResult, ReportFormat, Visibility } from "./types";
import { ReportDataGrid } from "./ReportDataGrid";

interface ReportPreviewTabProps {
  definition: ReportDefinition;
  activeDataset: ReportDatasetDefinition | null;
  result: ReportResult | null;
  loading: boolean;
  running: boolean;
  title: string;
  setTitle: (title: string) => void;
  onRunQuery: () => void;
  onExportQuery: (format: ReportFormat) => void;
  onSaveReport: (visibility: Visibility) => void;
}

export function ReportPreviewTab({
  definition,
  activeDataset,
  result,
  loading,
  running,
  title,
  setTitle,
  onRunQuery,
  onExportQuery,
  onSaveReport
}: ReportPreviewTabProps) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden bg-slate-100 p-4">
      
      <div className="shrink-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full lg:max-w-2xl">
            <div className="mb-2 flex items-center gap-2">
              <BarChart3 size={18} className="text-brand-600" />
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">תצוגה והרצה</span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="שם הדוח, למשל: תיק לקוחות עם חידוש קרוב"
              className="w-full bg-transparent text-xl font-semibold text-slate-900 outline-none placeholder:text-slate-300"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                {activeDataset ? activeDataset.label : "לא נבחר מקור נתונים"}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1">{definition.columns.length} עמודות</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1">{definition.metrics.length} מדדים</span>
              {definition.group_by.length > 0 ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">מקובץ לפי {definition.group_by.length} שדות</span>
              ) : null}
              {definition.filters.length > 0 ? (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">{definition.filters.length} סינונים פעילים</span>
              ) : null}
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <button
              onClick={() => onSaveReport("personal")}
              disabled={running}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <Save size={16} />
              שמור דוח
            </button>
            <button
              onClick={() => onExportQuery("csv")}
              disabled={!result || running}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <Download size={16} />
              ייצא CSV
            </button>
            <button
              onClick={onRunQuery}
              disabled={!definition.dataset || running || definition.columns.length === 0}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
            >
              <Play size={16} fill="currentColor" />
              {running ? "מריץ דוח..." : "הרץ דוח"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {definition.columns.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-400">
            <AlertCircle size={48} className="text-slate-200" />
            <div className="text-center">
              <h3 className="mb-1 font-bold text-slate-600">לא נבחרו שדות להצגה</h3>
              <p className="text-sm">חזור ללשונית "בחירת עמודות" ובחר שדות להצגה לפני הפקת הדוח.</p>
            </div>
          </div>
        ) : !result && !running ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-400">
            <BarChart3 size={48} className="text-slate-200" />
            <div className="text-center">
              <h3 className="mb-1 font-bold text-slate-600">הדוח מוכן להרצה</h3>
              <p className="text-sm">לחץ על "הרץ דוח" כדי לשלוף את הנתונים המעודכנים מהמערכת.</p>
            </div>
          </div>
        ) : (
          <ReportDataGrid result={result} activeDataset={activeDataset} loading={running && !result} />
        )}
      </div>
      
    </div>
  );
}
