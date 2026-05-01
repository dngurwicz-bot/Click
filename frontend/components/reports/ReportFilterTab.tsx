"use client";
import { Filter, Plus, X, SlidersHorizontal, Info } from "lucide-react";
import { ReportDefinition, ReportDatasetDefinition, FilterOption } from "./types";

const OPERATOR_LABELS: Record<string, string> = {
  equals: "שווה ל",
  not_equals: "שונה מ",
  contains: "מכיל",
  greater_than: "גדול מ",
  greater_or_equal: "גדול או שווה",
  less_than: "קטן מ",
  less_or_equal: "קטן או שווה",
  is_null: "ריק (ללא ערך)",
  is_not_null: "מכיל ערך",
  in: "בתוך רשימה",
  not_in: "לא ברשימה",
};

interface ReportFilterTabProps {
  definition: ReportDefinition;
  setDefinition: React.Dispatch<React.SetStateAction<ReportDefinition>>;
  activeDataset: ReportDatasetDefinition | null;
  filterOptions: { tenant_statuses: FilterOption[]; modules: FilterOption[] };
}

export function ReportFilterTab({ definition, setDefinition, activeDataset, filterOptions }: ReportFilterTabProps) {
  const addFilter = () => {
    if (!activeDataset?.fields.length) return;
    setDefinition((prev) => ({
      ...prev,
      filters: [...prev.filters, { field: activeDataset.fields[0].id, operator: activeDataset.fields[0].operators[0], value: "" }],
      offset: 0,
    }));
  };

  const updateFilter = (index: number, key: "field" | "operator" | "value", value: string) => {
    setDefinition((prev) => {
      const nextFilters = [...prev.filters];
      nextFilters[index] = { ...nextFilters[index], [key]: value };
      if (key === "field" && activeDataset) {
        const field = activeDataset.fields.find((f) => f.id === value);
        if (field) nextFilters[index].operator = field.operators[0];
        nextFilters[index].value = "";
      }
      return { ...prev, filters: nextFilters, offset: 0 };
    });
  };

  const removeFilter = (index: number) => {
    setDefinition((prev) => ({ ...prev, filters: prev.filters.filter((_, i) => i !== index), offset: 0 }));
  };

  if (!activeDataset) return null;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50" dir="rtl">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <SlidersHorizontal size={15} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">סינון נתונים</h2>
            <p className="text-[10px] text-slate-500">הגדר תנאים לסינון שורות הדוח</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {definition.filters.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
              {definition.filters.length} תנאים פעילים
            </span>
          )}
          <button
            onClick={addFilter}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus size={13} />
            הוסף תנאי
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-5">
        {definition.filters.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-slate-400">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
              <Filter size={28} className="text-slate-300" />
            </div>
            <div className="text-center max-w-sm">
              <p className="text-sm font-semibold text-slate-600 mb-1">לא הוגדרו תנאי סינון</p>
              <p className="text-xs text-slate-400 leading-5">הדוח יכלול את כל הנתונים הזמינים.<br />לחץ על &quot;הוסף תנאי&quot; כדי לצמצם את התוצאות.</p>
            </div>
            <button
              onClick={addFilter}
              className="flex items-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
            >
              <Plus size={15} />
              הוסף תנאי סינון ראשון
            </button>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-2.5">
            {/* Info tip */}
            <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-700">
              <Info size={12} className="mt-0.5 shrink-0 text-blue-500" />
              <span>כל תנאי מחובר ב-<strong>AND</strong> — הדוח יציג רק שורות שעומדות בכל התנאים.</span>
            </div>

            {definition.filters.map((filter, index) => {
              const field = activeDataset.fields.find((f) => f.id === filter.field);
              const noValue = filter.operator === "is_null" || filter.operator === "is_not_null";

              return (
                <div
                  key={index}
                  className="flex flex-wrap md:flex-nowrap items-center gap-2.5 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-blue-200 hover:shadow-md"
                >
                  {/* Condition label */}
                  <span className="shrink-0 flex items-center justify-center rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-extrabold text-slate-600 min-w-[36px]">
                    {index === 0 ? "אם" : "וגם"}
                  </span>

                  {/* Field selector */}
                  <select
                    value={filter.field}
                    onChange={(e) => updateFilter(index, "field", e.target.value)}
                    className="h-9 flex-1 min-w-[160px] rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 hover:border-slate-400"
                  >
                    {activeDataset.fields.map((f) => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>

                  {/* Operator selector */}
                  <select
                    value={filter.operator}
                    onChange={(e) => updateFilter(index, "operator", e.target.value)}
                    className="h-9 w-36 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 hover:border-slate-400 shrink-0"
                  >
                    {field?.operators.map((op) => (
                      <option key={op} value={op}>{OPERATOR_LABELS[op] || op}</option>
                    ))}
                  </select>

                  {/* Value input */}
                  {noValue ? (
                    <div className="h-9 flex-1 min-w-[120px] rounded-xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-[11px] text-slate-400 italic">
                      אין צורך בערך
                    </div>
                  ) : field?.type === "boolean" ? (
                    <select
                      value={String(filter.value ?? "")}
                      onChange={(e) => updateFilter(index, "value", e.target.value)}
                      className="h-9 flex-1 min-w-[120px] rounded-xl border border-slate-300 bg-white px-3 text-xs outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">בחר ערך</option>
                      <option value="true">כן</option>
                      <option value="false">לא</option>
                    </select>
                  ) : (
                    <input
                      type={field?.type === "number" ? "number" : field?.type === "date" ? "date" : "text"}
                      value={String(filter.value ?? "")}
                      onChange={(e) => updateFilter(index, "value", e.target.value)}
                      list={
                        filter.field === "module_slug" ? "rft-modules-list"
                          : filter.field === "status_value" ? "rft-statuses-list"
                          : undefined
                      }
                      placeholder="הזן ערך..."
                      className="h-9 flex-1 min-w-[120px] rounded-xl border border-slate-300 bg-white px-3 text-xs outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300"
                    />
                  )}

                  {/* Remove */}
                  <button
                    onClick={() => removeFilter(index)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-500 transition"
                    title="הסר תנאי"
                  >
                    <X size={15} />
                  </button>
                </div>
              );
            })}

            <button
              onClick={addFilter}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 py-2.5 text-xs font-medium text-slate-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 mt-1"
            >
              <Plus size={13} />
              הוסף תנאי נוסף
            </button>
          </div>
        )}
      </div>

      <datalist id="rft-modules-list">
        {filterOptions.modules.map((opt) => <option key={opt.value} value={opt.value} />)}
      </datalist>
      <datalist id="rft-statuses-list">
        {filterOptions.tenant_statuses.map((opt) => <option key={opt.value} value={opt.value} />)}
      </datalist>
    </div>
  );
}
