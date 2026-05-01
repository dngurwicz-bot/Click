"use client";
import { useMemo, useState } from "react";
import {
  Database,
  BarChart3,
  Filter,
  LayoutList,
  ListOrdered,
  Play,
  Download,
  Save,
  ChevronDown,
  CheckCircle2,
  Circle,
  FileSpreadsheet,
  FileCode2,
  FileText,
  File,
} from "lucide-react";
import { ReportColumnsTab } from "./ReportColumnsTab";
import { ReportSortGroupTab } from "./ReportSortGroupTab";
import { ReportFilterTab } from "./ReportFilterTab";
import { ReportPreviewTab } from "./ReportPreviewTab";
import { ReportSaveModal } from "./ReportSaveModal";
import { DateRangeSelector } from "./DateRangeSelector";
import {
  ReportDefinition,
  ReportDatasetDefinition,
  ReportResult,
  ReportFormat,
  Visibility,
  FilterOption,
  emptyDefinition,
} from "./types";

interface ReportDesignerProps {
  definition: ReportDefinition;
  setDefinition: React.Dispatch<React.SetStateAction<ReportDefinition>>;
  datasets: ReportDatasetDefinition[];
  result: ReportResult | null;
  loading: boolean;
  running: boolean;
  title: string;
  setTitle: (title: string) => void;
  onRunQuery: () => void;
  onExportQuery: (format: ReportFormat) => void;
  onSaveReport: (name: string, description: string, visibility: Visibility) => Promise<void>;
  filterOptions: { tenant_statuses: FilterOption[]; modules: FilterOption[] };
}

type TabId = "columns" | "sort_group" | "filter" | "preview";

const EXPORT_OPTIONS: { format: ReportFormat; label: string; icon: React.ElementType; description: string; color: string }[] = [
  { format: "xlsx", label: "Excel (.xlsx)", icon: FileSpreadsheet, description: "קובץ Excel עם עיצוב מלא", color: "text-emerald-600" },
  { format: "csv", label: "CSV", icon: FileText, description: "קובץ טקסט נפרד בפסיקים", color: "text-blue-600" },
  { format: "html", label: "HTML", icon: FileCode2, description: "דוח HTML לצפייה בדפדפן", color: "text-violet-600" },
  { format: "pdf", label: "PDF", icon: File, description: "קובץ PDF להדפסה", color: "text-red-600" },
];

