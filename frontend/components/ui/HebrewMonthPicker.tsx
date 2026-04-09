"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const now = new Date();
  const parsed = parseMonthValue(value);
  const [pickerYear, setPickerYear] = useState(parsed?.year ?? now.getFullYear());

  useEffect(() => {
    const p = parseMonthValue(value);
    if (p) setPickerYear(p.year);
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

  const displayText = parsed
    ? `${HE_MONTHS[parsed.month - 1]} ${parsed.year}`
    : "בחר חודש";

  function selectMonth(monthIndex: number) {
    onChange(`${pickerYear}-${String(monthIndex + 1).padStart(2, "0")}`);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={`${className ?? ""} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        dir="rtl"
      >
        {displayText}
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
