"use client";

import { Filter, HelpCircle, Plus, Trash2 } from "lucide-react";
import { FilterOption, ReportDatasetDefinition, ReportDefinition } from "./types";

const OPERATOR_LABELS: Record<string, string> = {
  equals: "שווה",
  not_equals: "שונה",
  contains: "מכיל",
  greater_than: "גדול מ",
  greater_or_equal: "גדול/שווה",
  less_than: "קטן מ",
  less_or_equal: "קטן/שווה",
  is_null: "ריק",
  is_not_null: "לא ריק",
  in: "ברשימה",
  not_in: "לא ברשימה",
};

interface ReportFilterTabProps {
  definition: ReportDefinition;
  setDefinition: React.Dispatch<React.SetStateAction<ReportDefinition>>;
  activeDataset: ReportDatasetDefinition | null;
  filterOptions: { tenant_statuses: FilterOption[]; modules: FilterOption[] };
  onFieldFocus: (fieldId: string | null) => void;
  onRequestFieldHelp: (fieldId: string) => void;
}

export function ReportFilterTab({
  definition,
  setDefinition,
  activeDataset,
  filterOptions,
  onFieldFocus,
  onRequestFieldHelp,
}: ReportFilterTabProps) {
  const addFilter = () => {
    const firstField = activeDataset?.fields[0];
    if (!firstField) return;
    setDefinition((prev) => ({
      ...prev,
      filters: [...prev.filters, { field: firstField.id, operator: firstField.operators[0], value: "" }],
      offset: 0,
    }));
  };

  const updateFilter = (index: number, key: "field" | "operator" | "value", value: string) => {
    setDefinition((prev) => {
      const filters = [...prev.filters];
      filters[index] = { ...filters[index], [key]: value };
      if (key === "field") {
        const field = activeDataset?.fields.find((item) => item.id === value);
        filters[index].operator = field?.operators[0] ?? "equals";
        filters[index].value = "";
      }
      return { ...prev, filters, offset: 0 };
    });
  };

  const removeFilter = (index: number) => {
    setDefinition((prev) => ({ ...prev, filters: prev.filters.filter((_, itemIndex) => itemIndex !== index), offset: 0 }));
  };

  if (!activeDataset) return <div className="flex h-full items-center justify-center bg-white text-sm text-slate-500">בחר מקור נתונים.</div>;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white" dir="rtl">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-slate-300 bg-white px-3">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-brand-700" />
          <span className="text-xs font-semibold text-slate-800">תנאי סינון</span>
          <span className="text-[11px] text-slate-500">{definition.filters.length} תנאים פעילים</span>
        </div>
        <button
          type="button"
          onClick={addFilter}
          className="inline-flex h-7 items-center gap-1.5 rounded border border-brand-600 bg-brand-600 px-2.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          <Plus size={12} />
          הוסף תנאי
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-full border-separate border-spacing-0 text-right text-xs">
          <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600">
            <tr>
              <th className="w-12 border-b border-slate-300 px-2 py-2 text-center font-semibold">#</th>
              <th className="border-b border-slate-300 px-2 py-2 font-semibold">שדה</th>
              <th className="w-36 border-b border-slate-300 px-2 py-2 font-semibold">תנאי</th>
              <th className="border-b border-slate-300 px-2 py-2 font-semibold">ערך</th>
              <th className="w-28 border-b border-slate-300 px-2 py-2 font-semibold">סוג</th>
              <th className="w-16 border-b border-slate-300 px-2 py-2 text-center font-semibold">הסר</th>
            </tr>
          </thead>
          <tbody>
            {definition.filters.length === 0 ? (
              <tr>
                <td colSpan={6} className="h-40 border-b border-slate-200 text-center text-sm text-slate-500">
                  אין תנאי סינון. הדוח ירוץ על כל הנתונים הזמינים.
                </td>
              </tr>
            ) : (
              definition.filters.map((filter, index) => {
                const field = activeDataset.fields.find((item) => item.id === filter.field);
                const noValue = filter.operator === "is_null" || filter.operator === "is_not_null";
                return (
                  <tr key={`${filter.field}-${index}`} className={index % 2 ? "bg-slate-50" : "bg-white"}>
                    <td className="border-b border-slate-200 px-2 py-1.5 text-center text-slate-500">{index + 1}</td>
                    <td className="border-b border-slate-200 px-2 py-1.5">
                      <select
                        value={filter.field}
                        onChange={(event) => updateFilter(index, "field", event.target.value)}
                        onFocus={() => onFieldFocus(filter.field)}
                        className="h-7 w-full rounded border border-slate-300 bg-white px-2 text-xs outline-none focus:border-brand-500"
                      >
                        {activeDataset.fields.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border-b border-slate-200 px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => field && onRequestFieldHelp(field.id)}
                          onFocus={() => field && onFieldFocus(field.id)}
                          disabled={!field}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-brand-700 disabled:opacity-30"
                          aria-label={field ? `עזרה עבור ${field.label}` : "עזרה עבור השדה"}
                        >
                          <HelpCircle size={12} />
                        </button>
                        <select
                          value={filter.operator}
                          onChange={(event) => updateFilter(index, "operator", event.target.value)}
                          onFocus={() => onFieldFocus(filter.field)}
                          className="h-7 w-full rounded border border-slate-300 bg-white px-2 text-xs outline-none focus:border-brand-500"
                        >
                          {(field?.operators ?? ["equals"]).map((operator) => (
                            <option key={operator} value={operator}>
                              {OPERATOR_LABELS[operator] ?? operator}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="border-b border-slate-200 px-2 py-1.5">
                      {noValue ? (
                        <span className="text-slate-400">אין צורך בערך</span>
                      ) : field?.type === "boolean" ? (
                        <select
                          value={String(filter.value ?? "")}
                          onChange={(event) => updateFilter(index, "value", event.target.value)}
                          onFocus={() => onFieldFocus(filter.field)}
                          className="h-7 w-full rounded border border-slate-300 bg-white px-2 text-xs outline-none focus:border-brand-500"
                        >
                          <option value="">בחר</option>
                          <option value="true">כן</option>
                          <option value="false">לא</option>
                        </select>
                      ) : (
                        <input
                          type={field?.type === "number" ? "number" : field?.type === "date" ? "date" : "text"}
                          value={String(filter.value ?? "")}
                          onChange={(event) => updateFilter(index, "value", event.target.value)}
                          onFocus={() => onFieldFocus(filter.field)}
                          list={
                            filter.field === "module_slug"
                              ? "rft-modules-list"
                              : filter.field === "status_value"
                              ? "rft-statuses-list"
                              : undefined
                          }
                          className="h-7 w-full rounded border border-slate-300 bg-white px-2 text-xs outline-none focus:border-brand-500"
                        />
                      )}
                    </td>
                    <td className="border-b border-slate-200 px-2 py-1.5 text-slate-600">{field?.type ?? "-"}</td>
                    <td className="border-b border-slate-200 px-2 py-1.5 text-center">
                      <button type="button" onClick={() => removeFilter(index)} className="rounded p-1 text-red-600 hover:bg-red-50">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex h-7 shrink-0 items-center justify-between border-t border-slate-300 bg-white px-3 text-[11px] text-slate-500">
        <span>כל התנאים מחוברים ב-AND.</span>
        <span>{definition.filters.length ? "הסינון יוחל בהרצה הבאה." : "אין סינון פעיל."}</span>
      </div>

      <datalist id="rft-modules-list">
        {filterOptions.modules.map((option) => (
          <option key={option.value} value={option.value} />
        ))}
      </datalist>
      <datalist id="rft-statuses-list">
        {filterOptions.tenant_statuses.map((option) => (
          <option key={option.value} value={option.value} />
        ))}
      </datalist>
    </div>
  );
}
