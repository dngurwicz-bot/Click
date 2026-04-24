"use client";
import { ReportDefinition, ReportDatasetDefinition } from "./types";
import { SidebarFields } from "./SidebarFields";
import { Trash2, ArrowUp, ArrowDown } from "lucide-react";

interface ReportColumnsTabProps {
  definition: ReportDefinition;
  setDefinition: React.Dispatch<React.SetStateAction<ReportDefinition>>;
  activeDataset: ReportDatasetDefinition | null;
}

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
      {/* Right side: Field Picker (RTL means this is logically the start or end, we'll put it on the right to match the image where tree is separate, but a side-panel is fine) */}
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

      {/* Left side: Selected Columns Grid */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-100 p-4">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h2 className="font-bold text-slate-800 text-sm">עמודות נבחרות לדוח</h2>
            <span className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
              סה״כ {definition.columns.length} עמודות
            </span>
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
                    <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                      לא נבחרו עמודות. בחר שדות מהקטלוג מימין.
                    </td>
                  </tr>
                ) : (
                  definition.columns.map((colId, index) => {
                    const field = activeDataset?.fields.find(f => f.id === colId);
                    const letter = String.fromCharCode(65 + (index % 26)) + (index >= 26 ? String(Math.floor(index/26)) : '');
                    
                    return (
                      <tr key={colId} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-4 text-center text-slate-500">{index + 1}</td>
                        <td className="py-2 px-4 text-center font-bold text-slate-400">{letter}</td>
                        <td className="py-2 px-4 font-medium text-slate-800">{field?.label || colId}</td>
                        <td className="py-2 px-4 text-slate-500 text-xs">{field?.type || 'unknown'}</td>
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
