"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Download, FileSpreadsheet, Filter, Layers3, Play, Save, Table2 } from "lucide-react";

import { ApiRequestError, api } from "@/lib/api";

type ReportViewMode = "detail" | "summary";
type ReportFormat = "csv" | "pdf";
type Visibility = "personal" | "shared";

interface FilterOption {
  value: string;
  label: string;
}

interface ReportFieldDefinition {
  id: string;
  label: string;
  type: "string" | "number" | "date" | "datetime" | "uuid";
  operators: string[];
  groupable: boolean;
}

interface ReportMetricDefinition {
  operation: string;
  field?: string | null;
  label: string;
}

interface ReportDatasetDefinition {
  id: string;
  label: string;
  description: string;
  fields: ReportFieldDefinition[];
  default_columns: string[];
  groupable_fields: string[];
  metrics: ReportMetricDefinition[];
}

interface ReportDefinition {
  dataset: string;
  columns: string[];
  filters: Array<{ field: string; operator: string; value: string | number | null }>;
  sort: Array<{ field: string; direction: "asc" | "desc" }>;
  as_of_date: string | null;
  group_by: string[];
  metrics: Array<{ operation: string; field?: string | null; label?: string | null }>;
  limit: number;
  offset: number;
  view_mode: ReportViewMode;
}

interface ReportCatalogItem {
  id: string;
  title: string;
  description: string;
  dataset: string;
  definition: ReportDefinition;
  available_formats: ReportFormat[];
}

interface ReportResult {
  columns: string[];
  rows: Array<Record<string, string>>;
  total: number;
  summary: Array<{ label: string; value: string }>;
  applied_definition: ReportDefinition;
}

interface SavedReportView {
  id: string;
  name: string;
  description?: string | null;
  dataset: string;
  visibility: Visibility;
  owner_name?: string | null;
  definition: ReportDefinition;
}

