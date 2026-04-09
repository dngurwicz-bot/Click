"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, getStoredUser, api } from "@/lib/api";
import { TopNav } from "@/components/layout/TopNav";
import { AdminActionBar, AdminCountLabel, AdminSearchField, AdminStatusBar, AdminTitleBar } from "@/components/layout/AdminShell";
import { HebrewDatePicker } from "@/components/ui/HebrewDatePicker";
import {
  UserCheck, UserX,
  UserPlus, Pencil, Trash2, X, Eye, EyeOff, ShieldCheck,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface Permission {
  resource: string;
  can_view: boolean;
  can_edit: boolean;
}

interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
  permissions: Permission[];
  valid_from: string;
  valid_to: string | null;
}

// ── Constants ──────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin:       "מנהל",
  support:     "תמיכה",
  billing:     "כספים",
};

const ROLE_STYLE: Record<string, string> = {
  super_admin: "bg-violet-50 text-violet-700",
  admin:       "bg-brand-50 text-brand-700",
  support:     "bg-sky-50 text-sky-700",
  billing:     "bg-amber-50 text-amber-700",
};

const RESOURCES: { key: string; label: string }[] = [
  { key: "tenants",   label: "ניהול ארגונים" },
  { key: "lookups",   label: "רשימות ארגוניות" },
  { key: "modules",   label: "מודולים ומחירון" },
  { key: "billing",   label: "חיובים וחשבוניות" },
  { key: "users",     label: "משתמשי מערכת" },
  { key: "templates", label: "תבניות הקמה" },
  { key: "audit",     label: "Audit Log" },
];

function emptyPermissions(): Permission[] {
  return RESOURCES.map((r) => ({ resource: r.key, can_view: false, can_edit: false }));
}

const DEFAULT_PERMS_BY_ROLE: Record<string, Record<string, { can_view: boolean; can_edit: boolean }>> = {
  admin: {
    tenants:   { can_view: true,  can_edit: true  },
    lookups:   { can_view: true,  can_edit: true  },
    modules:   { can_view: true,  can_edit: false },
    billing:   { can_view: true,  can_edit: true  },
    users:     { can_view: false, can_edit: false },
    templates: { can_view: true,  can_edit: true  },
    audit:     { can_view: true,  can_edit: false },
  },
  support: {
    tenants:   { can_view: true,  can_edit: false },
    lookups:   { can_view: true,  can_edit: false },
    modules:   { can_view: false, can_edit: false },
    billing:   { can_view: true,  can_edit: false },
    users:     { can_view: false, can_edit: false },
    templates: { can_view: false, can_edit: false },
    audit:     { can_view: false, can_edit: false },
  },
  billing: {
    tenants:   { can_view: false, can_edit: false },
    lookups:   { can_view: false, can_edit: false },
    modules:   { can_view: true,  can_edit: false },
    billing:   { can_view: true,  can_edit: true  },
    users:     { can_view: false, can_edit: false },
    templates: { can_view: false, can_edit: false },
    audit:     { can_view: false, can_edit: false },
  },
};

function permissionsForRole(role: string): Permission[] {
  if (role === "super_admin") return emptyPermissions(); // super_admin = no restrictions
  const defaults = DEFAULT_PERMS_BY_ROLE[role] ?? {};
  return RESOURCES.map((r) => ({
    resource: r.key,
    can_view: defaults[r.key]?.can_view ?? false,
    can_edit: defaults[r.key]?.can_edit ?? false,
  }));
}

function toInput(d?: string | null): string {
  if (!d) return "";
  return d.slice(0, 10);
}

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("he-IL");
}

type UserMode = "update" | "close" | "delete";

// ── Modal ──────────────────────────────────────────────────────────────────

interface ModalState {
  mode: "create" | "edit";
  user?: AdminUser;
}

interface FormData {
  full_name: string;
  email: string;
  password: string;
  role: string;
  is_active: boolean;
  permissions: Permission[];
}

