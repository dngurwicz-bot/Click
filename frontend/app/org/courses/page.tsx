"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import {
  AdminActionBar,
  AdminCountLabel,
  AdminGrandchildLayout,
  AdminSearchField,
  AdminStatusBar,
} from "@/components/layout/AdminShell";
import { useWorkspace } from "@/components/layout/WorkspaceShell";
import { HebrewDatePicker } from "@/components/ui/HebrewDatePicker";
import {
  ADMIN_MODAL_ACTION_DANGER,
  ADMIN_MODAL_ACTION_PRIMARY,
  ADMIN_MODAL_ACTION_SECONDARY,
  ADMIN_MODAL_INPUT,
  ADMIN_MODAL_TEXTAREA,
  AdminField,
  AdminModal,
  AdminModalBody,
  AdminModalFooter,
  AdminModalHeader,
  AdminModalMessage,
  AdminModalPanel,
} from "@/components/ui/AdminModal";
import { api, getOrgAdminTenantId, isLoggedIn, type ApiRequestError } from "@/lib/api";

interface CourseRow {
  id: string;
  code: string;
  name: string;
  name_en?: string | null;
  category?: string | null;
  duration_hours?: number | null;
  is_mandatory: boolean;
  valid_from: string;
  valid_to?: string | null;
  is_active: boolean;
}

interface CourseModalState {
  mode: "create" | "edit" | "close";
  row?: CourseRow | null;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("he-IL") : "—";
}

function RowStatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      פעיל
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      לא פעיל
    </span>
  );
}

function getUiError(err: unknown, fallback: string) {
  const candidate = err as ApiRequestError & { message?: string; error?: string };
  return candidate?.error ?? candidate?.message ?? fallback;
}

