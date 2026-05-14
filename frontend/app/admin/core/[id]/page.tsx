"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter, useParams } from "next/navigation";
import { isLoggedIn, api, ApiRequestError } from "@/lib/api";
import { useWorkspace } from "@/components/layout/WorkspaceShell";
import { CardPage, type ChildTab } from "@/components/layout/CardPage";
import {
  AdminDateFields,
  AdminModal,
  AdminModalBody,
  AdminModalFooter,
  AdminModalHeader,
  AdminModalMessage,
  AdminModalPanel,
  ADMIN_MODAL_ACTION_DANGER,
  ADMIN_MODAL_ACTION_PRIMARY,
  ADMIN_MODAL_ACTION_SECONDARY,
  ADMIN_MODAL_GRID,
  ADMIN_MODAL_INPUT,
} from "@/components/ui/AdminModal";
import { FormField } from "@/components/ui/FormField";
import { HebrewDatePicker } from "@/components/ui/HebrewDatePicker";

// ─── Types ────────────────────────────────────────────────────────────────────

interface IdentityRow {
  id: string; first_name: string; last_name: string;
  first_name_en?: string; last_name_en?: string; id_number?: string;
  title?: string; gender?: string; username?: string; api_username?: string;
  is_partner?: boolean; is_manager?: boolean;
  valid_from: string; valid_to?: string | null; created_at?: string;
  _current?: boolean; _valid_from_raw?: string; _valid_to_raw?: string | null;
}
interface PersonalRow {
  id: string; birth_date?: string; birth_country?: string;
  citizenship1?: string; citizenship2?: string; marital_status?: string; num_children?: number;
  valid_from: string; valid_to?: string | null; created_at?: string;
  _current?: boolean; _valid_from_raw?: string; _valid_to_raw?: string | null;
}
interface ContactRow {
  id: string; address1?: string; address2?: string; city?: string;
  zip_code?: string; country?: string; phone?: string; mobile?: string;
  home_phone?: string; fax?: string; email?: string;
  valid_from: string; valid_to?: string | null; created_at?: string;
  _current?: boolean; _valid_from_raw?: string; _valid_to_raw?: string | null;
}
interface EmploymentRow {
  id: string; org_unit_id?: string; org_unit_name?: string;
  position_id?: string; position_name?: string;
  company?: string; employment_type?: string; manager_id?: string;
  start_date?: string; valid_from: string; valid_to?: string | null; created_at?: string;
  _current?: boolean; _valid_from_raw?: string; _valid_to_raw?: string | null;
}
interface CompensationRow {
  id: string; comp_code?: string; comp_name?: string;
  amount?: number; percentage?: number;
  valid_from: string; valid_to?: string | null; created_at?: string;
  _current?: boolean; _valid_from_raw?: string; _valid_to_raw?: string | null;
}
interface BankRow {
  id: string; payment_code?: string; bank_code?: string; bank_name?: string;
  branch?: string; account?: string; pct_payment?: number; fixed_amount?: number;
  signature_date?: string; valid_from: string; valid_to?: string | null; created_at?: string;
  _current?: boolean; _valid_from_raw?: string; _valid_to_raw?: string | null;
}
interface EventRow {
  id: string; event_type: string; event_date: string;
  reason?: string; description?: string; created_at?: string;
}
interface TrainingRow {
  id: string; course_name: string; course_date?: string;
  score?: string; institute?: string; created_at?: string;
}

