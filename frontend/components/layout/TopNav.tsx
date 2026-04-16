"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Ban,
  BarChart3,
  Bell,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  Home,
  List,
  LogOut,
  Menu,
  Package,
  Quote,
  Receipt,
  Search,
  Settings,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { api, canView, getStoredUser, logout, type UserInfo } from "@/lib/api";
import { Logo } from "./Logo";
import { useWorkspace } from "./WorkspaceShell";

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

const BILLING_SUB_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin/billing/overview", label: "סקירה", icon: BarChart3 },
  { href: "/admin/billing/quotes", label: "הצעות מחיר", icon: Quote },
  { href: "/admin/billing/charges", label: "חיובים", icon: Wallet },
  { href: "/admin/billing/invoices", label: "חשבוניות", icon: FileText },
  { href: "/admin/billing/settings", label: "הגדרות מנפיק", icon: Ban },
];

const ADMIN_ROLES = ["super_admin", "admin", "support", "billing"];

function UserAvatar({ name }: { name: string | null | undefined }) {
  const initials = (name || "")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white select-none"
      style={{ background: "linear-gradient(135deg, #00A896 0%, #008a7b 100%)" }}
    >
      {initials}
    </div>
  );
}

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const workspace = useWorkspace();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [adminOpen, setAdminOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
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
        setBillingOpen(false);
        setUserOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAdminOpen(false);
        setBillingOpen(false);
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
    setBillingOpen(false);
    setUserOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  function handleLogout() {
    logout();
    router.push("/login");
  }

  function navigateTo(href: string) {
    setAdminOpen(false);
    setBillingOpen(false);
    setUserOpen(false);
    setMobileOpen(false);

    if (workspace) {
      workspace.navigateTo(href);
      return;
    }

    router.push(href);
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
    <header
      ref={rootRef}
      className="sticky top-0 z-40 bg-white border-b border-slate-200"
      style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}
    >
      {/* ── Single unified bar ── */}
      <div className="flex h-[52px] items-center gap-0 px-0">

        {/* Logo zone */}
        <div className="flex h-full shrink-0 items-center border-l border-slate-100 px-4">
          <Logo href="/dashboard" size="sm" variant="dark" />
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="mr-1 inline-flex h-8 w-8 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 md:hidden"
          aria-label="פתח תפריט"
        >
          {mobileOpen ? <X size={16} /> : <Menu size={16} />}
        </button>

        {/* ── Desktop nav tabs ── */}
        <nav className="hidden h-full min-w-0 flex-1 items-center overflow-x-auto md:flex" style={{ scrollbarWidth: "none" }}>
          <PriorityTab href="/dashboard" label="ראשי" active={pathname === "/dashboard"} onNavigate={navigateTo} />
          {moduleItems.map((item) => (
            <PriorityTab key={item.href} href={item.href} label={item.label} active={item.active} onNavigate={navigateTo} />
          ))}
        </nav>

        {/* Right-side actions */}
        <div className="flex h-full shrink-0 items-center gap-1 px-3">

          {/* Search */}
          <button
            type="button"
            className="hidden h-8 items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 text-right text-xs text-slate-400 transition hover:border-slate-300 hover:bg-white md:flex"
            style={{ minWidth: 200 }}
          >
            <Search size={12} className="shrink-0" />
            <span>חיפוש...</span>
          </button>

          {/* Mobile search */}
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 md:hidden"
          >
            <Search size={15} />
          </button>

          {/* Bell */}
          <button
            type="button"
            className="relative inline-flex h-8 w-8 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100"
            title="התראות"
          >
            <Bell size={15} />
            <span className="absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand-500" />
          </button>

          {/* Admin dropdown */}
          {isAdmin && adminItems.length > 0 && (
            <div className="relative hidden md:block">
              <button
                type="button"
                onClick={() => setAdminOpen((v) => !v)}
                className={`flex h-8 items-center gap-1 rounded px-2.5 text-xs font-medium transition ${
                  adminOpen || pathname?.startsWith("/admin/")
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                }`}
              >
                <Settings size={13} />
                ניהול
                <ChevronDown size={11} className={`transition-transform ${adminOpen ? "rotate-180" : ""}`} />
              </button>

              {adminOpen && (
                <div className="absolute left-0 top-[calc(100%+4px)] z-50 min-w-[180px] overflow-visible rounded border border-slate-200 bg-white shadow-lg">
                  <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    ניהול מערכת
                  </div>
                  <div className="py-1">
                    {adminItems.map((item) =>
                      item.href === "/admin/billing" ? (
                        <BillingMenuGroup
                          key={item.href}
                          item={item}
                          open={billingOpen}
                          onToggle={() => setBillingOpen((v) => !v)}
                          pathname={pathname}
                          onNavigate={navigateTo}
                        />
                      ) : (
                        <AdminMenuLink key={item.href} item={item} onNavigate={navigateTo} />
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="mx-1 h-5 w-px bg-slate-200" />

          {/* User */}
          {user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded px-1.5 py-1 text-xs transition hover:bg-slate-100"
              >
                <UserAvatar name={user.full_name} />
                <span className="hidden max-w-[100px] truncate font-medium text-slate-700 sm:block">
                  {user.full_name}
                </span>
                <ChevronDown size={11} className={`text-slate-400 transition-transform ${userOpen ? "rotate-180" : ""}`} />
              </button>

              {userOpen && (
                <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-52 overflow-hidden rounded border border-slate-200 bg-white shadow-lg">
                  <div className="border-b border-slate-100 bg-slate-50 px-3 py-2.5">
                    <div className="text-xs font-semibold text-slate-800">{user.full_name}</div>
                    <div className="mt-0.5 truncate text-[11px] text-slate-400">{user.email}</div>
                  </div>
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    >
                      <LogOut size={13} />
                      יציאה מהמערכת
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="md:hidden">
          <button
            type="button"
            className="fixed inset-0 top-[52px] z-40 bg-slate-900/20"
            aria-label="סגור תפריט"
            onClick={() => setMobileOpen(false)}
          />

          <div className="fixed right-0 top-[52px] z-50 h-[calc(100vh-52px)] w-full max-w-xs overflow-y-auto border-l border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="text-sm font-semibold text-slate-700">ניווט</div>
            </div>

            <div className="space-y-4 p-4">
              <div>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">ראשי</div>
                <MobileLink href="/dashboard" label="ראשי" icon={Home} active={pathname === "/dashboard"} onNavigate={navigateTo} />
              </div>

              {moduleItems.length > 0 && (
                <div>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">מודולים</div>
                  <div className="space-y-0.5">
                    {moduleItems.map((item) => <MobileLink key={item.href} {...item} onNavigate={navigateTo} />)}
                  </div>
                </div>
              )}

              {isAdmin && adminItems.length > 0 && (
                <div>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">ניהול</div>
                  <div className="space-y-0.5">
                    {adminItems.map((item) =>
                      item.href === "/admin/billing" ? (
                        <MobileBillingGroup
                          key={item.href}
                          item={item}
                          open={billingOpen}
                          onToggle={() => setBillingOpen((v) => !v)}
                          pathname={pathname}
                          onNavigate={navigateTo}
                        />
                      ) : (
                        <MobileLink key={item.href} {...item} onNavigate={navigateTo} />
                      )
                    )}
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

/** Priority-style flat tab with bottom-border active indicator */
function PriorityTab({
  href,
  label,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  onNavigate: (href: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(href)}
      className={`relative flex h-full items-center whitespace-nowrap px-4 text-sm transition-colors ${
        active
          ? "text-brand-600 font-medium"
          : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
      }`}
    >
      {label}
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500" />
      )}
    </button>
  );
}

function AdminMenuLink({ item, onNavigate }: { item: NavItem; onNavigate: (href: string) => void }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onNavigate(item.href)}
      className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition ${
        item.active ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      <Icon size={13} className={item.active ? "text-brand-500" : "text-slate-400"} />
      {item.label}
    </button>
  );
}

function MobileLink({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  onNavigate: (href: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(href)}
      className={`flex w-full items-center gap-2.5 rounded px-3 py-2 text-sm transition ${
        active
          ? "bg-brand-50 text-brand-700 font-medium"
          : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      <Icon size={14} className={active ? "text-brand-500" : "text-slate-400"} />
      {label}
    </button>
  );
}

function BillingMenuGroup({
  item,
  open,
  onToggle,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  open: boolean;
  onToggle: () => void;
  pathname: string | null;
  onNavigate: (href: string) => void;
}) {
  const Icon = item.icon;
  const isBillingActive = Boolean(pathname?.startsWith("/admin/billing"));
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition ${
          isBillingActive ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"
        }`}
      >
        <Icon size={13} className={isBillingActive ? "text-brand-500" : "text-slate-400"} />
        <span className="flex-1 text-right">{item.label}</span>
        <ChevronRight size={11} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-full top-0 z-50 mr-1 min-w-[190px] overflow-hidden rounded border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            חיובים
          </div>
          <div className="py-1">
            {BILLING_SUB_ITEMS.map(({ href, label, icon: SubIcon }) => {
              const subActive = pathname === href;
            return (
              <button
                key={href}
                type="button"
                onClick={() => onNavigate(href)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition ${
                  subActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <SubIcon size={12} className={`${subActive ? "text-brand-500" : "text-slate-400"} shrink-0`} />
                {label}
              </button>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}

function MobileBillingGroup({
  item,
  open,
  onToggle,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  open: boolean;
  onToggle: () => void;
  pathname: string | null;
  onNavigate: (href: string) => void;
}) {
  const Icon = item.icon;
  const isBillingActive = Boolean(pathname?.startsWith("/admin/billing"));
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center gap-2.5 rounded px-3 py-2 text-sm transition ${
          isBillingActive ? "bg-brand-50 text-brand-700 font-medium" : "text-slate-700 hover:bg-slate-50"
        }`}
      >
        <Icon size={14} className={isBillingActive ? "text-brand-500" : "text-slate-400"} />
        <span className="flex-1 text-right">{item.label}</span>
        <ChevronRight size={13} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-r-2 border-brand-200 mr-4 mt-0.5 space-y-0.5">
          {BILLING_SUB_ITEMS.map(({ href, label, icon: SubIcon }) => (
            <button
              key={href}
              type="button"
              onClick={() => onNavigate(href)}
              className={`flex w-full items-center gap-2 rounded px-3 py-2 text-sm transition ${
                pathname === href ? "bg-brand-50 text-brand-700 font-medium" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <SubIcon size={13} className={`${pathname === href ? "text-brand-500" : "text-slate-400"} shrink-0`} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
