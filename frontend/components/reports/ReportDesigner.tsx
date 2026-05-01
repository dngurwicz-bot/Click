"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CalendarClock,
  ChevronDown,
  Columns3,
  Database,
  Download,
  File,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Filter,
  LayoutTemplate,
  LayoutList,
  ListOrdered,
  Play,
  Save,
  Share2,
  Trash2,
} from "lucide-react";
import { ReportColumnsTab } from "./ReportColumnsTab";
import { ReportSortGroupTab } from "./ReportSortGroupTab";
import { ReportFilterTab } from "./ReportFilterTab";
import { ReportPreviewTab } from "./ReportPreviewTab";
import { ReportSaveModal } from "./ReportSaveModal";
import { ReportFieldHelpModal } from "./ReportFieldHelpModal";
import { ReportTemplateModal } from "./ReportTemplateModal";
import { DateRangeSelector } from "./DateRangeSelector";
import {
  FilterOption,
  ReportDatasetDefinition,
  ReportDefinition,
  ReportFormat,
  ReportResult,
  SavedReportView,
  Visibility,
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
  getPreferredColumnsForDataset: (dataset: ReportDatasetDefinition) => string[];
  onSavePreferredColumns: (datasetId: string, columns: string[]) => void;
  onClearPreferredColumns: (datasetId: string) => void;
  savedReports: SavedReportView[];
  savedTemplates: SavedReportView[];
  onSaveTemplate: (name: string, visibility: Visibility) => Promise<void>;
  onApplySavedReport: (reportId: string) => void;
  onApplySavedTemplate: (templateId: string) => void;
  onDeleteSavedItem: (itemId: string, kind: "report" | "template") => Promise<void>;
  filterOptions: { tenant_statuses: FilterOption[]; modules: FilterOption[] };
}

type TabId = "columns" | "sort_group" | "filter" | "preview";

const EXPORT_OPTIONS: { format: ReportFormat; label: string; icon: React.ElementType }[] = [
  { format: "xlsx", label: "Excel", icon: FileSpreadsheet },
  { format: "csv", label: "CSV", icon: FileText },
  { format: "html", label: "HTML", icon: FileCode2 },
  { format: "pdf", label: "PDF", icon: File },
];

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "columns", label: "שדות ועמודות", icon: LayoutList },
  { id: "sort_group", label: "מיון וסיכום", icon: ListOrdered },
  { id: "filter", label: "סינון", icon: Filter },
  { id: "preview", label: "תצוגה והרצה", icon: BarChart3 },
];