interface EmployeeCard {
  id: string; employee_number: number; status: string;
  full_name: string; id_number?: string; photo_url?: string; created_at?: string;
  identity: IdentityRow[];
  personal: PersonalRow[];
  contact: ContactRow[];
  employment: EmploymentRow[];
  compensation: CompensationRow[];
  bank: BankRow[];
  events: EventRow[];
  training: TrainingRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString("he-IL") : "—";
function todayIso() {
  const n = new Date(); return new Date(n.getTime() - n.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function getApiError(err: unknown, fallback: string) {
  if (err instanceof ApiRequestError) return err.error ?? fallback;
  const e = err as { error?: string; details?: { error?: string } };
  return e?.error ?? e?.details?.error ?? fallback;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, "active" | "trial" | "suspended" | "cancelled"> = {
  active: "active", inactive: "trial", terminated: "suspended",
};
const STATUS_LABELS: Record<string, string> = {
  active: "פעיל", inactive: "לא פעיל", terminated: "מסיים",
};

// ─── Temporal Modal ───────────────────────────────────────────────────────────

type TemporalSection = "identity" | "personal" | "contact" | "employment" | "compensation" | "bank";

interface TemporalModalState {
  section: TemporalSection;
  action: "add" | "update" | "set";
  recordId?: string;
  prefill?: Record<string, unknown>;
}

function TemporalModal({
  state,
  tenantId,
  employeeId,
  onClose,
  onSaved,
}: {
  state: TemporalModalState;
  tenantId: string;
  employeeId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { section, action } = state;
  const [validFrom, setValidFrom] = useState(state.prefill?.valid_from as string ?? todayIso());
  const [validTo, setValidTo] = useState(state.prefill?.valid_to as string ?? "");
  const [form, setForm] = useState<Record<string, string>>(() => {
    const p = state.prefill ?? {};
    const base: Record<string, string> = {};
    Object.entries(p).forEach(([k, v]) => {
      if (k !== "valid_from" && k !== "valid_to" && k !== "id") base[k] = v == null ? "" : String(v);
    });
    return base;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  const TITLE: Record<TemporalSection, string> = {
    identity: "פרטים כלליים", personal: "פרטים אישיים", contact: "כתובות וטלפון",
    employment: "תפקיד וצוות", compensation: "שכר", bank: "חשבון בנק",
  };
  const ACTION_LABEL: Record<string, string> = { add: "הוסף רשומה", update: "עדכן", set: "החלף (Set)" };

  async function handleSave() {
    setSaving(true); setError(null);
    const body: Record<string, unknown> = { action, valid_from: validFrom || todayIso() };
    if (validTo) body.valid_to = validTo;
    if (state.recordId) body.record_id = state.recordId;

    const toNum = (v: string) => v ? Number(v) : undefined;
    const toDate = (v: string) => v || undefined;

    if (section === "identity") {
      Object.assign(body, {
        first_name: form.first_name || undefined,
        last_name: form.last_name || undefined,
        first_name_en: form.first_name_en || undefined,
        last_name_en: form.last_name_en || undefined,
        id_number: form.id_number || undefined,
        title: form.title || undefined,
        gender: form.gender || undefined,
        username: form.username || undefined,
        api_username: form.api_username || undefined,
        is_partner: form.is_partner ? form.is_partner === "true" : undefined,
        is_manager: form.is_manager ? form.is_manager === "true" : undefined,
      });
    } else if (section === "personal") {
      Object.assign(body, {
        birth_date: toDate(form.birth_date),
        birth_country: form.birth_country || undefined,
        citizenship1: form.citizenship1 || undefined,
        citizenship2: form.citizenship2 || undefined,
        marital_status: form.marital_status || undefined,
        num_children: form.num_children ? toNum(form.num_children) : undefined,
      });
    } else if (section === "contact") {
      Object.assign(body, {
        address1: form.address1 || undefined, address2: form.address2 || undefined,
        city: form.city || undefined, zip_code: form.zip_code || undefined,
        country: form.country || undefined, phone: form.phone || undefined,
        mobile: form.mobile || undefined, home_phone: form.home_phone || undefined,
        fax: form.fax || undefined, email: form.email || undefined,
      });
    } else if (section === "employment") {
      Object.assign(body, {
        company: form.company || undefined,
        employment_type: form.employment_type || undefined,
        start_date: toDate(form.start_date),
      });
    } else if (section === "compensation") {
      Object.assign(body, {
        comp_code: form.comp_code || undefined, comp_name: form.comp_name || undefined,
        amount: form.amount ? toNum(form.amount) : undefined,
        percentage: form.percentage ? toNum(form.percentage) : undefined,
      });
    } else if (section === "bank") {
      Object.assign(body, {
        payment_code: form.payment_code || undefined, bank_code: form.bank_code || undefined,
        bank_name: form.bank_name || undefined, branch: form.branch || undefined,
        account: form.account || undefined,
        pct_payment: form.pct_payment ? toNum(form.pct_payment) : undefined,
        fixed_amount: form.fixed_amount ? toNum(form.fixed_amount) : undefined,
        signature_date: toDate(form.signature_date),
      });
    }

    try {
      await api.put(`/api/core/employees/${employeeId}/${section}?tenant_id=${tenantId}`, body);
      onSaved(); onClose();
    } catch (err) {
      setError(getApiError(err, "שגיאה בשמירה"));
    } finally { setSaving(false); }
  }

  return (
    <AdminModal onBackdropClick={onClose}>
      <AdminModalPanel className="max-w-lg overflow-hidden">
        <AdminModalHeader title={`${ACTION_LABEL[action]} — ${TITLE[section]}`} onClose={onClose} />
        <AdminModalBody className="space-y-3">
          {error && <AdminModalMessage tone="danger">{error}</AdminModalMessage>}

          {section === "identity" && (
            <div className={ADMIN_MODAL_GRID}>
              <FormField label="שם פרטי" value={form.first_name ?? ""} readOnly={false} onChange={(v) => set("first_name", v)} />
              <FormField label="שם משפחה" value={form.last_name ?? ""} readOnly={false} onChange={(v) => set("last_name", v)} />
              <FormField label="שם פרטי (לועזית)" value={form.first_name_en ?? ""} readOnly={false} onChange={(v) => set("first_name_en", v)} />
              <FormField label="שם משפחה (לועזית)" value={form.last_name_en ?? ""} readOnly={false} onChange={(v) => set("last_name_en", v)} />
              <FormField label="ת.ז." value={form.id_number ?? ""} readOnly={false} onChange={(v) => set("id_number", v)} />
              <FormField label="תואר" value={form.title ?? ""} readOnly={false} onChange={(v) => set("title", v)} />
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">מגדר</label>
                <select className={ADMIN_MODAL_INPUT} value={form.gender ?? ""} onChange={(e) => set("gender", e.target.value)}>
                  <option value="">בחר...</option>
                  <option value="M">זכר</option>
                  <option value="F">נקבה</option>
                </select>
              </div>
              <FormField label="שם משתמש" value={form.username ?? ""} readOnly={false} onChange={(v) => set("username", v)} />
            </div>
          )}

          {section === "personal" && (
            <div className={ADMIN_MODAL_GRID}>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">תאריך לידה</label>
                <HebrewDatePicker value={form.birth_date ?? ""} onChange={(v) => set("birth_date", v)} className={ADMIN_MODAL_INPUT} />
              </div>
              <FormField label="ארץ לידה" value={form.birth_country ?? ""} readOnly={false} onChange={(v) => set("birth_country", v)} />
              <FormField label="אזרחות 1" value={form.citizenship1 ?? ""} readOnly={false} onChange={(v) => set("citizenship1", v)} />
              <FormField label="אזרחות 2" value={form.citizenship2 ?? ""} readOnly={false} onChange={(v) => set("citizenship2", v)} />
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">מצב משפחתי</label>
                <select className={ADMIN_MODAL_INPUT} value={form.marital_status ?? ""} onChange={(e) => set("marital_status", e.target.value)}>
                  <option value="">בחר...</option>
                  <option value="single">רווק/ה</option>
                  <option value="married">נשוי/נשואה</option>
                  <option value="divorced">גרוש/ה</option>
                  <option value="widowed">אלמן/ה</option>
                </select>
              </div>
              <FormField label="מספר ילדים" value={form.num_children ?? "0"} readOnly={false} onChange={(v) => set("num_children", v)} />
            </div>
          )}

          {section === "contact" && (
            <div className={ADMIN_MODAL_GRID}>
              <FormField label="כתובת שורה 1" value={form.address1 ?? ""} readOnly={false} onChange={(v) => set("address1", v)} />
              <FormField label="כתובת שורה 2" value={form.address2 ?? ""} readOnly={false} onChange={(v) => set("address2", v)} />
              <FormField label="עיר" value={form.city ?? ""} readOnly={false} onChange={(v) => set("city", v)} />
              <FormField label="מיקוד" value={form.zip_code ?? ""} readOnly={false} onChange={(v) => set("zip_code", v)} />
              <FormField label="ארץ" value={form.country ?? "IL"} readOnly={false} onChange={(v) => set("country", v)} />
              <FormField label="טלפון" value={form.phone ?? ""} readOnly={false} onChange={(v) => set("phone", v)} />
              <FormField label="נייד" value={form.mobile ?? ""} readOnly={false} onChange={(v) => set("mobile", v)} />
              <FormField label="טלפון בית" value={form.home_phone ?? ""} readOnly={false} onChange={(v) => set("home_phone", v)} />
              <FormField label="פקס" value={form.fax ?? ""} readOnly={false} onChange={(v) => set("fax", v)} />
              <FormField label="דוא&quot;ל" value={form.email ?? ""} readOnly={false} onChange={(v) => set("email", v)} />
            </div>
          )}

          {section === "employment" && (
            <div className={ADMIN_MODAL_GRID}>
              <FormField label="חברה" value={form.company ?? ""} readOnly={false} onChange={(v) => set("company", v)} />
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">סוג העסקה</label>
                <select className={ADMIN_MODAL_INPUT} value={form.employment_type ?? ""} onChange={(e) => set("employment_type", e.target.value)}>
                  <option value="">בחר...</option>
                  <option value="full_time">משרה מלאה</option>
                  <option value="part_time">משרה חלקית</option>
                  <option value="contract">חוזה</option>
                  <option value="freelance">עצמאי</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] font-medium text-slate-500 mb-1">תאריך תחילה</label>
                <HebrewDatePicker value={form.start_date ?? ""} onChange={(v) => set("start_date", v)} className={ADMIN_MODAL_INPUT} />
              </div>
            </div>
          )}

          {section === "compensation" && (
            <div className={ADMIN_MODAL_GRID}>
              <FormField label="קוד רכיב" value={form.comp_code ?? ""} readOnly={false} onChange={(v) => set("comp_code", v)} />
              <FormField label="שם רכיב" value={form.comp_name ?? ""} readOnly={false} onChange={(v) => set("comp_name", v)} />
              <FormField label="סכום" value={form.amount ?? ""} readOnly={false} onChange={(v) => set("amount", v)} />
              <FormField label="אחוז" value={form.percentage ?? ""} readOnly={false} onChange={(v) => set("percentage", v)} />
            </div>
          )}

          {section === "bank" && (
            <div className={ADMIN_MODAL_GRID}>
              <FormField label="קוד תשלום" value={form.payment_code ?? ""} readOnly={false} onChange={(v) => set("payment_code", v)} />
              <FormField label="קוד בנק" value={form.bank_code ?? ""} readOnly={false} onChange={(v) => set("bank_code", v)} />
              <FormField label="שם בנק" value={form.bank_name ?? ""} readOnly={false} onChange={(v) => set("bank_name", v)} />
              <FormField label="סניף" value={form.branch ?? ""} readOnly={false} onChange={(v) => set("branch", v)} />
              <FormField label="חשבון" value={form.account ?? ""} readOnly={false} onChange={(v) => set("account", v)} />
              <FormField label="% לתשלום" value={form.pct_payment ?? "0"} readOnly={false} onChange={(v) => set("pct_payment", v)} />
              <FormField label="סכום קבוע" value={form.fixed_amount ?? "0"} readOnly={false} onChange={(v) => set("fixed_amount", v)} />
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">תאריך חתימה</label>
                <HebrewDatePicker value={form.signature_date ?? ""} onChange={(v) => set("signature_date", v)} className={ADMIN_MODAL_INPUT} />
              </div>
            </div>
          )}

          <AdminDateFields
            fromField={<HebrewDatePicker value={validFrom} onChange={setValidFrom} className={ADMIN_MODAL_INPUT} />}
            toField={<HebrewDatePicker value={validTo} onChange={setValidTo} className={ADMIN_MODAL_INPUT} />}
          />
        </AdminModalBody>
        <AdminModalFooter>
          <button onClick={handleSave} disabled={saving} className={ADMIN_MODAL_ACTION_PRIMARY}>
            {saving ? "שומר..." : "שמור"}
          </button>
          <button onClick={onClose} className={ADMIN_MODAL_ACTION_SECONDARY}>ביטול</button>
        </AdminModalFooter>
      </AdminModalPanel>
    </AdminModal>
  );
}

// ─── Event Modal ──────────────────────────────────────────────────────────────

function EventModal({ tenantId, employeeId, onClose, onSaved }: { tenantId: string; employeeId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ event_type: "", event_date: todayIso(), reason: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }
  async function handleSave() {
    if (!form.event_type || !form.event_date) return;
    setSaving(true); setError(null);
    try {
      await api.post(`/api/core/employees/${employeeId}/events?tenant_id=${tenantId}`, {
        event_type: form.event_type, event_date: form.event_date,
        reason: form.reason || undefined, description: form.description || undefined,
      });
      onSaved(); onClose();
    } catch (err) { setError(getApiError(err, "שגיאה בשמירה")); }
    finally { setSaving(false); }
  }
  return (
    <AdminModal onBackdropClick={onClose}>
      <AdminModalPanel className="max-w-sm overflow-hidden">
        <AdminModalHeader title="הוסף אירוע" onClose={onClose} />
        <AdminModalBody className="space-y-3">
          {error && <AdminModalMessage tone="danger">{error}</AdminModalMessage>}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">סוג אירוע *</label>
            <select className={ADMIN_MODAL_INPUT} value={form.event_type} onChange={(e) => set("event_type", e.target.value)}>
              <option value="">בחר...</option>
              <option value="hire">גיוס</option>
              <option value="promotion">קידום</option>
              <option value="transfer">העברה</option>
              <option value="leave">חופשה</option>
              <option value="termination">סיום עבודה</option>
              <option value="other">אחר</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">תאריך *</label>
            <HebrewDatePicker value={form.event_date} onChange={(v) => set("event_date", v)} className={ADMIN_MODAL_INPUT} />
          </div>
          <FormField label="סיבה" value={form.reason} readOnly={false} onChange={(v) => set("reason", v)} />
          <FormField label="תיאור" value={form.description} readOnly={false} onChange={(v) => set("description", v)} />
        </AdminModalBody>
        <AdminModalFooter>
          <button onClick={handleSave} disabled={saving || !form.event_type || !form.event_date} className={ADMIN_MODAL_ACTION_PRIMARY}>
            {saving ? "שומר..." : "שמור"}
          </button>
          <button onClick={onClose} className={ADMIN_MODAL_ACTION_SECONDARY}>ביטול</button>
        </AdminModalFooter>
      </AdminModalPanel>
    </AdminModal>
  );
}

// ─── Training Modal ───────────────────────────────────────────────────────────

function TrainingModal({ tenantId, employeeId, onClose, onSaved }: { tenantId: string; employeeId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ course_name: "", course_date: "", score: "", institute: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }
  async function handleSave() {
    if (!form.course_name.trim()) return;
    setSaving(true); setError(null);
    try {
      await api.post(`/api/core/employees/${employeeId}/training?tenant_id=${tenantId}`, {
        course_name: form.course_name.trim(),
        course_date: form.course_date || undefined,
        score: form.score || undefined,
        institute: form.institute || undefined,
      });
      onSaved(); onClose();
    } catch (err) { setError(getApiError(err, "שגיאה בשמירה")); }
    finally { setSaving(false); }
  }
  return (
    <AdminModal onBackdropClick={onClose}>
      <AdminModalPanel className="max-w-sm overflow-hidden">
        <AdminModalHeader title="הוסף קורס" onClose={onClose} />
        <AdminModalBody className="space-y-3">
          {error && <AdminModalMessage tone="danger">{error}</AdminModalMessage>}
          <FormField label="שם קורס *" required value={form.course_name} readOnly={false} onChange={(v) => set("course_name", v)} />
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">תאריך</label>
            <HebrewDatePicker value={form.course_date} onChange={(v) => set("course_date", v)} className={ADMIN_MODAL_INPUT} />
          </div>
          <FormField label="ציון" value={form.score} readOnly={false} onChange={(v) => set("score", v)} />
          <FormField label="גוף מלמד" value={form.institute} readOnly={false} onChange={(v) => set("institute", v)} />
        </AdminModalBody>
        <AdminModalFooter>
          <button onClick={handleSave} disabled={saving || !form.course_name} className={ADMIN_MODAL_ACTION_PRIMARY}>
            {saving ? "שומר..." : "שמור"}
          </button>
          <button onClick={onClose} className={ADMIN_MODAL_ACTION_SECONDARY}>ביטול</button>
        </AdminModalFooter>
      </AdminModalPanel>
    </AdminModal>
  );
}

// ─── Status Modal ─────────────────────────────────────────────────────────────

function StatusModal({ tenantId, employeeId, current, onClose, onSaved }: {
  tenantId: string; employeeId: string; current: string; onClose: () => void; onSaved: () => void;
}) {
  const [status, setStatus] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function handleSave() {
    setSaving(true); setError(null);
    try {
      await api.patch(`/api/core/employees/${employeeId}/status?tenant_id=${tenantId}`, { status });
      onSaved(); onClose();
    } catch (err) { setError(getApiError(err, "שגיאה בשמירה")); }
    finally { setSaving(false); }
  }
  return (
    <AdminModal onBackdropClick={onClose}>
      <AdminModalPanel className="max-w-xs overflow-hidden">
        <AdminModalHeader title="שינוי סטטוס עובד" onClose={onClose} />
        <AdminModalBody className="space-y-3">
          {error && <AdminModalMessage tone="danger">{error}</AdminModalMessage>}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">סטטוס</label>
            <select className={ADMIN_MODAL_INPUT} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">פעיל</option>
              <option value="inactive">לא פעיל</option>
              <option value="terminated">מסיים</option>
            </select>
          </div>
          {status === "terminated" && (
            <AdminModalMessage tone="warning">שינוי לסטטוס מסיים הוא פעולה משמעותית.</AdminModalMessage>
          )}
        </AdminModalBody>
        <AdminModalFooter>
          <button onClick={handleSave} disabled={saving || status === current} className={status === "terminated" ? ADMIN_MODAL_ACTION_DANGER : ADMIN_MODAL_ACTION_PRIMARY}>
            {saving ? "שומר..." : "שמור"}
          </button>
          <button onClick={onClose} className={ADMIN_MODAL_ACTION_SECONDARY}>ביטול</button>
        </AdminModalFooter>
      </AdminModalPanel>
    </AdminModal>
  );
}

// ─── Display helpers ──────────────────────────────────────────────────────────

function FieldRow({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-1 text-xs border-b border-slate-50">
      <span className="shrink-0 text-slate-500 font-medium" style={{ minWidth: 120 }}>{label}</span>
      <span className="text-slate-800">{value ?? "—"}</span>
    </div>
  );
}

function SectionHeader({ title, onAdd }: { title: string; onAdd?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-semibold text-slate-700">{title}</span>
      {onAdd && (
        <button onClick={onAdd} className="text-[11px] text-brand-600 hover:text-brand-700 font-medium">+ עדכן</button>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EmployeeCardPage() {
  const router = useRouter();
  const params = useParams();
  const employeeId = params.id as string;
  const workspace = useWorkspace();
  const tenantId = workspace?.selectedTenantId ?? "";

  const [card, setCard] = useState<EmployeeCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [temporalModal, setTemporalModal] = useState<TemporalModalState | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const loadCard = useCallback(() => {
    if (!tenantId) return;
    setLoading(true);
    api.get<EmployeeCard>(`/api/core/employees/${employeeId}?tenant_id=${tenantId}`)
      .then(setCard)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [employeeId, tenantId]);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
  }, [router]);

  useEffect(() => { if (tenantId) loadCard(); }, [tenantId, loadCard]);

  const activeIdent = card?.identity.find((r) => r._current) ?? card?.identity[0];
  const activePersonal = card?.personal.find((r) => r._current) ?? card?.personal[0];
  const activeContact = card?.contact.find((r) => r._current) ?? card?.contact[0];
  const activeEmployment = card?.employment.find((r) => r._current) ?? card?.employment[0];

  const GENDER_MAP: Record<string, string> = { M: "זכר", F: "נקבה" };
  const MARITAL_MAP: Record<string, string> = { single: "רווק/ה", married: "נשוי/נשואה", divorced: "גרוש/ה", widowed: "אלמן/ה" };
  const EMP_TYPE_MAP: Record<string, string> = { full_time: "משרה מלאה", part_time: "משרה חלקית", contract: "חוזה", freelance: "עצמאי" };
  const EVENT_TYPE_MAP: Record<string, string> = { hire: "גיוס", promotion: "קידום", transfer: "העברה", leave: "חופשה", termination: "סיום עבודה", other: "אחר" };

  // ── formTabs ──────────────────────────────────────────────────────────────

  const formTabs = [
    {
      id: "identity",
      label: "פרטים כלליים",
      content: (
        <div className="p-4 space-y-0">
          <SectionHeader title="פרטי זהות" onAdd={() => setTemporalModal({ section: "identity", action: "update", prefill: activeIdent as Record<string, unknown> })} />
          <FieldRow label="שם פרטי" value={activeIdent?.first_name} />
          <FieldRow label="שם משפחה" value={activeIdent?.last_name} />
          <FieldRow label="שם פרטי (לועזית)" value={activeIdent?.first_name_en} />
          <FieldRow label="שם משפחה (לועזית)" value={activeIdent?.last_name_en} />
          <FieldRow label="ת.ז." value={activeIdent?.id_number} />
          <FieldRow label="תואר" value={activeIdent?.title} />
          <FieldRow label="מגדר" value={activeIdent?.gender ? GENDER_MAP[activeIdent.gender] ?? activeIdent.gender : undefined} />
          <FieldRow label="שם משתמש" value={activeIdent?.username} />
          <FieldRow label="בתוקף מ" value={fmtDate(activeIdent?.valid_from)} />
        </div>
      ),
    },
    {
      id: "employment",
      label: "תפקיד וצוות",
      content: (
        <div className="p-4 space-y-0">
          <SectionHeader title="העסקה" onAdd={() => setTemporalModal({ section: "employment", action: "update", prefill: activeEmployment as Record<string, unknown> })} />
          <FieldRow label="יחידה ארגונית" value={activeEmployment?.org_unit_name} />
          <FieldRow label="תפקיד" value={activeEmployment?.position_name} />
          <FieldRow label="חברה" value={activeEmployment?.company} />
          <FieldRow label="סוג העסקה" value={activeEmployment?.employment_type ? EMP_TYPE_MAP[activeEmployment.employment_type] ?? activeEmployment.employment_type : undefined} />
          <FieldRow label="תאריך תחילה" value={fmtDate(activeEmployment?.start_date)} />
          <FieldRow label="בתוקף מ" value={fmtDate(activeEmployment?.valid_from)} />
        </div>
      ),
    },
    {
      id: "contact",
      label: "כתובות וטלפון",
      content: (
        <div className="p-4 space-y-0">
          <SectionHeader title="פרטי קשר" onAdd={() => setTemporalModal({ section: "contact", action: "update", prefill: activeContact as Record<string, unknown> })} />
          <FieldRow label="כתובת" value={[activeContact?.address1, activeContact?.address2].filter(Boolean).join(", ") || undefined} />
          <FieldRow label="עיר" value={activeContact?.city} />
          <FieldRow label="מיקוד" value={activeContact?.zip_code} />
          <FieldRow label="ארץ" value={activeContact?.country} />
          <FieldRow label="טלפון" value={activeContact?.phone} />
          <FieldRow label="נייד" value={activeContact?.mobile} />
          <FieldRow label="טלפון בית" value={activeContact?.home_phone} />
          <FieldRow label='דוא"ל' value={activeContact?.email} />
        </div>
      ),
    },
    {
      id: "settings",
      label: "הגדרות",
      content: (
        <div className="p-4 space-y-0">
          <SectionHeader title="הגדרות מתקדמות" onAdd={() => setTemporalModal({ section: "identity", action: "update", prefill: activeIdent as Record<string, unknown> })} />
          <FieldRow label="שם API" value={activeIdent?.api_username} />
          <FieldRow label="שותף?" value={activeIdent?.is_partner ? "כן" : "לא"} />
          <FieldRow label="מנהל?" value={activeIdent?.is_manager ? "כן" : "לא"} />
        </div>
      ),
    },
  ];

  // ── childTabs ─────────────────────────────────────────────────────────────

  const childTabs: ChildTab[] = [
    {
      id: "personal",
      label: "פרטים אישיים",
      temporalFilter: true,
      emptyMessage: "אין פרטים אישיים רשומים",
      columns: [
        { key: "birth_date", label: "ת. לידה" },
        { key: "birth_country", label: "ארץ לידה" },
        { key: "marital_status", label: "מצב משפחתי" },
        { key: "num_children", label: "מס' ילדים" },
        { key: "valid_from", label: "מ-" },
        { key: "valid_to", label: "עד" },
      ],
      rows: (card?.personal ?? []).map((r) => ({
        ...r,
        birth_date: fmtDate(r.birth_date),
        marital_status: r.marital_status ? MARITAL_MAP[r.marital_status] ?? r.marital_status : "—",
        num_children: r.num_children ?? 0,
        valid_from: fmtDate(r.valid_from),
        valid_to: fmtDate(r.valid_to),
        _current: r._current,
        _valid_from_raw: r._valid_from_raw,
        _valid_to_raw: r._valid_to_raw,
      })),
      onAddClick: () => setTemporalModal({ section: "personal", action: "add" }),
    },
    {
      id: "employment_history",
      label: "ניוד מחלקות",
      temporalFilter: true,
      emptyMessage: "אין רשומות העסקה",
      columns: [
        { key: "org_unit_name", label: "יחידה ארגונית" },
        { key: "position_name", label: "תפקיד" },
        { key: "company", label: "חברה" },
        { key: "employment_type", label: "סוג" },
        { key: "start_date", label: "תחילה" },
        { key: "valid_from", label: "מ-" },
        { key: "valid_to", label: "עד" },
      ],
      rows: (card?.employment ?? []).map((r) => ({
        ...r,
        employment_type: r.employment_type ? EMP_TYPE_MAP[r.employment_type] ?? r.employment_type : "—",
        start_date: fmtDate(r.start_date),
        valid_from: fmtDate(r.valid_from),
        valid_to: fmtDate(r.valid_to),
        _current: r._current,
        _valid_from_raw: r._valid_from_raw,
        _valid_to_raw: r._valid_to_raw,
      })),
      onAddClick: () => setTemporalModal({ section: "employment", action: "add" }),
    },
    {
      id: "compensation",
      label: "שכר",
      temporalFilter: true,
      emptyMessage: "אין רכיבי שכר",
      columns: [
        { key: "comp_code", label: "קוד" },
        { key: "comp_name", label: "שם רכיב" },
        { key: "amount", label: "סכום" },
        { key: "percentage", label: "%" },
        { key: "valid_from", label: "מ-" },
        { key: "valid_to", label: "עד" },
      ],
      rows: (card?.compensation ?? []).map((r) => ({
        ...r,
        valid_from: fmtDate(r.valid_from),
        valid_to: fmtDate(r.valid_to),
        _current: r._current,
        _valid_from_raw: r._valid_from_raw,
        _valid_to_raw: r._valid_to_raw,
      })),
      onAddClick: () => setTemporalModal({ section: "compensation", action: "add" }),
    },
    {
      id: "bank",
      label: "חשבון בנק",
      temporalFilter: true,
      emptyMessage: "אין חשבונות בנק",
      columns: [
        { key: "bank_name", label: "בנק" },
        { key: "branch", label: "סניף" },
        { key: "account", label: "חשבון" },
        { key: "pct_payment", label: "%" },
        { key: "fixed_amount", label: "סכום קבוע" },
        { key: "valid_from", label: "מ-" },
        { key: "valid_to", label: "עד" },
      ],
      rows: (card?.bank ?? []).map((r) => ({
        ...r,
        valid_from: fmtDate(r.valid_from),
        valid_to: fmtDate(r.valid_to),
        _current: r._current,
        _valid_from_raw: r._valid_from_raw,
        _valid_to_raw: r._valid_to_raw,
      })),
      onAddClick: () => setTemporalModal({ section: "bank", action: "add" }),
    },
    {
      id: "training",
      label: "קורסים",
      emptyMessage: "אין קורסים",
      columns: [
        { key: "course_name", label: "שם קורס" },
        { key: "course_date", label: "תאריך" },
        { key: "score", label: "ציון" },
        { key: "institute", label: "גוף מלמד" },
      ],
      rows: (card?.training ?? []).map((r) => ({
        ...r,
        course_date: fmtDate(r.course_date),
      })),
      onAddClick: () => setShowTrainingModal(true),
    },
    {
      id: "events",
      label: "אירועים",
      emptyMessage: "אין אירועים",
      columns: [
        { key: "event_type", label: "סוג אירוע" },
        { key: "event_date", label: "תאריך" },
        { key: "reason", label: "סיבה" },
        { key: "description", label: "תיאור" },
      ],
      rows: (card?.events ?? []).map((r) => ({
        ...r,
        event_type: EVENT_TYPE_MAP[r.event_type] ?? r.event_type,
        event_date: fmtDate(r.event_date),
      })),
      onAddClick: () => setShowEventModal(true),
    },
  ];

  // ── Parent header content ─────────────────────────────────────────────────

  const parentContent = card ? (
    <div className="flex items-center gap-4 p-4">
      <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-2xl font-bold text-slate-400 shrink-0">
        {activeIdent?.first_name?.[0] ?? "?"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-base font-bold text-slate-800">{card.full_name}</div>
        <div className="text-xs text-slate-500 mt-0.5">מס' עובד: {card.employee_number}</div>
        {card.id_number && <div className="text-xs text-slate-500">ת.ז.: {card.id_number}</div>}
      </div>
      <div className="flex flex-col items-end gap-2">
        <button
          onClick={() => setShowStatusModal(true)}
          className="text-xs text-brand-600 hover:text-brand-700 font-medium"
        >
          שנה סטטוס
        </button>
      </div>
    </div>
  ) : null;

  const statusCfg = card ? STATUS_CFG[card.status] : undefined;
  const statusLabel = card ? STATUS_LABELS[card.status] ?? card.status : undefined;

  return (
    <>
      <CardPage
        title={card ? `${card.full_name} — עובד ${card.employee_number}` : "כרטיס עובד"}
        backHref="/admin/core"
        backLabel="רשימת עובדים"
        status={statusCfg && statusLabel ? { label: statusLabel, type: statusCfg } : undefined}
        parentContent={parentContent ?? undefined}
        formTabs={formTabs}
        childTabs={childTabs}
        loading={loading}
      />

      {temporalModal && tenantId && (
        <TemporalModal
          state={temporalModal}
          tenantId={tenantId}
          employeeId={employeeId}
          onClose={() => setTemporalModal(null)}
          onSaved={loadCard}
        />
      )}
      {showEventModal && tenantId && (
        <EventModal tenantId={tenantId} employeeId={employeeId} onClose={() => setShowEventModal(false)} onSaved={loadCard} />
      )}
      {showTrainingModal && tenantId && (
        <TrainingModal tenantId={tenantId} employeeId={employeeId} onClose={() => setShowTrainingModal(false)} onSaved={loadCard} />
      )}
      {showStatusModal && card && tenantId && (
        <StatusModal tenantId={tenantId} employeeId={employeeId} current={card.status} onClose={() => setShowStatusModal(false)} onSaved={loadCard} />
      )}
    </>
  );
}