function UserModal({
  state,
  currentUserId,
  onClose,
  onSaved,
}: {
  state: ModalState;
  currentUserId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today  = new Date().toISOString().slice(0, 10);
  const isEdit = state.mode === "edit";

  const [form, setForm] = useState<FormData>(() => {
    if (isEdit && state.user) {
      return {
        full_name:   state.user.full_name,
        email:       state.user.email,
        password:    "",
        role:        state.user.role,
        is_active:   state.user.is_active,
        permissions: state.user.permissions?.length
          ? [...state.user.permissions]
          : permissionsForRole(state.user.role),
      };
    }
    return {
      full_name:   "",
      email:       "",
      password:    "",
      role:        "admin",
      is_active:   true,
      permissions: permissionsForRole("admin"),
    };
  });

  const [validFrom,    setValidFrom]    = useState<string>(isEdit ? toInput(state.user?.valid_from) || today : today);
  const [validTo,      setValidTo]      = useState<string>(isEdit ? toInput(state.user?.valid_to) : "");
  const [userMode,     setUserMode]     = useState<UserMode>("update");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const isSelf       = isEdit && state.user?.id === currentUserId;
  const isSuperAdmin = form.role === "super_admin";

  function handleRoleChange(role: string) {
    setForm((f) => ({
      ...f,
      role,
      permissions: role === "super_admin" ? emptyPermissions() : permissionsForRole(role),
    }));
  }

  function handlePermChange(resource: string, field: "can_view" | "can_edit", value: boolean) {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.map((p) => {
        if (p.resource !== resource) return p;
        if (field === "can_edit" && value) return { ...p, can_view: true, can_edit: true };
        if (field === "can_view" && !value) return { ...p, can_view: false, can_edit: false };
        return { ...p, [field]: value };
      }),
    }));
  }

  // CREATE flow — unchanged
  async function handleCreate() {
    setError(null);
    if (!form.full_name.trim()) { setError("שם מלא הוא שדה חובה"); return; }
    if (!form.email.trim())     { setError("דוא״ל הוא שדה חובה"); return; }
    if (!form.password)         { setError("סיסמה היא שדה חובה"); return; }
    setSaving(true);
    try {
      await api.post("/api/admin/users", {
        full_name:   form.full_name,
        email:       form.email,
        password:    form.password,
        role:        form.role,
        permissions: isSuperAdmin ? [] : form.permissions,
      });
      onSaved();
    } catch (err: unknown) {
      const e = err as { error?: string };
      setError(e?.error ?? "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  // EDIT — update action
  async function handleSaveUpdate() {
    setError(null);
    if (!form.full_name.trim()) { setError("שם מלא הוא שדה חובה"); return; }
    if (!validFrom) { setError("יש להזין תאריך תחילת תוקף"); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        action:      "update",
        full_name:   form.full_name,
        is_active:   form.is_active,
        permissions: isSuperAdmin ? [] : form.permissions,
        valid_from:  validFrom,
        valid_to:    validTo || null,
      };
      if (!isSelf) body.role = form.role;
      await api.put(`/api/admin/users/${state.user!.id}/temporal`, body);
      onSaved();
    } catch (err: unknown) {
      const e = err as { error?: string; detail?: { error?: string } };
      setError(e?.error ?? (e as { detail?: { error?: string } })?.detail?.error ?? "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  // EDIT — close action
  async function handleCloseAction() {
    if (!validTo) { setError("יש להזין תאריך גמר תוקף"); return; }
    setError(null);
    setSaving(true);
    try {
      await api.put(`/api/admin/users/${state.user!.id}/temporal`, { action: "close", valid_to: validTo });
      onSaved();
    } catch (err: unknown) {
      const e = err as { error?: string; detail?: { error?: string } };
      setError(e?.error ?? (e as { detail?: { error?: string } })?.detail?.error ?? "שגיאה בסגירת תקופה");
    } finally {
      setSaving(false);
    }
  }

  // EDIT — delete action
  async function handleDeleteAction() {
    setError(null);
    setSaving(true);
    try {
      await api.delete(`/api/admin/users/${state.user!.id}`);
      onSaved();
    } catch (err: unknown) {
      const e = err as { error?: string };
      setError(e?.error ?? "שגיאה במחיקה");
    } finally {
      setSaving(false);
    }
  }

  // Header color/text for edit modes
  const editHeaderBg =
    userMode === "delete" ? "bg-red-50" :
    userMode === "close"  ? "bg-orange-50" :
    "bg-[#dce4f0]";
  const editHeaderText =
    userMode === "delete" ? "text-red-800" :
    userMode === "close"  ? "text-orange-800" :
    "text-[#1a3a6e]";
  const editModalTitle =
    userMode === "delete" ? "מחיקת משתמש" :
    userMode === "close"  ? "סגירת תקופה — משתמש" :
    "עדכון משתמש";

  const dateCls = "border rounded px-2 py-1 text-xs w-36 focus:outline-none font-mono";

  // ── CREATE modal
  if (!isEdit) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" style={{ direction: "rtl" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-brand-50 rounded-xl"><ShieldCheck size={16} className="text-brand-600" /></div>
              <h2 className="text-sm font-bold text-slate-800">הוספת משתמש חדש</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><X size={16} /></button>
          </div>
          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">שם מלא</label>
                <input type="text" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-right focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-colors"
                  placeholder="ישראל ישראלי" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">דוא״ל</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-right focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-colors"
                  dir="ltr" placeholder="user@example.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">סיסמה ראשונית</label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-right focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-colors"
                    dir="ltr" placeholder="לפחות 8 תווים" />
                  <button type="button" onClick={() => setShowPassword((v) => !v)}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">תפקיד</label>
                <select value={form.role} onChange={(e) => handleRoleChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-right focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-colors">
                  <option value="super_admin">Super Admin</option>
                  <option value="admin">מנהל (Admin)</option>
                  <option value="support">תמיכה (Support)</option>
                  <option value="billing">כספים (Billing)</option>
                </select>
              </div>
            </div>
            {/* Permissions */}
            {!isSuperAdmin && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-700">הרשאות גישה למסכים</h3>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setForm((f) => ({ ...f, permissions: f.permissions.map((p) => ({ ...p, can_view: true, can_edit: true })) }))}
                      className="text-[10px] text-brand-600 hover:underline font-medium">בחר הכל</button>
                    <span className="text-slate-300 text-[10px]">|</span>
                    <button type="button" onClick={() => setForm((f) => ({ ...f, permissions: f.permissions.map((p) => ({ ...p, can_view: false, can_edit: false })) }))}
                      className="text-[10px] text-slate-400 hover:underline font-medium">נקה הכל</button>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="grid grid-cols-[1fr_80px_80px] bg-slate-50 border-b border-slate-200 px-4 py-2">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">מסך</span>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center">צפיה</span>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center">עריכה</span>
                  </div>
                  {RESOURCES.map((r, i) => {
                    const perm = form.permissions.find((p) => p.resource === r.key) ?? { resource: r.key, can_view: false, can_edit: false };
                    return (
                      <div key={r.key} className={`grid grid-cols-[1fr_80px_80px] items-center px-4 py-2.5 border-b border-slate-100 last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                        <span className="text-xs text-slate-700 font-medium">{r.label}</span>
                        <div className="flex justify-center">
                          <button type="button" onClick={() => handlePermChange(r.key, "can_view", !perm.can_view)}
                            className={`rounded-full transition-colors duration-200 relative ${perm.can_view ? "bg-brand-500" : "bg-slate-200"}`} style={{ width: 32, height: 18 }}>
                            <span className={`absolute top-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${perm.can_view ? "translate-x-[14px]" : "translate-x-0.5"}`} style={{ width: 14, height: 14 }} />
                          </button>
                        </div>
                        <div className="flex justify-center">
                          <button type="button" onClick={() => handlePermChange(r.key, "can_edit", !perm.can_edit)}
                            className={`relative rounded-full transition-colors duration-200 ${perm.can_edit ? "bg-emerald-500" : "bg-slate-200"}`} style={{ width: 32, height: 18 }}>
                            <span className={`absolute top-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${perm.can_edit ? "translate-x-[14px]" : "translate-x-0.5"}`} style={{ width: 14, height: 14 }} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-400 mt-2">הפעלת עריכה מפעילה צפיה אוטומטית. כיבוי צפיה מכבה גם עריכה.</p>
              </div>
            )}
            {isSuperAdmin && (
              <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 flex items-start gap-3">
                <ShieldCheck size={15} className="text-violet-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-violet-700">גישה מלאה לכל המסכים</p>
                  <p className="text-[10px] text-violet-500 mt-0.5">Super Admin מקבל גישה מלאה לכל המסכים והפעולות — ללא הגבלות.</p>
                </div>
              </div>
            )}
            {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-xs text-red-600">{error}</div>}
          </div>
          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/60">
            <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">ביטול</button>
            <button onClick={handleCreate} disabled={saving} className="px-5 py-2 text-xs font-semibold text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-60 transition-colors flex items-center gap-2">
              {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              צור משתמש
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── EDIT modal (with split-button)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden" dir="rtl"
           onClick={() => setDropdownOpen(false)}>

        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-3 border-b border-slate-200 rounded-t-lg ${editHeaderBg}`}>
          <h2 className={`text-sm font-bold ${editHeaderText}`}>{editModalTitle}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/60 text-slate-500"><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* DELETE mode */}
          {userMode === "delete" && (
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-300 rounded px-4 py-3 text-xs text-red-800 space-y-1.5">
                <div className="font-bold text-sm">⚠️ מחיקת משתמש — פעולה בלתי הפיכה</div>
                <div>המשתמש <strong>{state.user?.full_name}</strong> ({state.user?.email}) יימחק מהמערכת ומ-Supabase Auth.</div>
                <div className="text-red-600">אם ברצונך רק לסיים את התוקף — השתמש ב<strong>סגור תקופה</strong> במקום.</div>
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">{error}</p>}
            </div>
          )}

          {/* CLOSE mode */}
          {userMode === "close" && (
            <div className="space-y-3">
              <div className="bg-orange-50 border border-orange-200 rounded px-4 py-2 text-xs text-orange-800">
                סגירת תקופת הפעילות של <strong>{state.user?.full_name}</strong> על ידי הגדרת תאריך גמר תוקף.
              </div>
              <div className="flex items-center gap-3 pt-1">
                <label className="text-xs font-semibold text-slate-600 w-28 shrink-0">
                  <span className="text-red-500 ml-0.5">*</span>
                  תוקף עד (אחרון)
                </label>
                <HebrewDatePicker value={validTo} onChange={setValidTo}
                  className={`${dateCls} border-orange-400 bg-orange-50 focus:border-orange-600 font-semibold`} />
                <span className="text-xs text-orange-700">יום אחרון שהמשתמש בתוקף</span>
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">{error}</p>}
            </div>
          )}

          {/* UPDATE mode */}
          {userMode === "update" && (
            <>
              {/* Name + role + active */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">שם מלא</label>
                  <input type="text" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-right focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-colors"
                    placeholder="ישראל ישראלי" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">דוא״ל</label>
                  <input type="email" value={form.email} disabled
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 text-slate-400 text-right"
                    dir="ltr" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">תפקיד</label>
                  <select value={form.role} disabled={isSelf} onChange={(e) => handleRoleChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-right focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-400 transition-colors">
                    <option value="super_admin">Super Admin</option>
                    <option value="admin">מנהל (Admin)</option>
                    <option value="support">תמיכה (Support)</option>
                    <option value="billing">כספים (Billing)</option>
                  </select>
                  {isSelf && <p className="text-[10px] text-amber-600 mt-1">לא ניתן לשנות את התפקיד שלך</p>}
                </div>
                <div className="flex flex-col justify-center">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">סטטוס</label>
                  <button type="button" disabled={isSelf} onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors
                      ${form.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" : "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"}
                      disabled:opacity-50 disabled:cursor-not-allowed`}>
                    {form.is_active ? <UserCheck size={13} /> : <UserX size={13} />}
                    {form.is_active ? "פעיל" : "לא פעיל"}
                  </button>
                </div>
              </div>

              {/* Permissions */}
              {!isSuperAdmin && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-slate-700">הרשאות גישה למסכים</h3>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setForm((f) => ({ ...f, permissions: f.permissions.map((p) => ({ ...p, can_view: true, can_edit: true })) }))}
                        className="text-[10px] text-brand-600 hover:underline font-medium">בחר הכל</button>
                      <span className="text-slate-300 text-[10px]">|</span>
                      <button type="button" onClick={() => setForm((f) => ({ ...f, permissions: f.permissions.map((p) => ({ ...p, can_view: false, can_edit: false })) }))}
                        className="text-[10px] text-slate-400 hover:underline font-medium">נקה הכל</button>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="grid grid-cols-[1fr_80px_80px] bg-slate-50 border-b border-slate-200 px-4 py-2">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">מסך</span>
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center">צפיה</span>
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center">עריכה</span>
                    </div>
                    {RESOURCES.map((r, i) => {
                      const perm = form.permissions.find((p) => p.resource === r.key) ?? { resource: r.key, can_view: false, can_edit: false };
                      return (
                        <div key={r.key} className={`grid grid-cols-[1fr_80px_80px] items-center px-4 py-2.5 border-b border-slate-100 last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                          <span className="text-xs text-slate-700 font-medium">{r.label}</span>
                          <div className="flex justify-center">
                            <button type="button" onClick={() => handlePermChange(r.key, "can_view", !perm.can_view)}
                              className={`rounded-full transition-colors duration-200 relative ${perm.can_view ? "bg-brand-500" : "bg-slate-200"}`} style={{ width: 32, height: 18 }}>
                              <span className={`absolute top-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${perm.can_view ? "translate-x-[14px]" : "translate-x-0.5"}`} style={{ width: 14, height: 14 }} />
                            </button>
                          </div>
                          <div className="flex justify-center">
                            <button type="button" onClick={() => handlePermChange(r.key, "can_edit", !perm.can_edit)}
                              className={`relative rounded-full transition-colors duration-200 ${perm.can_edit ? "bg-emerald-500" : "bg-slate-200"}`} style={{ width: 32, height: 18 }}>
                              <span className={`absolute top-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${perm.can_edit ? "translate-x-[14px]" : "translate-x-0.5"}`} style={{ width: 14, height: 14 }} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">הפעלת עריכה מפעילה צפיה אוטומטית. כיבוי צפיה מכבה גם עריכה.</p>
                </div>
              )}
              {isSuperAdmin && (
                <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 flex items-start gap-3">
                  <ShieldCheck size={15} className="text-violet-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-violet-700">גישה מלאה לכל המסכים</p>
                    <p className="text-[10px] text-violet-500 mt-0.5">Super Admin מקבל גישה מלאה לכל המסכים והפעולות — ללא הגבלות.</p>
                  </div>
                </div>
              )}

              {/* Date fields */}
              <div className="border-t border-slate-200 pt-3 space-y-2">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-semibold text-slate-600 w-28 shrink-0">
                    <span className="text-red-500 ml-0.5">*</span>
                    תוקף מתאריך
                  </label>
                  <HebrewDatePicker value={validFrom} onChange={setValidFrom}
                    className={`${dateCls} border-slate-300 focus:border-blue-400`} />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs font-semibold text-slate-600 w-28 shrink-0">תוקף עד (אופציונלי)</label>
                  <HebrewDatePicker value={validTo} onChange={setValidTo}
                    className={`${dateCls} border-slate-300 focus:border-blue-400`} />
                  {!validTo && <span className="text-xs text-slate-400">ריק = ללא תאריך סיום</span>}
                  {validTo && <span className="text-xs text-blue-600 cursor-pointer hover:underline" onClick={() => setValidTo("")}>✕ נקה</span>}
                </div>
              </div>

              {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">{error}</p>}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-lg">
          {userMode === "delete" ? (
            <>
              <button onClick={() => { setUserMode("update"); setError(null); }}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded text-slate-600 hover:bg-slate-100">
                ← ביטול
              </button>
              <button onClick={handleDeleteAction} disabled={saving}
                className="px-4 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50 font-semibold">
                {saving ? "מוחק..." : "מחק לצמיתות"}
              </button>
            </>
          ) : userMode === "close" ? (
            <>
              <button onClick={() => { setUserMode("update"); setValidTo(toInput(state.user?.valid_to)); setError(null); }}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded text-slate-600 hover:bg-slate-100">
                ← ביטול
              </button>
              <button onClick={handleCloseAction} disabled={saving}
                className="px-4 py-1.5 text-xs bg-orange-600 hover:bg-orange-700 text-white rounded disabled:opacity-50">
                {saving ? "שומר..." : "סגור תקופה"}
              </button>
            </>
          ) : (
            /* UPDATE mode — split button [שמור | ▾] */
            <>
              <button onClick={onClose}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded text-slate-600 hover:bg-slate-100">
                ביטול
              </button>
              <div className="relative flex">
                <button onClick={(e) => { e.stopPropagation(); handleSaveUpdate(); }} disabled={saving}
                  className="px-4 py-1.5 text-xs bg-[#0d6efd] hover:bg-[#0b5ed7] text-white rounded-r transition-colors disabled:opacity-50 border-l border-blue-400">
                  {saving ? "שומר..." : "שמור"}
                </button>
                <button onClick={(e) => { e.stopPropagation(); setDropdownOpen((o) => !o); }} disabled={saving}
                  className="px-2 py-1.5 text-xs bg-[#0d6efd] hover:bg-[#0b5ed7] text-white rounded-l transition-colors disabled:opacity-50">
                  ▾
                </button>
                {dropdownOpen && (
                  <div className="absolute bottom-full left-0 mb-1 bg-white border border-slate-200 rounded shadow-lg z-10 min-w-[160px] text-right">
                    <button onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); handleSaveUpdate(); }}
                      className="w-full px-4 py-2 text-xs text-slate-700 hover:bg-blue-50 text-right block border-b border-slate-100">
                      שמור
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); setValidTo(""); setError(null); setUserMode("close"); }}
                      className="w-full px-4 py-2 text-xs text-orange-700 hover:bg-orange-50 text-right block border-b border-slate-100 font-medium">
                      סגור תקופה
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); setError(null); setUserMode("delete"); }}
                      className="w-full px-4 py-2 text-xs text-red-700 hover:bg-red-50 text-right block font-medium">
                      מחק משתמש
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm ─────────────────────────────────────────────────────────

function DeleteConfirm({
  user,
  onClose,
  onDeleted,
}: {
  user: AdminUser;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await api.delete(`/api/admin/users/${user.id}`);
      onDeleted();
    } catch (err: unknown) {
      const e = err as { error?: string };
      setError(e?.error ?? "שגיאה במחיקה");
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
        style={{ direction: "rtl" }}
      >
        <h2 className="text-sm font-bold text-slate-800 mb-2">מחיקת משתמש</h2>
        <p className="text-xs text-slate-500 mb-1">
          האם למחוק את <span className="font-semibold text-slate-700">{user.full_name}</span>?
        </p>
        <p className="text-[10px] text-slate-400 mb-5">
          הפעולה תמחק את המשתמש מהמערכת ומ-Supabase Auth ולא ניתן לבטל אותה.
        </p>
        {error && (
          <p className="text-xs text-red-600 mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            ביטול
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 text-xs font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600
                       disabled:opacity-60 transition-colors flex items-center gap-2"
          >
            {deleting && (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            מחק
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const currentUser = getStoredUser();
  const currentUserId = currentUser?.id ?? "";

  function loadUsers() {
    setLoading(true);
    api.get<AdminUser[]>("/api/admin/users")
      .then(setUsers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    loadUsers();
  }, [router]);

  const filtered = users.filter((u) =>
    u.full_name.includes(search) || u.email.includes(search) || u.role.includes(search)
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <TopNav />

      <main className="flex-1 overflow-hidden flex flex-col">
        <AdminTitleBar title="משתמשי מערכת" onRefresh={loadUsers} />

        <AdminActionBar
          start={<AdminSearchField value={search} onChange={setSearch} />}
          end={
            <div className="flex items-center gap-3">
            {!loading && <AdminCountLabel>{filtered.length} משתמשים</AdminCountLabel>}
            <button
              onClick={() => setModal({ mode: "create" })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white
                         bg-brand-500 hover:bg-brand-600 rounded-lg transition-colors"
            >
              <UserPlus size={13} />
              הוסף משתמש
            </button>
          </div>
          }
        />

        {/* ── Table ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto bg-white min-h-0">
          {loading ? (
            <div className="py-20 flex flex-col items-center gap-3 text-slate-400">
              <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">טוען...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-sm">לא נמצאו משתמשים</div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">שם</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">דוא״ל</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">תפקיד</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">הרשאות</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">כניסה אחרונה</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">תוקף מ</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">תוקף עד</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">סטטוס</th>
                  <th className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 w-20" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => {
                  const activePerms = (u.permissions ?? []).filter((p) => p.can_view || p.can_edit);
                  return (
                    <tr
                      key={u.id}
                      className={`transition-colors group
                        ${i % 2 === 0 ? "bg-white hover:bg-brand-50/40" : "bg-slate-50/60 hover:bg-brand-50/40"}`}
                    >
                      <td className="px-4 py-2 border-b border-slate-100 text-slate-800 font-medium">
                        <div className="flex items-center gap-2">
                          {u.id === currentUserId && (
                            <span className="text-[9px] font-bold text-brand-600 bg-brand-50 border border-brand-200 rounded px-1.5 py-0.5 shrink-0">
                              אתה
                            </span>
                          )}
                          {u.full_name}
                        </div>
                      </td>
                      <td className="px-4 py-2 border-b border-slate-100 text-slate-500 direction-ltr">{u.email}</td>
                      <td className="px-4 py-2 border-b border-slate-100">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_STYLE[u.role] ?? "bg-slate-100 text-slate-600"}`}>
                          {ROLE_LABEL[u.role] ?? u.role}
                        </span>
                      </td>
                      <td className="px-4 py-2 border-b border-slate-100">
                        {u.role === "super_admin" ? (
                          <span className="text-[10px] text-violet-600 font-medium flex items-center gap-1">
                            <ShieldCheck size={11} /> הכל
                          </span>
                        ) : activePerms.length === 0 ? (
                          <span className="text-[10px] text-slate-400">ללא גישה</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {activePerms.slice(0, 3).map((p) => {
                              const label = RESOURCES.find((r) => r.key === p.resource)?.label ?? p.resource;
                              return (
                                <span key={p.resource}
                                  className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                                    p.can_edit
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-slate-100 text-slate-500"
                                  }`}
                                  title={p.can_edit ? "צפיה + עריכה" : "צפיה בלבד"}
                                >
                                  {label}
                                </span>
                              );
                            })}
                            {activePerms.length > 3 && (
                              <span className="text-[9px] text-slate-400">+{activePerms.length - 3}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 border-b border-slate-100 text-slate-500">
                        {u.last_login_at
                          ? new Date(u.last_login_at).toLocaleString("he-IL")
                          : "לא נכנס"}
                      </td>
                      <td className="px-4 py-2 border-b border-slate-100 text-slate-500 whitespace-nowrap">
                        {fmtDate(u.valid_from)}
                      </td>
                      <td className="px-4 py-2 border-b border-slate-100 whitespace-nowrap">
                        {u.valid_to ? (
                          <span className="text-slate-500">{fmtDate(u.valid_to)}</span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-700">פעיל</span>
                        )}
                      </td>
                      <td className="px-4 py-2 border-b border-slate-100">
                        {u.is_active ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700">
                            <UserCheck size={10} />פעיל
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-50 text-red-600">
                            <UserX size={10} />לא פעיל
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 border-b border-slate-100">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            title="עריכה"
                            onClick={() => setModal({ mode: "edit", user: u })}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                          >
                            <Pencil size={12} />
                          </button>
                          {u.id !== currentUserId && (
                            <button
                              title="מחק"
                              onClick={() => setDeleteTarget(u)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {!loading && <AdminStatusBar total={filtered.length} label="משתמשים" />}
      </main>

      {/* Modals */}
      {modal && (
        <UserModal
          state={modal}
          currentUserId={currentUserId}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); loadUsers(); }}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          user={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => { setDeleteTarget(null); loadUsers(); }}
        />
      )}
    </div>
  );
}
