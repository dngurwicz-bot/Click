"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  Search,
  Settings,
  X,
  type LucideIcon,
} from "lucide-react";

import { api, getStoredUser, logout, type UserInfo } from "@/lib/api";
import { BILLING_ENABLED } from "@/lib/features";
import {
  ADMIN_SCREEN_IDS,
  BILLING_SCREEN_IDS,
  getStaticScreen,
  getVisibleDashboardScreens,
  readPinnedDashboardScreenIds,
  subscribeToPinnedDashboardScreens,
  togglePinnedDashboardScreen,
  type DashboardScreen,
  type ModuleNavItem,
} from "@/lib/dashboardScreens";
import { Logo } from "./Logo";
import { useWorkspace } from "./WorkspaceShell";
import { InsightsDropdownTab } from "./InsightsDropdownTab";
import {
  DashboardScreenContextMenu,
  ScreenExplanationModal,
  type ScreenMenuState,
} from "./DashboardScreenContextMenu";

interface NavItem extends DashboardScreen {
  active: boolean;
}

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
  const rootRef = useRef<HTMLDivElement>(null);

  const [user, setUser] = useState<UserInfo | null>(null);
  const [modules, setModules] = useState<ModuleNavItem[]>([]);
  const [adminOpen, setAdminOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [screenMenu, setScreenMenu] = useState<ScreenMenuState | null>(null);
  const [explanationScreen, setExplanationScreen] = useState<DashboardScreen | null>(null);
  const [pinnedScreenIds, setPinnedScreenIds] = useState<string[]>([]);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    api
      .get<ModuleNavItem[]>("/api/admin/modules")
      .then((data) => setModules(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const visibleScreens = useMemo(
    () => getVisibleDashboardScreens({ modules, user }),
    [modules, user],
  );

  const visibleScreenMap = useMemo(
    () => new Map(visibleScreens.map((screen) => [screen.id, screen])),
    [visibleScreens],
  );

  useEffect(() => {
    setPinnedScreenIds(readPinnedDashboardScreenIds(visibleScreens));
    return subscribeToPinnedDashboardScreens(() => {
      setPinnedScreenIds(readPinnedDashboardScreenIds(visibleScreens));
    });
  }, [visibleScreens]);

  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setAdminOpen(false);
        setBillingOpen(false);
        setUserOpen(false);
        setScreenMenu(null);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAdminOpen(false);
        setBillingOpen(false);
        setUserOpen(false);
        setMobileOpen(false);
        setScreenMenu(null);
        setExplanationScreen(null);
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
    setScreenMenu(null);
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
    setScreenMenu(null);

    if (workspace) {
      workspace.navigateTo(href);
      return;
    }

    router.push(href);
  }

  function openScreenMenu(screen: DashboardScreen, event: ReactMouseEvent<HTMLElement>) {
    event.preventDefault();
    setScreenMenu({
      screen,
      x: event.clientX,
      y: event.clientY,
    });
  }

  const isAdmin = Boolean(user && ADMIN_ROLES.includes(user.role));
  const dashboardScreen = getStaticScreen("dashboard");
  const insightsScreen = visibleScreenMap.get("module:insights") ?? null;

  const adminItems = useMemo<NavItem[]>(() => {
    if (!isAdmin) return [];

    return ADMIN_SCREEN_IDS
      .map((screenId) => visibleScreenMap.get(screenId))
      .filter((screen): screen is DashboardScreen => Boolean(screen))
      .map((screen) => ({
        ...screen,
        active: screen.id === "admin:billing"
          ? Boolean(pathname?.startsWith("/admin/billing"))
          : Boolean(pathname?.startsWith(screen.href)),
      }));
  }, [isAdmin, pathname, visibleScreenMap]);

  const billingItems = useMemo<NavItem[]>(() => {
    if (!BILLING_ENABLED) return [];

    return BILLING_SCREEN_IDS
      .map((screenId) => visibleScreenMap.get(screenId))
      .filter((screen): screen is DashboardScreen => Boolean(screen))
      .map((screen) => ({
        ...screen,
        active: Boolean(pathname?.startsWith(screen.href)),
      }));
  }, [pathname, visibleScreenMap]);

  const moduleItems = useMemo<NavItem[]>(
    () =>
      visibleScreens
        .filter((screen) => screen.navGroup === "module" && !screen.hideFromNav)
        .map((screen) => ({
          ...screen,
          active: Boolean(pathname?.startsWith(screen.href)),
        })),
    [pathname, visibleScreens],
  );

  const isPinned = screenMenu ? pinnedScreenIds.includes(screenMenu.screen.id) : false;

  return (
    <header
      ref={rootRef}
      className="sticky top-0 z-40 border-b border-slate-200 bg-white"
      style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}
    >
      <div className="flex h-[52px] items-center gap-0 px-0">
        <div className="flex h-full shrink-0 items-center border-l border-slate-100 px-4">
          <Logo href="/dashboard" size="sm" variant="dark" />
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((value) => !value)}
          className="mr-1 inline-flex h-8 w-8 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 md:hidden"
          aria-label="פתח תפריט"
        >
          {mobileOpen ? <X size={16} /> : <Menu size={16} />}
        </button>

        <nav className="hidden h-full min-w-0 flex-1 items-center overflow-visible md:flex" style={{ scrollbarWidth: "none" }}>
          {dashboardScreen && (
            <PriorityTab
              screen={dashboardScreen}
              active={pathname === dashboardScreen.href}
              onNavigate={navigateTo}
              onScreenContextMenu={openScreenMenu}
            />
          )}

          {moduleItems.map((item) => (
            item.href === "/modules/insights" ? (
              <InsightsDropdownTab
                key={item.href}
                active={item.active}
                onNavigate={navigateTo}
                onScreenContextMenu={openScreenMenu}
                insightsScreen={insightsScreen}
              />
            ) : (
              <PriorityTab
                key={item.href}
                screen={item}
                active={item.active}
                onNavigate={navigateTo}
                onScreenContextMenu={openScreenMenu}
              />
            )
          ))}
        </nav>

        <div className="flex h-full shrink-0 items-center gap-1 px-3">
          <button
            type="button"
            className="hidden h-8 items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 text-right text-xs text-slate-400 transition hover:border-slate-300 hover:bg-white md:flex"
            style={{ minWidth: 200 }}
          >
            <Search size={12} className="shrink-0" />
            <span>חיפוש...</span>
          </button>

          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 md:hidden"
          >
            <Search size={15} />
          </button>

          <button
            type="button"
            className="relative inline-flex h-8 w-8 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100"
            title="התראות"
          >
            <Bell size={15} />
            <span className="absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand-500" />
          </button>

          {isAdmin && adminItems.length > 0 && (
            <div className="relative hidden md:block">
              <button
                type="button"
                onClick={() => setAdminOpen((value) => !value)}
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
                      item.id === "admin:billing" ? (
                        <BillingMenuGroup
                          key={item.id}
                          item={item}
                          subItems={billingItems}
                          open={billingOpen}
                          onToggle={() => setBillingOpen((value) => !value)}
                          onNavigate={navigateTo}
                          onScreenContextMenu={openScreenMenu}
                        />
                      ) : (
                        <AdminMenuLink key={item.id} item={item} onNavigate={navigateTo} onScreenContextMenu={openScreenMenu} />
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mx-1 h-5 w-px bg-slate-200" />

          {user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserOpen((value) => !value)}
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
              {dashboardScreen && (
                <div>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">ראשי</div>
                  <MobileLink item={{ ...dashboardScreen, active: pathname === dashboardScreen.href }} onNavigate={navigateTo} />
                </div>
              )}

              {moduleItems.length > 0 && (
                <div>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">מודולים</div>
                  <div className="space-y-0.5">
                    {moduleItems.map((item) => <MobileLink key={item.id} item={item} onNavigate={navigateTo} />)}
                  </div>
                </div>
              )}

              {isAdmin && adminItems.length > 0 && (
                <div>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">ניהול</div>
                  <div className="space-y-0.5">
                    {adminItems.map((item) =>
                      item.id === "admin:billing" ? (
                        <MobileBillingGroup
                          key={item.id}
                          item={item}
                          subItems={billingItems}
                          open={billingOpen}
                          onToggle={() => setBillingOpen((value) => !value)}
                          onNavigate={navigateTo}
                        />
                      ) : (
                        <MobileLink key={item.id} item={item} onNavigate={navigateTo} />
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <DashboardScreenContextMenu
        menu={screenMenu}
        isPinned={isPinned}
        onTogglePin={() => {
          if (!screenMenu) return;
          const next = togglePinnedDashboardScreen(screenMenu.screen.id, visibleScreens);
          setPinnedScreenIds(next);
          setScreenMenu(null);
        }}
        onExplain={() => {
          if (!screenMenu) return;
          setExplanationScreen(screenMenu.screen);
          setScreenMenu(null);
        }}
        onClose={() => setScreenMenu(null)}
      />

      <ScreenExplanationModal screen={explanationScreen} onClose={() => setExplanationScreen(null)} />
    </header>
  );
}

function PriorityTab({
  screen,
  active,
  onNavigate,
  onScreenContextMenu,
}: {
  screen: DashboardScreen;
  active: boolean;
  onNavigate: (href: string) => void;
  onScreenContextMenu: (screen: DashboardScreen, event: ReactMouseEvent<HTMLElement>) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(screen.href)}
      onContextMenu={(event) => onScreenContextMenu(screen, event)}
      className={`relative flex h-full items-center whitespace-nowrap px-4 text-sm transition-colors ${
        active
          ? "font-medium text-brand-600"
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
      }`}
    >
      {screen.label}
      {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500" />}
    </button>
  );
}

function AdminMenuLink({
  item,
  onNavigate,
  onScreenContextMenu,
}: {
  item: NavItem;
  onNavigate: (href: string) => void;
  onScreenContextMenu: (screen: DashboardScreen, event: ReactMouseEvent<HTMLElement>) => void;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={() => onNavigate(item.href)}
      onContextMenu={(event) => onScreenContextMenu(item, event)}
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
  item,
  onNavigate,
}: {
  item: NavItem;
  onNavigate: (href: string) => void;
}) {
  const Icon = item.icon as LucideIcon;

  return (
    <button
      type="button"
      onClick={() => onNavigate(item.href)}
      className={`flex w-full items-center gap-2.5 rounded px-3 py-2 text-sm transition ${
        item.active
          ? "bg-brand-50 font-medium text-brand-700"
          : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      <Icon size={14} className={item.active ? "text-brand-500" : "text-slate-400"} />
      {item.label}
    </button>
  );
}

function BillingMenuGroup({
  item,
  subItems,
  open,
  onToggle,
  onNavigate,
  onScreenContextMenu,
}: {
  item: NavItem;
  subItems: NavItem[];
  open: boolean;
  onToggle: () => void;
  onNavigate: (href: string) => void;
  onScreenContextMenu: (screen: DashboardScreen, event: ReactMouseEvent<HTMLElement>) => void;
}) {
  if (!BILLING_ENABLED) return null;

  const Icon = item.icon;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        onContextMenu={(event) => onScreenContextMenu(item, event)}
        className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition ${
          item.active ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"
        }`}
      >
        <Icon size={13} className={item.active ? "text-brand-500" : "text-slate-400"} />
        <span className="flex-1 text-right">{item.label}</span>
        <ChevronRight size={11} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-full top-0 z-50 mr-1 min-w-[190px] overflow-hidden rounded border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            חיובים
          </div>
          <div className="py-1">
            {subItems.map((item) => {
              const SubIcon = item.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.href)}
                  onContextMenu={(event) => onScreenContextMenu(item, event)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition ${
                    item.active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <SubIcon size={12} className={`${item.active ? "text-brand-500" : "text-slate-400"} shrink-0`} />
                  {item.label}
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
  subItems,
  open,
  onToggle,
  onNavigate,
}: {
  item: NavItem;
  subItems: NavItem[];
  open: boolean;
  onToggle: () => void;
  onNavigate: (href: string) => void;
}) {
  if (!BILLING_ENABLED) return null;

  const Icon = item.icon;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center gap-2.5 rounded px-3 py-2 text-sm transition ${
          item.active ? "bg-brand-50 font-medium text-brand-700" : "text-slate-700 hover:bg-slate-50"
        }`}
      >
        <Icon size={14} className={item.active ? "text-brand-500" : "text-slate-400"} />
        <span className="flex-1 text-right">{item.label}</span>
        <ChevronRight size={13} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mr-4 mt-0.5 space-y-0.5 border-r-2 border-brand-200">
          {subItems.map((item) => {
            const SubIcon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.href)}
                className={`flex w-full items-center gap-2 rounded px-3 py-2 text-sm transition ${
                  item.active ? "bg-brand-50 font-medium text-brand-700" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <SubIcon size={13} className={`${item.active ? "text-brand-500" : "text-slate-400"} shrink-0`} />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