const emptyDefinition: ReportDefinition = {
  dataset: "",
  columns: [],
  filters: [],
  sort: [],
  as_of_date: null,
  group_by: [],
  metrics: [],
  limit: 25,
  offset: 0,
  view_mode: "detail",
};

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function decodeBase64ToBlob(base64: string, mimeType: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

function triggerDownload(payload: { file_name: string; mime_type: string; content_base64: string }) {
  const blob = decodeBase64ToBlob(payload.content_base64, payload.mime_type);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = payload.file_name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function metricKey(metric: { operation: string; field?: string | null; label?: string | null }) {
  return `${metric.operation}:${metric.field || "na"}:${metric.label || ""}`;
}

export function ReportsWorkspace() {
  const [catalog, setCatalog] = useState<ReportCatalogItem[]>([]);
  const [datasets, setDatasets] = useState<ReportDatasetDefinition[]>([]);
  const [savedReports, setSavedReports] = useState<SavedReportView[]>([]);
  const [filterOptions, setFilterOptions] = useState<{ tenant_statuses: FilterOption[]; modules: FilterOption[] }>({
    tenant_statuses: [],
    modules: [],
  });
  const [definition, setDefinition] = useState<ReportDefinition>(emptyDefinition);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.get<{ reports: ReportCatalogItem[]; filter_options: { tenant_statuses: FilterOption[]; modules: FilterOption[] } }>("/api/insights/reports/catalog"),
      api.get<{ datasets: ReportDatasetDefinition[]; filter_options: { tenant_statuses: FilterOption[]; modules: FilterOption[] } }>("/api/insights/reports/datasets"),
      api.get<SavedReportView[]>("/api/insights/reports/saved"),
    ])
      .then(([catalogResult, datasetsResult, savedResult]) => {
        if (catalogResult.status === "fulfilled") {
          setCatalog(catalogResult.value.reports);
        }
        if (datasetsResult.status === "fulfilled") {
          setDatasets(datasetsResult.value.datasets);
          setFilterOptions(datasetsResult.value.filter_options);
          const firstDataset = datasetsResult.value.datasets[0];
          if (firstDataset) {
            setDefinition((prev) => ({
              ...prev,
              dataset: firstDataset.id,
              columns: firstDataset.default_columns,
              metrics: firstDataset.metrics.map((metric) => ({
                operation: metric.operation,
                field: metric.field ?? null,
                label: metric.label,
              })),
            }));
          }
        }
        if (savedResult.status === "fulfilled") {
          setSavedReports(savedResult.value);
        }
        if (catalogResult.status === "rejected" || datasetsResult.status === "rejected") {
          const culprit =
            catalogResult.status === "rejected"
              ? catalogResult.reason
              : datasetsResult.status === "rejected"
                ? datasetsResult.reason
                : null;
          const message = culprit instanceof ApiRequestError ? culprit.message : "לא הצלחתי לטעון את מערכת הדוחות.";
          setError(message);
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof ApiRequestError ? err.message : "לא הצלחתי לטעון את מערכת הדוחות.";
        setError(message);
      })
      .finally(() => setLoading(false));
  }, []);

  const activeDataset = useMemo(
    () => datasets.find((dataset) => dataset.id === definition.dataset) ?? null,
    [datasets, definition.dataset],
  );

  function applyDefinition(nextDefinition: ReportDefinition, nextTitle = "") {
    setDefinition({
      ...nextDefinition,
      offset: 0,
      limit: nextDefinition.limit || 25,
    });
    setTitle(nextTitle);
    setResult(null);
    setError(null);
  }

  function setDataset(datasetId: string) {
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
      limit: 25,
    });
    setResult(null);
  }

  function toggleColumn(columnId: string) {
    setDefinition((prev) => ({
      ...prev,
      columns: prev.columns.includes(columnId) ? prev.columns.filter((item) => item !== columnId) : [...prev.columns, columnId],
      offset: 0,
    }));
  }

  function toggleGroupBy(fieldId: string) {
    setDefinition((prev) => ({
      ...prev,
      group_by: prev.group_by.includes(fieldId) ? prev.group_by.filter((item) => item !== fieldId) : [...prev.group_by, fieldId],
      view_mode: "summary",
      offset: 0,
    }));
  }

  function toggleMetric(metric: { operation: string; field?: string | null; label?: string }) {
    setDefinition((prev) => {
      const key = metricKey(metric);
      const exists = prev.metrics.some((item) => metricKey(item) === key);
      return {
        ...prev,
        metrics: exists ? prev.metrics.filter((item) => metricKey(item) !== key) : [...prev.metrics, metric],
        offset: 0,
      };
    });
  }

  function addFilter() {
    if (!activeDataset?.fields.length) return;
    setDefinition((prev) => ({
      ...prev,
      filters: [...prev.filters, { field: activeDataset.fields[0].id, operator: activeDataset.fields[0].operators[0], value: "" }],
      offset: 0,
    }));
  }

  function updateFilter(index: number, key: "field" | "operator" | "value", value: string) {
    setDefinition((prev) => {
      const nextFilters = [...prev.filters];
      nextFilters[index] = { ...nextFilters[index], [key]: value };
      if (key === "field") {
        const field = activeDataset?.fields.find((item) => item.id === value);
        if (field) nextFilters[index].operator = field.operators[0];
      }
      return { ...prev, filters: nextFilters, offset: 0 };
    });
  }

  async function runQuery(nextOffset = definition.offset) {
    if (!definition.dataset) return;
    setRunning(true);
    setError(null);
    try {
      const payload = await api.post<ReportResult>("/api/insights/reports/query", {
        title: title.trim() || null,
        definition: { ...definition, offset: nextOffset },
      });
      setDefinition((prev) => ({ ...prev, offset: nextOffset }));
      setResult(payload);
    } catch (err: unknown) {
      const message = err instanceof ApiRequestError ? err.message : "הפקת הדוח נכשלה.";
      setError(message);
    } finally {
      setRunning(false);
    }
  }

  async function exportQuery(format: ReportFormat) {
    if (!definition.dataset) return;
    setRunning(true);
    setError(null);
    try {
      const payload = await api.post<{ file_name: string; mime_type: string; content_base64: string }>("/api/insights/reports/export", {
        title: title.trim() || null,
        format,
        definition,
      });
      triggerDownload(payload);
    } catch (err: unknown) {
      const message = err instanceof ApiRequestError ? err.message : "ייצוא הדוח נכשל.";
      setError(message);
    } finally {
      setRunning(false);
    }
  }

  async function saveReport(visibility: Visibility) {
    const name = window.prompt("שם לדוח השמור");
    if (!name?.trim()) return;
    try {
      const payload = await api.post<SavedReportView>("/api/insights/reports/saved", {
        name: name.trim(),
        description: title.trim() || null,
        visibility,
        definition,
      });
      setSavedReports((prev) => [payload, ...prev.filter((item) => item.id !== payload.id)]);
    } catch (err: unknown) {
      const message = err instanceof ApiRequestError ? err.message : "שמירת הדוח נכשלה.";
      setError(message);
    }
  }

  async function runSavedReport(reportId: string) {
    setRunning(true);
    setError(null);
    try {
      const payload = await api.post<ReportResult>(`/api/insights/reports/saved/${reportId}/run`, {});
      setResult(payload);
      setDefinition(payload.applied_definition);
    } catch (err: unknown) {
      const message = err instanceof ApiRequestError ? err.message : "הפעלת הדוח השמור נכשלה.";
      setError(message);
    } finally {
      setRunning(false);
    }
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / definition.limit)) : 1;
  const currentPage = Math.floor(definition.offset / Math.max(definition.limit, 1)) + 1;

  if (loading) {
    return <div className="rounded-lg border border-slate-200 bg-white p-8 text-sm text-slate-500">טוען סביבת דוחות...</div>;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-800">
              <BarChart3 size={18} className="text-brand-600" />
              <h2 className="text-xl font-semibold">מערכת דוחות מאוחדת</h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              דוחות מוכנים, builder גמיש, שמירת תצוגות, Snapshot נוכחי או לתאריך נבחר וייצוא מקצועי לקובץ.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => saveReport("personal")}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              <Save size={15} />
              שמור אישי
            </button>
            <button
              type="button"
              onClick={() => saveReport("shared")}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              <Save size={15} />
              שמור משותף
            </button>
            <button
              type="button"
              onClick={() => runQuery(0)}
              disabled={!definition.dataset || running}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              <Play size={15} />
              {running ? "מריץ..." : "הרץ דוח"}
            </button>
          </div>
        </div>
      </section>

      {error && <section className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</section>}

      <div className="grid gap-5 xl:grid-cols-[320px_320px_minmax(0,1fr)]">
        <section className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2 text-slate-700">
              <Layers3 size={15} />
              <h3 className="text-sm font-semibold">דוחות מוכנים</h3>
            </div>
            <div className="space-y-2">
              {catalog.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => applyDefinition(item.definition, item.title)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-3 text-right transition hover:bg-slate-50"
                >
                  <div className="text-sm font-semibold text-slate-800">{item.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{item.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2 text-slate-700">
              <Save size={15} />
              <h3 className="text-sm font-semibold">My Reports / Shared</h3>
            </div>
            <div className="space-y-2">
              {savedReports.length === 0 ? (
                <div className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">עדיין אין דוחות שמורים.</div>
              ) : (
                savedReports.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{item.name}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {item.visibility === "shared" ? "Shared" : "Personal"}
                          {item.owner_name ? ` • ${item.owner_name}` : ""}
                        </div>
                      </div>
                      <span className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-500">{item.dataset}</span>
                    </div>
                    {item.description && <div className="mt-2 text-sm text-slate-500">{item.description}</div>}
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => applyDefinition(item.definition, item.name)}
                        className="inline-flex h-8 items-center rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        טען ל-builder
                      </button>
                      <button
                        type="button"
                        onClick={() => runSavedReport(item.id)}
                        className="inline-flex h-8 items-center rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        הרץ
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2 text-slate-700">
              <Table2 size={15} />
              <h3 className="text-sm font-semibold">Builder</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">כותרת</label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-brand-500"
                  placeholder="שם דוח פנימי"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Dataset</label>
                <select
                  value={definition.dataset}
                  onChange={(event) => setDataset(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-brand-500"
                >
                  <option value="">בחר dataset</option>
                  {datasets.map((dataset) => (
                    <option key={dataset.id} value={dataset.id}>
                      {dataset.label}
                    </option>
                  ))}
                </select>
                {activeDataset && <p className="mt-2 text-xs leading-5 text-slate-500">{activeDataset.description}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">As Of</label>
                  <input
                    type="date"
                    value={definition.as_of_date ?? ""}
                    onChange={(event) => setDefinition((prev) => ({ ...prev, as_of_date: event.target.value || null, offset: 0 }))}
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">תצוגה</label>
                  <select
                    value={definition.view_mode}
                    onChange={(event) => setDefinition((prev) => ({ ...prev, view_mode: event.target.value as ReportViewMode, offset: 0 }))}
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-brand-500"
                  >
                    <option value="detail">Detail</option>
                    <option value="summary">Summary</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">מיון</label>
                  <select
                    value={definition.sort[0]?.field || ""}
                    onChange={(event) =>
                      setDefinition((prev) => ({
                        ...prev,
                        sort: event.target.value ? [{ field: event.target.value, direction: prev.sort[0]?.direction || "asc" }] : [],
                        offset: 0,
                      }))
                    }
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-brand-500"
                  >
                    <option value="">ללא</option>
                    {activeDataset?.fields.map((field) => (
                      <option key={field.id} value={field.id}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">כיוון</label>
                  <select
                    value={definition.sort[0]?.direction || "asc"}
                    onChange={(event) =>
                      setDefinition((prev) => ({
                        ...prev,
                        sort: prev.sort[0] ? [{ ...prev.sort[0], direction: event.target.value as "asc" | "desc" }] : [],
                        offset: 0,
                      }))
                    }
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-brand-500"
                  >
                    <option value="asc">ASC</option>
                    <option value="desc">DESC</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">כמות שורות לעמוד</label>
                <input
                  type="number"
                  min={5}
                  max={200}
                  value={definition.limit}
                  onChange={(event) => setDefinition((prev) => ({ ...prev, limit: Number(event.target.value) || 25, offset: 0 }))}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-brand-500"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-700">
                <Filter size={15} />
                <h3 className="text-sm font-semibold">סינונים</h3>
              </div>
              <button
                type="button"
                onClick={addFilter}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
              >
                הוסף סינון
              </button>
            </div>
            <div className="space-y-3">
              {definition.filters.length === 0 ? (
                <div className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">אין סינונים פעילים.</div>
              ) : (
                definition.filters.map((filter, index) => {
                  const field = activeDataset?.fields.find((item) => item.id === filter.field);
                  return (
                    <div key={`${filter.field}-${index}`} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                      <select
                        value={filter.field}
                        onChange={(event) => updateFilter(index, "field", event.target.value)}
                        className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-brand-500"
                      >
                        {activeDataset?.fields.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={filter.operator}
                        onChange={(event) => updateFilter(index, "operator", event.target.value)}
                        className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-brand-500"
                      >
                        {field?.operators.map((operator) => (
                          <option key={operator} value={operator}>
                            {operator}
                          </option>
                        ))}
                      </select>
                      {filter.operator === "is_null" || filter.operator === "is_not_null" ? (
                        <div className="h-10 rounded-lg border border-dashed border-slate-200 bg-slate-50" />
                      ) : (
                        <input
                          type={field?.type === "number" ? "number" : field?.type === "date" ? "date" : "text"}
                          value={String(filter.value ?? "")}
                          onChange={(event) => updateFilter(index, "value", event.target.value)}
                          list={filter.field === "module_slug" ? "report-modules" : filter.field === "tenant_status" ? "report-statuses" : undefined}
                          className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-brand-500"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setDefinition((prev) => ({ ...prev, filters: prev.filters.filter((_, currentIndex) => currentIndex !== index), offset: 0 }))
                        }
                        className="h-10 rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        הסר
                      </button>
                    </div>
                  );
                })
              )}
              <datalist id="report-modules">
                {filterOptions.modules.map((option) => (
                  <option key={option.value} value={option.value} />
                ))}
              </datalist>
              <datalist id="report-statuses">
                {filterOptions.tenant_statuses.map((option) => (
                  <option key={option.value} value={option.value} />
                ))}
              </datalist>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-800">עמודות</h3>
            <div className="mt-3 flex max-h-[220px] flex-wrap gap-2 overflow-auto">
              {activeDataset?.fields.map((field) => (
                <button
                  key={field.id}
                  type="button"
                  onClick={() => toggleColumn(field.id)}
                  className={classNames(
                    "rounded-lg border px-3 py-2 text-xs transition",
                    definition.columns.includes(field.id)
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50",
                  )}
                >
                  {field.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-800">Grouping</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {activeDataset?.fields
                .filter((field) => field.groupable)
                .map((field) => (
                  <button
                    key={field.id}
                    type="button"
                    onClick={() => toggleGroupBy(field.id)}
                    className={classNames(
                      "rounded-lg border px-3 py-2 text-xs transition",
                      definition.group_by.includes(field.id)
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    {field.label}
                  </button>
                ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-800">Metrics</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {activeDataset?.metrics.map((metric) => (
                <button
                  key={metricKey(metric)}
                  type="button"
                  onClick={() => toggleMetric({ operation: metric.operation, field: metric.field ?? null, label: metric.label })}
                  className={classNames(
                    "rounded-lg border px-3 py-2 text-xs transition",
                    definition.metrics.some((item) => metricKey(item) === metricKey(metric))
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50",
                  )}
                >
                  {metric.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => exportQuery("csv")}
                disabled={!result || running}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
              >
                <FileSpreadsheet size={15} />
                CSV
              </button>
              <button
                type="button"
                onClick={() => exportQuery("pdf")}
                disabled={!result || running}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
              >
                <Download size={15} />
                PDF
              </button>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">{title || "תצוגת דוח"}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {result ? `${result.total} תוצאות בסך הכל • מצב ${definition.view_mode === "summary" ? "Summary" : "Detail"}` : "הרץ דוח כדי לראות תצוגה מקדימה."}
            </p>
          </div>
          {result && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <button
                type="button"
                disabled={definition.offset === 0 || running}
                onClick={() => runQuery(Math.max(0, definition.offset - definition.limit))}
                className="inline-flex h-9 items-center rounded-lg border border-slate-300 px-3 transition hover:bg-slate-100 disabled:opacity-60"
              >
                הקודם
              </button>
              <span>
                עמוד {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={definition.offset + definition.limit >= result.total || running}
                onClick={() => runQuery(definition.offset + definition.limit)}
                className="inline-flex h-9 items-center rounded-lg border border-slate-300 px-3 transition hover:bg-slate-100 disabled:opacity-60"
              >
                הבא
              </button>
            </div>
          )}
        </div>

        {!result ? (
          <div className="mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
            אין עדיין תוצאות להצגה.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {result.summary.length > 0 && (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {result.summary.map((item) => (
                  <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-xs font-medium text-slate-500">{item.label}</div>
                    <div className="mt-2 text-xl font-semibold text-slate-800">{item.value}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-right text-sm">
                <thead>
                  <tr>
                    {result.columns.map((column) => {
                      const label = activeDataset?.fields.find((field) => field.id === column)?.label || column;
                      return (
                        <th key={column} className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                          {label}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, index) => (
                    <tr key={`row-${index}`}>
                      {result.columns.map((column) => (
                        <td key={column} className="border-b border-slate-100 px-3 py-2 text-slate-700">
                          {row[column] || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
