"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const HE_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];
const HE_DAY_ABBR = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

function parseDateValue(value: string): { year: number; month: number; day: number } | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  return { year: y, month: m, day: d };
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** YYYY-MM-DD → DD/MM/YY */
function valueToDisplay(value: string): string {
  const p = parseDateValue(value);
  if (!p) return "";
  const yy = String(p.year).slice(-2);
  return `${String(p.day).padStart(2, "0")}/${String(p.month).padStart(2, "0")}/${yy}`;
}

/** DD/MM/YY or DD/MM/YYYY → YYYY-MM-DD, or null if invalid */
function parseDisplayInput(s: string): string | null {
  const parts = s.split("/");
  if (parts.length !== 3) return null;
  const [dd, mm, yyRaw] = parts;
  const day = Number(dd);
  const month = Number(mm);
  let year = Number(yyRaw);
  if (!day || !month || !year || isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (yyRaw.length <= 2) year = year >= 50 ? 1900 + year : 2000 + year;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Auto-insert slashes while typing: after 2nd and 4th digit */
function autoFormatTyping(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 6)}`;
}

export function HebrewDatePicker({
  value,
  onChange,
  className,
  id,
  disabled,
  fieldLabel,
  inputRef: externalInputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  id?: string;
  disabled?: boolean;
  fieldLabel?: string;
  inputRef?: { current: HTMLInputElement | null };
}) {
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState(() => valueToDisplay(value));
  const ref = useRef<HTMLDivElement>(null);
  const [inputElement, setInputNode] = useState<HTMLInputElement | null>(null);
  const today = new Date();
  const parsed = parseDateValue(value);
  const [viewYear, setViewYear] = useState(parsed?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.getMonth() + 1);

  useEffect(() => {
    setInputText(valueToDisplay(value));
    const p = parseDateValue(value);
    if (p) { setViewYear(p.year); setViewMonth(p.month); }
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

  function prevMonth() {
    if (viewMonth === 1) { setViewYear((y) => y - 1); setViewMonth(12); }
    else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 12) { setViewYear((y) => y + 1); setViewMonth(1); }
    else setViewMonth((m) => m + 1);
  }

  function selectDay(day: number) {
    const m = String(viewMonth).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    const iso = `${viewYear}-${m}-${d}`;
    onChange(iso);
    setInputText(valueToDisplay(iso));
    setOpen(false);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = autoFormatTyping(e.target.value);
    setInputText(formatted);
    if (formatted.length === 8) {
      const iso = parseDisplayInput(formatted);
      if (iso) onChange(iso);
    }
  }

  function handleInputBlur() {
    if (!inputText.trim()) {
      onChange("");
      setInputText("");
      return;
    }

    const iso = parseDisplayInput(inputText);
    if (iso) {
      onChange(iso);
    } else {
      setInputText(valueToDisplay(value));
    }
  }

  const firstDayOfWeek = new Date(viewYear, viewMonth - 1, 1).getDay();
  const total = daysInMonth(viewYear, viewMonth);
  const cells: (number | null)[] = [
    ...Array<null>(firstDayOfWeek).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div ref={ref} className="relative">
      {/* Text input — className from caller applies here, just like the old button */}
      <input
        id={id}
        type="text"
        ref={setInputElement}
        value={inputText}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        onFocus={selectInputText}
        onClick={selectInputText}
        placeholder="DD/MM/YY"
        data-field-label={fieldLabel}
        maxLength={8}
        disabled={disabled}
        dir="ltr"
        className={`${className ?? ""} pl-7 ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      />
      {/* Calendar icon — absolutely positioned inside the input on the left */}
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (disabled) return;
          selectInputText();
          setOpen((o) => !o);
        }}
        disabled={disabled}
        tabIndex={-1}
        className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-600 disabled:cursor-not-allowed"
        title="בחר תאריך מלוח שנה"
      >
        <CalendarDays size={13} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-slate-200 bg-white shadow-lg"
          dir="rtl"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <button
              type="button"
              onClick={prevMonth}
              className="rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              title="חודש קודם"
            >
              <ChevronRight size={14} />
            </button>
            <span className="text-sm font-semibold text-slate-700">
              {HE_MONTHS[viewMonth - 1]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              title="חודש הבא"
            >
              <ChevronLeft size={14} />
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-slate-100 px-2 py-1">
            {HE_DAY_ABBR.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold text-slate-400">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-0.5 p-2">
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} />;
              const isSelected =
                parsed?.year === viewYear &&
                parsed?.month === viewMonth &&
                parsed?.day === day;
              const isToday =
                today.getFullYear() === viewYear &&
                today.getMonth() + 1 === viewMonth &&
                today.getDate() === day;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`rounded py-0.5 text-xs font-medium transition-colors ${
                    isSelected
                      ? "bg-brand-600 text-white"
                      : isToday
                      ? "border border-brand-300 text-brand-700 hover:bg-brand-50"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
