"use client";
import { useMemo, useState } from "react";
import { Database, BarChart3, Filter, LayoutList, ListOrdered, ChevronDown } from "lucide-react";
import { ReportColumnsTab } from "./ReportColumnsTab";
import { ReportSortGroupTab } from "./ReportSortGroupTab";
import { ReportFilterTab } from "./ReportFilterTab";
import { ReportPreviewTab } from "./ReportPreviewTab";
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
  onSaveReport: (visibility: Visibility) => void;
  filterOptions: { tenant_statuses: FilterOption[]; modules: FilterOption[] };
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
  filterOptions,
}: ReportDesignerProps) {
  const [activeTab, setActiveTab] = useState<"columns" | "sort_group" | "filter" | "preview">("columns");

  const activeDataset = useMemo(
    () => datasets.find((dataset) => dataset.id === definition.dataset) ?? datasets[0] ?? null,
    [datasets, definition.dataset],
  );

  const selectedCategories = useMemo(() => {
    if (!activeDataset) return 0;
    return new Set(activeDataset.fields.map((field) => field.category || "כללי")).size;
  }, [activeDataset]);

  const handleDatasetChange = (datasetId: string) => {
    const dataset = datasets.find((item) => item.id === datasetId);
    if (!dataset) return;
    setDefinition({
      ...emptyDefinition,
      dataset: dataset.id,
      columns: dataset.default_columns,
      metrics: dataset.metrics.map((metric) => ({
        operation: metric.operation,
        field: metric.field ?? null,
        label: metric.label,
      })),
      limit: 50,
    });
  };

  const tabs = [
    { id: "columns" as const, label: "שדות ועמודות", icon: LayoutList },
    { id: "sort_group" as const, label: "מיון וסיכום", icon: ListOrdered },
    { id: "filter" as const, label: "סינון", icon: Filter, badge: definition.filters.length > 0 ? definition.filters.length : null },
    { id: "preview" as const, label: "תצוגה והרצה", icon: BarChart3 },
  ];

  return (
    <div className="flex h-[calc(100vh-140px)] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <aside className="flex w-72 shrink-0 flex-col border-l border-slate-200 bg-slate-950 text-white">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-sky-200">
              <Database size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">CLICK Insights</p>
              <h2 className="mt-1 text-lg font-semibold text-white">מחולל דוחות מלא</h2>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">מקור נתונים</label>
            <div className="relative">
              <select
                value={activeDataset?.id ?? ""}
                onChange={(e) => handleDatasetChange(e.target.value)}
                className="h-12 w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white outline-none transition focus:border-sky-400 focus:bg-white/10"
              >
                {datasets.map((dataset) => (
                  <option key={dataset.id} value={dataset.id} className="text-slate-900">
                    {dataset.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            {activeDataset ? (
              <p className="text-xs leading-5 text-slate-300">{activeDataset.description}</p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 border-b border-white/10 px-5 py-4 text-center">
          <div className="rounded-xl bg-white/5 px-3 py-3">
            <div className="text-lg font-semibold text-white">{activeDataset?.fields.length ?? 0}</div>
            <div className="mt-1 text-[11px] text-slate-400">שדות זמינים</div>
          </div>
          <div className="rounded-xl bg-white/5 px-3 py-3">
            <div className="text-lg font-semibold text-white">{selectedCategories}</div>
            <div className="mt-1 text-[11px] text-slate-400">קטגוריות</div>
          </div>
          <div className="rounded-xl bg-white/5 px-3 py-3">
            <div className="text-lg font-semibold text-white">{definition.columns.length}</div>
            <div className="mt-1 text-[11px] text-slate-400">עמודות</div>
          </div>
          <div className="rounded-xl bg-white/5 px-3 py-3">
            <div className="text-lg font-semibold text-white">{definition.metrics.length}</div>
            <div className="mt-1 text-[11px] text-slate-400">מדדים</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4">
          <div className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">שלבי בניית דוח</div>
          <div className="space-y-1.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-right text-sm transition ${
                    isActive ? "bg-sky-400/15 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon size={16} />
                    <span className="font-medium">{tab.label}</span>
                  </span>
                  {tab.badge ? (
                    <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-sky-300/20 px-2 text-[11px] font-semibold text-sky-100">
                      {tab.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-slate-50">
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
            setTitle={setTitle}
            onRunQuery={onRunQuery}
            onExportQuery={onExportQuery}
            onSaveReport={onSaveReport}
          />
        )}
      </div>
    </div>
  );
}
