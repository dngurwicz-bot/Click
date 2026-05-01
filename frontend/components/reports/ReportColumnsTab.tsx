"use client";
import { useMemo, useState } from "react";
import { ReportDefinition, ReportDatasetDefinition } from "./types";
import {
  Search, Hash, Type, CalendarDays, ToggleLeft,
  Plus, ChevronDown, ChevronLeft, ArrowUp, ArrowDown, Trash2, Columns3, CheckSquare, Square
} from "lucide-react";

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
  uuid: "מזהה",
  boolean: "כן/לא",
};

const TYPE_COLORS: Record<string, string> = {
  string: "bg-blue-50 text-blue-700",
  number: "bg-emerald-50 text-emerald-700",
  date: "bg-violet-50 text-violet-700",
  datetime: "bg-violet-50 text-violet-700",
  uuid: "bg-slate-100 text-slate-500",
  boolean: "bg-amber-50 text-amber-700",
};

const CATEGORY_ORDER = [
  "לקוח","זהות","איש קשר","כתובת","סטטוס","מנוי","שיוך מודול","מודול","תמחור","תבנית","ברירת מחדל","משתמש","הרשאה","Audit","דוח שמור","כללי",
];

function FieldTypeIcon({ type }: { type: string }) {
  if (type === "number") return <Hash size={12} className="text-emerald-600 shrink-0" />;
  if (type === "date" || type === "datetime") return <CalendarDays size={12} className="text-violet-600 shrink-0" />;
  if (type === "boolean") return <ToggleLeft size={12} className="text-amber-600 shrink-0" />;
  return <Type size={12} className="text-blue-500 shrink-0" />;
}

