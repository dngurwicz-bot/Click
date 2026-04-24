"use client";

import { useEffect, useState } from "react";
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

  function buildDefinitionFromDataset(dataset: ReportDatasetDefinition, base: ReportDefinition = emptyDefinition): ReportDefinition {
    return {
      ...base,
      dataset: dataset.id,
      columns: base.columns.length > 0 ? base.columns : dataset.default_columns,
      metrics: base.metrics.length > 0 ? base.metrics : dataset.metrics.map((metric) => ({
        operation: metric.operation,
        field: metric.field ?? null,
        label: metric.label,
      })),
      limit: base.limit || 50,
      offset: 0,
    };
  }

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.get<{ reports: ReportCatalogItem[]; filter_options: { tenant_statuses: FilterOption[]; modules: FilterOption[] } }>("/api/insights/reports/catalog"),
      api.get<{ datasets: ReportDatasetDefinition[]; filter_options: { tenant_statuses: FilterOption[]; modules: FilterOption[] } }>("/api/insights/reports/datasets"),
      api.get<SavedReportView[]>("/api/insights/reports/saved"),
    ])
      .then(([catalogResult, datasetsResult, savedResult]) => {
        let loadedCatalog = catalog;
        let loadedSaved = savedReports;
        let loadedDatasets = datasets;

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

        // Apply URL params if present
        const templateId = searchParams?.get('template');
        const savedId = searchParams?.get('saved');
        const isNew = searchParams?.get('new') === 'true';

        if (templateId) {
          const item = loadedCatalog.find(r => r.id === templateId);
          if (item) applyDefinition(item.definition, item.title);
        } else if (savedId) {
          const item = loadedSaved.find(r => r.id === savedId);
          if (item) applyDefinition(item.definition, item.name);
        } else if (isNew) {
          const defaultDataset = loadedDatasets.find((item) => item.id === emptyDefinition.dataset) ?? loadedDatasets[0];
          if (defaultDataset) {
            applyDefinition(buildDefinitionFromDataset(defaultDataset), "");
          } else {
            applyDefinition(emptyDefinition, "");
          }
        } else if (loadedDatasets.length > 0) {
          const defaultDataset = loadedDatasets.find((item) => item.id === emptyDefinition.dataset) ?? loadedDatasets[0];
          applyDefinition(buildDefinitionFromDataset(defaultDataset), "");
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
  }, []);

  useEffect(() => {
    function handleLoadReport(event: Event) {
      const customEvent = event as CustomEvent<{ type: string; id: string }>;
      const { type, id } = customEvent.detail;
      
      if (type === 'template') {
        const item = catalog.find(r => r.id === id);
        if (item) applyDefinition(item.definition, item.title);
      } else if (type === 'saved') {
        const item = savedReports.find(r => r.id === id);
        if (item) applyDefinition(item.definition, item.name);
      } else if (type === 'new') {
        const defaultDataset = datasets.find((item) => item.id === emptyDefinition.dataset) ?? datasets[0];
        if (defaultDataset) {
          applyDefinition(buildDefinitionFromDataset(defaultDataset), "");
        } else {
          applyDefinition(emptyDefinition, "");
        }
      }
    }

    window.addEventListener('load-report', handleLoadReport);
    return () => window.removeEventListener('load-report', handleLoadReport);
  }, [catalog, savedReports]);

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
      alert("הדוח נשמר בהצלחה!");
    } catch (err: unknown) {
      const message = err instanceof ApiRequestError ? err.message : "שמירת הדוח נכשלה.";
      setError(message);
    }
  }

  function applyDefinition(nextDefinition: ReportDefinition, nextTitle = "") {
    const dataset = datasets.find((item) => item.id === nextDefinition.dataset);
    setDefinition({
      ...(dataset ? buildDefinitionFromDataset(dataset, nextDefinition) : nextDefinition),
      offset: 0,
      limit: nextDefinition.limit || 50,
    });
    setTitle(nextTitle);
    setResult(null);
    setError(null);
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
    <div className="flex-1 overflow-hidden p-4 bg-slate-50">
      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700 shadow-sm">
          {error}
        </div>
      )}

      <div className="h-full">
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
          filterOptions={filterOptions}
        />
      </div>
    </div>
  );
}
