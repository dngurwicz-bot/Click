"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { AdminActionBar, AdminTitleBar } from "@/components/layout/AdminShell";
import { TemporalFilterBar } from "@/components/ui/TemporalFilterBar";
import {
  createDefaultTemporalFilterState,
  getTemporalFilterError,
  overlapsTemporalFilter,
  type TemporalFilterState,
} from "@/lib/temporalFilter";

export interface FormTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

export interface ChildColumn {
  key: string;
  label: string;
  required?: boolean;
  width?: string;
}

export interface ChildRow extends Record<string, React.ReactNode> {
  _current?: boolean;
  _valid_from_raw?: string;
  _valid_to_raw?: string | null;
}

export interface ChildTab {
  id: string;
  label: string;
  columns: ChildColumn[];
  rows: ChildRow[];
  temporalFilter?: boolean;
  emptyMessage?: string;
  onRowDoubleClick?: (rowIndex: number) => void;
  onAddClick?: () => void;
}

export interface CardPageAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "primary";
  icon?: React.ReactNode;
}

export interface CardPageProps {
  title: string;
  backHref?: string;
  backLabel?: string;
  status?: { label: string; type: "active" | "trial" | "suspended" | "cancelled" };
  onNew?: () => void;
  primaryActions?: CardPageAction[];
  /** Static parent content (no tabs) — shown instead of formTabs when provided */
  parentContent?: React.ReactNode;
  formTabs: FormTab[];
  childTabs: ChildTab[];
  loading?: boolean;
}

