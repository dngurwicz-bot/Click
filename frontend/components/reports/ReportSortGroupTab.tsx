"use client";

import { ArrowUpDown, Group, HelpCircle, Sigma } from "lucide-react";
import { ReportDatasetDefinition, ReportDefinition } from "./types";

interface ReportSortGroupTabProps {
  definition: ReportDefinition;
  setDefinition: React.Dispatch<React.SetStateAction<ReportDefinition>>;
  activeDataset: ReportDatasetDefinition | null;
  onFieldFocus: (fieldId: string | null) => void;
  onRequestFieldHelp: (fieldId: string) => void;
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
  onFieldFocus,
  onRequestFieldHelp,
}: ReportSortGroupTabProps) {
  const handleSummaryChange = (columnId: string, value: string) => {
    setDefinition((prev) => {
      const metrics = prev.metrics.filter((metric) => metric.field !== columnId);
      if (value) {
        const datasetMetric = activeDataset?.metrics.find((metric) => metric.field === columnId && metric.operation === value);
        const field = activeDataset?.fields.find((item) => item.id === columnId);
        metrics.push({
          operation: value,
          field: columnId,
          label: datasetMetric?.label || `${SUMMARY_LABELS[value] || value} ${field?.label || columnId}`,
        });
      }
      return { ...prev, metrics, offset: 0 };
    });
  };

  const handleGroupChange = (columnId: string, isGrouped: boolean) => {
    setDefinition((prev) => {
      const groupBy = isGrouped
        ? [...prev.group_by, columnId].filter((id, index, arr) => arr.indexOf(id) === index)
        : prev.group_by.filter((id) => id !== columnId);
      return { ...prev, group_by: groupBy, view_mode: groupBy.length > 0 ? "summary" : "detail", offset: 0 };
    });
  };

  const handleSortChange = (columnId: string, direction: "asc" | "desc" | "") => {
    setDefinition((prev) => ({
      ...prev,
      sort: direction ? [...prev.sort.filter((sort) => sort.field !== columnId), { field: columnId, direction }] : prev.sort.filter((sort) => sort.field !== columnId),
      offset: 0,
    }));
  };

  if (!activeDataset) return <div className="flex h-full items-center justify-center bg-white text-sm text-slate-500">בחר מקור נתונים.</div>;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white" dir="rtl">
      <div className="grid h-14 shrink-0 grid-cols-3 border-b border-slate-300 bg-white">
        <div className="flex items-center gap-2 border-l border-slate-200 px-3">
          <ArrowUpDown size={15} className="text-brand-700" />
          <div>
            <div className="text-[11px] text-slate-500">מיון</div>
            <div className="text-sm font-semibold text-slate-900">{definition.sort.length}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 border-l border-slate-200 px-3">
          <Group size={15} className="text-brand-700" />
          <div>
            <div className="text-[11px] text-slate-500">קיבוץ</div>
            <div className="text-sm font-semibold text-slate-900">{definition.group_by.length}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3">
          <Sigma size={15} className="text-brand-700" />
          <div>
            <div className="text-[11px] text-slate-500">מדדים</div>
            <div className="text-sm font-semibold text-slate-900">{definition.metrics.length}</div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-full border-separate border-spacing-0 text-right text-xs">
          <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600">
            <tr>
              <th className="w-12 border-b border-slate-300 px-2 py-2 text-center font-semibold">אות</th>
              <th className="border-b border-slate-300 px-2 py-2 font-semibold">שם השדה</th>
              <th className="w-36 border-b border-slate-300 px-2 py-2 font-semibold">מיון</th>
              <th className="w-36 border-b border-slate-300 px-2 py-2 font-semibold">קיבוץ</th>
              <th className="w-44 border-b border-slate-300 px-2 py-2 font-semibold">סיכום</th>
            </tr>
          </thead>
          <tbody>
            {definition.columns.length === 0 ? (
              <tr>
                <td colSpan={5} className="h-40 border-b border-slate-200 text-center text-sm text-slate-500">
                  בחר עמודות לפני הגדרת מיון, קיבוץ וסיכומים.
                </td>
              </tr>
            ) : (
              definition.columns.map((columnId, index) => {
                const field = activeDataset.fields.find((item) => item.id === columnId);
                const letter = String.fromCharCode(65 + (index % 26)) + (index >= 26 ? String(Math.floor(index / 26)) : "");
                const isGrouped = definition.group_by.includes(columnId);
                const currentSort = definition.sort.find((sort) => sort.field === columnId)?.direction || "";
                const currentMetric = definition.metrics.find((metric) => metric.field === columnId)?.operation || "";

                return (
                  <tr key={columnId} className={index % 2 ? "bg-slate-50" : "bg-white"}>
                    <td className="border-b border-slate-200 px-2 py-1.5 text-center font-semibold text-slate-600">{letter}</td>
                    <td className="border-b border-slate-200 px-2 py-1.5">
                      <div className="font-semibold text-slate-800">{field?.label || columnId}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                        <span>{field?.category ?? "-"} · {field?.type ?? "-"}</span>
                        {field ? (
                          <button
                            type="button"
                            onClick={() => onRequestFieldHelp(field.id)}
                            onFocus={() => onFieldFocus(field.id)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-brand-700"
                            aria-label={`עזרה עבור ${field.label}`}
                          >
                            <HelpCircle size={12} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td className="border-b border-slate-200 px-2 py-1.5">
                      <select
                        value={currentSort}
                        onChange={(event) => handleSortChange(columnId, event.target.value as "asc" | "desc" | "")}
                        onFocus={() => onFieldFocus(columnId)}
                        className="h-7 w-full rounded border border-slate-300 bg-white px-2 text-xs outline-none focus:border-brand-500"
                      >
                        <option value="">ללא מיון</option>
                        <option value="asc">עולה</option>
                        <option value="desc">יורד</option>
                      </select>
                    </td>
                    <td className="border-b border-slate-200 px-2 py-1.5">
                      {field?.groupable ? (
                        <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={isGrouped}
                            onChange={(event) => handleGroupChange(columnId, event.target.checked)}
                            onFocus={() => onFieldFocus(columnId)}
                            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                          />
                          קבץ
                        </label>
                      ) : (
                        <span className="text-slate-400">לא ניתן</span>
                      )}
                    </td>
                    <td className="border-b border-slate-200 px-2 py-1.5">
                      <select
                        value={currentMetric}
                        onChange={(event) => handleSummaryChange(columnId, event.target.value)}
                        onFocus={() => onFieldFocus(columnId)}
                        className="h-7 w-full rounded border border-slate-300 bg-white px-2 text-xs outline-none focus:border-brand-500"
                      >
                        <option value="">ללא סיכום</option>
                        {field?.type === "number" && (
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

      <div className="flex h-7 shrink-0 items-center justify-between border-t border-slate-300 bg-white px-3 text-[11px] text-slate-500">
        <span>מצב תצוגה: {definition.view_mode === "summary" ? "מסוכם" : "מפורט"}</span>
        <span>שינוי מיון/קיבוץ יתבטא בהרצה הבאה.</span>
      </div>
    </div>
  );
}