export function ReportColumnsTab({ definition, setDefinition, activeDataset }: ReportColumnsTabProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const addColumn = (id: string) => {
    setDefinition((prev) => ({
      ...prev,
      columns: prev.columns.includes(id) ? prev.columns : [...prev.columns, id],
      offset: 0,
    }));
  };

  const removeColumn = (id: string) => {
    setDefinition((prev) => ({
      ...prev,
      columns: prev.columns.filter((c) => c !== id),
      offset: 0,
    }));
  };

  const moveColumn = (index: number, dir: "up" | "down") => {
    setDefinition((prev) => {
      const cols = [...prev.columns];
      if (dir === "up" && index > 0) [cols[index - 1], cols[index]] = [cols[index], cols[index - 1]];
      else if (dir === "down" && index < cols.length - 1) [cols[index], cols[index + 1]] = [cols[index + 1], cols[index]];
      return { ...prev, columns: cols, offset: 0 };
    });
  };

  const clearAll = () => setDefinition((prev) => ({ ...prev, columns: [], offset: 0 }));
  const addAll = () => {
    if (!activeDataset) return;
    setDefinition((prev) => ({ ...prev, columns: activeDataset.fields.map((f) => f.id), offset: 0 }));
  };

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const categories = useMemo(() => {
    if (!activeDataset) return [];
    const vals = Array.from(new Set(activeDataset.fields.map((f) => f.category || "כללי")));
    return vals.sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a), bi = CATEGORY_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b, "he");
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [activeDataset]);

  const filteredFields = useMemo(() => {
    if (!activeDataset) return [];
    const needle = search.trim().toLowerCase();
    return activeDataset.fields.filter((f) => {
      const inCat = activeCategory === "all" || (f.category || "כללי") === activeCategory;
      if (!inCat) return false;
      if (!needle) return true;
      return [f.label, f.id, f.category || "", f.description || ""].join(" ").toLowerCase().includes(needle);
    });
  }, [activeDataset, search, activeCategory]);

  const groupedFields = useMemo(() => {
    const groups = new Map<string, typeof filteredFields>();
    for (const f of filteredFields) {
      const cat = f.category || "כללי";
      const arr = groups.get(cat) ?? [];
      arr.push(f);
      groups.set(cat, arr);
    }
    return Array.from(groups.entries()).sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a[0]), bi = CATEGORY_ORDER.indexOf(b[0]);
      if (ai === -1 && bi === -1) return a[0].localeCompare(b[0], "he");
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [filteredFields]);

  if (!activeDataset) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400 text-sm">
        בחר מקור נתונים כדי לראות את רשימת השדות.
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-white" dir="rtl">

      {/* ═══ LEFT PANE: Available Fields ═══ */}
      <div className="flex w-72 shrink-0 flex-col border-l border-slate-200 bg-slate-50">
        {/* Header */}
        <div className="border-b border-slate-200 bg-white px-3 py-2.5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">שדות זמינים</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              {activeDataset.fields.length}
            </span>
          </div>
          {/* Search */}
          <div className="relative">
            <Search size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="חיפוש שדה..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 py-1.5 pl-2 pr-7 text-xs outline-none transition focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-100"
            />
          </div>
        </div>

        {/* Category filter pills */}
        <div className="flex flex-wrap gap-1 border-b border-slate-200 px-2.5 py-2 bg-white">
          <button
            onClick={() => setActiveCategory("all")}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
              activeCategory === "all" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            הכל ({activeDataset.fields.length})
          </button>
          {categories.map((cat) => {
            const count = activeDataset.fields.filter((f) => (f.category || "כללי") === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat === activeCategory ? "all" : cat)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
                  activeCategory === cat ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        {/* Field list grouped by category */}
        <div className="flex-1 overflow-y-auto">
          {groupedFields.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-xs text-slate-400">לא נמצאו שדות</div>
          ) : (
            groupedFields.map(([cat, fields]) => {
              const isCollapsed = collapsedCategories.has(cat);
              const allSelected = fields.every((f) => definition.columns.includes(f.id));
              return (
                <div key={cat}>
                  {/* Category header */}
                  <button
                    onClick={() => toggleCategory(cat)}
                    className="flex w-full items-center justify-between border-b border-slate-100 bg-slate-100/80 px-3 py-1.5 text-right hover:bg-slate-200/50 transition"
                  >
                    <div className="flex items-center gap-1.5">
                      {isCollapsed ? <ChevronLeft size={11} className="text-slate-400" /> : <ChevronDown size={11} className="text-slate-400" />}
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{cat}</span>
                      <span className="rounded-full bg-white px-1.5 text-[9px] font-semibold text-slate-500 border border-slate-200">{fields.length}</span>
                    </div>
                    {/* Select all in category */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (allSelected) {
                          setDefinition((prev) => ({
                            ...prev,
                            columns: prev.columns.filter((c) => !fields.some((f) => f.id === c)),
                          }));
                        } else {
                          const toAdd = fields.map((f) => f.id).filter((id) => !definition.columns.includes(id));
                          setDefinition((prev) => ({ ...prev, columns: [...prev.columns, ...toAdd] }));
                        }
                      }}
                      className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 transition"
                      title={allSelected ? "הסר קטגוריה" : "בחר קטגוריה"}
                    >
                      {allSelected ? <CheckSquare size={11} /> : <Square size={11} />}
                    </button>
                  </button>

                  {!isCollapsed && (
                    <div>
                      {fields.map((field) => {
                        const isSelected = definition.columns.includes(field.id);
                        return (
                          <button
                            key={field.id}
                            onClick={() => isSelected ? removeColumn(field.id) : addColumn(field.id)}
                            className={`group flex w-full items-center gap-2 px-3 py-1.5 text-right text-xs transition border-b border-slate-100/70 ${
                              isSelected
                                ? "bg-blue-50/70 text-blue-900"
                                : "bg-white text-slate-700 hover:bg-blue-50/40"
                            }`}
                          >
                            <FieldTypeIcon type={field.type} />
                            <span className="flex-1 truncate font-medium">{field.label}</span>
                            {isSelected ? (
                              <div className="h-3.5 w-3.5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                                <span className="text-[8px] text-white font-bold">✓</span>
                              </div>
                            ) : (
                              <Plus size={12} className="text-slate-300 group-hover:text-blue-500 transition shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ═══ RIGHT PANE: Selected Columns ═══ */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Columns3 size={16} className="text-blue-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-800">עמודות הדוח</h2>
              <p className="text-[10px] text-slate-400">סדר העמודות ישפיע על הצגה ועל הייצוא</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
              {definition.columns.length} נבחרו
            </span>
            <button
              onClick={addAll}
              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
            >
              הוסף הכל
            </button>
            {definition.columns.length > 0 && (
              <button
                onClick={clearAll}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-100"
              >
                נקה הכל
              </button>
            )}
          </div>
        </div>

        {/* Table of selected columns */}
        <div className="flex-1 overflow-auto">
          {definition.columns.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400 p-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                <Columns3 size={28} className="text-slate-300" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-600">אין עמודות נבחרות</p>
                <p className="mt-1 text-xs text-slate-400 leading-5">לחץ על שדה ברשימה השמאלית כדי להוסיפו לדוח,<br />או לחץ על &quot;הוסף הכל&quot; לבחירה מהירה.</p>
              </div>
            </div>
          ) : (
            <table className="w-full text-right text-sm" dir="rtl">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100">
                <tr>
                  <th className="py-2 px-3 font-semibold text-slate-500 text-center w-10">#</th>
                  <th className="py-2 px-3 font-semibold text-slate-600 text-[11px] uppercase tracking-wide">שם השדה</th>
                  <th className="py-2 px-3 font-semibold text-slate-600 text-[11px] uppercase tracking-wide w-24">סוג</th>
                  <th className="py-2 px-3 font-semibold text-slate-600 text-[11px] uppercase tracking-wide w-20">קטגוריה</th>
                  <th className="py-2 px-3 font-semibold text-slate-600 text-[11px] uppercase tracking-wide text-center w-24">סדר / הסר</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {definition.columns.map((colId, index) => {
                  const field = activeDataset?.fields.find((f) => f.id === colId);
                  return (
                    <tr
                      key={colId}
                      className={`group transition-colors hover:bg-blue-50/40 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}
                    >
                      <td className="py-1.5 px-3 text-center">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700 transition">
                          {index + 1}
                        </span>
                      </td>
                      <td className="py-1.5 px-3">
                        <div className="flex items-center gap-2">
                          <FieldTypeIcon type={field?.type || "string"} />
                          <div>
                            <div className="font-semibold text-slate-800 text-xs">{field?.label || colId}</div>
                            {field?.description && (
                              <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{field.description}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-1.5 px-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_COLORS[field?.type || "string"] || "bg-slate-100 text-slate-500"}`}>
                          {TYPE_LABELS[field?.type || ""] || field?.type || "—"}
                        </span>
                      </td>
                      <td className="py-1.5 px-3">
                        {field?.category && (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-600 font-medium">
                            {field.category}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => moveColumn(index, "up")}
                            disabled={index === 0}
                            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-25 transition"
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            onClick={() => moveColumn(index, "down")}
                            disabled={index === definition.columns.length - 1}
                            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-25 transition"
                          >
                            <ArrowDown size={12} />
                          </button>
                          <button
                            onClick={() => removeColumn(colId)}
                            className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500 transition"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Bottom status bar */}
        {definition.columns.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-4 py-2 text-[11px] text-slate-500">
            <span>{definition.columns.length} עמודות נבחרו מתוך {activeDataset?.fields.length ?? 0} זמינות</span>
            <span className="text-slate-400">לחץ על שדה בעמודה השמאלית להוסיפו או להסירו</span>
          </div>
        )}
      </div>
    </div>
  );
}
