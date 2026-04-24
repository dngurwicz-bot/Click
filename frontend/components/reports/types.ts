export type ReportViewMode = "detail" | "summary";
export type ReportFormat = "csv" | "pdf";
export type Visibility = "personal" | "shared";

export interface FilterOption {
  value: string;
  label: string;
}

export interface ReportFieldDefinition {
  id: string;
  label: string;
  type: "string" | "number" | "date" | "datetime" | "uuid" | "boolean";
  operators: string[];
  groupable: boolean;
  category?: string | null;
  description?: string | null;
}

export interface ReportMetricDefinition {
  operation: string;
  field?: string | null;
  label: string;
}

export interface ReportDatasetDefinition {
  id: string;
  label: string;
  description: string;
  fields: ReportFieldDefinition[];
  default_columns: string[];
  groupable_fields: string[];
  metrics: ReportMetricDefinition[];
}

export interface ReportDefinition {
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

export interface ReportCatalogItem {
  id: string;
  title: string;
  description: string;
  dataset: string;
  definition: ReportDefinition;
  available_formats: ReportFormat[];
}

export interface ReportResult {
  columns: string[];
  rows: Array<Record<string, string>>;
  total: number;
  summary: Array<{ label: string; value: string }>;
  applied_definition: ReportDefinition;
}

export interface SavedReportView {
  id: string;
  name: string;
  description?: string | null;
  dataset: string;
  visibility: Visibility;
  owner_name?: string | null;
  definition: ReportDefinition;
}

export const emptyDefinition: ReportDefinition = {
  dataset: "master_dataset",
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

export function metricKey(metric: { operation: string; field?: string | null; label?: string | null }) {
  return `${metric.operation}:${metric.field || "na"}:${metric.label || ""}`;
}
