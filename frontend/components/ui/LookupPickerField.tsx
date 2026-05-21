"use client";

import { useState } from "react";
import { Check, MoreVertical, Search, Settings2, X } from "lucide-react";

export interface LookupOption {
  value: string;
  label: string;
  code?: string;
}

interface LookupPickerModalProps {
  title: string;
  options: LookupOption[];
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  lookupHref?: string;
  zIndex?: string;
}

export function LookupPickerModal({
  title,
  options,
  value,
  onSelect,
  onClose,
  lookupHref,
  zIndex = "z-50",
}: LookupPickerModalProps) {
  const [search, setSearch] = useState("");
  const hasCode = options.some((o) => o.code);
  const filtered = search
    ? options.filter(
        (o) =>
          o.label.includes(search) ||
          o.value.toLowerCase().includes(search.toLowerCase()) ||
          (o.code && o.code.toLowerCase().includes(search.toLowerCase())),
      )
    : options;

  return (
    <div
      className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/25`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50 rounded-t-lg">
          <h3 className="text-sm font-semibold text-slate-700">בחר {title}</h3>
          <div className="flex items-center gap-1">
            {lookupHref && (
              <a
                href={lookupHref}
                title="הגדרות רשימה"
                className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-brand-600 transition-colors"
              >
                <Settings2 size={13} />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-slate-100">
          <div className="relative">
            <Search size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש..."
              autoFocus
              className="w-full pr-8 pl-3 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100 text-right bg-white"
            />
          </div>
        </div>

        {/* Options table */}
        <div className="overflow-auto max-h-64">
          <table className="w-full text-xs border-collapse">
            {hasCode && (
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className="px-3 py-1.5 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wide w-16">
                    קוד
                  </th>
                  <th className="px-4 py-1.5 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                    תיאור
                  </th>
                  <th className="w-8" />
                </tr>
              </thead>
            )}
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={hasCode ? 3 : 2} className="px-4 py-6 text-center text-slate-400">
                    לא נמצאו תוצאות
                  </td>
                </tr>
              ) : (
                filtered.map((option, i) => {
                  const isSelected = option.value === value;
                  return (
                    <tr
                      key={option.value}
                      onClick={() => onSelect(option.value)}
                      className={`cursor-pointer transition-colors border-b border-slate-50 last:border-0
                        ${
                          isSelected
                            ? "bg-brand-50"
                            : i % 2 === 0
                              ? "bg-white hover:bg-brand-50/40"
                              : "bg-slate-50/60 hover:bg-brand-50/40"
                        }`}
                    >
                      {hasCode && (
                        <td className="px-3 py-2.5 text-right">
                          <span className="inline-block font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {option.code ?? ""}
                          </span>
                        </td>
                      )}
                      <td
                        className={`px-4 py-2.5 text-right ${
                          isSelected ? "font-semibold text-brand-700" : "text-slate-800"
                        }`}
                      >
                        {option.label}
                      </td>
                      <td className="px-3 py-2.5 w-8 text-left">
                        {isSelected && <Check size={12} className="text-brand-600" />}
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

interface LookupPickerFieldProps {
  label: string;
  value?: string | null;
  options: LookupOption[];
  readOnly?: boolean;
  onChange?: (value: string) => void;
  lookupHref?: string;
  canAdmin?: boolean;
  required?: boolean;
}

export function LookupPickerField({
  label,
  value,
  options,
  readOnly = true,
  onChange,
  lookupHref,
  canAdmin = false,
  required,
}: LookupPickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState(false);

  const hasCode = options.some((o) => o.code);
  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption?.label ?? "";

  function handleCodeChange(raw: string) {
    setCodeInput(raw);
    if (!raw) {
      setCodeError(false);
      onChange?.("");
      return;
    }
    const match = options.find(
      (o) => o.code && o.code.toLowerCase() === raw.toLowerCase(),
    );
    if (match) {
      setCodeError(false);
      onChange?.(match.value);
    } else {
      setCodeError(true);
    }
  }

  function handleCodeBlur() {
    if (codeError) {
      setCodeInput("");
      setCodeError(false);
    }
  }

  const baseInputClass =
    "border border-slate-300 rounded px-2.5 py-1 text-xs text-right bg-white " +
    "focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-200 focus:bg-brand-50 " +
    "transition-colors";

  const readOnlyInputClass =
    "flex-1 min-w-0 border border-slate-300 rounded px-2.5 py-1 text-xs text-right " +
    "bg-slate-50 text-slate-600 cursor-default transition-colors";

  return (
    <>
      <div className="flex items-center gap-1 min-h-[26px]">
        <label
          className="text-[11px] font-medium text-slate-500 shrink-0 text-right whitespace-nowrap"
          style={{ minWidth: "84px" }}
        >
          {required && <span className="text-red-400 ml-0.5">*</span>}
          {label}
        </label>

        {/* Code input — only when editable and options have codes */}
        {!readOnly && hasCode && (
          <input
            type="text"
            value={codeInput || (selectedOption?.code ?? "")}
            onChange={(e) => handleCodeChange(e.target.value)}
            onFocus={() => setCodeInput(selectedOption?.code ?? "")}
            onBlur={handleCodeBlur}
            placeholder="קוד"
            title="הקלד קוד לבחירה מהירה"
            className={`${baseInputClass} w-14 text-center font-mono ${
              codeError ? "border-red-400 bg-red-50" : ""
            }`}
          />
        )}

        {/* Label display */}
        <input
          type="text"
          value={displayLabel}
          readOnly
          className={`${readOnlyInputClass} flex-1`}
        />

        {/* ⋮ picker button */}
        {!readOnly && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
            title="פתח רשימת בחירה"
          >
            <MoreVertical size={14} />
          </button>
        )}

        {/* ⚙️ admin settings button */}
        {canAdmin && lookupHref && (
          <a
            href={lookupHref}
            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-brand-600 transition-colors shrink-0"
            title="הגדרות רשימה"
          >
            <Settings2 size={12} />
          </a>
        )}
      </div>

      {open && (
        <LookupPickerModal
          title={label}
          options={options}
          value={value ?? ""}
          onSelect={(v) => {
            onChange?.(v);
            setCodeInput("");
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
          lookupHref={canAdmin ? lookupHref : undefined}
        />
      )}
    </>
  );
}
