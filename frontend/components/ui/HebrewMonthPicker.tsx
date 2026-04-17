"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  formatMonthDisplay,
  normalizeMonthDisplayInput,
  parseMonthInput,
} from "@/lib/temporalFilter";

const HE_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

function parseMonthValue(value: string): { year: number; month: number } | null {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null;
  const [y, m] = value.split("-").map(Number);
  if (m < 1 || m > 12) return null;
  return { year: y, month: m };
}

export function HebrewMonthPicker({
  value,
  onChange,
  className,
  disabled,
  fieldLabel,
  inputRef: externalInputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  disabled?: boolean;
  fieldLabel?: string;
  inputRef?: { current: HTMLInputElement | null };
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [inputElement, setInputNode] = useState<HTMLInputElement | null>(null);
  const now = new Date();
  const parsed = parseMonthValue(value);
  const [pickerYear, setPickerYear] = useState(parsed?.year ?? now.getFullYear());
  const [inputText, setInputText] = useState(() => formatMonthDisplay(value));

  useEffect(() => {
    const p = parseMonthValue(value);
    if (p) setPickerYear(p.year);
    setInputText(formatMonthDisplay(value));
  }, [value]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function selectInputText() {
    requestAnimationFrame(() => {
      const target = externalInputRef?.current ?? inputElement;
      target?.focus();
      target?.select();
    });
  }

  function setInputElement(node: HTMLInputElement | null) {
    setInputNode(node);
    if (externalInputRef) {
      externalInputRef.current = node;
    }
  }

  function selectMonth(monthIndex: number) {
    const nextValue = `${pickerYear}-${String(monthIndex + 1).padStart(2, "0")}`;
    onChange(nextValue);
    setInputText(formatMonthDisplay(nextValue));
    setOpen(false);
    selectInputText();
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const formatted = normalizeMonthDisplayInput(event.target.value);
    setInputText(formatted);

    const parsedInput = parseMonthInput(formatted);
    if (parsedInput.normalized) {
      onChange(parsedInput.normalized);
    }
  }

  function handleInputBlur() {
    const parsedInput = parseMonthInput(inputText);
    if (parsedInput.normalized) {
      const formatted = formatMonthDisplay(parsedInput.normalized);
      setInputText(formatted);
      onChange(parsedInput.normalized);
      return;
    }

    setInputText(formatMonthDisplay(value));
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        ref={setInputElement}
        value={inputText}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        onFocus={selectInputText}
        onClick={selectInputText}
        placeholder="MM/YYYY"
        inputMode="numeric"
        maxLength={7}
        disabled={disabled}
        data-field-label={fieldLabel}
        aria-label={fieldLabel}
        className={`${className ?? ""} pl-7 ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        dir="ltr"
      />
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (disabled) return;
          selectInputText();
          setOpen((current) => !current);
        }}
        disabled={disabled}
        tabIndex={-1}
        className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-600 disabled:cursor-not-allowed"
        title="בחר חודש"
      >
        <CalendarDays size={13} />
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-1 w-56 rounded-lg border border-slate-200 bg-white shadow-lg"
          dir="rtl"
        >
          {/* Year navigation */}
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <button
              type="button"
              onClick={() => setPickerYear((y) => y - 1)}
              className="rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              title="שנה קודמת"
            >
              <ChevronRight size={14} />
            </button>
            <span className="text-sm font-semibold text-slate-700">{pickerYear}</span>
            <button
              type="button"
              onClick={() => setPickerYear((y) => y + 1)}
              className="rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              title="שנה הבאה"
            >
              <ChevronLeft size={14} />
            </button>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-3 gap-1 p-2">
            {HE_MONTHS.map((name, i) => {
              const isSelected =
                parsed?.year === pickerYear && parsed?.month === i + 1;
              const isCurrentMonth =
                now.getFullYear() === pickerYear && now.getMonth() === i;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectMonth(i)}
                  className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                    isSelected
                      ? "bg-brand-600 text-white"
                      : isCurrentMonth
                      ? "border border-brand-300 text-brand-700 hover:bg-brand-50"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
