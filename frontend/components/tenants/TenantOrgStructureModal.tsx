"use client";

import { useMemo, useState } from "react";
import {
  AdminModal,
  AdminModalBody,
  AdminModalFooter,
  AdminModalHeader,
  AdminModalMessage,
  AdminModalPanel,
  ADMIN_MODAL_ACTION_PRIMARY,
  ADMIN_MODAL_ACTION_SECONDARY,
} from "@/components/ui/AdminModal";

export type OrgStructureLevel = "division" | "department" | "section" | "team";

export interface TenantOrgStructureConfigValue {
  levels: OrgStructureLevel[];
  position_attachment_level: OrgStructureLevel | null;
  is_hierarchical: boolean;
}

const LEVEL_OPTIONS: { value: OrgStructureLevel; label: string; description: string }[] = [
  { value: "division", label: "חטיבה", description: "הרמה העליונה בשרשרת" },
  { value: "department", label: "אגף", description: "מתחת לחטיבה או כרמה ראשונה בארגון" },
  { value: "section", label: "מחלקה", description: "מתחת לאגף" },
  { value: "team", label: "צוות", description: "מתחת למחלקה או לרמה הפעילה שלפניה" },
];

export function formatOrgStructureSummary(config: TenantOrgStructureConfigValue) {
  const labels = config.levels.map((level) => LEVEL_OPTIONS.find((option) => option.value === level)?.label ?? level);
  const attachmentLabel =
    config.position_attachment_level
      ? (LEVEL_OPTIONS.find((option) => option.value === config.position_attachment_level)?.label ??
        config.position_attachment_level)
      : "לא משויך להיררכיה";
  return {
    levelsText: labels.join(" > "),
    attachmentText: attachmentLabel,
    hierarchyText: config.is_hierarchical ? "כן" : "לא",
  };
}

export function TenantOrgStructureModal({
  initialValue,
  saving = false,
  title,
  onClose,
  onSave,
}: {
  initialValue: TenantOrgStructureConfigValue;
  saving?: boolean;
  title: string;
  onClose: () => void;
  onSave: (value: TenantOrgStructureConfigValue) => void | Promise<void>;
}) {
  const [levels, setLevels] = useState<OrgStructureLevel[]>(initialValue.levels);
  const [isHierarchical, setIsHierarchical] = useState(initialValue.is_hierarchical);
  const [attachPositionToHierarchy, setAttachPositionToHierarchy] = useState(Boolean(initialValue.position_attachment_level));
  const [positionAttachmentLevel, setPositionAttachmentLevel] = useState<OrgStructureLevel | null>(
    initialValue.position_attachment_level ?? initialValue.levels[initialValue.levels.length - 1] ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  const availableAttachmentLevels = useMemo(
    () => LEVEL_OPTIONS.filter((option) => levels.includes(option.value)),
    [levels],
  );

  function toggleLevel(level: OrgStructureLevel) {
    setLevels((current) => {
      const nextLevels = current.includes(level)
        ? current.filter((item) => item !== level)
        : LEVEL_OPTIONS.filter((option) => [...current, level].includes(option.value)).map((option) => option.value);
      if (nextLevels.length === 0) {
        setPositionAttachmentLevel(null);
        return nextLevels;
      }
      if (!attachPositionToHierarchy) {
        return nextLevels;
      }
      if (!positionAttachmentLevel || !nextLevels.includes(positionAttachmentLevel)) {
        setPositionAttachmentLevel(nextLevels[nextLevels.length - 1]);
      }
      return nextLevels;
    });
  }

  async function handleSave() {
    if (levels.length === 0) {
      setError("יש לבחור לפחות רמה ארגונית אחת.");
      return;
    }
    if (attachPositionToHierarchy && !positionAttachmentLevel) {
      setError("לא נמצאה רמת שיוך לתפקיד.");
      return;
    }
    setError(null);
    await onSave({
      levels,
      position_attachment_level: attachPositionToHierarchy ? positionAttachmentLevel : null,
      is_hierarchical: isHierarchical,
    });
  }

  return (
    <AdminModal onBackdropClick={onClose}>
      <AdminModalPanel className="max-w-2xl">
        <AdminModalHeader
          title={title}
          subtitle="המסכים והוולידציה של CLICK Core ייגזרו מההגדרה הזו."
          onClose={onClose}
        />

        <AdminModalBody className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold text-slate-700">רמות פעילות לפי סדר</div>
            <div className="mt-3 grid gap-2">
              {LEVEL_OPTIONS.map((option) => {
                const checked = levels.includes(option.value);
                return (
                  <label key={option.value} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleLevel(option.value)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300"
                    />
                    <span className="flex-1">
                      <span className="block font-semibold text-slate-800">{option.label}</span>
                      <span className="block text-[11px] text-slate-500">{option.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={isHierarchical}
              onChange={(event) => setIsHierarchical(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
            />
            <span>
              <span className="block font-semibold text-slate-800">המבנה היררכי ומקושר בין הרמות</span>
              <span className="mt-1 block text-[11px] text-slate-500">
                כאשר האפשרות הזו פעילה, כל רמה תחויב להשתייך לרמת האב הפעילה שלפניה בשרשרת.
              </span>
            </span>
          </label>

          <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-xs text-brand-800">
            <div className="font-semibold">שיוך תפקידים</div>
            <label className="mt-3 flex items-start gap-3 rounded-lg border border-brand-100 bg-white/70 px-3 py-2 text-slate-700">
              <input
                type="checkbox"
                checked={attachPositionToHierarchy}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setAttachPositionToHierarchy(checked);
                  if (checked && levels.length > 0 && !positionAttachmentLevel) {
                    setPositionAttachmentLevel(levels[levels.length - 1]);
                  }
                }}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <span>
                <span className="block font-semibold text-slate-800">התפקיד משויך להיררכיה</span>
                <span className="mt-1 block text-[11px] text-slate-500">
                  בטל כדי לאפשר תפקידים ללא שיוך ליחידה ארגונית בהיררכיה.
                </span>
              </span>
            </label>

            {attachPositionToHierarchy ? (
              <div className="mt-3 rounded-lg border border-brand-100 bg-white/80 px-3 py-3">
                <label className="block text-[11px] font-semibold text-slate-700">רמת שיוך התפקיד</label>
                <select
                  value={positionAttachmentLevel ?? ""}
                  onChange={(event) => setPositionAttachmentLevel((event.target.value || null) as OrgStructureLevel | null)}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700"
                >
                  <option value="">בחר רמה</option>
                  {availableAttachmentLevels.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-dashed border-brand-200 bg-white/70 px-3 py-2 text-[11px] text-slate-600">
                תפקידים יישמרו ללא שיוך לרמה היררכית.
              </div>
            )}
          </div>

          {error ? (
            <AdminModalMessage tone="danger">{error}</AdminModalMessage>
          ) : null}
        </AdminModalBody>

        <AdminModalFooter>
          <button onClick={onClose} className={ADMIN_MODAL_ACTION_SECONDARY}>
            ביטול
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={ADMIN_MODAL_ACTION_PRIMARY}
          >
            {saving ? "שומר..." : "שמור הגדרה"}
          </button>
        </AdminModalFooter>
      </AdminModalPanel>
    </AdminModal>
  );
}
