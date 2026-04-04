"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Building2,
  ChevronDown,
  ClipboardList,
  FileText,
  Home,
  List,
  LogOut,
  Menu,
  Package,
  Receipt,
  Search,
  Settings,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { api, canView, getStoredUser, logout, type UserInfo } from "@/lib/api";
import { Logo } from "./Logo";

interface Module {
  slug: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}

const ADMIN_LINKS = [
  { href: "/admin/tenants", label: "ארגונים", icon: Building2 },
  { href: "/admin/lookups", label: "רשימות", icon: List },
  { href: "/admin/modules", label: "מודולים", icon: Package },
  { href: "/admin/billing", label: "חיובים", icon: Receipt },
  { href: "/admin/users", label: "משתמשים", icon: Users },
  { href: "/admin/templates", label: "תבניות", icon: FileText },
  { href: "/admin/audit", label: "Audit", icon: ClipboardList },
];

const RESOURCE_FOR_LINK: Record<string, string> = {
  "/admin/tenants": "tenants",
  "/admin/lookups": "lookups",
  "/admin/modules": "modules",
  "/admin/billing": "billing",
  "/admin/users": "users",
  "/admin/templates": "templates",
  "/admin/audit": "audit",
};

const ADMIN_ROLES = ["super_admin", "admin", "support", "billing"];

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white select-none"
      style={{ background: "linear-gradient(135deg, #00A896 0%, #008a7b 100%)" }}
    >
      {initials}
    </div>
  );
}

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [adminOpen, setAdminOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    api
      .get<Module[]>("/api/admin/modules")
      .then((data) =>
        setModules(
          data
            .filter((module) => module.is_active)
            .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
        ),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setAdminOpen(false);
        setUserOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAdminOpen(false);
        setUserOpen(false);
        setMobileOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    setAdminOpen(false);
    setUserOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  function handleLogout() {
    logout();
    router.push("/login");
  }

  const isAdmin = Boolean(user && ADMIN_ROLES.includes(user.role));

  const adminItems = useMemo<NavItem[]>(() => {
    if (!isAdmin) return [];

    return ADMIN_LINKS.filter(({ href }) => {
      if (user?.role === "super_admin") return true;
      const resource = RESOURCE_FOR_LINK[href];
      return resource ? canView(resource) : false;
    }).map(({ href, label, icon }) => ({
      href,
      label,
      icon,
      active: Boolean(pathname?.startsWith(href)),
    }));
  }, [isAdmin, pathname, user?.role]);

  const moduleItems = useMemo<NavItem[]>(
    () =>
      modules.map((module) => ({
        href: `/modules/${module.slug}`,
        label: module.name,
        icon: Package,
        active: Boolean(pathname?.startsWith(`/modules/${module.slug}`)),
      })),
    [modules, pathname],
  );

  return (
    <header ref={rootRef} className="sticky top-0 z-40 border-b border-slate-200 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <div className="bg-navy-500">
        <div className="flex h-[52px] items-center gap-3 px-3 sm:px-5">
          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white transition hover:bg-white/10 md:hidden"
            aria-label="פתח תפריט"
          >
            {mobileOpen ? <X size={17} /> : <Menu size={17} />}
          </button>

          <div className="shrink-0">
            <Logo href="/dashboard" size="sm" variant="light" />
          </div>

          <div className="hidden flex-1 justify-center md:flex">
            <button
              type="button"
              className="flex h-9 w-full max-w-[430px] items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-right transition hover:bg-white/10"
            >
              <Search size={14} className="shrink-0 text-navy-300" />
              <span className="truncate text-sm text-navy-100">חיפוש לקוחות, מסמכים ומודולים</span>
            </button>
          </div>

          <div className="mr-auto flex items-center gap-1.5">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-navy-200 transition hover:bg-white/10 hover:text-white md:hidden"
              title="חיפוש"
            >
              <Search size={16} />
            </button>

            <button
              type="button"
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-navy-200 transition hover:bg-white/10 hover:text-white"
              title="התראות"
            >
              <Bell size={15} />
              <span className="absolute left-[10px] top-[9px] h-2 w-2 rounded-full bg-brand-400" />
            </button>

            {user && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserOpen((value) => !value)}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 transition hover:bg-white/10"
                >
                  <UserAvatar name={user.full_name} />
                  <div className="hidden text-right sm:block">
                    <div className="max-w-[120px] truncate text-sm font-medium text-white">{user.full_name}</div>
                  </div>
                  <ChevronDown size={13} className={`text-navy-300 transition-transform ${userOpen ? "rotate-180" : ""}`} />
                </button>

                {userOpen && (
                  <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_44px_-24px_rgba(15,23,42,0.4)]">
                    <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                      <div className="text-sm font-semibold text-slate-900">{user.full_name}</div>
                      <div className="mt-1 truncate text-xs text-slate-500">{user.email}</div>
                    </div>
                    <div className="p-2">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                      >
                        <LogOut size={14} />
                        יציאה מהמערכת
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="hidden bg-white md:block">
        <div className="flex h-[46px] items-center gap-3 px-4 lg:px-5">
          <div className="flex shrink-0 items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            <Settings size={12} className="text-brand-600" />
            workspace
          </div>

          <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scrollbar-none">
            <DesktopLink href="/dashboard" label="ראשי" icon={Home} active={pathname === "/dashboard"} />
            {moduleItems.map((item) => (
              <DesktopLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={item.active}
              />
            ))}
          </nav>

          {isAdmin && adminItems.length > 0 && (
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setAdminOpen((value) => !value)}
                className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition ${
                  adminOpen || pathname?.startsWith("/admin/")
                    ? "border-brand-100 bg-brand-50 text-brand-700"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Settings size={14} />
                ניהול
                <ChevronDown size={13} className={`transition-transform ${adminOpen ? "rotate-180" : ""}`} />
              </button>

              {adminOpen && (
                <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_44px_-24px_rgba(15,23,42,0.35)]">
                  <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500">
                    ניהול מערכת
                  </div>
                  <div className="p-2">
                    {adminItems.map((item) => (
                      <CompactMenuLink key={item.href} item={item} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden">
          <button
            type="button"
            className="fixed inset-0 top-[52px] z-40 bg-slate-950/35"
            aria-label="סגור תפריט"
            onClick={() => setMobileOpen(false)}
          />

          <div className="fixed right-0 top-[52px] z-50 h-[calc(100vh-52px)] w-full max-w-sm overflow-y-auto border-l border-slate-200 bg-white shadow-[0_18px_50px_-18px_rgba(15,23,42,0.3)]">
            <div className="border-b border-slate-200 px-4 py-4">
              <div className="text-lg font-bold text-navy-700">ניווט מהיר</div>
              <div className="mt-1 text-sm text-slate-500">כל האזורים הראשיים זמינים ישירות גם במובייל.</div>
            </div>

            <div className="space-y-5 p-4">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">ראשי</div>
                <MobileLink href="/dashboard" label="ראשי" icon={Home} active={pathname === "/dashboard"} />
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">מודולים</div>
                <div className="space-y-1.5">
                  {moduleItems.length > 0 ? (
                    moduleItems.map((item) => <MobileLink key={item.href} {...item} />)
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-400">
                      אין כרגע מודולים פעילים להצגה.
                    </div>
                  )}
                </div>
              </div>

              {isAdmin && adminItems.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">ניהול</div>
                  <div className="space-y-1.5">
                    {adminItems.map((item) => <MobileLink key={item.href} {...item} />)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function DesktopLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm whitespace-nowrap transition ${
        active
          ? "border-brand-100 bg-brand-50 text-brand-700"
          : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      <Icon size={14} className={active ? "text-brand-600" : "text-slate-400 group-hover:text-slate-600"} />
      <span className="font-medium">{label}</span>
    </Link>
  );
}

function CompactMenuLink({ item }: { item: NavItem }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition ${
        item.active ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      <Icon size={14} className={item.active ? "text-brand-600" : "text-slate-400"} />
      <span className="font-medium">{item.label}</span>
    </Link>
  );
}

function MobileLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition ${
        active
          ? "border-brand-100 bg-brand-50 text-brand-700"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      <Icon size={15} className={active ? "text-brand-600" : "text-slate-400"} />
      <span className="font-medium">{label}</span>
    </Link>
  );
}
