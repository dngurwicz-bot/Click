"use client";
import { ReportDatasetDefinition, ReportResult } from "./types";

interface ReportDataGridProps {
  result: ReportResult | null;
  activeDataset: ReportDatasetDefinition | null;
  loading: boolean;
}

export function ReportDataGrid({ result, activeDataset, loading }: ReportDataGridProps) {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
          <p className="text-sm text-slate-500 font-medium">מעבד נתונים...</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 bg-slate-50/50">
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm max-w-md w-full">
          <h3 className="text-sm font-bold text-slate-700">הקנבס ריק</h3>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            הוסף עמודות, מדדים וסינונים מהתפריט בצד ימין, ולאחר מכן לחץ על <strong>"הרץ דוח"</strong> כדי לצפות בנתונים.
          </p>
        </div>
      </div>
    );
  }

  const getColumnLabel = (colId: string) => {
    return activeDataset?.fields.find((f) => f.id === colId)?.label || colId;
  };

  const firstColumns = result.columns.slice(0, 4);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white">
      {result.summary.length > 0 && (
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex flex-wrap gap-3">
            {result.summary.map((item, idx) => (
              <div key={idx} className="min-w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{item.label}</span>
                <div className="mt-1 text-lg font-bold text-slate-800">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-2.5 py-1 font-medium text-slate-600">{activeDataset?.label || "תוצאת דוח"}</span>
            {firstColumns.map((column) => (
              <span key={column} className="rounded-full bg-white px-2.5 py-1 text-slate-500">
                {getColumnLabel(column)}
              </span>
            ))}
            {result.columns.length > firstColumns.length ? (
              <span className="rounded-full bg-white px-2.5 py-1 text-slate-400">+{result.columns.length - firstColumns.length} עמודות נוספות</span>
            ) : null}
          </div>
        </div>
        <table className="min-w-full border-separate border-spacing-0 text-right text-sm">
          <thead className="sticky top-0 z-10 bg-white shadow-sm">
            <tr>
              {result.columns.map((column, idx) => (
                <th
                  key={`${column}-${idx}`}
                  className="whitespace-nowrap border-b border-slate-200 bg-white px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500"
                >
                  {getColumnLabel(column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <tr>
                <td colSpan={result.columns.length} className="px-4 py-8 text-center text-sm text-slate-500">
                  לא נמצאו נתונים תואמים לסינון.
                </td>
              </tr>
            ) : (
              result.rows.map((row, rowIdx) => (
                <tr key={rowIdx} className={`${rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/50"} transition-colors hover:bg-sky-50/50`}>
                  {result.columns.map((column, colIdx) => (
                    <td
                      key={`${rowIdx}-${colIdx}`}
                      className={`whitespace-nowrap border-b border-slate-100 px-4 py-3 text-sm ${colIdx === 0 ? "font-medium text-slate-900" : "text-slate-700"}`}
                    >
                      {row[column] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-2 text-[11px] font-medium text-slate-500">
        <div>מציג {result.rows.length} שורות מתוך {result.total}</div>
        <div>{activeDataset?.label || "תוצאת דוח"}</div>
      </div>
    </div>
  );
}
