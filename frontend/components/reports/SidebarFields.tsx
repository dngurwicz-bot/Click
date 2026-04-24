"use client";
import { Search, Hash, Type, CalendarDays, GripVertical, Plus, ToggleLeft } from "lucide-react";
import { ReportDatasetDefinition } from "./types";
import { useMemo, useState } from "react";

const CATEGORY_ORDER = [
  "לקוח",
  "זהות",
  "איש קשר",
  "כתובת",
  "סטטוס",
  "מנוי",
  "שיוך מודול",
  "מודול",
  "תמחור",
  "תבנית",
  "ברירת מחדל",
  "משתמש",
  "הרשאה",
  "Audit",
  "דוח שמור",
  "כללי",
];

function FieldIcon({ type }: { type: string }) {
  if (type === "number") return <Hash size={14} className="text-sky-600" />;
  if (type === "date" || type === "datetime") return <CalendarDays size={14} className="text-emerald-600" />;
  if (type === "boolean") return <ToggleLeft size={14} className="text-amber-600" />;
  return <Type size={14} className="text-slate-500" />;
}

export function SidebarFields({
  activeDataset,
  onAddColumn,
  onAddGroupBy,
  onAddMetric,
}: {
  activeDataset: ReportDatasetDefinition | null;
  onAddColumn: (id: string) => void;
  onAddGroupBy: (id: string) => void;
  onAddMetric: (metric: { operation: string; field?: string | null; label?: string }) => void;
}) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filteredFields = useMemo(() => {
    if (!activeDataset) return [];
    const needle = search.trim().toLowerCase();
    return activeDataset.fields.filter((field) => {
      if (!needle) return true;
      return [field.label, field.id, field.category || "", field.description || ""]
        .join(" ")
        .toLowerCase()
        .includes(needle);
      });
  }, [activeDataset, search]);

  const categories = useMemo(() => {
    const values = Array.from(new Set((activeDataset?.fields ?? []).map((field) => field.category || "כללי")));
    return values.sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b, "he");
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [activeDataset]);

  const groupedFields = useMemo(() => {
    const groups = new Map<string, typeof filteredFields>();
    for (const field of filteredFields) {
      const category = field.category || "כללי";
      if (activeCategory !== "all" && category !== activeCategory) continue;
      const current = groups.get(category) ?? [];
      current.push(field);
      groups.set(category, current);
    }
    return Array.from(groups.entries()).sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a[0]);
      const bi = CATEGORY_ORDER.indexOf(b[0]);
      if (ai === -1 && bi === -1) return a[0].localeCompare(b[0], "he");
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [activeCategory, filteredFields]);

  const metrics = useMemo(() => {
    if (!activeDataset) return [];
    const needle = search.trim().toLowerCase();
    return activeDataset.metrics.filter((metric) => {
      if (!needle) return true;
      return [metric.label, metric.field || ""].join(" ").toLowerCase().includes(needle);
    });
  }, [activeDataset, search]);

  if (!activeDataset) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-slate-500">
        <p className="text-sm">בחר dataset כדי לראות את קטלוג השדות.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      <div className="border-b border-slate-200 p-4">
        <div className="relative">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="חיפוש לפי שם, מזהה או קטגוריה..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 pl-3 pr-9 text-sm outline-none transition focus:border-sky-500 focus:bg-white"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory("all")}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
              activeCategory === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            כל השדות ({activeDataset.fields.length})
          </button>
          {categories.map((category) => {
            const count = activeDataset.fields.filter((field) => (field.category || "כללי") === category).length;
            return (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
                  activeCategory === category ? "bg-sky-600 text-white" : "bg-sky-50 text-sky-700 hover:bg-sky-100"
                }`}
              >
                {category} ({count})
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-5">
          {groupedFields.map(([category, fields]) => (
            <section key={category}>
              <div className="mb-2 flex items-center justify-between px-1">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{category}</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{fields.length}</span>
              </div>

              <div className="space-y-1.5">
                {fields.map((field) => (
                  <div key={field.id} className="group rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition hover:border-sky-200 hover:bg-sky-50/40">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <GripVertical size={13} className="mt-0.5 text-slate-300" />
                          <FieldIcon type={field.type} />
                          <span className="truncate text-sm font-medium text-slate-800">{field.label}</span>
                        </div>
                        <div className="mt-1 pr-7 text-[11px] text-slate-500">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {field.category ? (
                              <span className="rounded-full bg-sky-50 px-2 py-0.5 font-medium text-sky-700">{field.category}</span>
                            ) : null}
                            {field.description ? <span className="text-slate-400">{field.description}</span> : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-1 opacity-100">
                        <button
                          onClick={() => onAddColumn(field.id)}
                          className="rounded-lg bg-slate-200 p-1.5 text-slate-700 hover:bg-sky-100 hover:text-sky-700"
                          title="הוסף כעמודה"
                        >
                          <Plus size={13} />
                        </button>
                        {field.groupable ? (
                          <button
                            onClick={() => onAddGroupBy(field.id)}
                            className="rounded-lg bg-slate-200 px-2 text-[10px] font-semibold text-slate-700 hover:bg-emerald-100 hover:text-emerald-700"
                            title="הוסף לקיבוץ"
                          >
                            קבץ
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section>
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">מדדים</h3>
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">{metrics.length}</span>
            </div>

            <div className="space-y-1.5">
              {metrics.map((metric) => (
                <div key={`${metric.operation}:${metric.field || "na"}:${metric.label}`} className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition hover:border-amber-200 hover:bg-amber-50/40">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700">∑</span>
                      <span className="truncate text-sm font-medium text-slate-800">{metric.label}</span>
                    </div>
                    {metric.field ? (
                      <div className="mt-1 pr-7 text-[11px] text-slate-500">{metric.field}</div>
                    ) : null}
                  </div>
                  <button
                    onClick={() => onAddMetric(metric)}
                    className="rounded-lg bg-slate-200 p-1.5 text-slate-700 opacity-0 transition group-hover:opacity-100 hover:bg-amber-100 hover:text-amber-700"
                    title="הוסף מדד"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
