"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CheckSquare,
  CircleX,
  Columns3,
  Hash,
  HelpCircle,
  ListChecks,
  Pin,
  Plus,
  Search,
  Square,
  ToggleLeft,
  Trash2,
  Type,
} from "lucide-react";
import { ReportDatasetDefinition, ReportDefinition } from "./types";

interface ReportColumnsTabProps {
  definition: ReportDefinition;
  setDefinition: React.Dispatch<React.SetStateAction<ReportDefinition>>;
  activeDataset: ReportDatasetDefinition | null;
  preferredColumns: string[];
  onSavePreferredColumns: (datasetId: string, columns: string[]) => void;
  onClearPreferredColumns: (datasetId: string) => void;
  onFieldFocus: (fieldId: string | null) => void;
  onRequestFieldHelp: (fieldId: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  string: "טקסט",
  number: "מספר",
  date: "תאריך",
  datetime: "תאריך ושעה",
  uuid: "מזהה",
  boolean: "כן/לא",
};

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

function FieldTypeIcon({ type }: { type: string }) {
  if (type === "number") return <Hash size={12} className="text-emerald-700" />;
  if (type === "date" || type === "datetime") return <CalendarDays size={12} className="text-indigo-700" />;
  if (type === "boolean") return <ToggleLeft size={12} className="text-amber-700" />;
  return <Type size={12} className="text-slate-600" />;
}

function sortCategories(a: string, b: string) {
  const ai = CATEGORY_ORDER.indexOf(a);
  const bi = CATEGORY_ORDER.indexOf(b);
  if (ai === -1 && bi === -1) return a.localeCompare(b, "he");
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
}

export function ReportColumnsTab({
  definition,
  setDefinition,
  activeDataset,
  preferredColumns,
  onSavePreferredColumns,
  onClearPreferredColumns,
  onFieldFocus,
  onRequestFieldHelp,
}: ReportColumnsTabProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [showPreferencesPanel, setShowPreferencesPanel] = useState(false);

  const categories = useMemo(() => {
    if (!activeDataset) return [];
    return Array.from(new Set(activeDataset.fields.map((field) => field.category || "כללי"))).sort(sortCategories);
  }, [activeDataset]);

  const groupedFields = useMemo(() => {
    if (!activeDataset) return [];
    const needle = search.trim().toLowerCase();
    const fields = activeDataset.fields.filter((field) => {
      const category = field.category || "כללי";
      const inCategory = activeCategory === "all" || activeCategory === category;
      if (!inCategory) return false;
      if (!needle) return true;
      return [field.label, field.id, category, field.description ?? ""].join(" ").toLowerCase().includes(needle);
    });
    const groups = new Map<string, typeof fields>();
    fields.forEach((field) => {
      const category = field.category || "כללי";
      groups.set(category, [...(groups.get(category) ?? []), field]);
    });
    return Array.from(groups.entries()).sort((a, b) => sortCategories(a[0], b[0]));
  }, [activeCategory, activeDataset, search]);

  const addColumn = (id: string) => {
    setDefinition((prev) => ({
      ...prev,
      columns: prev.columns.includes(id) ? prev.columns : [...prev.columns, id],
      offset: 0,
    }));
  };

  const removeColumn = (id: string) => {
    setDefinition((prev) => ({ ...prev, columns: prev.columns.filter((column) => column !== id), offset: 0 }));
  };

  const addAll = () => {
    if (!activeDataset) return;
    setDefinition((prev) => ({ ...prev, columns: activeDataset.fields.map((field) => field.id), offset: 0 }));
  };

  const clearAll = () => {
    setDefinition((prev) => ({ ...prev, columns: [], sort: [], group_by: [], metrics: [], offset: 0 }));
  };

  const applyPreferred = () => {
    if (!activeDataset) return;
    setDefinition((prev) => ({
      ...prev,
      columns: preferredColumns,
      offset: 0,
    }));
  };

  const toggleCategory = (category: string) => {
    if (!activeDataset) return;
    const categoryFields = activeDataset.fields.filter((field) => (field.category || "כללי") === category);
    const allSelected = categoryFields.every((field) => definition.columns.includes(field.id));
    setDefinition((prev) => ({
      ...prev,
      columns: allSelected
        ? prev.columns.filter((id) => !categoryFields.some((field) => field.id === id))
        : [...prev.columns, ...categoryFields.map((field) => field.id).filter((id) => !prev.columns.includes(id))],
      offset: 0,
    }));
  };

  const moveColumn = (index: number, direction: "up" | "down") => {
    setDefinition((prev) => {
      const columns = [...prev.columns];
      if (direction === "up" && index > 0) [columns[index - 1], columns[index]] = [columns[index], columns[index - 1]];
      if (direction === "down" && index < columns.length - 1) [columns[index], columns[index + 1]] = [columns[index + 1], columns[index]];
      return { ...prev, columns, offset: 0 };
    });
  };

  if (!activeDataset) {
    return <div className="flex h-full items-center justify-center bg-white text-sm text-slate-500">בחר מקור נתונים.</div>;
  }

  const preferredFieldLabels = preferredColumns
    .map((columnId) => activeDataset.fields.find((field) => field.id === columnId))
    .filter((field): field is ReportDatasetDefinition["fields"][number] => !!field);

  return (
    <div className="grid h-full min-h-0 grid-cols-[300px_minmax(0,1fr)] overflow-hidden bg-white" dir="rtl">
      <aside className="flex min-h-0 flex-col border-l border-slate-300 bg-slate-50">
        <div className="border-b border-slate-300 bg-white p-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">שדות זמינים</span>
            <span className="text-[11px] text-slate-500">{activeDataset.fields.length} שדות</span>
          </div>
          <div className="relative">
            <Search size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="חיפוש שדה"
              className="h-7 w-full rounded border border-slate-300 bg-white pr-7 pl-2 text-xs outline-none focus:border-brand-500"
            />
          </div>
        </div>

        <div className="flex max-h-24 flex-wrap gap-1 overflow-auto border-b border-slate-300 bg-white p-2">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`h-6 rounded border px-2 text-[11px] ${activeCategory === "all" ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-300 bg-white text-slate-600"}`}
          >
            הכל
          </button>
          {categories.map((category) => (
            <button
              type="button"
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`h-6 rounded border px-2 text-[11px] ${activeCategory === category ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-300 bg-white text-slate-600"}`}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {groupedFields.map(([category, fields]) => {
            const allSelected = fields.every((field) => definition.columns.includes(field.id));
            return (
              <section key={category} className="border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className="flex h-7 w-full items-center justify-between bg-slate-100 px-2 text-right text-[11px] font-semibold text-slate-600 hover:bg-slate-200"
                >
                  <span>
                    {category} ({fields.length})
                  </span>
                  {allSelected ? <CheckSquare size={12} /> : <Square size={12} />}
                </button>
                {fields.map((field) => {
                  const isSelected = definition.columns.includes(field.id);
                  return (
                    <button
                      type="button"
                      key={field.id}
                      onClick={() => (isSelected ? removeColumn(field.id) : addColumn(field.id))}
                      onFocus={() => onFieldFocus(field.id)}
                      onMouseEnter={() => onFieldFocus(field.id)}
                      className={`flex h-8 w-full items-center gap-2 border-t border-slate-100 px-2 text-right text-xs hover:bg-brand-50 ${
                        isSelected ? "bg-brand-50 text-brand-800" : "bg-white text-slate-700"
                      }`}
                    >
                      <FieldTypeIcon type={field.type} />
                      <span className="min-w-0 flex-1 truncate">{field.label}</span>
                      <span
                        onClick={(event) => {
                          event.stopPropagation();
                          onRequestFieldHelp(field.id);
                        }}
                        className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-brand-700"
                        title={`עזרה עבור ${field.label}`}
                      >
                        <HelpCircle size={12} />
                      </span>
                      {isSelected ? <CheckSquare size={13} className="text-brand-700" /> : <Plus size={13} className="text-slate-400" />}
                    </button>
                  );
                })}
              </section>
            );
          })}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-slate-300 bg-white px-3">
          <div className="flex items-center gap-2">
            <Columns3 size={14} className="text-brand-700" />
            <span className="text-xs font-semibold text-slate-800">עמודות הדוח</span>
            <span className="text-[11px] text-slate-500">{definition.columns.length} נבחרו</span>
            <span className="text-[11px] text-slate-400">מועדפים: {preferredColumns.length}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowPreferencesPanel(true)}
              className="inline-flex h-7 items-center gap-1 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700 hover:bg-slate-50"
            >
              <ListChecks size={11} />
              נהל מועדפים
            </button>
            <button
              type="button"
              onClick={() => activeDataset && onSavePreferredColumns(activeDataset.id, definition.columns)}
              disabled={definition.columns.length === 0}
              className="inline-flex h-7 items-center gap-1 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <Pin size={11} />
              שמור כמועדפים
            </button>
            <button
              type="button"
              onClick={applyPreferred}
              disabled={preferredColumns.length === 0}
              className="h-7 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              טען מועדפים
            </button>
            <button
              type="button"
              onClick={() => activeDataset && onClearPreferredColumns(activeDataset.id)}
              disabled={preferredColumns.length === 0}
              className="h-7 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              נקה מועדפים
            </button>
            <button type="button" onClick={addAll} className="h-7 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700 hover:bg-slate-50">
              הוסף הכל
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={definition.columns.length === 0}
              className="h-7 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              נקה
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-full border-separate border-spacing-0 text-right text-xs">
            <thead className="sticky top-0 z-10 bg-slate-100">
              <tr className="text-slate-600">
                <th className="w-12 border-b border-slate-300 px-2 py-2 text-center font-semibold">#</th>
                <th className="border-b border-slate-300 px-2 py-2 font-semibold">שם שדה</th>
                <th className="w-28 border-b border-slate-300 px-2 py-2 font-semibold">סוג</th>
                <th className="w-32 border-b border-slate-300 px-2 py-2 font-semibold">קטגוריה</th>
                <th className="w-24 border-b border-slate-300 px-2 py-2 text-center font-semibold">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {definition.columns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="h-36 border-b border-slate-200 text-center text-sm text-slate-500">
                    בחר שדות מהרשימה כדי להרכיב את מבנה הדוח.
                  </td>
                </tr>
              ) : (
                definition.columns.map((columnId, index) => {
                  const field = activeDataset.fields.find((item) => item.id === columnId);
                  return (
                    <tr key={columnId} className={index % 2 ? "bg-slate-50" : "bg-white"}>
                      <td className="border-b border-slate-200 px-2 py-1.5 text-center text-slate-500">{index + 1}</td>
                      <td className="border-b border-slate-200 px-2 py-1.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <FieldTypeIcon type={field?.type ?? "string"} />
                          <span className="truncate font-semibold text-slate-800">{field?.label ?? columnId}</span>
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
                      <td className="border-b border-slate-200 px-2 py-1.5 text-slate-600">{TYPE_LABELS[field?.type ?? ""] ?? field?.type ?? "-"}</td>
                      <td className="border-b border-slate-200 px-2 py-1.5 text-slate-600">{field?.category ?? "-"}</td>
                      <td className="border-b border-slate-200 px-2 py-1.5">
                        <div className="flex items-center justify-center gap-1">
                          <button type="button" onClick={() => moveColumn(index, "up")} disabled={index === 0} className="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-25">
                            <ArrowUp size={12} />
                          </button>
                          <button type="button" onClick={() => moveColumn(index, "down")} disabled={index === definition.columns.length - 1} className="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-25">
                            <ArrowDown size={12} />
                          </button>
                          <button type="button" onClick={() => removeColumn(columnId)} className="rounded p-1 text-red-600 hover:bg-red-50">
                            <Trash2 size={12} />
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

        <div className="flex h-7 shrink-0 items-center justify-between border-t border-slate-300 bg-white px-3 text-[11px] text-slate-500">
          <span>{definition.columns.length} מתוך {activeDataset.fields.length} שדות נבחרו</span>
          <span>{preferredColumns.length > 0 ? `יש ${preferredColumns.length} שדות מועדפים למקור הנתונים הזה.` : "אין עדיין שדות מועדפים למקור הנתונים הזה."}</span>
        </div>
      </section>

      {showPreferencesPanel && (
        <>
          <div className="fixed inset-0 z-20 bg-slate-900/20" onClick={() => setShowPreferencesPanel(false)} />
          <section className="absolute left-6 top-14 z-30 flex w-[380px] max-w-[calc(100%-48px)] flex-col overflow-hidden border border-slate-300 bg-white shadow-xl">
            <div className="flex h-10 items-center justify-between border-b border-slate-300 bg-slate-50 px-3">
              <div>
                <div className="text-xs font-semibold text-slate-800">מועדפים למקור הנתונים</div>
                <div className="text-[11px] text-slate-500">{activeDataset.label}</div>
              </div>
              <button
                type="button"
                onClick={() => setShowPreferencesPanel(false)}
                className="rounded p-1 text-slate-500 hover:bg-slate-200"
              >
                <CircleX size={14} />
              </button>
            </div>

            <div className="border-b border-slate-200 p-3 text-[11px] text-slate-600">
              שדות מועדפים נטענים אוטומטית בכל דוח חדש של אותו מקור נתונים.
            </div>

            <div className="min-h-0 max-h-[320px] overflow-auto">
              {preferredFieldLabels.length === 0 ? (
                <div className="p-4 text-sm text-slate-500">אין עדיין שדות מועדפים למקור הנתונים הזה.</div>
              ) : (
                <table className="min-w-full border-separate border-spacing-0 text-right text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600">
                    <tr>
                      <th className="border-b border-slate-300 px-2 py-2 font-semibold">שדה</th>
                      <th className="w-24 border-b border-slate-300 px-2 py-2 font-semibold">קטגוריה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preferredFieldLabels.map((field, index) => (
                      <tr key={field.id} className={index % 2 ? "bg-slate-50" : "bg-white"}>
                        <td className="border-b border-slate-200 px-2 py-1.5 font-semibold text-slate-800">{field.label}</td>
                        <td className="border-b border-slate-200 px-2 py-1.5 text-slate-600">{field.category ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-300 bg-white p-3">
              <span className="text-[11px] text-slate-500">{preferredColumns.length} שדות מועדפים שמורים</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => activeDataset && onSavePreferredColumns(activeDataset.id, definition.columns)}
                  disabled={definition.columns.length === 0}
                  className="inline-flex h-7 items-center gap-1 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  <Pin size={11} />
                  החלף לפי הבחירה הנוכחית
                </button>
                <button
                  type="button"
                  onClick={applyPreferred}
                  disabled={preferredColumns.length === 0}
                  className="h-7 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  טען למסך
                </button>
                <button
                  type="button"
                  onClick={() => activeDataset && onClearPreferredColumns(activeDataset.id)}
                  disabled={preferredColumns.length === 0}
                  className="h-7 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  מחק מועדפים
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