function CourseModal({
  tenantId,
  state,
  onClose,
  onSaved,
}: {
  tenantId: string;
  state: CourseModalState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const row = state.row ?? null;
  const isCreate = state.mode === "create";
  const isClose = state.mode === "close";

  const [code, setCode] = useState(row?.code ?? "");
  const [name, setName] = useState(row?.name ?? "");
  const [nameEn, setNameEn] = useState(row?.name_en ?? "");
  const [category, setCategory] = useState(row?.category ?? "");
  const [durationHours, setDurationHours] = useState(row?.duration_hours?.toString() ?? "");
  const [isMandatory, setIsMandatory] = useState(row?.is_mandatory ?? false);
  const [validFrom, setValidFrom] = useState(row?.valid_from ?? new Date().toISOString().slice(0, 10));
  const [validTo, setValidTo] = useState(row?.valid_to ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        code: code.trim(),
        name: name.trim(),
        name_en: nameEn.trim() || null,
        category: category.trim() || null,
        duration_hours: durationHours.trim() ? Number(durationHours) : null,
        is_mandatory: isMandatory,
        valid_from: validFrom,
        valid_to: validTo || null,
      };

      if (isCreate) {
        await api.post(`/api/org/courses?tenant_id=${tenantId}`, payload);
      } else if (isClose && row) {
        await api.delete(`/api/org/courses/${row.id}?tenant_id=${tenantId}`);
      } else if (row) {
        await api.put(`/api/org/courses/${row.id}?tenant_id=${tenantId}`, payload);
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(getUiError(err, "לא ניתן לשמור את הקורס"));
    } finally {
      setSaving(false);
    }
  }

  const title = isCreate ? "קורס חדש" : isClose ? "סגירת קורס" : "עדכון קורס";

  return (
    <AdminModal onBackdropClick={onClose}>
      <AdminModalPanel className="max-w-xl">
        <AdminModalHeader title={title} onClose={onClose} />
        <AdminModalBody className="space-y-4">
          {error ? <AdminModalMessage tone="danger">{error}</AdminModalMessage> : null}
          {isClose ? (
            <>
              <AdminModalMessage tone="warning">
                הקורס יסומן כלא פעיל מתאריך היום, ויישאר בהיסטוריה.
              </AdminModalMessage>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <AdminField label="קוד" value={row?.code} />
                <AdminField label="שם קורס" value={row?.name} />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">קוד</label>
                  <input
                    className={ADMIN_MODAL_INPUT}
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    disabled={!isCreate}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">שם קורס</label>
                  <input
                    className={ADMIN_MODAL_INPUT}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">שם באנגלית</label>
                  <input
                    className={ADMIN_MODAL_INPUT}
                    value={nameEn}
                    onChange={(event) => setNameEn(event.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">קטגוריה</label>
                  <input
                    className={ADMIN_MODAL_INPUT}
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">משך שעות</label>
                  <input
                    type="number"
                    min="0"
                    className={ADMIN_MODAL_INPUT}
                    value={durationHours}
                    onChange={(event) => setDurationHours(event.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">סוג</label>
                  <select
                    className={ADMIN_MODAL_INPUT}
                    value={isMandatory ? "mandatory" : "optional"}
                    onChange={(event) => setIsMandatory(event.target.value === "mandatory")}
                  >
                    <option value="optional">רשות</option>
                    <option value="mandatory">חובה</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">מתאריך</label>
                  <HebrewDatePicker value={validFrom} onChange={setValidFrom} className={ADMIN_MODAL_INPUT} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">עד תאריך</label>
                  <HebrewDatePicker value={validTo} onChange={setValidTo} className={ADMIN_MODAL_INPUT} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">הערות</label>
                <textarea
                  className={ADMIN_MODAL_TEXTAREA}
                  value=""
                  readOnly
                  placeholder="בשלב זה הקטלוג אינו שומר שדה הערות."
                />
              </div>
            </>
          )}
        </AdminModalBody>
        <AdminModalFooter>
          <button
            onClick={handleSave}
            disabled={saving || (!isClose && (!code.trim() || !name.trim() || !validFrom))}
            className={isClose ? ADMIN_MODAL_ACTION_DANGER : ADMIN_MODAL_ACTION_PRIMARY}
          >
            {saving ? "שומר..." : isClose ? "סגור קורס" : "שמור"}
          </button>
          <button onClick={onClose} className={ADMIN_MODAL_ACTION_SECONDARY}>
            ביטול
          </button>
        </AdminModalFooter>
      </AdminModalPanel>
    </AdminModal>
  );
}

export default function OrgCoursesPage() {
  const workspace = useWorkspace();
  const orgAdminTenantId = getOrgAdminTenantId();
  const tenantId = orgAdminTenantId ?? workspace?.selectedTenantId ?? "";

  const [rows, setRows] = useState<CourseRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalState, setModalState] = useState<CourseModalState | null>(null);

  const loadData = useCallback(() => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    api
      .get<CourseRow[]>(`/api/org/courses?tenant_id=${tenantId}`)
      .then((nextRows) => setRows(nextRows))
      .catch((err) => {
        setRows([]);
        setError(getUiError(err, "לא ניתן לטעון את קטלוג הקורסים"));
      })
      .finally(() => setLoading(false));
  }, [tenantId]);

  useEffect(() => {
    if (!isLoggedIn()) return;
    if (tenantId) {
      loadData();
      return;
    }
    setLoading(false);
  }, [loadData, tenantId]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      [row.code, row.name, row.name_en ?? "", row.category ?? ""].join(" ").toLowerCase().includes(query)
    );
  }, [rows, search]);

  return (
    <>
      <AdminGrandchildLayout
        title="קורסים"
        backHref="/dashboard"
        backLabel="ראשי"
        onRefresh={loadData}
        maxWidthClass="max-w-6xl"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-slate-200 bg-white">
          <AdminActionBar
            start={<AdminSearchField value={search} onChange={setSearch} placeholder="חיפוש קורס..." />}
            end={
              <div className="flex items-center gap-2">
                {!loading ? <AdminCountLabel>{filteredRows.length} קורסים</AdminCountLabel> : null}
                <button
                  onClick={() => setModalState({ mode: "create" })}
                  disabled={!tenantId}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  <Plus size={12} />
                  קורס חדש
                </button>
              </div>
            }
          />
          <div className="flex-1 overflow-auto bg-white min-h-0">
            {loading ? (
              <div className="py-20 text-center text-sm text-slate-400">טוען נתונים...</div>
            ) : !tenantId ? (
              <div className="py-20 text-center text-sm text-slate-400">יש לבחור ארגון פעיל כדי לנהל קטלוג קורסים.</div>
            ) : error ? (
              <div className="py-20 text-center text-sm text-red-500">{error}</div>
            ) : filteredRows.length === 0 ? (
              <div className="py-20 text-center text-sm text-slate-400">לא נמצאו קורסים</div>
            ) : (
              <table className="admin-data-table w-full border-collapse text-xs">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-right font-semibold text-slate-600">קוד</th>
                    <th className="border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-right font-semibold text-slate-600">שם קורס</th>
                    <th className="border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-right font-semibold text-slate-600">קטגוריה</th>
                    <th className="border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-right font-semibold text-slate-600">שעות</th>
                    <th className="border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-right font-semibold text-slate-600">סוג</th>
                    <th className="border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-right font-semibold text-slate-600">מתאריך</th>
                    <th className="border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-right font-semibold text-slate-600">עד תאריך</th>
                    <th className="border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-right font-semibold text-slate-600">סטטוס</th>
                    <th className="border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-right font-semibold text-slate-600">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, index) => (
                    <tr
                      key={row.id}
                      className={`transition-colors ${index % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}
                    >
                      <td className="border-b border-slate-100 px-4 py-2 font-mono text-slate-600">{row.code}</td>
                      <td className="border-b border-slate-100 px-4 py-2 font-medium text-slate-800">{row.name}</td>
                      <td className="border-b border-slate-100 px-4 py-2 text-slate-600">{row.category || "—"}</td>
                      <td className="border-b border-slate-100 px-4 py-2 text-slate-600">{row.duration_hours ?? "—"}</td>
                      <td className="border-b border-slate-100 px-4 py-2 text-slate-600">{row.is_mandatory ? "חובה" : "רשות"}</td>
                      <td className="border-b border-slate-100 px-4 py-2 text-slate-500">{formatDate(row.valid_from)}</td>
                      <td className="border-b border-slate-100 px-4 py-2 text-slate-500">{row.valid_to ? formatDate(row.valid_to) : "פעיל"}</td>
                      <td className="border-b border-slate-100 px-4 py-2"><RowStatusBadge active={row.is_active} /></td>
                      <td className="border-b border-slate-100 px-4 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setModalState({ mode: "edit", row })}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setModalState({ mode: "close", row })}
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </AdminGrandchildLayout>
      {!loading ? <AdminStatusBar total={filteredRows.length} label="קורסים" /> : null}
      {modalState && tenantId ? (
        <CourseModal
          tenantId={tenantId}
          state={modalState}
          onClose={() => setModalState(null)}
          onSaved={loadData}
        />
      ) : null}
    </>
  );
}
