"use client";
import { Plus, X } from "lucide-react";
import { ReportDefinition, ReportDatasetDefinition, FilterOption } from "./types";

const OPERATOR_LABELS: Record<string, string> = {
  equals: "שווה ל",
  not_equals: "שונה מ",
  contains: "מכיל",
  greater_than: "גדול מ",
  greater_or_equal: "גדול או שווה ל",
  less_than: "קטן מ",
  less_or_equal: "קטן או שווה ל",
  is_null: "ריק",
  is_not_null: "לא ריק",
  in: "בתוך רשימה",
  not_in: "לא בתוך רשימה",
};

interface ReportFilterTabProps {
  definition: ReportDefinition;
  setDefinition: React.Dispatch<React.SetStateAction<ReportDefinition>>;
  activeDataset: ReportDatasetDefinition | null;
  filterOptions: { tenant_statuses: FilterOption[]; modules: FilterOption[] };
}

export function ReportFilterTab({
  definition,
  setDefinition,
  activeDataset,
  filterOptions
}: ReportFilterTabProps) {
  
  const addFilter = () => {
    if (!activeDataset || !activeDataset.fields.length) return;
    setDefinition(prev => ({
      ...prev,
      filters: [...prev.filters, { field: activeDataset.fields[0].id, operator: activeDataset.fields[0].operators[0], value: "" }],
      offset: 0
    }));
  };

  const updateFilter = (index: number, key: "field" | "operator" | "value", value: string) => {
    setDefinition(prev => {
      const nextFilters = [...prev.filters];
      nextFilters[index] = { ...nextFilters[index], [key]: value };
      if (key === "field" && activeDataset) {
        const field = activeDataset.fields.find(item => item.id === value);
        if (field) nextFilters[index].operator = field.operators[0];
      }
      return { ...prev, filters: nextFilters, offset: 0 };
    });
  };

  const removeFilter = (index: number) => {
    setDefinition(prev => ({ ...prev, filters: prev.filters.filter((_, idx) => idx !== index), offset: 0 }));
  };

  if (!activeDataset) return null;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-100 p-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-sm">סינון נתונים</h2>
          <span className="text-xs text-slate-500">הגדר תנאים וחתכים לנתוני הדוח</span>
        </div>
        
        <div className="flex-1 overflow-auto p-6 bg-white">
          <div className="max-w-4xl mx-auto space-y-4">
            {definition.filters.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center text-slate-500 flex flex-col items-center justify-center">
                <span className="text-sm font-medium mb-1">לא הוגדרו תנאי סינון</span>
                <span className="text-xs text-slate-400">הדוח יכלול את כל הנתונים הזמינים. לחץ על הכפתור כדי להוסיף תנאי סינון.</span>
              </div>
            ) : (
              definition.filters.map((filter, index) => {
                const field = activeDataset.fields.find(item => item.id === filter.field);
                return (
                  <div key={index} className="flex flex-wrap md:flex-nowrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-sm transition-all hover:border-brand-300">
                    <span className="text-xs font-bold text-slate-400 w-6 text-center">{index === 0 ? "IF" : "AND"}</span>
                    <select
                      value={filter.field}
                      onChange={e => updateFilter(index, "field", e.target.value)}
                      className="h-9 w-full md:w-1/3 rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    >
                      {activeDataset.fields.map(item => (
                        <option key={item.id} value={item.id}>{item.label}</option>
                      ))}
                    </select>
                    
                    <select
                      value={filter.operator}
                      onChange={e => updateFilter(index, "operator", e.target.value)}
                      className="h-9 w-full md:w-1/4 rounded-md border border-slate-300 px-3 text-sm font-medium outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    >
                      {field?.operators.map(operator => (
                        <option key={operator} value={operator}>{OPERATOR_LABELS[operator] || operator}</option>
                      ))}
                    </select>

                    {filter.operator === "is_null" || filter.operator === "is_not_null" ? (
                      <div className="h-9 w-full md:flex-1 rounded-md border border-dashed border-slate-200 bg-slate-100" />
                    ) : field?.type === "boolean" ? (
                      <select
                        value={String(filter.value ?? "")}
                        onChange={e => updateFilter(index, "value", e.target.value)}
                        className="h-9 w-full md:flex-1 rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                      >
                        <option value="">בחר ערך</option>
                        <option value="true">כן</option>
                        <option value="false">לא</option>
                      </select>
                    ) : (
                      <input
                        type={field?.type === "number" ? "number" : field?.type === "date" ? "date" : "text"}
                        value={String(filter.value ?? "")}
                        onChange={e => updateFilter(index, "value", e.target.value)}
                        list={filter.field === "module_slug" ? "report-modules-list" : filter.field === "tenant_status" ? "report-statuses-list" : undefined}
                        className="h-9 w-full md:flex-1 rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                        placeholder="הזן ערך..."
                      />
                    )}
                    
                    <button
                      onClick={() => removeFilter(index)}
                      className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors shrink-0"
                      title="הסר סינון"
                    >
                      <X size={16} />
                    </button>
                  </div>
                );
              })
            )}
            
            <div className="pt-2">
              <button
                onClick={addFilter}
                className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-brand-300 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100"
              >
                <Plus size={16} />
                הוסף תנאי סינון
              </button>
            </div>
          </div>

          <datalist id="report-modules-list">
            {filterOptions.modules.map(opt => <option key={opt.value} value={opt.value} />)}
          </datalist>
          <datalist id="report-statuses-list">
            {filterOptions.tenant_statuses.map(opt => <option key={opt.value} value={opt.value} />)}
          </datalist>
        </div>
      </div>
    </div>
  );
}
