"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, getStoredUser, api, canEdit, canView, type UserInfo } from "@/lib/api";
import { TopNav } from "@/components/layout/TopNav";
import { AdminTitleBar } from "@/components/layout/AdminShell";
import {
  Building2, Package, Users, Activity,
  TrendingUp, ChevronLeft, Clock,
} from "lucide-react";

interface Stats {
  active_tenants: number;
  total_modules: number;
  admin_users: number;
}

interface AuditLogItem {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  actor_name?: string | null;
  actor_email?: string | null;
  created_at: string;
}

const roleLabel: Record<string, string> = {
  super_admin: "Super Admin",
  admin:       "מנהל מערכת",
  support:     "תמיכה",
  billing:     "כספים",
};

/* ── KPI card ── */
function KpiCard({
  label, value, icon: Icon, accent, sub,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  accent: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${accent} shrink-0`}>
          <Icon size={15} className="text-white" />
        </div>
        {sub && (
          <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
            {sub}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900 leading-none mb-1">{value}</p>
      <p className="text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}

/* ── Quick action row ── */
function QuickAction({
  href, label, icon: Icon, desc,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  desc: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-200
                 bg-white hover:border-brand-200 hover:bg-brand-50/50 transition-all duration-150 group"
    >
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 rounded-md bg-slate-100 group-hover:bg-brand-100 transition-colors shrink-0">
          <Icon size={13} className="text-slate-500 group-hover:text-brand-600 transition-colors" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-700 group-hover:text-brand-700 transition-colors leading-tight">
            {label}
          </p>
          <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{desc}</p>
        </div>
      </div>
      <ChevronLeft size={13} className="text-slate-300 group-hover:text-brand-400 transition-colors shrink-0" />
    </a>
  );
}

/* ── Page ── */
export default function DashboardPage() {
  const router = useRouter();
  const [user,  setUser]  = useState<UserInfo | null>(null);
  const [stats, setStats] = useState<Stats>({ active_tenants: 0, total_modules: 0, admin_users: 0 });
  const [auditRows, setAuditRows] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toLocaleDateString("he-IL", {
    weekday: "long",
    year:    "numeric",
    month:   "long",
    day:     "numeric",
  });

  function loadStats() {
    const nextUser = getStoredUser();
    if (nextUser) setUser(nextUser);

    const requests: Promise<unknown>[] = [
      canView("tenants") ? api.get<unknown[]>("/api/admin/tenants") : Promise.resolve([]),
      canView("modules") ? api.get<unknown[]>("/api/admin/modules") : Promise.resolve([]),
      canView("users") ? api.get<unknown[]>("/api/admin/users") : Promise.resolve([]),
      canView("audit") ? api.get<AuditLogItem[]>("/api/admin/audit?limit=5") : Promise.resolve([]),
    ];

    setLoading(true);
    Promise.all(requests)
      .then(([tenants, modules, users, audit]) => {
        setStats({
          active_tenants: Array.isArray(tenants) ? tenants.length : 0,
          total_modules:  Array.isArray(modules) ? modules.length : 0,
          admin_users:    Array.isArray(users)   ? users.length   : 0,
        });
        setAuditRows(Array.isArray(audit) ? audit : []);
      })
      .catch(() => {
        setAuditRows([]);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    setUser(getStoredUser());
    loadStats();
  }, [router]);

  // Show spinner while loading user from localStorage (avoids blank page)
  if (!user && loading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <TopNav />
        <main className="flex-1 flex items-center justify-center">
          <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  // User not found after load → redirect handled by useEffect, show nothing
  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <TopNav />

      {/* ── Title Bar ── */}
      <AdminTitleBar
        title={`שלום, ${user.full_name.split(" ")[0]}`}
        onRefresh={loadStats}
        utilitySlot={
          <span className="mr-2 text-[10px] text-slate-400">{today}</span>
        }
      />

      {/* ── Main ── */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-screen-lg px-4 py-5 space-y-5">

          {/* KPI row */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={13} className="text-slate-400" />
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">סקירה כללית</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <KpiCard label="ארגונים פעילים" value={loading ? "—" : stats.active_tenants} icon={Building2} accent="bg-brand-500" sub="פעיל" />
              <KpiCard label="מודולים במערכת"  value={loading ? "—" : stats.total_modules}  icon={Package}   accent="bg-violet-500" />
              <KpiCard label="משתמשי מנהל"     value={loading ? "—" : stats.admin_users}    icon={Users}     accent="bg-sky-500" />
            </div>
          </section>

          {/* Bottom grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Quick actions */}
            <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                <h3 className="text-xs font-semibold text-slate-700">פעולות מהירות</h3>
              </div>
              <div className="p-3 space-y-2">
                {canEdit("tenants") && <QuickAction href="/admin/tenants/new" label="ארגון חדש" desc="הוספת לקוח חדש למערכת" icon={Building2} />}
                {canView("users") && <QuickAction href="/admin/users" label="ניהול משתמשים" desc="הרשאות ומשתמשי מנהל" icon={Users} />}
                {canView("modules") && <QuickAction href="/admin/modules" label="מודולים ומחירון" desc="הגדרות פרייסינג" icon={Package} />}
                {!canEdit("tenants") && !canView("users") && !canView("modules") && (
                  <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
                    אין כרגע פעולות מהירות זמינות לפי ההרשאות שלך.
                  </div>
                )}
              </div>
            </section>

            {/* Activity log */}
            <section className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  <h3 className="text-xs font-semibold text-slate-700">פעילות אחרונה</h3>
                </div>
                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Clock size={10} />היום
                </span>
              </div>

              {/* Table head */}
              <div className="grid grid-cols-3 px-4 py-2 bg-slate-50 border-b border-slate-100">
                {["פעולה", "משתמש", "תאריך"].map((h) => (
                  <span key={h} className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    {h}
                  </span>
                ))}
              </div>

              {auditRows.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center mb-2.5">
                    <Activity size={16} className="text-slate-400" />
                  </div>
                  <p className="text-xs font-medium text-slate-500">
                    {canView("audit") ? "אין פעילות אחרונה" : "אין גישה ללוג פעילות"}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {canView("audit") ? "פעולות במערכת יופיעו כאן" : "בקש הרשאת Audit כדי לראות פעולות מערכת"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {auditRows.map((row) => (
                    <div key={row.id} className="grid grid-cols-3 px-4 py-2.5 text-xs">
                      <span className="font-medium text-slate-700">{row.action} / {row.entity_type}</span>
                      <span className="text-slate-500">{row.actor_name || row.actor_email || row.actor_id || "—"}</span>
                      <span className="text-slate-400">{new Date(row.created_at).toLocaleString("he-IL")}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

          </div>

          {/* Role badge */}
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-3 py-1.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">תפקיד</span>
              <span className="text-xs font-semibold text-brand-600">{roleLabel[user.role] ?? user.role}</span>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