const STATUS_CONFIG = {
  active:    { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50"  },
  trial:     { dot: "bg-amber-400",   text: "text-amber-700",   bg: "bg-amber-50"   },
  suspended: { dot: "bg-red-500",     text: "text-red-700",     bg: "bg-red-50"     },
  cancelled: { dot: "bg-slate-400",   text: "text-slate-500",   bg: "bg-slate-100"  },
};

export function CardPage({
  title, backHref, backLabel, status, onNew,
  primaryActions = [], parentContent, formTabs, childTabs, loading,
}: CardPageProps) {
  const [activeFormTab,  setActiveFormTab]  = useState(formTabs[0]?.id ?? "");
  const [activeChildTab, setActiveChildTab] = useState(childTabs[0]?.id ?? "");
  const [temporalFilters, setTemporalFilters] = useState<Record<string, TemporalFilterState>>({});

  useEffect(() => {
    if (childTabs.length > 0 && !childTabs.find((t) => t.id === activeChildTab)) {
      setActiveChildTab(childTabs[0].id);
    }
  }, [childTabs, activeChildTab]);

  useEffect(() => {
    setTemporalFilters((prev) => {
      let changed = false;
      const next = { ...prev };

      for (const tab of childTabs) {
        if (tab.temporalFilter && !next[tab.id]) {
          next[tab.id] = createDefaultTemporalFilterState();
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [childTabs]);

  const statusCfg      = status ? STATUS_CONFIG[status.type] : null;
  const currentFormTab = formTabs.find((t) => t.id === activeFormTab);
  const currentChildTab = childTabs.find((t) => t.id === activeChildTab);
  const temporalFilterEnabled = Boolean(
    currentChildTab?.temporalFilter &&
    currentChildTab.rows.some((row) => row._valid_from_raw),
  );
  const currentTemporalFilter = currentChildTab
    ? (temporalFilters[currentChildTab.id] ?? createDefaultTemporalFilterState())
    : createDefaultTemporalFilterState();
  const temporalFilterError = temporalFilterEnabled
    ? getTemporalFilterError(currentTemporalFilter)
    : null;
  const visibleRows = currentChildTab
    ? currentChildTab.rows.filter((row) => {
        if (!temporalFilterEnabled || temporalFilterError) return true;
        return overlapsTemporalFilter({
          rowFrom: row._valid_from_raw,
          rowTo: row._valid_to_raw,
          filter: currentTemporalFilter,
        });
      })
    : [];

  function updateTemporalFilter(tabId: string, nextFilter: TemporalFilterState) {
    setTemporalFilters((prev) => ({
      ...prev,
      [tabId]: nextFilter,
    }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">

      <AdminTitleBar title={title} backHref={backHref} backLabel={backLabel} />

      <AdminActionBar
        start={
          <>
          {onNew && (
            <button
              onClick={onNew}
              className="flex items-center gap-1 bg-brand-600 hover:bg-brand-700 text-white
                         text-xs font-semibold px-3 py-1.5 rounded-md transition-colors shadow-sm"
            >
              <Plus size={12} />
              חדש
            </button>
          )}
          </>
        }
        center={statusCfg && status ? (
          <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${statusCfg.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
            <span className={statusCfg.text}>{status.label}</span>
          </div>
        ) : undefined}
        end={
          <>
          {primaryActions.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors
                ${action.variant === "primary"
                  ? "bg-brand-600 hover:bg-brand-700 text-white border-brand-600 shadow-sm"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-400"
                }`}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
          </>
        }
      />

      {/* ── Parent Content (static) OR Form Tabs ──────────────────── */}
      {parentContent ? (
        <div className="bg-white border-b border-slate-200 shrink-0">
          {parentContent}
        </div>
      ) : (
        <>
          {/* Form Tabs */}
          {formTabs.length > 0 && (
            <div className="bg-white border-b border-slate-200 flex items-end px-3 shrink-0 gap-0.5">
              {formTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFormTab(tab.id)}
                  className={`px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap
                    ${activeFormTab === tab.id
                      ? "border-brand-500 text-brand-600"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
          {/* Form Content */}
          {currentFormTab && (
            <div className="bg-white border-b border-slate-200 shrink-0">
              {currentFormTab.content}
            </div>
          )}
        </>
      )}

      {/* ── Child Tabs ────────────────────────────────────────────── */}
      {childTabs.length > 0 && (
        <div className="bg-slate-100 border-b border-slate-200 flex items-center px-3 shrink-0 mt-0.5 gap-0.5">
          <div className="flex items-end flex-1 gap-0.5 self-stretch">
            {childTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveChildTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap self-end
                  ${activeChildTab === tab.id
                    ? "border-brand-500 text-brand-600 bg-white"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {/* Add button for current tab */}
          {currentChildTab?.onAddClick && (
            <button
              onClick={currentChildTab.onAddClick}
              title="הוסף רשומה"
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded
                         bg-brand-600 hover:bg-brand-700 text-white transition-colors shrink-0"
            >
              <Plus size={11} />
              הוסף
            </button>
          )}
        </div>
      )}

      {/* ── Child Grid ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto bg-white min-h-0">
        {currentChildTab && (
          <>
            {temporalFilterEnabled && (
              <TemporalFilterBar
                filter={currentTemporalFilter}
                onChange={(nextFilter) => updateTemporalFilter(currentChildTab.id, nextFilter)}
                rowRanges={currentChildTab.rows.map((row) => ({
                  valid_from: row._valid_from_raw,
                  valid_to: row._valid_to_raw,
                }))}
                idPrefix={`temporal-${currentChildTab.id}`}
              />
            )}

            <table className="w-full text-xs border-collapse min-w-max">
              <thead className="sticky top-0 z-10">
                <tr>
                  {currentChildTab.columns.map((col) => (
                    <th
                      key={col.key}
                      className={`text-right px-3 py-2 font-semibold text-slate-600
                               bg-slate-100 border-b border-slate-200 border-l border-slate-200 whitespace-nowrap ${col.width ?? ""}`}
                    >
                      {col.required && <span className="text-red-400 ml-0.5">*</span>}
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr
                    onClick={currentChildTab.rows.length === 0 ? currentChildTab.onAddClick : undefined}
                    className={currentChildTab.rows.length === 0 && currentChildTab.onAddClick ? "cursor-pointer hover:bg-blue-50 transition-colors" : ""}
                  >
                    <td colSpan={currentChildTab.columns.length} className="text-center py-12 text-slate-400">
                      {currentChildTab.rows.length === 0 ? (
                        currentChildTab.onAddClick ? (
                          <span className="flex items-center justify-center gap-1.5">
                            <Plus size={14} />
                            {currentChildTab.emptyMessage ?? "לחץ להוספת רשומה"}
                          </span>
                        ) : (
                          currentChildTab.emptyMessage ?? "אין רשומות"
                        )
                      ) : (
                        temporalFilterError
                          ? "הטווח שנבחר אינו תקין"
                          : "לא נמצאו רשומות עבור הסינון שנבחר"
                      )}
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row, i) => {
                    const isCurrent = row._current === true;
                    const hasClick = !!currentChildTab.onRowDoubleClick;
                    const originalIndex = currentChildTab.rows.indexOf(row);
                    return (
                      <tr
                        key={originalIndex >= 0 ? originalIndex : i}
                        onDoubleClick={() => currentChildTab.onRowDoubleClick?.(originalIndex >= 0 ? originalIndex : i)}
                        title={hasClick ? "לחץ פעמיים לעריכה" : undefined}
                        className={`transition-colors ${hasClick ? "cursor-pointer" : ""} ${
                          isCurrent
                            ? "bg-brand-50 font-medium hover:bg-brand-100"
                            : i % 2 === 0
                              ? "bg-white hover:bg-slate-50 text-slate-600"
                              : "bg-slate-50/60 hover:bg-slate-100 text-slate-600"
                        }`}
                      >
                        {currentChildTab.columns.map((col) => (
                          <td key={col.key} className="px-3 py-1.5 border-b border-slate-100 border-l border-slate-100">
                            {row[col.key] ?? ""}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
