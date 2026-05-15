"use client";

import { HelpCircle, Link2, X } from "lucide-react";
import { AdminModal, AdminModalPanel } from "@/components/ui/AdminModal";
import { ReportDatasetDefinition } from "./types";

export function ReportFieldHelpModal({
  activeDataset,
  fieldId,
  onClose,
}: {
  activeDataset: ReportDatasetDefinition | null;
  fieldId: string | null;
  onClose: () => void;
}) {
  if (!activeDataset || !fieldId) return null;

  const field = activeDataset.fields.find((item) => item.id === fieldId);
  if (!field) return null;

  const relatedFields = field.help.related_fields
    .map((relatedId) => activeDataset.fields.find((candidate) => candidate.id === relatedId))
    .filter((candidate): candidate is ReportDatasetDefinition["fields"][number] => !!candidate);

  return (
    <AdminModal onBackdropClick={onClose}>
      <AdminModalPanel
        className="max-w-5xl"
        dir="rtl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-[#dce4f0] px-6 py-5 shrink-0">
          <div className="mx-auto flex w-full max-w-5xl items-start gap-3 text-right">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <HelpCircle size={18} />
            </div>
            <div>
              <div className="text-lg font-bold text-[#1a3a6e]">{field.label}</div>
              <div className="mt-1 text-sm text-slate-600">
                {activeDataset.label} · {field.category ?? "כללי"} · {field.id}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="סגור"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-6 text-right">
          <div className="mx-auto w-full max-w-5xl space-y-4">
          <div className="rounded-2xl border border-brand-100 bg-brand-50/50 px-4 py-3">
            <div className="text-xs font-semibold text-brand-700">מה השדה עושה</div>
            <p className="mt-2 text-sm leading-7 text-slate-800">{field.help.summary}</p>
            <p className="mt-2 text-sm leading-7 text-slate-600">{field.help.details}</p>
          </div>

          {relatedFields.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="mb-2 flex items-center justify-end gap-2 text-xs font-semibold text-slate-700">
                <Link2 size={13} />
                שדות מקושרים
              </div>
              {field.help.related_reason ? <p className="mb-3 text-sm leading-6 text-slate-600">{field.help.related_reason}</p> : null}
              <div className="flex flex-wrap justify-end gap-2">
                {relatedFields.map((relatedField) => (
                  <span key={relatedField.id} className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800">
                    {relatedField.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="mb-2 text-xs font-semibold text-slate-700">דגשים שימושיים</div>
            <ul className="space-y-2 text-sm leading-6 text-slate-600">
              {field.help.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        </div>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 text-center text-[11px] text-slate-400 shrink-0">
          אפשר לפתוח את העזרה גם עם F1 כשהשדה בפוקוס
        </div>
      </AdminModalPanel>
    </AdminModal>
  );
}
