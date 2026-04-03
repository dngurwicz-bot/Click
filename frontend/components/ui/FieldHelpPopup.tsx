"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { HelpCircle, X } from "lucide-react";
import { FIELD_HELP, normalizeLabel } from "@/lib/fieldHelpData";

interface HelpState {
  label: string;
  top: number;
  left: number;
}

/** מוצא את תווית השדה הממוקד על פי עץ ה-DOM */
function getLabelText(el: Element): string | null {
  // aria-label
  const aria = el.getAttribute("aria-label");
  if (aria) return normalizeLabel(aria);

  // id → label[for]
  const id = el.id;
  if (id) {
    const lbl = document.querySelector(`label[for="${id}"]`);
    if (lbl) return normalizeLabel(lbl.textContent ?? "");
  }

  // עלייה בעץ ה-DOM — עד 4 רמות
  let node: Element | null = el;
  for (let i = 0; i < 4; i++) {
    node = node.parentElement;
    if (!node) break;
    const lbl = node.querySelector("label");
    if (lbl) return normalizeLabel(lbl.textContent ?? "");
  }

  return null;
}

/** מחשב מיקום הפופאפ — מתחת לשדה עם התאמה לגבולות המסך */
function calcPosition(rect: DOMRect): { top: number; left: number } {
  const popupWidth = 300;
  const popupHeight = 220; // הערכה
  const gap = 8;

  let top = rect.bottom + gap;
  let left = rect.left;

  // מניעת יציאה מהמסך מימין
  if (left + popupWidth > window.innerWidth - 8) {
    left = window.innerWidth - popupWidth - 8;
  }
  // מניעת יציאה מהמסך מלמטה
  if (top + popupHeight > window.innerHeight - 8) {
    top = rect.top - popupHeight - gap;
  }
  // שמירה על מינימום מלמעלה
  if (top < 8) top = 8;
  if (left < 8) left = 8;

  return { top, left };
}

export function FieldHelpPopup() {
  const [help, setHelp] = useState<HelpState | null>(null);
  const isOpenRef = useRef(false);

  const closeHelp = useCallback(() => {
    setHelp(null);
    isOpenRef.current = false;
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== "F1") return;
      e.preventDefault();
      e.stopPropagation();

      // סגירה אם כבר פתוח
      if (isOpenRef.current) {
        closeHelp();
        return;
      }

      const active = document.activeElement;
      if (!active || !["INPUT", "SELECT", "TEXTAREA"].includes(active.tagName)) return;

      const label = getLabelText(active);
      if (!label) return;

      const rect = active.getBoundingClientRect();
      const { top, left } = calcPosition(rect);

      setHelp({ label, top, left });
      isOpenRef.current = true;
    },
    [closeHelp]
  );

  // האזנה גלובלית ל-F1
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [handleKeyDown]);

  // סגירה ב-Escape
  useEffect(() => {
    if (!help) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeHelp();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [help, closeHelp]);

  if (!help) return null;

  const data = FIELD_HELP[help.label];

  return (
    <>
      {/* רקע שקוף לסגירה בלחיצה */}
      <div className="fixed inset-0 z-40" onClick={closeHelp} />

      {/* הפופאפ */}
      <div
        role="tooltip"
        dir="rtl"
        className="fixed z-50 bg-white rounded-xl shadow-xl border border-brand-100 overflow-hidden"
        style={{ top: help.top, left: help.left, width: 300 }}
      >
        {/* כותרת */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-brand-50 border-b border-brand-100">
          <div className="flex items-center gap-2">
            <HelpCircle size={14} className="text-brand-500 shrink-0" />
            <span className="font-semibold text-sm text-slate-800">{help.label}</span>
          </div>
          <button
            onClick={closeHelp}
            className="p-0.5 rounded hover:bg-brand-100 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="סגור"
          >
            <X size={13} />
          </button>
        </div>

        {/* תוכן */}
        <div className="px-4 py-3 space-y-2.5 text-xs">
          {data ? (
            <>
              <p className="text-slate-700 leading-relaxed">{data.description}</p>

              {data.example && (
                <div className="flex gap-1.5 items-start">
                  <span className="font-medium text-slate-500 shrink-0 mt-0.5">דוגמה:</span>
                  <span className="text-brand-700 font-mono bg-brand-50 px-1.5 py-0.5 rounded">
                    {data.example}
                  </span>
                </div>
              )}

              {data.affects && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="font-medium text-slate-500">משפיע על: </span>
                  <span className="text-slate-600">{data.affects}</span>
                </div>
              )}
            </>
          ) : (
            <p className="text-slate-400 italic">אין מידע עזרה עבור שדה זה.</p>
          )}
        </div>

        {/* כותרת תחתונה */}
        <div className="px-4 py-1.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 text-center">
          F1 / Esc לסגירה
        </div>
      </div>
    </>
  );
}
