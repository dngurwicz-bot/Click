"use client";
import { ReportDefinition, ReportDatasetDefinition } from "./types";
import { SidebarFields } from "./SidebarFields";
import { Trash2, ArrowUp, ArrowDown, Columns3, Grip, Sparkles } from "lucide-react";

interface ReportColumnsTabProps {
  definition: ReportDefinition;
  setDefinition: React.Dispatch<React.SetStateAction<ReportDefinition>>;
  activeDataset: ReportDatasetDefinition | null;
}

const TYPE_LABELS: Record<string, string> = {
  string: "טקסט",
  number: "מספר",
  date: "תאריך",
  datetime: "תאריך ושעה",
  uuid: "מזהה מערכת",
  boolean: "כן/לא",
};

const CORE_FIELD_GROUPS = [
  {
    label: "פרטי לקוח",
    ids: ["identity_name_he", "org_number", "identity_tax_id", "status_value"],
  },
  {
    label: "אנשי קשר",
    ids: ["contact_main_name", "contact_main_phone", "contact_main_phone_alt", "contact_main_email", "contact_main_website"],
  },
  {
    label: "כתובת",
    ids: ["address_main_street", "address_main_city", "address_main_zip_code", "address_main_country"],
  },
];

export function ReportColumnsTab({
  definition,
  setDefinition,
  activeDataset,
}: ReportColumnsTabProps) {
  const addColumn = (id: string) => {
    setDefinition(prev => ({
      ...prev,
      columns: prev.columns.includes(id) ? prev.columns : [...prev.columns, id],
      offset: 0,
    }));
  };

  const addAllColumns = () => {
    if (!activeDataset) return;
    setDefinition((prev) => ({
      ...prev,
      columns: activeDataset.fields.map((field) => field.id),
      offset: 0,
    }));
  };

  const addFieldGroup = (ids: string[]) => {
    if (!activeDataset) return;
    const valid = ids.filter((id) => activeDataset.fields.some((field) => field.id === id));
    if (valid.length === 0) return;
    setDefinition((prev) => ({
      ...prev,
      columns: Array.from(new Set([...prev.columns, ...valid])),
      offset: 0,
    }));
  };

  const removeColumn = (id: string) => {
    setDefinition(prev => ({
      ...prev,
      columns: prev.columns.filter(col => col !== id),
      offset: 0,
    }));
  };

  const moveColumn = (index: number, direction: "up" | "down") => {
    setDefinition(prev => {
      const cols = [...prev.columns];
      if (direction === "up" && index > 0) {
        [cols[index - 1], cols[index]] = [cols[index], cols[index - 1]];
      } else if (direction === "down" && index < cols.length - 1) {
        [cols[index], cols[index + 1]] = [cols[index + 1], cols[index]];
      }
      return { ...prev, columns: cols, offset: 0 };
    });
  };

  const addGroupBy = (id: string) => {
    setDefinition((prev) => ({
      ...prev,
      group_by: prev.group_by.includes(id) ? prev.group_by : [...prev.group_by, id],
      view_mode: "summary",
      offset: 0,
    }));
  };

  return (
    <div className="flex h-full bg-white">
      <div className="w-72 border-l border-slate-200 bg-slate-50 flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-200 bg-slate-100 font-bold text-slate-700 text-sm">
          קטלוג שדות
        </div>
        <div className="flex-1 overflow-hidden">
          <SidebarFields 
            activeDataset={activeDataset}
            onAddColumn={addColumn}
            onAddGroupBy={addGroupBy}
            onAddMetric={() => {}}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden bg-slate-100 p-4">
        <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                <Columns3 size={18} />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">עמודות</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">{definition.columns.length}</div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <Grip size={18} />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">קיבוץ</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">{definition.group_by.length}</div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <Sparkles size={18} />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">שימוש מהיר</div>
                <div className="mt-1 text-sm font-medium text-slate-700">אפשר להוסיף שדה כעמודה או כקיבוץ ישירות מהקטלוג</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">שדות ליבה מהירים</h3>
              <p className="mt-1 text-xs text-slate-500">כדי שלא תצטרך לחפש, הנה קיצורים לכתובות, אנשי קשר ופרטי לקוח.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {CORE_FIELD_GROUPS.map((group) => (
                <button
                  key={group.label}
                  onClick={() => addFieldGroup(group.ids)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                >
                  הוסף {group.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">עמודות נבחרות לדוח</h2>
              <p className="mt-1 text-xs text-slate-500">סדר העמודות כאן יקבע גם את סדר ההצגה בתוצאה ובייצוא.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={addAllColumns}
                className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 transition hover:bg-sky-100"
              >
                הוסף את כל השדות
              </button>
              <span className="text-xs font-medium text-slate-500 bg-white px-2.5 py-1 rounded-full border border-slate-200">
                סה״כ {definition.columns.length} עמודות
              </span>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto">
            <table className="w-full text-right text-sm">
              <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-600 z-10">
                <tr>
                  <th className="py-2 px-4 font-semibold w-16 text-center">סדר</th>
                  <th className="py-2 px-4 font-semibold w-16 text-center">אות</th>
                  <th className="py-2 px-4 font-semibold">שם השדה</th>
                  <th className="py-2 px-4 font-semibold text-slate-400">סוג נתונים</th>
                  <th className="py-2 px-4 font-semibold w-24 text-center">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {definition.columns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <div className="mx-auto max-w-md">
                        <div className="text-sm font-medium text-slate-600">עדיין לא נבחרו עמודות</div>
                        <div className="mt-2 text-xs leading-6 text-slate-500">בחר שדות מהקטלוג מימין כדי לבנות את מבנה הדוח. אפשר להתחיל משם, טלפון, כתובת, איש קשר או כל שדה אחר.</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  definition.columns.map((colId, index) => {
                    const field = activeDataset?.fields.find(f => f.id === colId);
                    const letter = String.fromCharCode(65 + (index % 26)) + (index >= 26 ? String(Math.floor(index/26)) : '');
                    
                    return (
                      <tr key={colId} className={`${index % 2 === 0 ? "bg-white" : "bg-slate-50/40"} hover:bg-sky-50/50 transition-colors`}>
                        <td className="py-2 px-4 text-center text-slate-500">{index + 1}</td>
                        <td className="py-2 px-4 text-center">
                          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-200 px-2 text-[11px] font-bold text-slate-600">{letter}</span>
                        </td>
                        <td className="py-2 px-4">
                          <div className="font-medium text-slate-800">{field?.label || colId}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                            {field?.category ? (
                              <span className="rounded-full bg-sky-50 px-2 py-0.5 font-medium text-sky-700">{field.category}</span>
                            ) : null}
                            {field?.description ? (
                              <span className="text-slate-400">{field.description}</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-2 px-4 text-xs">
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{TYPE_LABELS[field?.type || ""] || field?.type || "לא ידוע"}</span>
                        </td>
                        <td className="py-2 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <button 
                              onClick={() => moveColumn(index, "up")}
                              disabled={index === 0}
                              className="p-1 rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button 
                              onClick={() => moveColumn(index, "down")}
                              disabled={index === definition.columns.length - 1}
                              className="p-1 rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-30"
                            >
                              <ArrowDown size={14} />
                            </button>
                            <button 
                              onClick={() => removeColumn(colId)}
                              className="p-1 rounded text-red-400 hover:bg-red-50 hover:text-red-600 ml-1"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
