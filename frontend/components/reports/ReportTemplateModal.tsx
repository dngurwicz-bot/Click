"use client";

import { useEffect, useState } from "react";
import { LayoutTemplate, Lock, Save, Users, X } from "lucide-react";
import type { Visibility } from "./types";

interface ReportTemplateModalProps {
  isOpen: boolean;
  defaultName?: string;
  onClose: () => void;
  onSave: (name: string, visibility: Visibility) => Promise<void>;
}

export function ReportTemplateModal({ isOpen, defaultName = "", onClose, onSave }: ReportTemplateModalProps) {
  const [name, setName] = useState(defaultName);
  const [visibility, setVisibility] = useState<Visibility>("personal");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(defaultName);
      setVisibility("personal");
      setSaving(false);
      setError(null);
    }
  }, [defaultName, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      setError("יש להזין שם לתבנית");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(name.trim(), visibility);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "שמירת התבנית נכשלה");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
      <div className="absolute inset-0 bg-slate-900/35" onClick={onClose} />
      <section className="relative z-10 w-full max-w-sm overflow-hidden border border-slate-300 bg-white shadow-xl">
        <header className="flex h-11 items-center justify-between border-b border-slate-300 bg-slate-50 px-4">
          <div className="flex items-center gap-2">
            <LayoutTemplate size={15} className="text-brand-700" />
            <div>
              <div className="text-sm font-semibold text-slate-900">שמירה כתבנית</div>
              <div className="text-[11px] text-slate-500">סט שדות והגדרות לשימוש חוזר</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-200">
            <X size={14} />
          </button>
        </header>

        <div className="space-y-3 p-4">
          {error && <div className="border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">שם התבנית</label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="לדוגמה: דוח לקוחות בסיסי"
              className="h-9 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-brand-500"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">נראות</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVisibility("personal")}
                className={`flex items-center gap-2 border px-3 py-2 text-right text-xs ${
                  visibility === "personal"
                    ? "border-brand-600 bg-brand-50 text-brand-800"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Lock size={13} className={visibility === "personal" ? "text-brand-700" : "text-slate-400"} />
                <div>
                  <div className="font-semibold">אישי</div>
                  <div className="text-[10px] text-slate-500">רק אני</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setVisibility("shared")}
                className={`flex items-center gap-2 border px-3 py-2 text-right text-xs ${
                  visibility === "shared"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Users size={13} className={visibility === "shared" ? "text-emerald-700" : "text-slate-400"} />
                <div>
                  <div className="font-semibold">משותפת</div>
                  <div className="text-[10px] text-slate-500">לכל הצוות</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-slate-300 bg-white px-4 py-3">
          <button type="button" onClick={onClose} className="h-8 border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            ביטול
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-8 items-center gap-1.5 border border-brand-700 bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/35 border-t-white" /> : <Save size={12} />}
            שמור כתבנית
          </button>
        </footer>
      </section>
    </div>
  );
}
