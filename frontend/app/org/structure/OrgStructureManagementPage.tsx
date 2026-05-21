"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { SplitActionButton } from "@/components/ui/SplitActionButton";
import { TemporalFilterBar } from "@/components/ui/TemporalFilterBar";
import {
  AdminDateFields,
  AdminField,
  AdminModal,
  AdminModalBody,
  AdminModalFooter,
  AdminModalHeader,
  AdminModalMessage,
  AdminModalPanel,
  ADMIN_MODAL_ACTION_DANGER,
  ADMIN_MODAL_ACTION_PRIMARY,
  ADMIN_MODAL_ACTION_SECONDARY,
  ADMIN_MODAL_ACTION_WARNING,
  ADMIN_MODAL_DATE_INPUT,
  ADMIN_MODAL_GRID,
  ADMIN_MODAL_INPUT,
  ADMIN_MODAL_TEXTAREA,
} from "@/components/ui/AdminModal";
import { api, getOrgAdminTenantId, isLoggedIn } from "@/lib/api";
import {
  createDefaultTemporalFilterState,
  getTemporalFilterError,
  overlapsTemporalFilter,
  type TemporalFilterState,
} from "@/lib/temporalFilter";
import type { CoreStructureConfigItem, OrgStructureLevel } from "@/app/admin/core/structure/config";

interface TenantOrgStructureConfig {
  levels: OrgStructureLevel[];
  position_attachment_level: OrgStructureLevel | null;
  is_hierarchical: boolean;
}

interface OrgUnitRow {
  id: string;
  code: string;
  unit_type: "division" | "department" | "section" | "team";
  name: string;
  description?: string | null;
  parent_unit_id?: string | null;
  parent_unit_name?: string | null;
  manager_employee_id?: string | null;
  manager_name?: string | null;
  valid_from: string;
  valid_to?: string | null;
  is_active: boolean;
}

interface PositionRow {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  org_unit_id?: string | null;
  org_unit_name?: string | null;
  valid_from: string;
  valid_to?: string | null;
  is_active: boolean;
  employment_type_default?: string | null;
}

interface EmployeeOption {
  id: string;
  employee_number: string;
  full_name: string;
}

type StructureRow = OrgUnitRow | PositionRow;
type StructureModalMode = "add" | "update" | "set" | "close" | "delete";
type EditingState = { row: StructureRow; initialMode?: StructureModalMode };

