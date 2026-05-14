"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApiRequestError, api } from "@/lib/api";
import { ReportDesigner } from "./ReportDesigner";
import { 
  ReportCatalogItem, 
  ReportDatasetDefinition, 
  SavedReportView, 
  FilterOption, 
  ReportDefinition, 
  ReportResult, 
  emptyDefinition,
  ReportFormat,
  Visibility
} from "./types";

const PREFERRED_COLUMNS_STORAGE_KEY = "click-report-preferred-columns";

function readPreferredColumnsMap(): Record<string, string[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PREFERRED_COLUMNS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].every((item) => typeof item === "string")),
    );
  } catch {
    return {};
  }
}

function writePreferredColumnsMap(nextMap: Record<string, string[]>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREFERRED_COLUMNS_STORAGE_KEY, JSON.stringify(nextMap));
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

export function ReportsWorkspace() {
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams?.toString() ?? "";
  const templateId = searchParams?.get("template") ?? null;
  const savedTemplateId = searchParams?.get("saved_template") ?? null;
  const savedId = searchParams?.get("saved") ?? null;
  const isNew = searchParams?.get("new") === "true";
  const [catalog, setCatalog] = useState<ReportCatalogItem[]>([]);
  const [datasets, setDatasets] = useState<ReportDatasetDefinition[]>([]);
  const [savedReports, setSavedReports] = useState<SavedReportView[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<SavedReportView[]>([]);
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
  const [preferredColumnsVersion, setPreferredColumnsVersion] = useState(0);

  const getPreferredColumns = useCallback((dataset: ReportDatasetDefinition) => {
    void preferredColumnsVersion;
    return readPreferredColumnsMap()[dataset.id]?.filter((columnId) => dataset.fields.some((field) => field.id === columnId)) ?? [];
  }, [preferredColumnsVersion]);

  const resolveDatasetColumns = useCallback((dataset: ReportDatasetDefinition, requestedColumns: string[]) => {
    if (requestedColumns.length > 0) {
      return requestedColumns.filter((columnId) => dataset.fields.some((field) => field.id === columnId));
    }

    const preferredColumns = getPreferredColumns(dataset);
    if (preferredColumns.length > 0) {
      return preferredColumns;
    }

    return dataset.default_columns.filter((columnId) => dataset.fields.some((field) => field.id === columnId));
  }, [getPreferredColumns]);

  const buildDefinitionFromDataset = useCallback((dataset: ReportDatasetDefinition, base: ReportDefinition = emptyDefinition): ReportDefinition => {
    return {
      ...base,
      dataset: dataset.id,
      columns: resolveDatasetColumns(dataset, base.columns),
      metrics: base.metrics.length > 0 ? base.metrics : dataset.metrics.map((metric) => ({
        operation: metric.operation,
        field: metric.field ?? null,
        label: metric.label,
      })),
      limit: base.limit || 50,
      offset: 0,
    };
  }, [resolveDatasetColumns]);

  const applyDefinition = useCallback((
    nextDefinition: ReportDefinition,
    nextTitle = "",
    availableDatasets: ReportDatasetDefinition[],
  ) => {
    const dataset = availableDatasets.find((item) => item.id === nextDefinition.dataset);
    setDefinition({
      ...(dataset ? buildDefinitionFromDataset(dataset, nextDefinition) : nextDefinition),
      offset: 0,
      limit: nextDefinition.limit || 50,
    });
    setTitle(nextTitle);
    setResult(null);
    setError(null);
  }, [buildDefinitionFromDataset]);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.get<{ reports: ReportCatalogItem[]; filter_options: { tenant_statuses: FilterOption[]; modules: FilterOption[] } }>("/api/insights/reports/catalog"),
      api.get<{ datasets: ReportDatasetDefinition[]; filter_options: { tenant_statuses: FilterOption[]; modules: FilterOption[] } }>("/api/insights/reports/datasets"),
      api.get<SavedReportView[]>("/api/insights/reports/saved?kind=report"),
      api.get<SavedReportView[]>("/api/insights/reports/saved?kind=template"),
    ])
      .then(([catalogResult, datasetsResult, savedResult, templateResult]) => {
        let loadedCatalog: ReportCatalogItem[] = [];
        let loadedSaved: SavedReportView[] = [];
        let loadedTemplates: SavedReportView[] = [];
        let loadedDatasets: ReportDatasetDefinition[] = [];

        if (catalogResult.status === "fulfilled") {
          loadedCatalog = catalogResult.value.reports;
          setCatalog(loadedCatalog);
        }
        if (datasetsResult.status === "fulfilled") {
          loadedDatasets = datasetsResult.value.datasets;
          setDatasets(loadedDatasets);
          setFilterOptions(datasetsResult.value.filter_options);
        }
        if (savedResult.status === "fulfilled") {
          loadedSaved = savedResult.value;
          setSavedReports(loadedSaved);
        }
        if (templateResult.status === "fulfilled") {
          loadedTemplates = templateResult.value;
          setSavedTemplates(loadedTemplates);
        }

        // Apply URL params if present
        if (templateId) {
          const item = loadedCatalog.find((r) => r.id === templateId);
          if (item) applyDefinition(item.definition, item.title, loadedDatasets);
        } else if (savedTemplateId) {
          const item = loadedTemplates.find((r) => r.id === savedTemplateId);
          if (item) applyDefinition(item.definition, item.name, loadedDatasets);
        } else if (savedId) {
          const item = loadedSaved.find((r) => r.id === savedId);
          if (item) applyDefinition(item.definition, item.name, loadedDatasets);
        } else if (isNew) {
          const defaultDataset = loadedDatasets.find((item) => item.id === emptyDefinition.dataset) ?? loadedDatasets[0];
          if (defaultDataset) {
            applyDefinition(buildDefinitionFromDataset(defaultDataset), "", loadedDatasets);
          } else {
            applyDefinition(emptyDefinition, "", loadedDatasets);
          }
        } else if (loadedDatasets.length > 0) {
          const defaultDataset = loadedDatasets.find((item) => item.id === emptyDefinition.dataset) ?? loadedDatasets[0];
          applyDefinition(buildDefinitionFromDataset(defaultDataset), "", loadedDatasets);
        }

        if (catalogResult.status === "rejected" || datasetsResult.status === "rejected") {
          const culprit = catalogResult.status === "rejected" ? catalogResult.reason : (datasetsResult.status === "rejected" ? datasetsResult.reason : null);
          const message = culprit instanceof ApiRequestError ? culprit.message : "לא הצלחתי לטעון את המערכת.";
          setError(message);
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof ApiRequestError ? err.message : "לא הצלחתי לטעון את המערכת.";
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [applyDefinition, buildDefinitionFromDataset, isNew, savedId, savedTemplateId, searchParamsKey, templateId]);

  useEffect(() => {
    function handleLoadReport(event: Event) {
      const customEvent = event as CustomEvent<{ type: string; id: string }>;
      const { type, id } = customEvent.detail;
      
      if (type === 'template') {
        const item = catalog.find((r) => r.id === id);
        if (item) applyDefinition(item.definition, item.title, datasets);
      } else if (type === 'saved-template') {
        const item = savedTemplates.find((r) => r.id === id);
        if (item) applyDefinition(item.definition, item.name, datasets);
      } else if (type === 'saved') {
        const item = savedReports.find((r) => r.id === id);
        if (item) applyDefinition(item.definition, item.name, datasets);
      } else if (type === 'new') {
        const defaultDataset = datasets.find((item) => item.id === emptyDefinition.dataset) ?? datasets[0];
        if (defaultDataset) {
          applyDefinition(buildDefinitionFromDataset(defaultDataset), "", datasets);
        } else {
          applyDefinition(emptyDefinition, "", datasets);
        }
      }
    }

    window.addEventListener('load-report', handleLoadReport);
    return () => window.removeEventListener('load-report', handleLoadReport);
  }, [applyDefinition, buildDefinitionFromDataset, catalog, datasets, savedReports, savedTemplates]);

  async function runQuery() {
    if (!definition.dataset) return;
    setRunning(true);
    setError(null);
    try {
      const payload = await api.post<ReportResult>("/api/insights/reports/query", {
        title: title.trim() || null,
        definition,
      });
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

  async function saveReport(name: string, description: string, visibility: Visibility) {
    try {
      const payload = await api.post<SavedReportView>("/api/insights/reports/saved", {
        name: name.trim(),
        description: description.trim() || title.trim() || null,
        kind: "report",
        visibility,
        definition,
      });
      setSavedReports((prev) => [payload, ...prev.filter((item) => item.id !== payload.id)]);
    } catch (err: unknown) {
      const message = err instanceof ApiRequestError ? err.message : "שמירת הדוח נכשלה.";
      setError(message);
      throw new Error(message);
    }
  }

  function savePreferredColumns(datasetId: string, columns: string[]) {
    const nextMap = {
      ...readPreferredColumnsMap(),
      [datasetId]: columns,
    };
    writePreferredColumnsMap(nextMap);
    setPreferredColumnsVersion((value) => value + 1);
  }

  function clearPreferredColumns(datasetId: string) {
    const nextMap = { ...readPreferredColumnsMap() };
    delete nextMap[datasetId];
    writePreferredColumnsMap(nextMap);
    setPreferredColumnsVersion((value) => value + 1);
  }

  async function saveTemplate(name: string, visibility: Visibility) {
    try {
      const payload = await api.post<SavedReportView>("/api/insights/reports/saved", {
        name: name.trim(),
        description: title.trim() || null,
        kind: "template",
        visibility,
        definition: {
          ...definition,
          offset: 0,
        },
      });
      setSavedTemplates((prev) => [payload, ...prev.filter((item) => item.id !== payload.id)]);
    } catch (err: unknown) {
      const message = err instanceof ApiRequestError ? err.message : "שמירת התבנית נכשלה.";
      setError(message);
      throw new Error(message);
    }
  }

  function applySavedTemplate(templateId: string) {
    const template = savedTemplates.find((item) => item.id === templateId);
    if (!template) return;
    applyDefinition(template.definition, template.name, datasets);
  }

  function applySavedReport(reportId: string) {
    const report = savedReports.find((item) => item.id === reportId);
    if (!report) return;
    applyDefinition(report.definition, report.name, datasets);
  }

  async function deleteSavedItem(itemId: string, kind: "report" | "template") {
    try {
      await api.delete(`/api/insights/reports/saved/${itemId}`);
      if (kind === "template") {
        setSavedTemplates((prev) => prev.filter((item) => item.id !== itemId));
      } else {
        setSavedReports((prev) => prev.filter((item) => item.id !== itemId));
      }
    } catch (err: unknown) {
      const message = err instanceof ApiRequestError ? err.message : "מחיקת הפריט נכשלה.";
      setError(message);
      throw new Error(message);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
          <p className="text-sm font-medium text-slate-500">טוען סביבת דוחות מתקדמת...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden bg-slate-100">
      {error && (
        <div className="m-3 border border-red-300 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className={`${error ? "h-[calc(100%-44px)]" : "h-full"} p-3`}>
        <ReportDesigner 
          definition={definition}
          setDefinition={setDefinition}
          datasets={datasets}
          result={result}
          loading={loading}
          running={running}
          title={title}
          setTitle={setTitle}
          onRunQuery={runQuery}
          onExportQuery={exportQuery}
          onSaveReport={saveReport}
          getPreferredColumnsForDataset={getPreferredColumns}
          onSavePreferredColumns={savePreferredColumns}
          onClearPreferredColumns={clearPreferredColumns}
          savedReports={savedReports}
          savedTemplates={savedTemplates}
          onSaveTemplate={saveTemplate}
          onApplySavedReport={applySavedReport}
          onApplySavedTemplate={applySavedTemplate}
          onDeleteSavedItem={deleteSavedItem}
          filterOptions={filterOptions}
        />
      </div>
    </div>
  );
}
