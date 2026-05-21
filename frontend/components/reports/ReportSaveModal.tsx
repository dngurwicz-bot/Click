"use client";
import { useState } from "react";
import { X, Save, Users, Lock } from "lucide-react";
import { AdminModal, AdminModalPanel } from "@/components/ui/AdminModal";
import type { Visibility } from "./types";

interface ReportSaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description: string, visibility: Visibility) => Promise<void>;
  defaultName?: string;
}

export function ReportSaveModal({ isOpen, onClose, onSave, defaultName = "" }: ReportSaveModalProps) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("personal");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      setError("יש להזין שם לדוח");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(name.trim(), description.trim(), visibility);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "שמירת הדוח נכשלה");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminModal onBackdropClick={onClose}>
      <AdminModalPanel  dir="rtl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Save size={16} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">שמירת דוח</h2>
              <p className="text-sm text-slate-600">שמור את הגדרות הדוח לשימוש עתידי</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/70 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-6">
          <div className="mx-auto w-full max-w-4xl space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              שם הדוח <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="לדוגמה: תיק לקוחות Q2 2025"
              autoFocus
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">תיאור (אופציונלי)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="הוסף תיאור קצר שיעזור לך לזכור את מטרת הדוח..."
              rows={2}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300 resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">נראות</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setVisibility("personal")}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-right text-sm transition ${
                  visibility === "personal"
                    ? "border-blue-300 bg-blue-50 text-blue-800 shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Lock size={14} className={visibility === "personal" ? "text-blue-600" : "text-slate-400"} />
                <div>
                  <div className="font-medium text-xs">אישי</div>
                  <div className="text-[10px] text-slate-500">רק אני</div>
                </div>
              </button>
              <button
                onClick={() => setVisibility("shared")}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-right text-sm transition ${
                  visibility === "shared"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Users size={14} className={visibility === "shared" ? "text-emerald-600" : "text-slate-400"} />
                <div>
                  <div className="font-medium text-xs">משותף</div>
                  <div className="text-[10px] text-slate-500">כל הצוות</div>
                </div>
              </button>
            </div>
          </div>
        </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 shrink-0">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            ביטול
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <Save size={14} />
            )}
            שמור דוח
          </button>
        </div>
      </AdminModalPanel>
    </AdminModal>
  );
}
