"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LogOut, Bell, ChevronDown, Building2, Package,
  Users, FileText, ClipboardList, Settings, Search, List, Receipt,
} from "lucide-react";
import { api, logout, getStoredUser, canView, type UserInfo } from "@/lib/api";
import { Logo } from "./Logo";

interface Module {
  slug: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

const ADMIN_LINKS = [
  { href: "/admin/tenants",   label: "ניהול ארגונים",         icon: Building2 },
  { href: "/admin/lookups",   label: "ניהול רשימות ארגוניות", icon: List },
  { href: "/admin/modules",   label: "מודולים ומחירון",        icon: Package },
  { href: "/admin/billing",   label: "חיובים וחשבוניות",       icon: Receipt },
  { href: "/admin/users",     label: "משתמשי מערכת",          icon: Users },
  { href: "/admin/templates", label: "תבניות הקמה",            icon: FileText },
  { href: "/admin/audit",     label: "Audit Log",              icon: ClipboardList },
];

// Resource slug → TopNav link mapping
const RESOURCE_FOR_LINK: Record<string, string> = {
  "/admin/tenants":   "tenants",
  "/admin/lookups":   "lookups",
  "/admin/modules":   "modules",
  "/admin/billing":   "billing",
  "/admin/users":     "users",
  "/admin/templates": "templates",
  "/admin/audit":     "audit",
};

const ADMIN_ROLES = ["super_admin", "admin", "support", "billing"];

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white select-none shrink-0"
      style={{ background: "linear-gradient(135deg, #00A896 0%, #008a7b 100%)" }}
    >
      {initials}
    </div>
  );
}

