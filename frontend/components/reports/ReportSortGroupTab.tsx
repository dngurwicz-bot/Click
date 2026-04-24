"use client";
import { ReportDefinition, ReportDatasetDefinition, metricKey } from "./types";
import { ArrowUp, ArrowDown } from "lucide-react";

interface ReportSortGroupTabProps {
  definition: ReportDefinition;
  setDefinition: React.Dispatch<React.SetStateAction<ReportDefinition>>;
  activeDataset: ReportDatasetDefinition | null;
}

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
          label: datasetMetric?.label || `${value.toUpperCase()} ${field?.label || colId}`
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
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-sm">מיון וסיכומים</h2>
          <span className="text-xs text-slate-500">הגדרות מתקדמות לעמודות שנבחרו</span>
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
                  <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                    לא נבחרו עמודות לדוח.
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
                    <tr key={colId} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-4 text-center font-bold text-slate-400">{letter}</td>
                      <td className="py-2 px-4 font-medium text-slate-800">{field?.label || colId}</td>
                      
                      {/* SORT */}
                      <td className="py-2 px-4">
                        <select 
                          value={currentSort}
                          onChange={(e) => handleSortChange(colId, e.target.value as any)}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand-500 bg-white"
                        >
                          <option value="">ללא מיון</option>
                          <option value="asc">עולה (A-Z)</option>
                          <option value="desc">יורד (Z-A)</option>
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
                              <option value="sum">סכום (Sum)</option>
                              <option value="avg">ממוצע (Avg)</option>
                            </>
                          )}
                          <option value="count">ספירה (Count)</option>
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
