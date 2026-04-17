"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BarChart3, Download, FileText, Filter, LayoutTemplate, Save, Sparkles } from "lucide-react";

import { AdminTitleBar } from "@/components/layout/AdminShell";
import { api, isLoggedIn, ApiRequestError } from "@/lib/api";

type ReportFormat = "pdf" | "csv";

interface Option {
  value: string;
  label: string;
}

interface ReportCatalogItem {
  id: string;
  title: string;
  description: string;
  audience: string;
  available_formats: ReportFormat[];
  supports_date_range: boolean;
  supports_status_filter: boolean;
  supports_module_filter: boolean;
  default_row_limit: number;
  is_available: boolean;
  availability_note?: string | null;
}

interface CatalogResponse {
  reports: ReportCatalogItem[];
  filter_options: {
    tenant_statuses: Option[];
    modules: Option[];
  };
}

interface FilterState {
  tenant_statuses: string[];
  module_slugs: string[];
  date_from: string;
  date_to: string;
  row_limit: number;
  include_summary: boolean;
  include_details: boolean;
}

interface Metric {
  label: string;
  value: string;
  hint?: string | null;
}

interface ReportSection {
  id: string;
  title: string;
  description?: string | null;
  columns: string[];
  rows: Array<Record<string, string>>;
  empty_message?: string | null;
}

interface ReportPreview {
  report_id: string;
  title: string;
  subtitle: string;
  generated_at: string;
  applied_filters: Metric[];
  summary: Metric[];
  highlights: string[];
  sections: ReportSection[];
}

interface ExportResponse {
  file_name: string;
  mime_type: string;
  content_base64: string;
}

interface SavedPreset {
  id: string;
  name: string;
  reportId: string;
  title: string;
  filters: FilterState;
}

const PRESET_STORAGE_KEY = "click_insights_report_presets";

const defaultFilters: FilterState = {
  tenant_statuses: [],
  module_slugs: [],
  date_from: "",
  date_to: "",
  row_limit: 12,
  include_summary: true,
  include_details: true,
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

function triggerDownload(payload: ExportResponse) {
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

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[280px] items-center justify-center px-6 py-10">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <BarChart3 size={20} />
        </div>
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
      </div>
    </div>
  );
}

