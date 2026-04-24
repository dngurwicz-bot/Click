"use client";
import { ReportDefinition, ReportDatasetDefinition } from "./types";
import { ArrowUpDown, Sigma, Group } from "lucide-react";

interface ReportSortGroupTabProps {
  definition: ReportDefinition;
  setDefinition: React.Dispatch<React.SetStateAction<ReportDefinition>>;
  activeDataset: ReportDatasetDefinition | null;
}

const SUMMARY_LABELS: Record<string, string> = {
  sum: "סכום",
  avg: "ממוצע",
  count: "ספירה",
  count_distinct: "ספירה ייחודית",
};

export function ReportSortGroupTab({
  definition,
  setDefinition,
  activeDataset,
}: ReportSortGroupTabProps) {
  
  const handleSummaryChange = (colId: string, value: string) => {
    setDefinition(prev => {
      // Remove any existing metric for this field
      let newMetrics = prev.metrics.filter(m => m.field !== colId);
      
      if (value) {
        // Find default label if any
        const datasetMetric = activeDataset?.metrics.find(m => m.field === colId && m.operation === value);
        const field = activeDataset?.fields.find(f => f.id === colId);
        
        newMetrics.push({
          operation: value,
          field: colId,
          label: datasetMetric?.label || `${SUMMARY_LABELS[value] || value} ${field?.label || colId}`
        });
      }
      
      return { ...prev, metrics: newMetrics, offset: 0 };
    });
  };

  const handleGroupChange = (colId: string, isGroup: boolean) => {
    setDefinition(prev => {
      let newGroup = [...prev.group_by];
      if (isGroup && !newGroup.includes(colId)) {
        newGroup.push(colId);
      } else if (!isGroup) {
        newGroup = newGroup.filter(id => id !== colId);
      }
      return { 
        ...prev, 
        group_by: newGroup, 
        view_mode: newGroup.length > 0 ? "summary" : "detail",
        offset: 0 
      };
    });
  };

  const handleSortChange = (colId: string, direction: "asc" | "desc" | "") => {
    setDefinition(prev => {
      let newSort = prev.sort.filter(s => s.field !== colId);
      if (direction) {
        newSort.push({ field: colId, direction });
      }
      return { ...prev, sort: newSort, offset: 0 };
    });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-100 p-4">
      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              <ArrowUpDown size={18} />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">מיון</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{definition.sort.length}</div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <Group size={18} />
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
              <Sigma size={18} />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">מדדים</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{definition.metrics.length}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">מיון, קיבוץ וסיכומים</h2>
            <p className="mt-1 text-xs text-slate-500">כאן קובעים איך הנתונים יופיעו, באיזה סדר, ואילו ערכי סיכום ייחשבו.</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500">תצוגה {definition.view_mode === "summary" ? "מסוכמת" : "מפורטת"}</span>
        </div>
        
        <div className="flex-1 overflow-auto">
          <table className="w-full text-right text-sm">
            <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-600 z-10">
              <tr>
                <th className="py-2 px-4 font-semibold w-16 text-center">אות</th>
                <th className="py-2 px-4 font-semibold">שם השדה</th>
                <th className="py-2 px-4 font-semibold w-32">מיון</th>
                <th className="py-2 px-4 font-semibold w-32">הקבצה (Group)</th>
                <th className="py-2 px-4 font-semibold w-40">סיכום (Summary)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
                {definition.columns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <div className="mx-auto max-w-md">
                        <div className="text-sm font-medium text-slate-600">אין עמודות להגדרה עדיין</div>
                        <div className="mt-2 text-xs leading-6 text-slate-500">בחר עמודות קודם, ואז תוכל לשלוט במיון, בקיבוץ ובחישובים המסכמים שלהן.</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                definition.columns.map((colId, index) => {
                  const field = activeDataset?.fields.find(f => f.id === colId);
                  const letter = String.fromCharCode(65 + (index % 26)) + (index >= 26 ? String(Math.floor(index/26)) : '');
                  
                  const isGrouped = definition.group_by.includes(colId);
                  const currentSort = definition.sort.find(s => s.field === colId)?.direction || "";
                  const currentMetric = definition.metrics.find(m => m.field === colId)?.operation || "";
                  
                  return (
                    <tr key={colId} className={`${index % 2 === 0 ? "bg-white" : "bg-slate-50/40"} hover:bg-sky-50/50 transition-colors`}>
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
                      
                      {/* SORT */}
                      <td className="py-2 px-4">
                        <select 
                          value={currentSort}
                          onChange={(e) => handleSortChange(colId, e.target.value as any)}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand-500 bg-white"
                        >
                          <option value="">ללא מיון</option>
                          <option value="asc">עולה</option>
                          <option value="desc">יורד</option>
                        </select>
                      </td>

                      {/* GROUP BY */}
                      <td className="py-2 px-4">
                        {field?.groupable ? (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={isGrouped}
                              onChange={(e) => handleGroupChange(colId, e.target.checked)}
                              className="rounded border-slate-300 text-brand-600 focus:ring-brand-600"
                            />
                            <span className="text-xs text-slate-600">קבץ שורות</span>
                          </label>
                        ) : (
                          <span className="text-xs text-slate-400 italic">לא ניתן לקיבוץ</span>
                        )}
                      </td>

                      {/* METRIC / SUMMARY */}
                      <td className="py-2 px-4">
                        <select 
                          value={currentMetric}
                          onChange={(e) => handleSummaryChange(colId, e.target.value)}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand-500 bg-white"
                        >
                          <option value="">ללא סיכום</option>
                          {field?.type === 'number' && (
                            <>
                              <option value="sum">סכום</option>
                              <option value="avg">ממוצע</option>
                            </>
                          )}
                          <option value="count">ספירה</option>
                          <option value="count_distinct">ספירה ייחודית</option>
                        </select>
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
  );
}