function formatRowLabel(code: string, name: string) {
  return `${code} - ${name}`;
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

function OrgStructureRecordModal({
  config,
  tenantId,
  row,
  initialMode,
  parentOptions,
  orgUnitOptions,
  managerOptions,
  tenantConfig,
  onClose,
  onSaved,
}: {
  config: CoreStructureConfigItem;
  tenantId: string;
  row: StructureRow | null;
  initialMode?: StructureModalMode;
  parentOptions: OrgUnitRow[];
  orgUnitOptions: OrgUnitRow[];
  managerOptions: EmployeeOption[];
  tenantConfig: TenantOrgStructureConfig | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isPosition = !config.unitType;
  const positionAttachmentEnabled = isPosition && !!tenantConfig?.position_attachment_level;
  const [mode, setMode] = useState<StructureModalMode>(initialMode ?? (row ? "update" : "add"));
  const [validFrom, setValidFrom] = useState(row?.valid_from ?? new Date().toISOString().slice(0, 10));
  const [validTo, setValidTo] = useState(row?.valid_to ?? "");
  const [name, setName] = useState(row ? ("name" in row ? row.name : row.title) : "");
  const [description, setDescription] = useState(row?.description ?? "");
  const [parentUnitId, setParentUnitId] = useState(row && "parent_unit_id" in row ? row.parent_unit_id ?? "" : "");
  const [orgUnitId, setOrgUnitId] = useState(row && "org_unit_id" in row ? row.org_unit_id ?? "" : "");
  const [managerEmployeeId, setManagerEmployeeId] = useState(
    row && "manager_employee_id" in row ? row.manager_employee_id ?? "" : ""
  );
  const [employmentTypeDefault, setEmploymentTypeDefault] = useState(
    row && "employment_type_default" in row ? row.employment_type_default ?? "employee" : "employee"
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputCls = ADMIN_MODAL_INPUT;

  function switchToMode(nextMode: StructureModalMode) {
    setDropdownOpen(false);
    setError(null);
    if (nextMode === "add" || nextMode === "set") {
      setValidFrom(new Date().toISOString().slice(0, 10));
      setValidTo("");
    }
    setMode(nextMode);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (!row) {
        if (config.unitType) {
          await api.post(`/api/org/org-units?tenant_id=${tenantId}`, {
            unit_type: config.unitType,
            parent_unit_id: parentUnitId || null,
            manager_employee_id: managerEmployeeId || null,
            name,
            description: description || null,
            valid_from: validFrom,
          });
        } else {
          await api.post(`/api/org/positions?tenant_id=${tenantId}`, {
            org_unit_id: positionAttachmentEnabled ? (orgUnitId || null) : null,
            title: name,
            description: description || null,
            employment_type_default: employmentTypeDefault || null,
            valid_from: validFrom,
          });
        }
      } else if (config.unitType) {
        await api.put(`/api/org/org-units/${row.id}/record?tenant_id=${tenantId}`, {
          action: mode,
          unit_type: config.unitType,
          parent_unit_id: parentUnitId || null,
          manager_employee_id: managerEmployeeId || null,
          clear_manager_employee_id: !managerEmployeeId,
          name,
          description: description || null,
          valid_from: validFrom || null,
          valid_to: validTo || null,
        });
      } else {
        await api.put(`/api/org/positions/${row.id}/record?tenant_id=${tenantId}`, {
          action: mode,
          org_unit_id: positionAttachmentEnabled ? (orgUnitId || null) : null,
          title: name,
          description: description || null,
          employment_type_default: employmentTypeDefault || null,
          valid_from: validFrom || null,
          valid_to: validTo || null,
        });
      }
      onSaved();
    } catch (err) {
      setError((err as { message?: string })?.message ?? "לא ניתן לשמור את הרשומה");
      setSaving(false);
    }
  }

  const title =
    !row ? config.createLabel :
    mode === "delete" ? `ביטול ${config.label}` :
    mode === "set" ? `קבע תקופה ${config.label}` :
    mode === "close" ? `סגירת תוקף ${config.label}` :
    mode === "add" ? `הוספת שורה ${config.label}` :
    `עדכון ${config.label}`;

  return (
    <AdminModal onBackdropClick={onClose}>
      <AdminModalPanel className="relative" onClick={() => setDropdownOpen(false)}>
        <AdminModalHeader title={title} onClose={onClose} />
        <AdminModalBody className="space-y-4">
          {row ? null : (
            <AdminModalMessage>
              הקוד נוצר אוטומטית בעת השמירה.
            </AdminModalMessage>
          )}

          {row ? (
            <AdminField label="קוד">
              <input className={`${inputCls} font-mono bg-slate-50 text-slate-600`} value={row.code} readOnly />
            </AdminField>
          ) : null}

          {mode !== "delete" && mode !== "close" ? (
            <>
              <div className={ADMIN_MODAL_GRID}>
              <AdminField label={config.unitType ? "שם יחידה" : "שם תפקיד"}>
                <input className={inputCls} placeholder={config.label} value={name} onChange={(e) => setName(e.target.value)} />
              </AdminField>
              {config.parentType ? (
                <AdminField label={config.parentLabel}>
                  <select className={inputCls} value={parentUnitId} onChange={(e) => setParentUnitId(e.target.value)}>
                    <option value="">בחר {config.parentLabel}</option>
                    {parentOptions.map((option) => (
                      <option key={option.id} value={option.id}>{formatRowLabel(option.code, option.name)}</option>
                    ))}
                  </select>
                </AdminField>
              ) : null}
              {config.unitType ? (
                <AdminField label="מנהל היחידה">
                  <select className={inputCls} value={managerEmployeeId} onChange={(e) => setManagerEmployeeId(e.target.value)}>
                    <option value="">ללא מנהל משויך</option>
                    {managerOptions.map((option) => (
                      <option key={option.id} value={option.id}>{`${option.employee_number} - ${option.full_name}`}</option>
                    ))}
                  </select>
                </AdminField>
              ) : null}
              {isPosition && positionAttachmentEnabled ? (
                <AdminField label="יחידה ארגונית">
                  <select className={inputCls} value={orgUnitId} onChange={(e) => setOrgUnitId(e.target.value)}>
                    <option value="">בחר יחידה ארגונית</option>
                    {orgUnitOptions.map((option) => (
                      <option key={option.id} value={option.id}>{formatRowLabel(option.code, option.name)}</option>
                    ))}
                  </select>
                </AdminField>
              ) : null}
              {isPosition && !positionAttachmentEnabled ? (
                <AdminField label="שיוך ארגוני">
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    התפקיד מוגדר ללא שיוך להיררכיה במסך המבנה הארגוני.
                  </div>
                </AdminField>
              ) : null}
              {isPosition ? (
                <AdminField label="סוג העסקה ברירת מחדל">
                  <select className={inputCls} value={employmentTypeDefault} onChange={(e) => setEmploymentTypeDefault(e.target.value)}>
                    <option value="employee">עובד</option>
                    <option value="temporary">זמני</option>
                    <option value="contractor">קבלן</option>
                    <option value="intern">מתמחה</option>
                    <option value="consultant">יועץ</option>
                  </select>
                </AdminField>
              ) : null}
              <AdminField label="תיאור" className="md:col-span-2">
                <textarea className={ADMIN_MODAL_TEXTAREA} placeholder="תיאור" value={description} onChange={(e) => setDescription(e.target.value)} />
              </AdminField>
              </div>
            </>
          ) : null}

          {mode === "delete" ? (
            <AdminModalMessage tone="danger">
              פעולה זו תבטל את הרשומה מההיסטוריה.
            </AdminModalMessage>
          ) : null}

          {mode === "set" ? (
            <AdminModalMessage tone="warning">
              קביעת תקופה תחליף, תפצל או תסיר רשומות חופפות של אותה ישות בטווח התאריכים שתבחר.
            </AdminModalMessage>
          ) : null}

          <AdminDateFields
            fromField={<HebrewDatePicker className={ADMIN_MODAL_DATE_INPUT} value={validFrom} onChange={setValidFrom} />}
            toField={<HebrewDatePicker className={ADMIN_MODAL_DATE_INPUT} value={validTo} onChange={setValidTo} />}
            className={mode === "delete" ? "hidden" : ""}
          />
          {error ? <AdminModalMessage tone="danger">{error}</AdminModalMessage> : null}
        </AdminModalBody>
        <AdminModalFooter className="px-6">
          <button onClick={onClose} className={ADMIN_MODAL_ACTION_SECONDARY}>ביטול</button>
          {row && mode === "update" ? (
            <SplitActionButton
              primaryLabel={saving ? "שומר..." : "שמור"}
              onPrimaryClick={handleSave}
              primaryDisabled={
                saving ||
                !name.trim() ||
                (!!config.parentType && !parentUnitId) ||
                (positionAttachmentEnabled && !orgUnitId)
              }
              menuOpen={dropdownOpen}
              onMenuToggle={() => setDropdownOpen((open) => !open)}
              buttonClassName="bg-brand-600 hover:bg-brand-700 text-white"
              minMenuWidthClassName="min-w-[150px]"
              actions={[
                { label: "רשומה חדשה", onClick: () => switchToMode("add") },
                { label: "קבע תקופה", onClick: () => switchToMode("set"), tone: "warning" },
                { label: "סגור תקופה", onClick: () => switchToMode("close"), tone: "warning" },
                { label: "בטל רשומה", onClick: () => switchToMode("delete"), tone: "danger" },
              ]}
            />
          ) : (
            <button
              onClick={handleSave}
              disabled={
                saving ||
                (mode === "close" && !validTo) ||
                (mode !== "delete" && mode !== "close" && (!name.trim() || (!!config.parentType && !parentUnitId) || (positionAttachmentEnabled && !orgUnitId)))
              }
              className={
                mode === "delete"
                  ? ADMIN_MODAL_ACTION_DANGER
                  : mode === "close" || mode === "set"
                  ? ADMIN_MODAL_ACTION_WARNING
                  : ADMIN_MODAL_ACTION_PRIMARY
              }
            >
              {saving ? "שומר..." : mode === "delete" ? "בטל רשומה" : mode === "close" ? "סגור תוקף" : mode === "set" ? "קבע תקופה" : mode === "add" ? "הוסף רשומה" : "שמור"}
            </button>
          )}
        </AdminModalFooter>
      </AdminModalPanel>
    </AdminModal>
  );
}

function OrgStructureManagementPageContent({ config }: { config: CoreStructureConfigItem }) {
  const router = useRouter();
  const workspace = useWorkspace();
  const searchParams = useSearchParams();
  const initialTenant = searchParams.get("tenant_id") ?? "";

  const orgAdminTenantId = getOrgAdminTenantId();
  const tenantId = orgAdminTenantId ?? workspace?.selectedTenantId ?? "";

  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<StructureRow[]>([]);
  const [parentOptions, setParentOptions] = useState<OrgUnitRow[]>([]);
  const [orgUnitOptions, setOrgUnitOptions] = useState<OrgUnitRow[]>([]);
  const [managerOptions, setManagerOptions] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tenantConfig, setTenantConfig] = useState<TenantOrgStructureConfig | null>(null);
  const [editingState, setEditingState] = useState<EditingState | null>(null);
  const [creating, setCreating] = useState(false);
  const [temporalFilter, setTemporalFilter] = useState<TemporalFilterState>(() => createDefaultTemporalFilterState());
  const [resolvedTenantId, setResolvedTenantId] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    if (initialTenant && workspace && !orgAdminTenantId && initialTenant !== workspace.selectedTenantId) {
      workspace.setSelectedTenantId(initialTenant);
    }
  }, [initialTenant, router, workspace, orgAdminTenantId]);

  const loadData = useCallback((tid: string) => {
    if (!tid) return;
    setLoading(true);

    const tenantParam = orgAdminTenantId ? "" : `?tenant_id=${tid}`;

    const structureRequest = api.get<TenantOrgStructureConfig>(`/api/org/org-structure${tenantParam}`);
    const mainRequest = config.unitType
      ? api.get<OrgUnitRow[]>(`/api/org/org-units${tenantParam}${tenantParam ? "&" : "?"}unit_type=${config.unitType}`)
      : api.get<PositionRow[]>(`/api/org/positions${tenantParam}`);

    const parentRequest = config.parentType
      ? api.get<OrgUnitRow[]>(`/api/org/org-units${tenantParam}${tenantParam ? "&" : "?"}unit_type=${config.parentType}`)
      : Promise.resolve<OrgUnitRow[]>([]);

    const unitOptionsRequest = config.unitType
      ? Promise.resolve<OrgUnitRow[]>([])
      : api.get<OrgUnitRow[]>(`/api/org/org-units${tenantParam}`);

    const managerRequest = config.unitType
      ? api.get<EmployeeOption[]>(`/api/org/employees${tenantParam}`).catch(() => [] as EmployeeOption[])
      : Promise.resolve<EmployeeOption[]>([]);

    let active = true;
    setLoadError(null);

    Promise.all([structureRequest, mainRequest, parentRequest, unitOptionsRequest, managerRequest])
      .then(([structure, mainRows, parentRows, unitRows, managerRows]) => {
        if (!active) return;
        setTenantConfig(structure);
        setRows(mainRows);
        setParentOptions(parentRows);
        setOrgUnitOptions(unitRows);
        setManagerOptions(managerRows);
        setResolvedTenantId(tid);
      })
      .catch((err) => {
        if (!active) return;
        console.error(err);
        const msg = (err as { message?: string })?.message ?? "שגיאה בטעינת הנתונים";
        setLoadError(msg);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [config.parentType, config.unitType, orgAdminTenantId]);

  useEffect(() => {
    if (!tenantId) return;
    return loadData(tenantId);
  }, [tenantId, loadData]);

  const filteredRows = useMemo(() => {
    const query = search.toLowerCase();
    return rows.filter((row) => {
      if ("name" in row) {
        return [row.code, row.name, row.parent_unit_name ?? "", row.manager_name ?? "", row.valid_from, row.valid_to ?? ""].join(" ").toLowerCase().includes(query);
      }
      return [row.code, row.title, row.org_unit_name ?? "", row.valid_from, row.valid_to ?? ""].join(" ").toLowerCase().includes(query);
    });
  }, [rows, search]);

  const temporalFilterError = getTemporalFilterError(temporalFilter);

  const levelEnabled = useMemo(() => {
    if (!tenantConfig) return false;
    if (config.unitType) return tenantConfig.levels.includes(config.unitType);
    return true;
  }, [config.unitType, tenantConfig]);

  const unitOptionsForPosition = useMemo(
    () =>
      !tenantConfig?.position_attachment_level
        ? orgUnitOptions
        : orgUnitOptions.filter((row) => row.unit_type === tenantConfig.position_attachment_level),
    [orgUnitOptions, tenantConfig],
  );

  const isCurrentTenantResolved = resolvedTenantId === tenantId;

  const visibleRows = useMemo(
    () =>
      filteredRows.filter((row) =>
        temporalFilterError ||
        overlapsTemporalFilter({
          rowFrom: row.valid_from,
          rowTo: row.valid_to ?? null,
          filter: temporalFilter,
        })
      ),
    [filteredRows, temporalFilter, temporalFilterError]
  );

  return (
    <>
      <AdminGrandchildLayout
        title={config.title}
        backHref="/org/structure"
        backLabel="יחידות ארגוניות"
        onRefresh={() => loadData(tenantId)}
        maxWidthClass="max-w-7xl"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-slate-200 bg-white">
          <AdminActionBar
            start={<AdminSearchField value={search} onChange={setSearch} placeholder={config.searchPlaceholder} />}
            end={
              <div className="flex items-center gap-2">
                {!loading ? <AdminCountLabel>{visibleRows.length} רשומות</AdminCountLabel> : null}
                <button
                  onClick={() => setCreating(true)}
                  disabled={!tenantId || !levelEnabled}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  <Plus size={12} />
                  {config.createLabel}
                </button>
              </div>
            }
          />
          {!loading ? (
            <TemporalFilterBar
              filter={temporalFilter}
              onChange={setTemporalFilter}
              rowRanges={rows.map((row) => ({ valid_from: row.valid_from, valid_to: row.valid_to ?? null }))}
              idPrefix={`org-structure-${config.key}-temporal`}
            />
          ) : null}
          <div className="flex-1 overflow-auto bg-white min-h-0">
            {loading ? (
              <div className="py-20 text-center text-sm text-slate-400">טוען נתונים...</div>
            ) : loadError ? (
              <div className="py-20 text-center">
                <div className="mx-auto max-w-md rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">
                  <div className="mb-1 font-semibold">שגיאה בטעינת הנתונים</div>
                  <div className="font-mono text-xs text-red-600">{loadError}</div>
                </div>
              </div>
            ) : isCurrentTenantResolved && !levelEnabled ? (
              <div className="py-20 text-center text-sm text-slate-400">
                הרמה הזו לא מוגדרת לארגון זה.
              </div>
            ) : visibleRows.length === 0 ? (
              <div className="py-20 text-center text-sm text-slate-400">{temporalFilterError || config.emptyMessage}</div>
            ) : (
              <table className="admin-data-table w-full border-collapse text-xs">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-right font-semibold text-slate-600">מתאריך</th>
                    <th className="border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-right font-semibold text-slate-600">עד תאריך</th>
                    <th className="border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-right font-semibold text-slate-600">קוד</th>
                    <th className="border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-right font-semibold text-slate-600">{config.unitType ? "שם" : "תפקיד"}</th>
                    <th className="border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-right font-semibold text-slate-600">{config.unitType ? (config.parentLabel ?? "יחידת אב") : "יחידה ארגונית"}</th>
                    {config.unitType ? <th className="border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-right font-semibold text-slate-600">מנהל</th> : null}
                    {!config.unitType ? <th className="border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-right font-semibold text-slate-600">סוג העסקה</th> : null}
                    <th className="border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-right font-semibold text-slate-600">סטטוס</th>
                    <th className="border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-right font-semibold text-slate-600">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, index) => (
                    <tr
                      key={row.id}
                      onDoubleClick={() => setEditingState({ row })}
                      className={`cursor-pointer transition-colors ${index % 2 === 0 ? "bg-white hover:bg-brand-50/40" : "bg-slate-50/60 hover:bg-brand-50/40"}`}
                    >
                      <td className="border-b border-slate-100 px-4 py-2 text-slate-500">{formatDate(row.valid_from)}</td>
                      <td className="border-b border-slate-100 px-4 py-2 text-slate-500">{row.valid_to ? formatDate(row.valid_to) : "פעיל"}</td>
                      <td className="border-b border-slate-100 px-4 py-2 font-mono text-slate-600">{row.code}</td>
                      <td className="border-b border-slate-100 px-4 py-2 font-medium text-slate-800">{"name" in row ? row.name : row.title}</td>
                      <td className="border-b border-slate-100 px-4 py-2 text-slate-600">{"name" in row ? row.parent_unit_name || "—" : row.org_unit_name || "—"}</td>
                      {"name" in row ? <td className="border-b border-slate-100 px-4 py-2 text-slate-600">{row.manager_name || "—"}</td> : null}
                      {!config.unitType ? <td className="border-b border-slate-100 px-4 py-2 text-slate-600">{"employment_type_default" in row ? row.employment_type_default || "—" : "—"}</td> : null}
                      <td className="border-b border-slate-100 px-4 py-2"><RowStatusBadge active={row.is_active} /></td>
                      <td className="border-b border-slate-100 px-4 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={(e) => { e.stopPropagation(); setEditingState({ row }); }} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-brand-600">
                            <Pencil size={14} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setEditingState({ row, initialMode: "delete" }); }} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
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
      {!loading ? <AdminStatusBar total={visibleRows.length} label={config.label} /> : null}
      {creating && tenantId && levelEnabled ? (
        <OrgStructureRecordModal
          config={config}
          tenantId={tenantId}
          row={null}
          parentOptions={parentOptions}
          orgUnitOptions={unitOptionsForPosition}
          managerOptions={managerOptions}
          tenantConfig={tenantConfig}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); loadData(tenantId); }}
        />
      ) : null}
      {editingState && tenantId && levelEnabled ? (
        <OrgStructureRecordModal
          config={config}
          tenantId={tenantId}
          row={editingState.row}
          initialMode={editingState.initialMode}
          parentOptions={parentOptions}
          orgUnitOptions={unitOptionsForPosition}
          managerOptions={managerOptions}
          tenantConfig={tenantConfig}
          onClose={() => setEditingState(null)}
          onSaved={() => { setEditingState(null); loadData(tenantId); }}
        />
      ) : null}
    </>
  );
}

export function OrgStructureManagementPage({ config }: { config: CoreStructureConfigItem }) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-400">טוען מבנה ארגוני...</div>}>
      <OrgStructureManagementPageContent config={config} />
    </Suspense>
  );
}