export default function ModulePage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = typeof params?.slug === "string" ? params.slug : "";

  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [selectedReportId, setSelectedReportId] = useState("executive_overview");
  const [reportTitle, setReportTitle] = useState("");
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [presets, setPresets] = useState<SavedPreset[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ReportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    const raw = window.localStorage.getItem(PRESET_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as SavedPreset[];
      if (Array.isArray(parsed)) setPresets(parsed);
    } catch {}
  }, []);

  useEffect(() => {
    if (slug !== "insights") return;
    setLoadingCatalog(true);
    api
      .get<CatalogResponse>("/api/insights/reports/catalog")
      .then((payload) => {
        setCatalog(payload);
        const firstAvailable = payload.reports.find((item) => item.is_available);
        if (firstAvailable) {
          setSelectedReportId(firstAvailable.id);
          setFilters((prev) => ({ ...prev, row_limit: firstAvailable.default_row_limit }));
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof ApiRequestError ? err.message : "לא הצלחתי לטעון את ספריית הדוחות.";
        setError(message);
      })
      .finally(() => setLoadingCatalog(false));
  }, [slug]);

  const selectedReport = useMemo(
    () => catalog?.reports.find((item) => item.id === selectedReportId) ?? null,
    [catalog, selectedReportId],
  );

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function toggleArrayFilter(key: "tenant_statuses" | "module_slugs", value: string) {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter((item) => item !== value) : [...prev[key], value],
    }));
  }

  async function generateReport() {
    if (!selectedReport) return;
    setGenerating(true);
    setError(null);
    try {
      const payload = await api.post<ReportPreview>("/api/insights/reports/generate", {
        report_id: selectedReport.id,
        title: reportTitle.trim() || null,
        filters: {
          ...filters,
          row_limit: Number(filters.row_limit) || selectedReport.default_row_limit,
          date_from: filters.date_from || null,
          date_to: filters.date_to || null,
        },
      });
      setPreview(payload);
    } catch (err: unknown) {
      const message = err instanceof ApiRequestError ? err.message : "הפקת הדוח נכשלה.";
      setError(message);
    } finally {
      setGenerating(false);
    }
  }

  async function exportReport(format: ReportFormat) {
    if (!selectedReport) return;
    setExportingFormat(format);
    setError(null);
    try {
      const payload = await api.post<ExportResponse>("/api/insights/reports/export", {
        report_id: selectedReport.id,
        title: reportTitle.trim() || null,
        format,
        filters: {
          ...filters,
          row_limit: Number(filters.row_limit) || selectedReport.default_row_limit,
          date_from: filters.date_from || null,
          date_to: filters.date_to || null,
        },
      });
      triggerDownload(payload);
    } catch (err: unknown) {
      const message = err instanceof ApiRequestError ? err.message : "ייצוא הדוח נכשל.";
      setError(message);
    } finally {
      setExportingFormat(null);
    }
  }

  function savePreset() {
    if (!selectedReport) return;
    const name = window.prompt("שם לפריסט הדוח");
    if (!name?.trim()) return;
    const nextPreset: SavedPreset = {
      id: `${Date.now()}`,
      name: name.trim(),
      reportId: selectedReport.id,
      title: reportTitle.trim(),
      filters,
    };
    const next = [nextPreset, ...presets].slice(0, 8);
    setPresets(next);
    window.localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(next));
  }

  function applyPreset(preset: SavedPreset) {
    setSelectedReportId(preset.reportId);
    setReportTitle(preset.title);
    setFilters(preset.filters);
  }

  if (slug !== "insights") {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
        <AdminTitleBar title="מודול" />
        <main className="flex-1 overflow-auto">
          <EmptyState title="המודול הזה עדיין לא חובר למסך עבודה" body="הניווט למודול פעיל, אבל עדיין לא נבנה עבורו workspace ייעודי." />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
      <AdminTitleBar title="CLICK Insights" />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 px-4 py-5">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Sparkles size={16} className="text-brand-600" />
                  <h1 className="text-xl font-semibold">מערכת הפקת דוחות</h1>
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                  בחר סוג דוח, כוון פילטרים ותוציא גרסה מקצועית לישיבת הנהלה, תפעול או מעקב מוצר.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={savePreset}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  <Save size={15} />
                  שמור פריסט
                </button>
                <button
                  type="button"
                  onClick={generateReport}
                  disabled={!selectedReport || !selectedReport.is_available || generating}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FileText size={15} />
                  {generating ? "מייצר דוח..." : "צור דוח"}
                </button>
              </div>
            </div>
          </section>

          {error && (
            <section className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </section>
          )}

          <section className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-5">
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center gap-2 text-slate-700">
                  <LayoutTemplate size={15} />
                  <h2 className="text-sm font-semibold">ספריית דוחות</h2>
                </div>

                {loadingCatalog ? (
                  <div className="text-sm text-slate-500">טוען תבניות דוחות...</div>
                ) : (
                  <div className="space-y-2">
                    {catalog?.reports.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedReportId(item.id);
                          setFilters((prev) => ({ ...prev, row_limit: item.default_row_limit }));
                        }}
                        className={classNames(
                          "w-full rounded-lg border px-3 py-3 text-right transition",
                          selectedReportId === item.id ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:bg-slate-50",
                          !item.is_available && "opacity-60",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-800">{item.title}</div>
                            <div className="mt-1 text-xs text-slate-500">{item.audience}</div>
                          </div>
                          {!item.is_available && (
                            <span className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-500">לא זמין</span>
                          )}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                        {item.availability_note && (
                          <p className="mt-2 text-xs text-amber-700">{item.availability_note}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center gap-2 text-slate-700">
                  <Filter size={15} />
                  <h2 className="text-sm font-semibold">התאמה אישית</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">כותרת הדוח</label>
                    <input
                      value={reportTitle}
                      onChange={(e) => setReportTitle(e.target.value)}
                      placeholder={selectedReport?.title || "הכנס כותרת מותאמת"}
                      className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">מספר שורות</label>
                    <input
                      type="number"
                      min={5}
                      max={50}
                      value={filters.row_limit}
                      onChange={(e) => updateFilter("row_limit", Number(e.target.value))}
                      className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-brand-500"
                    />
                  </div>

                  {selectedReport?.supports_date_range && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">מתאריך</label>
                        <input
                          type="date"
                          value={filters.date_from}
                          onChange={(e) => updateFilter("date_from", e.target.value)}
                          className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-brand-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">עד תאריך</label>
                        <input
                          type="date"
                          value={filters.date_to}
                          onChange={(e) => updateFilter("date_to", e.target.value)}
                          className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-brand-500"
                        />
                      </div>
                    </div>
                  )}

                  {selectedReport?.supports_status_filter && (
                    <div>
                      <div className="mb-2 text-xs font-medium text-slate-600">סטטוסים</div>
                      <div className="flex flex-wrap gap-2">
                        {catalog?.filter_options.tenant_statuses.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => toggleArrayFilter("tenant_statuses", option.value)}
                            className={classNames(
                              "rounded-lg border px-3 py-2 text-xs transition",
                              filters.tenant_statuses.includes(option.value)
                                ? "border-brand-500 bg-brand-50 text-brand-700"
                                : "border-slate-200 text-slate-600 hover:bg-slate-50",
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedReport?.supports_module_filter && (
                    <div>
                      <div className="mb-2 text-xs font-medium text-slate-600">מודולים</div>
                      <div className="flex max-h-[180px] flex-wrap gap-2 overflow-auto">
                        {catalog?.filter_options.modules.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => toggleArrayFilter("module_slugs", option.value)}
                            className={classNames(
                              "rounded-lg border px-3 py-2 text-xs transition",
                              filters.module_slugs.includes(option.value)
                                ? "border-brand-500 bg-brand-50 text-brand-700"
                                : "border-slate-200 text-slate-600 hover:bg-slate-50",
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center gap-2 text-slate-700">
                  <Save size={15} />
                  <h2 className="text-sm font-semibold">פריסטים שמורים</h2>
                </div>
                <div className="space-y-2">
                  {presets.length === 0 ? (
                    <p className="text-sm text-slate-500">עדיין לא שמרת פריסטים.</p>
                  ) : (
                    presets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-3 text-right transition hover:bg-slate-50"
                      >
                        <div className="text-sm font-medium text-slate-800">{preset.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{preset.reportId.replaceAll("_", " ")}</div>
                      </button>
                    ))
                  )}
                </div>
              </section>
            </div>

            <div className="space-y-5">
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800">{preview?.title || "תצוגה מקדימה של הדוח"}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {preview?.subtitle || "אחרי שתייצר דוח, הסיכום, התובנות והטבלאות יופיעו כאן."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => exportReport("pdf")}
                      disabled={!selectedReport || !selectedReport.is_available || exportingFormat !== null}
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Download size={15} />
                      {exportingFormat === "pdf" ? "מייצא PDF..." : "ייצא PDF"}
                    </button>
                    <button
                      type="button"
                      onClick={() => exportReport("csv")}
                      disabled={!selectedReport || !selectedReport.is_available || exportingFormat !== null}
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Download size={15} />
                      {exportingFormat === "csv" ? "מייצא CSV..." : "ייצא CSV"}
                    </button>
                  </div>
                </div>
              </section>

              {!preview ? (
                <section className="rounded-lg border border-dashed border-slate-300 bg-white">
                  <EmptyState title="הדוח שלך מחכה" body="בחר תבנית, כוון פילטרים ולחץ על 'צור דוח' כדי לקבל preview מלא עם ייצוא." />
                </section>
              ) : (
                <>
                  <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {preview.summary.map((metric) => (
                      <div key={metric.label} className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="text-xs font-medium text-slate-500">{metric.label}</div>
                        <div className="mt-2 text-2xl font-semibold text-slate-800">{metric.value}</div>
                        {metric.hint && <div className="mt-1 text-xs text-slate-400">{metric.hint}</div>}
                      </div>
                    ))}
                  </section>

                  {preview.highlights.length > 0 && (
                    <section className="rounded-lg border border-slate-200 bg-white p-4">
                      <h3 className="text-sm font-semibold text-slate-800">תובנות מרכזיות</h3>
                      <div className="mt-3 space-y-2">
                        {preview.highlights.map((item) => (
                          <div key={item} className="rounded-lg bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-600">
                            {item}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {preview.applied_filters.length > 0 && (
                    <section className="rounded-lg border border-slate-200 bg-white p-4">
                      <h3 className="text-sm font-semibold text-slate-800">פילטרים שהופעלו</h3>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {preview.applied_filters.map((item) => (
                          <div key={`${item.label}-${item.value}`} className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
                            <span className="font-medium text-slate-700">{item.label}:</span> {item.value}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  <div className="space-y-5">
                    {preview.sections.map((section) => (
                      <section key={section.id} className="rounded-lg border border-slate-200 bg-white p-4">
                        <h3 className="text-sm font-semibold text-slate-800">{section.title}</h3>
                        {section.description && <p className="mt-1 text-sm text-slate-500">{section.description}</p>}

                        {section.rows.length === 0 ? (
                          <div className="mt-4 rounded-lg bg-slate-50 px-4 py-5 text-sm text-slate-500">
                            {section.empty_message || "אין נתונים להצגה."}
                          </div>
                        ) : (
                          <div className="mt-4 overflow-x-auto">
                            <table className="min-w-full border-separate border-spacing-0 text-right text-sm">
                              <thead>
                                <tr>
                                  {section.columns.map((column) => (
                                    <th key={column} className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                                      {column}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {section.rows.map((row, index) => (
                                  <tr key={`${section.id}-${index}`}>
                                    {section.columns.map((column) => (
                                      <td key={column} className="border-b border-slate-100 px-3 py-2 text-slate-700">
                                        {row[column] || "—"}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