export function TopNav() {
  const router   = useRouter();
  const pathname = usePathname();
  const [user, setUser]           = useState<UserInfo | null>(null);
  const [modules, setModules]     = useState<Module[]>([]);
  const [adminOpen, setAdminOpen] = useState(false);
  const [userOpen,  setUserOpen]  = useState(false);
  const adminRef = useRef<HTMLDivElement>(null);
  const userRef  = useRef<HTMLDivElement>(null);

  useEffect(() => { setUser(getStoredUser()); }, []);

  useEffect(() => {
    api
      .get<Module[]>("/api/admin/modules")
      .then((data) => setModules(data.filter((m) => m.is_active)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (adminRef.current && !adminRef.current.contains(e.target as Node)) setAdminOpen(false);
      if (userRef.current  && !userRef.current.contains(e.target as Node))  setUserOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  function handleLogout() {
    logout();
    router.push("/login");
  }

  const isAdmin = user && ADMIN_ROLES.includes(user.role);

  return (
    <header className="sticky top-0 z-40">

      {/* ══════════════════════════════════════════
          ROW 1 — Dark top bar
      ══════════════════════════════════════════ */}
      <div className="bg-navy-500 h-[48px] flex items-center px-5 gap-4">

        {/* Right: Logo */}
        <div className="shrink-0">
          <Logo href="/dashboard" size="sm" variant="light" />
        </div>

        {/* Center: Search bar */}
        <div className="flex-1 flex justify-center">
          <div className="hidden md:flex items-center gap-2 bg-navy-600 border border-navy-400 rounded-lg px-3 h-[32px] w-full max-w-[420px] text-sm text-navy-200 cursor-text hover:border-navy-300 transition-colors">
            <Search size={13} className="text-navy-300 shrink-0" />
            <span className="text-navy-300 text-[13px] select-none">חיפוש לקוחות, מסמכים ועוד…</span>
          </div>
        </div>

        {/* Left: Bell + User */}
        <div className="flex items-center gap-1 shrink-0">

          {/* Notification bell */}
          <button
            className="relative p-2 rounded-md text-navy-300 hover:text-white hover:bg-navy-600 transition-colors duration-150"
            title="התראות"
          >
            <Bell size={15} />
          </button>

          {/* Divider */}
          <div className="h-4 w-px bg-navy-400 mx-1" />

          {/* User dropdown */}
          {user && (
            <div className="relative" ref={userRef}>
              <button
                onClick={() => setUserOpen((v) => !v)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-navy-600 transition-colors duration-150"
              >
                <UserAvatar name={user.full_name} />
                <div className="hidden sm:block text-right leading-snug">
                  <p className="text-[13px] font-semibold text-white truncate max-w-[110px] leading-tight">
                    {user.full_name}
                  </p>
                  <p className="text-[10px] text-navy-300 truncate max-w-[110px] leading-tight">
                    {user.email}
                  </p>
                </div>
                <ChevronDown
                  size={12}
                  className={`text-navy-300 transition-transform duration-200 ${userOpen ? "rotate-180" : ""}`}
                />
              </button>

              {userOpen && (
                <div
                  className="absolute left-0 mt-1.5 w-56 rounded-xl bg-white border border-slate-200 overflow-hidden z-50"
                  style={{ boxShadow: "0 8px 28px -4px rgb(0 0 0 / 0.18), 0 4px 8px -4px rgb(0 0 0 / 0.08)" }}
                >
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                    <p className="text-sm font-semibold text-slate-800 leading-tight">{user.full_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{user.email}</p>
                  </div>
                  <div className="p-1.5">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                                 text-red-600 hover:bg-red-50 transition-colors duration-100"
                    >
                      <LogOut size={14} className="shrink-0" />
                      יציאה מהמערכת
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          ROW 2 — White module navigation bar
      ══════════════════════════════════════════ */}
      <div
        className="bg-white border-b border-slate-200 h-[44px] flex items-center px-5 gap-3"
        style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.05)" }}
      >
        {/* Right: Company badge */}
        <div className="flex items-center gap-3 shrink-0">
          <span
            className="text-[11px] font-bold text-white px-2.5 py-1 rounded-md tracking-wide uppercase select-none"
            style={{ background: "linear-gradient(135deg, #00A896 0%, #006b60 100%)" }}
          >
            dng hub
          </span>
          <div className="h-5 w-px bg-slate-200" />
        </div>

        {/* Center: Module tabs (scrollable on small screens) */}
        <nav className="hidden md:flex items-center flex-1 overflow-x-auto scrollbar-none min-w-0">
          <ModuleTab
            href="/dashboard"
            label="ראשי"
            active={pathname === "/dashboard"}
          />
          {modules.map((m) => (
            <ModuleTab
              key={m.slug}
              href={`/modules/${m.slug}`}
              label={m.name}
              active={!!pathname?.startsWith(`/modules/${m.slug}`)}
            />
          ))}
        </nav>

        {/* Left: Admin dropdown + search icon */}
        <div className="flex items-center gap-1 shrink-0 mr-auto">

          {isAdmin && (
            <div className="relative" ref={adminRef}>
              <button
                onClick={() => setAdminOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 h-[30px] rounded-md text-[13px] font-medium
                            transition-colors duration-150 ${
                              adminOpen
                                ? "text-brand-600 bg-brand-50"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                            }`}
              >
                <Settings size={13} className="shrink-0" />
                <span>ניהול</span>
                <ChevronDown
                  size={11}
                  className={`transition-transform duration-200 ${adminOpen ? "rotate-180" : ""}`}
                />
              </button>

              {adminOpen && (
                <div
                  className="absolute left-0 mt-1 w-56 rounded-xl bg-white border border-slate-200 overflow-hidden z-50"
                  style={{ boxShadow: "0 8px 28px -4px rgb(0 0 0 / 0.12), 0 4px 8px -4px rgb(0 0 0 / 0.06)" }}
                >
                  <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                      ניהול מערכת
                    </p>
                  </div>
                  <div className="py-1.5 px-1.5">
                    {ADMIN_LINKS.filter(({ href }) => {
                      if (user?.role === "super_admin") return true;
                      const resource = RESOURCE_FOR_LINK[href];
                      return resource ? canView(resource) : false;
                    }).map(({ href, label, icon: Icon }) => {
                      const isActive = !!pathname?.startsWith(href);
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setAdminOpen(false)}
                          className={`flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm
                                      transition-colors duration-100 ${
                                        isActive
                                          ? "text-brand-700 bg-brand-50"
                                          : "text-slate-700 hover:bg-slate-50"
                                      }`}
                        >
                          <div
                            className={`p-1.5 rounded-md shrink-0 ${
                              isActive ? "bg-brand-100" : "bg-slate-100"
                            }`}
                          >
                            <Icon
                              size={13}
                              className={isActive ? "text-brand-600" : "text-slate-500"}
                            />
                          </div>
                          <span className="font-medium">{label}</span>
                          {isActive && (
                            <div className="mr-auto w-1.5 h-1.5 rounded-full bg-brand-500" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            className="p-2 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors duration-150"
            title="חיפוש"
          >
            <Search size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}

/* ── Helper: single module tab ── */
function ModuleTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`relative flex items-center h-[44px] px-3.5 text-[13px] font-medium whitespace-nowrap
                  transition-colors duration-150 border-b-2 -mb-px ${
                    active
                      ? "text-brand-600 border-brand-500"
                      : "text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300"
                  }`}
    >
      {label}
    </Link>
  );
}