function ToolbarButton({
  children,
  onClick,
  disabled,
  title,
  primary = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex h-8 items-center gap-1.5 rounded border px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
        primary
          ? "border-brand-700 bg-brand-600 text-white hover:bg-brand-700"
          : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

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
  getPreferredColumnsForDataset,
  onSavePreferredColumns,
  onClearPreferredColumns,
  savedReports,
  savedTemplates,
  onSaveTemplate,
  onApplySavedReport,
  onApplySavedTemplate,
  onDeleteSavedItem,
  filterOptions,
}: ReportDesignerProps) {
  const [activeTab, setActiveTab] = useState<TabId>("columns");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [showSavedMenu, setShowSavedMenu] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ReportFormat | null>(null);
  const [focusedFieldId, setFocusedFieldId] = useState<string | null>(null);
  const [helpFieldId, setHelpFieldId] = useState<string | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  const activeDataset = useMemo(
    () => datasets.find((d) => d.id === definition.dataset) ?? datasets[0] ?? null,
    [datasets, definition.dataset],
  );

  const canRun = !!definition.dataset && definition.columns.length > 0 && !running;
  const canExport = !!result && !running;
  const activeTabLabel = TABS.find((tab) => tab.id === activeTab)?.label ?? "";
  const datasetTemplates = activeDataset ? savedTemplates.filter((item) => item.dataset === activeDataset.id) : [];
  const datasetSavedReports = activeDataset ? savedReports.filter((item) => item.dataset === activeDataset.id) : [];

  const handleDatasetChange = (datasetId: string) => {
    const dataset = datasets.find((d) => d.id === datasetId);
    if (!dataset) return;
    setDefinition({
      ...emptyDefinition,
      dataset: dataset.id,
      columns: getPreferredColumnsForDataset(dataset),
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

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "F1") return;
      const activeElement = document.activeElement;
      if (!containerRef.current || !activeElement || !containerRef.current.contains(activeElement)) return;
      if (!focusedFieldId) return;
      event.preventDefault();
      setHelpFieldId(focusedFieldId);
    };

    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [focusedFieldId]);

  useEffect(() => {
    if (!activeDataset) {
      setFocusedFieldId(null);
      setHelpFieldId(null);
      return;
    }
    if (focusedFieldId && !activeDataset.fields.some((field) => field.id === focusedFieldId)) {
      setFocusedFieldId(null);
    }
    if (helpFieldId && !activeDataset.fields.some((field) => field.id === helpFieldId)) {
      setHelpFieldId(null);
    }
  }, [activeDataset, focusedFieldId, helpFieldId]);

  return (
    <section ref={containerRef} className="flex h-full min-h-0 flex-col overflow-hidden border border-slate-300 bg-white" dir="rtl">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-slate-300 bg-white px-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-slate-50 text-brand-700">
            <Database size={14} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">מחולל דוחות</div>
            <div className="truncate text-[11px] text-slate-500">
              {activeDataset?.label ?? "מקור נתונים"} · {activeTabLabel}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span>{definition.columns.length} עמודות</span>
          <span className="h-3 w-px bg-slate-300" />
          <span>{definition.filters.length} סינונים</span>
          <span className="h-3 w-px bg-slate-300" />
          <span>{result ? `${result.total.toLocaleString()} שורות` : "טרם הורץ"}</span>
        </div>
      </header>

      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-slate-300 bg-slate-50 px-3">
        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
          <Database size={12} />
          מקור
        </label>
        <select
          value={activeDataset?.id ?? ""}
          onChange={(event) => handleDatasetChange(event.target.value)}
          className="h-7 w-52 rounded border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none focus:border-brand-500"
        >
          {datasets.map((dataset) => (
            <option key={dataset.id} value={dataset.id}>
              {dataset.label}
            </option>
          ))}
        </select>

        <DateRangeSelector definition={definition} setDefinition={setDefinition} />

        <div className="flex min-w-[180px] flex-1 items-center gap-1.5">
          <FileText size={12} className="text-slate-400" />
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="שם הדוח"
            className="h-7 w-full rounded border border-slate-300 bg-white px-2 text-xs font-medium text-slate-800 outline-none placeholder:text-slate-400 focus:border-brand-500"
          />
        </div>

        <ToolbarButton onClick={() => setShowSaveModal(true)} disabled={running} title="שמור דוח">
          <Save size={13} />
          שמור
        </ToolbarButton>

        <div className="relative">
          <ToolbarButton onClick={() => setShowSavedMenu((value) => !value)} disabled={!activeDataset} title="דוחות שמורים">
            <Save size={13} />
            דוחות שמורים
            <ChevronDown size={11} />
          </ToolbarButton>
          {showSavedMenu && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setShowSavedMenu(false)} />
              <div className="absolute left-0 top-full z-30 mt-1 w-80 border border-slate-300 bg-white shadow-lg">
                <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-xs font-semibold text-slate-800">דוחות שמורים למקור הנתונים</div>
                  <div className="text-[11px] text-slate-500">{activeDataset?.label ?? ""}</div>
                </div>
                <div className="max-h-72 overflow-auto py-1">
                  {datasetSavedReports.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-slate-500">אין עדיין דוחות שמורים למקור הנתונים הזה.</div>
                  ) : (
                    datasetSavedReports.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-2 px-2 py-1">
                        <button
                          type="button"
                          onClick={() => {
                            onApplySavedReport(item.id);
                            setShowSavedMenu(false);
                          }}
                          className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-right text-xs text-slate-700 hover:bg-slate-100"
                        >
                          <Save size={12} className="shrink-0 text-slate-500" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold text-slate-800">{item.name}</div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-500">
                              <span className="truncate">{item.owner_name ?? "ללא בעלים"}</span>
                              {item.visibility === "shared" && <Share2 size={10} className="shrink-0" />}
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSavedItem(item.id, "report")}
                          className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600"
                          title="מחק דוח שמור"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="relative">
          <ToolbarButton onClick={() => setShowTemplateMenu((value) => !value)} disabled={!activeDataset} title="תבניות עבודה">
            <LayoutTemplate size={13} />
            תבניות
            <ChevronDown size={11} />
          </ToolbarButton>
          {showTemplateMenu && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setShowTemplateMenu(false)} />
              <div className="absolute left-0 top-full z-30 mt-1 w-72 border border-slate-300 bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-800">תבניות למקור הנתונים</div>
                    <div className="text-[11px] text-slate-500">{activeDataset?.label ?? ""}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTemplateMenu(false);
                      setShowTemplateModal(true);
                    }}
                    className="inline-flex h-7 items-center gap-1 border border-slate-300 bg-white px-2 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <Save size={11} />
                    שמור כתבנית
                  </button>
                </div>
                <div className="max-h-72 overflow-auto py-1">
                  {datasetTemplates.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-slate-500">אין עדיין תבניות שמורות למקור הנתונים הזה.</div>
                  ) : (
                    datasetTemplates.map((template) => (
                      <div key={template.id} className="flex items-center justify-between gap-2 px-2 py-1">
                        <button
                          type="button"
                          onClick={() => {
                            onApplySavedTemplate(template.id);
                            setShowTemplateMenu(false);
                          }}
                          className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-right text-xs text-slate-700 hover:bg-slate-100"
                        >
                          <LayoutTemplate size={12} className="shrink-0 text-brand-700" />
                          <span className="truncate">{template.name}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSavedItem(template.id, "template")}
                          className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600"
                          title="מחק תבנית"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="relative">
          <ToolbarButton
            onClick={() => setShowExportMenu((value) => !value)}
            disabled={!canExport || exportingFormat !== null}
            title="ייצא דוח"
          >
            {exportingFormat ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" /> : <Download size={13} />}
            ייצוא
            <ChevronDown size={11} />
          </ToolbarButton>
          {showExportMenu && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setShowExportMenu(false)} />
              <div className="absolute left-0 top-full z-30 mt-1 w-36 border border-slate-300 bg-white py-1 shadow-lg">
                {EXPORT_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.format}
                      type="button"
                      onClick={() => handleExport(option.format)}
                      disabled={!canExport}
                      className="flex h-8 w-full items-center gap-2 px-3 text-right text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                    >
                      <Icon size={13} />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <ToolbarButton onClick={onRunQuery} disabled={!canRun} primary title="הרץ דוח">
          {running ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/35 border-t-white" /> : <Play size={12} fill="currentColor" />}
          {running ? "מריץ" : "הרץ"}
        </ToolbarButton>
      </div>

      <nav className="flex h-9 shrink-0 items-end border-b border-slate-300 bg-white px-3">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTab;
          const count =
            tab.id === "columns"
              ? definition.columns.length
              : tab.id === "filter"
              ? definition.filters.length
              : tab.id === "sort_group"
              ? definition.sort.length + definition.group_by.length + definition.metrics.length
              : result?.rows.length ?? 0;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex h-8 items-center gap-1.5 border border-b-0 px-3 text-xs font-semibold ${
                isActive
                  ? "border-slate-300 bg-slate-100 text-slate-900"
                  : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <Icon size={13} />
              {tab.label}
              <span className="text-[10px] font-medium text-slate-400">({count})</span>
            </button>
          );
        })}
      </nav>

      <main className="min-h-0 flex-1 overflow-hidden bg-slate-100">
        {activeTab === "columns" && (
          <ReportColumnsTab
            definition={definition}
            setDefinition={setDefinition}
            activeDataset={activeDataset}
            preferredColumns={activeDataset ? getPreferredColumnsForDataset(activeDataset) : []}
            onSavePreferredColumns={onSavePreferredColumns}
            onClearPreferredColumns={onClearPreferredColumns}
            onFieldFocus={setFocusedFieldId}
            onRequestFieldHelp={setHelpFieldId}
          />
        )}
        {activeTab === "sort_group" && (
          <ReportSortGroupTab
            definition={definition}
            setDefinition={setDefinition}
            activeDataset={activeDataset}
            onFieldFocus={setFocusedFieldId}
            onRequestFieldHelp={setHelpFieldId}
          />
        )}
        {activeTab === "filter" && (
          <ReportFilterTab
            definition={definition}
            setDefinition={setDefinition}
            activeDataset={activeDataset}
            filterOptions={filterOptions}
            onFieldFocus={setFocusedFieldId}
            onRequestFieldHelp={setHelpFieldId}
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
      </main>

      <footer className="flex h-7 shrink-0 items-center justify-between border-t border-slate-300 bg-white px-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <CalendarClock size={11} />
          {definition.date_from && definition.date_to
            ? `${definition.date_from} - ${definition.date_to}`
            : definition.as_of_date
            ? `נכון ל-${definition.as_of_date}`
            : "כל הנתונים"}
        </span>
        <span>
          {running ? "מריץ שאילתה..." : result ? `עודכן: ${result.rows.length.toLocaleString()} שורות מוצגות` : "מוכן להגדרה"}
        </span>
        <span>{activeDataset?.description ?? ""}</span>
      </footer>

      <ReportSaveModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={onSaveReport}
        defaultName={title}
      />
      <ReportTemplateModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSave={onSaveTemplate}
        defaultName={title || `${activeDataset?.label ?? "דוח"} בסיסי`}
      />
      <ReportFieldHelpModal activeDataset={activeDataset} fieldId={helpFieldId} onClose={() => setHelpFieldId(null)} />
    </section>
  );
}