export function ReportDesigner({
  definition,
  setDefinition,
  datasets,
  result,
  loading,
  running,
  title,
  setTitle,
  onRunQuery,
  onExportQuery,
  onSaveReport,
  filterOptions,
}: ReportDesignerProps) {
  const [activeTab, setActiveTab] = useState<TabId>("columns");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ReportFormat | null>(null);

  const activeDataset = useMemo(
    () => datasets.find((d) => d.id === definition.dataset) ?? datasets[0] ?? null,
    [datasets, definition.dataset],
  );

  const handleDatasetChange = (datasetId: string) => {
    const dataset = datasets.find((d) => d.id === datasetId);
    if (!dataset) return;
    setDefinition({
      ...emptyDefinition,
      dataset: dataset.id,
      columns: dataset.default_columns,
      metrics: dataset.metrics.map((m) => ({ operation: m.operation, field: m.field ?? null, label: m.label })),
      limit: 50,
    });
  };

  const handleExport = async (format: ReportFormat) => {
    setShowExportMenu(false);
    setExportingFormat(format);
    try {
      await onExportQuery(format);
    } finally {
      setExportingFormat(null);
    }
  };

  const TABS: { id: TabId; label: string; icon: React.ElementType; step: number; badge?: number | null }[] = [
    { id: "columns", label: "בחירת שדות", icon: LayoutList, step: 1 },
    { id: "sort_group", label: "מיון וסיכום", icon: ListOrdered, step: 2 },
    { id: "filter", label: "סינון", icon: Filter, step: 3, badge: definition.filters.length > 0 ? definition.filters.length : null },
    { id: "preview", label: "הרצה ותצוגה", icon: BarChart3, step: 4 },
  ];

  const canRun = !!definition.dataset && definition.columns.length > 0 && !running;
  const canExport = !!result && !running;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_40px_rgba(15,23,42,0.08)]" dir="rtl">

      {/* ═══════════════════════════════════════════════════
          TOP TOOLBAR — Priority-style ERP action bar
      ═══════════════════════════════════════════════════ */}
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-4 py-2.5">
        {/* Logo + Brand */}
        <div className="flex items-center gap-2 border-l border-slate-200 pl-3 ml-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
            <Database size={15} />
          </div>
          <div className="hidden sm:block">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600/70">CLICK</div>
            <div className="text-[11px] font-semibold text-slate-800 leading-none">מחולל דוחות</div>
          </div>
        </div>

        {/* Dataset Selector */}
        <div className="relative flex-shrink-0">
          <select
            value={activeDataset?.id ?? ""}
            onChange={(e) => handleDatasetChange(e.target.value)}
            className="h-8 appearance-none rounded-lg border border-slate-300 bg-white pr-3 pl-7 text-xs font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 hover:border-slate-400 cursor-pointer max-w-[180px]"
          >
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
          <ChevronDown size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>

        {/* Date Range Selector */}
        <DateRangeSelector definition={definition} setDefinition={setDefinition} />

        {/* Report Title (editable inline) */}
        <div className="flex-1 min-w-0 mx-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="שם הדוח..."
            className="w-full bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-300 truncate"
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Stats pills */}
        <div className="hidden lg:flex items-center gap-1.5 text-[11px]">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
            {definition.columns.length} עמודות
          </span>
          {definition.filters.length > 0 && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700 border border-amber-200">
              {definition.filters.length} סינונים
            </span>
          )}
          {result && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 border border-emerald-200">
              {result.total.toLocaleString()} שורות
            </span>
          )}
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-slate-200" />

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Save */}
          <button
            onClick={() => setShowSaveModal(true)}
            disabled={running}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50"
            title="שמור דוח"
          >
            <Save size={13} />
            <span className="hidden sm:inline">שמור</span>
          </button>

          {/* Export dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu((v) => !v)}
              disabled={!canExport && exportingFormat === null}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
              title="ייצא דוח"
            >
              {exportingFormat ? (
                <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />
              ) : (
                <Download size={13} />
              )}
              <span className="hidden sm:inline">ייצא</span>
              <ChevronDown size={11} className={`transition-transform ${showExportMenu ? "rotate-180" : ""}`} />
            </button>

            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                <div className="absolute left-0 top-full mt-1.5 z-20 w-52 rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    בחר פורמט ייצוא
                  </div>
                  {EXPORT_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.format}
                        onClick={() => handleExport(opt.format)}
                        disabled={!canExport}
                        className="flex w-full items-center gap-3 px-3 py-2 text-right transition hover:bg-slate-50 disabled:opacity-40"
                      >
                        <Icon size={15} className={opt.color} />
                        <div>
                          <div className="text-xs font-semibold text-slate-800">{opt.label}</div>
                          <div className="text-[10px] text-slate-400">{opt.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Run Query — primary CTA */}
          <button
            onClick={onRunQuery}
            disabled={!canRun}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? (
              <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <Play size={12} fill="currentColor" />
            )}
            {running ? "מריץ..." : "הרץ דוח"}
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          BODY: Sidebar + Content
      ═══════════════════════════════════════════════════ */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* ─── LEFT NAV SIDEBAR ─── */}
        <aside className="flex w-52 shrink-0 flex-col border-l border-slate-200 bg-slate-50/80">
          {/* Dataset info */}
          <div className="border-b border-slate-200 px-3 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-1.5">מקור נתונים</div>
            <div className="text-xs font-semibold text-slate-800 truncate">{activeDataset?.label ?? "—"}</div>
            {activeDataset?.description && (
              <p className="mt-0.5 text-[10px] text-slate-500 leading-4 line-clamp-2">{activeDataset.description}</p>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-1.5 border-b border-slate-200 p-2.5">
            {[
              { label: "שדות", value: activeDataset?.fields.length ?? 0, color: "text-blue-700", bg: "bg-blue-50" },
              { label: "נבחרו", value: definition.columns.length, color: "text-slate-700", bg: "bg-white" },
              { label: "סינונים", value: definition.filters.length, color: "text-amber-700", bg: "bg-amber-50" },
              { label: "מדדים", value: definition.metrics.length, color: "text-violet-700", bg: "bg-violet-50" },
            ].map((stat) => (
              <div key={stat.label} className={`rounded-lg border border-slate-200 ${stat.bg} px-2 py-1.5 text-center`}>
                <div className={`text-base font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-[9px] text-slate-500 uppercase tracking-wide">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Steps Navigation */}
          <nav className="flex-1 p-2 space-y-0.5">
            <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">שלבי הגדרה</div>
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const isDone =
                (tab.id === "columns" && definition.columns.length > 0) ||
                (tab.id === "filter" && definition.filters.length > 0) ||
                (tab.id === "sort_group" && (definition.sort.length > 0 || definition.group_by.length > 0)) ||
                (tab.id === "preview" && !!result);

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-right text-xs transition ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm"
                  }`}
                >
                  {/* Step number / done indicator */}
                  <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition ${
                    isActive ? "bg-white/20 text-white" : isDone ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                  }`}>
                    {isDone && !isActive ? <CheckCircle2 size={12} /> : tab.step}
                  </div>

                  <div className="flex-1 flex items-center justify-between gap-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Icon size={13} />
                      <span className="font-medium truncate">{tab.label}</span>
                    </div>
                    {tab.badge ? (
                      <span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1.5 text-[9px] font-bold ${
                        isActive ? "bg-white/25 text-white" : "bg-amber-100 text-amber-700"
                      }`}>
                        {tab.badge}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Bottom hint */}
          <div className="border-t border-slate-200 p-3">
            <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5 text-center">
              <Circle size={12} className="mx-auto mb-1 text-blue-400" />
              <p className="text-[10px] text-blue-700 leading-4">
                הגדר שדות, סינונים ומיון, ואז לחץ <strong>הרץ דוח</strong>
              </p>
            </div>
          </div>
        </aside>

        {/* ─── MAIN CONTENT AREA ─── */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-slate-100">
          {activeTab === "columns" && (
            <ReportColumnsTab definition={definition} setDefinition={setDefinition} activeDataset={activeDataset} />
          )}
          {activeTab === "sort_group" && (
            <ReportSortGroupTab definition={definition} setDefinition={setDefinition} activeDataset={activeDataset} />
          )}
          {activeTab === "filter" && (
            <ReportFilterTab
              definition={definition}
              setDefinition={setDefinition}
              activeDataset={activeDataset}
              filterOptions={filterOptions}
            />
          )}
          {activeTab === "preview" && (
            <ReportPreviewTab
              definition={definition}
              activeDataset={activeDataset}
              result={result}
              loading={loading}
              running={running}
              title={title}
              onRunQuery={onRunQuery}
            />
          )}
        </div>
      </div>

      {/* Save Modal */}
      <ReportSaveModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={onSaveReport}
        defaultName={title}
      />
    </div>
  );
}
