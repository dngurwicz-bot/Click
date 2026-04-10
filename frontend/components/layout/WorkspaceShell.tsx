"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { Clock3, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { TopNav } from "./TopNav";
import { AIAssistant } from "../ai/AIAssistant";

export interface ScreenDescriptor {
  pathname: string;
  title: string;
  lastVisitedAt: number;
}

interface WorkspaceContextValue {
  activePathname: string;
  openScreens: ScreenDescriptor[];
  recentScreens: ScreenDescriptor[];
  isRecentPanelOpen: boolean;
  isRecentDrawerOpen: boolean;
  navigateTo: (href: string) => void;
  closeScreen: (pathname: string) => void;
  registerScreen: (title: string, pathname?: string) => void;
  toggleRecentPanel: () => void;
  openRecentDrawer: () => void;
  closeRecentDrawer: () => void;
}

const CLICK_OPEN_SCREENS_KEY = "click_open_screens";
const CLICK_RECENT_SCREENS_KEY = "click_recent_screens";
const CLICK_ACTIVE_SCREEN_KEY = "click_active_screen";
const CLICK_RECENT_PANEL_OPEN_KEY = "click_recent_panel_open";
const MAX_RECENT_SCREENS = 10;
const FALLBACK_SCREEN = "/dashboard";

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function normalizePath(pathname: string) {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function isAuthPath(pathname: string) {
  return pathname === "/login" || pathname === "/reset-password";
}

function inferScreenTitle(pathname: string) {
  const normalized = normalizePath(pathname);

  const staticTitles: Record<string, string> = {
    "/dashboard": "ראשי",
    "/admin/tenants": "ניהול ארגונים",
    "/admin/tenants/new": "ארגון חדש",
    "/admin/lookups": "ניהול רשימות ארגוניות",
    "/admin/lookups/new": "רשימה חדשה",
    "/admin/modules": "מודולים ומחירון",
    "/admin/modules/new": "מודול חדש",
    "/admin/users": "משתמשי מערכת",
    "/admin/templates": "תבניות הקמה",
    "/admin/audit": "Audit Log",
    "/admin/billing/overview": "חיובים - סקירה",
    "/admin/billing/quotes": "חיובים - הצעות מחיר",
    "/admin/billing/charges": "חיובים - חיובים",
    "/admin/billing/invoices": "חיובים - חשבוניות",
    "/admin/billing/settings": "חיובים - הגדרות מנפיק",
  };

  if (staticTitles[normalized]) return staticTitles[normalized];
  if (normalized.startsWith("/admin/tenants/")) return "כרטיס ארגון";
  if (normalized.startsWith("/admin/lookups/")) return "עריכת רשימה";
  if (normalized.startsWith("/admin/modules/")) return "פרטי מודול";

  return normalized.split("/").filter(Boolean).at(-1) ?? "מסך";
}

function mergeScreen(
  screens: ScreenDescriptor[],
  next: ScreenDescriptor,
  maxItems?: number,
) {
  const merged = [next, ...screens.filter((screen) => screen.pathname !== next.pathname)];
  return typeof maxItems === "number" ? merged.slice(0, maxItems) : merged;
}

function readStoredScreens(key: string) {
  if (typeof window === "undefined") return [] as ScreenDescriptor[];

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScreenDescriptor[];
    return Array.isArray(parsed)
      ? parsed.filter((entry) => Boolean(entry?.pathname && entry?.title))
      : [];
  } catch {
    return [];
  }
}

function ActiveScreensBar({
  openScreens,
  activePathname,
  navigateTo,
  closeScreen,
  openRecentDrawer,
}: {
  openScreens: ScreenDescriptor[];
  activePathname: string;
  navigateTo: (href: string) => void;
  closeScreen: (pathname: string) => void;
  openRecentDrawer: () => void;
}) {
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="flex h-11 items-center gap-2 px-3">
        <button
          type="button"
          onClick={openRecentDrawer}
          className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 lg:hidden"
          aria-label="פתח בשימוש לאחרונה"
        >
          <Clock3 size={15} />
        </button>
        <div className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          מסכים פעילים
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto pb-1 pt-1" style={{ scrollbarWidth: "thin" }}>
          {openScreens.map((screen) => {
            const isActive = screen.pathname === activePathname;
            return (
              <div
                key={screen.pathname}
                className={`flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs transition ${
                  isActive
                    ? "border-brand-200 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => navigateTo(screen.pathname)}
                  className="max-w-[180px] truncate text-right"
                  title={screen.title}
                >
                  {screen.title}
                </button>
                <button
                  type="button"
                  onClick={() => closeScreen(screen.pathname)}
                  className="inline-flex h-4 w-4 items-center justify-center rounded text-slate-400 transition hover:bg-white hover:text-slate-600"
                  aria-label={`סגור ${screen.title}`}
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RecentScreensPanel({
  recentScreens,
  activePathname,
  openScreens,
  isOpen,
  navigateTo,
  toggleRecentPanel,
}: {
  recentScreens: ScreenDescriptor[];
  activePathname: string;
  openScreens: ScreenDescriptor[];
  isOpen: boolean;
  navigateTo: (href: string) => void;
  toggleRecentPanel: () => void;
}) {
  const openPathnames = new Set(openScreens.map((screen) => screen.pathname));

  return (
    <aside
      className={`hidden border-r border-slate-200 bg-white transition-all duration-200 lg:flex lg:flex-col ${
        isOpen ? "w-72" : "w-14"
      }`}
    >
      <div className="flex h-12 items-center justify-between border-b border-slate-100 px-3">
        {isOpen ? (
          <div className="text-xs font-semibold text-slate-600">בשימוש לאחרונה</div>
        ) : (
          <div className="mx-auto text-slate-400">
            <Clock3 size={15} />
          </div>
        )}
        <button
          type="button"
          onClick={toggleRecentPanel}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label={isOpen ? "כווץ בשימוש לאחרונה" : "הרחב בשימוש לאחרונה"}
        >
          {isOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {isOpen ? (
          recentScreens.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
              עדיין אין מסכים אחרונים.
            </div>
          ) : (
            <div className="space-y-1">
              {recentScreens.map((screen) => {
                const isActive = screen.pathname === activePathname;
                const isOpenScreen = openPathnames.has(screen.pathname);
                return (
                  <button
                    key={screen.pathname}
                    type="button"
                    onClick={() => navigateTo(screen.pathname)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-right text-xs transition ${
                      isActive
                        ? "bg-brand-50 text-brand-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                    }`}
                  >
                    <span className="truncate">{screen.title}</span>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${isOpenScreen ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {isOpenScreen ? "פתוח" : "אחרון"}
                    </span>
                  </button>
                );
              })}
            </div>
          )
        ) : (
          <div className="flex flex-col items-center gap-2 pt-2">
            {recentScreens.slice(0, 6).map((screen) => (
              <button
                key={screen.pathname}
                type="button"
                onClick={() => navigateTo(screen.pathname)}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-md border text-[10px] font-semibold transition ${
                  screen.pathname === activePathname
                    ? "border-brand-200 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-white"
                }`}
                title={screen.title}
              >
                {screen.title.slice(0, 2)}
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function RecentScreensDrawer({
  recentScreens,
  activePathname,
  openScreens,
  navigateTo,
  onClose,
}: {
  recentScreens: ScreenDescriptor[];
  activePathname: string;
  openScreens: ScreenDescriptor[];
  navigateTo: (href: string) => void;
  onClose: () => void;
}) {
  const openPathnames = new Set(openScreens.map((screen) => screen.pathname));

  return (
    <div className="lg:hidden">
      <button
        type="button"
        className="fixed inset-0 z-40 bg-slate-900/25"
        aria-label="סגור בשימוש לאחרונה"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xs flex-col border-l border-slate-200 bg-white shadow-xl">
        <div className="flex h-12 items-center justify-between border-b border-slate-100 px-4">
          <div className="text-sm font-semibold text-slate-700">בשימוש לאחרונה</div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="סגור"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {recentScreens.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
              עדיין אין מסכים אחרונים.
            </div>
          ) : (
            <div className="space-y-1">
              {recentScreens.map((screen) => (
                <button
                  key={screen.pathname}
                  type="button"
                  onClick={() => {
                    navigateTo(screen.pathname);
                    onClose();
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-right text-sm transition ${
                    screen.pathname === activePathname
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  <span className="truncate">{screen.title}</span>
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${openPathnames.has(screen.pathname) ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {openPathnames.has(screen.pathname) ? "פתוח" : "אחרון"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = normalizePath(usePathname() ?? "/");

  if (isAuthPath(pathname)) {
    return <>{children}</>;
  }

  return <WorkspaceShellInner pathname={pathname}>{children}</WorkspaceShellInner>;
}

function WorkspaceShellInner({
  children,
  pathname,
}: {
  children: ReactNode;
  pathname: string;
}) {
  const router = useRouter();
  const [openScreens, setOpenScreens] = useState<ScreenDescriptor[]>([]);
  const [recentScreens, setRecentScreens] = useState<ScreenDescriptor[]>([]);
  const [activePathname, setActivePathname] = useState(pathname);
  const [isRecentPanelOpen, setIsRecentPanelOpen] = useState(true);
  const [isRecentDrawerOpen, setIsRecentDrawerOpen] = useState(false);
  const [cachedChildren, setCachedChildren] = useState<Record<string, ReactNode>>({});
  const hydratedRef = useRef(false);

  useEffect(() => {
    const now = Date.now();
    const current: ScreenDescriptor = {
      pathname,
      title: inferScreenTitle(pathname),
      lastVisitedAt: now,
    };

    const storedRecent = readStoredScreens(CLICK_RECENT_SCREENS_KEY);
    const storedPanelOpen = typeof window !== "undefined" ? localStorage.getItem(CLICK_RECENT_PANEL_OPEN_KEY) : null;

    setRecentScreens(mergeScreen(storedRecent, current, MAX_RECENT_SCREENS));
    setOpenScreens([current]);
    setActivePathname(pathname);
    setIsRecentPanelOpen(storedPanelOpen !== "0");
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    setCachedChildren((prev) => ({ ...prev, [pathname]: children }));
  }, [children, pathname]);

  useEffect(() => {
    if (!hydratedRef.current) return;

    const now = Date.now();
    const fallbackTitle = inferScreenTitle(pathname);

    setOpenScreens((prev) =>
      mergeScreen(prev, {
        pathname,
        title: prev.find((screen) => screen.pathname === pathname)?.title ?? fallbackTitle,
        lastVisitedAt: now,
      }),
    );

    setRecentScreens((prev) =>
      mergeScreen(
        prev,
        {
          pathname,
          title: prev.find((screen) => screen.pathname === pathname)?.title ?? fallbackTitle,
          lastVisitedAt: now,
        },
        MAX_RECENT_SCREENS,
      ),
    );

    setActivePathname(pathname);
  }, [pathname]);

  useEffect(() => {
    if (!hydratedRef.current || typeof window === "undefined") return;
    localStorage.setItem(CLICK_OPEN_SCREENS_KEY, JSON.stringify(openScreens));
  }, [openScreens]);

  useEffect(() => {
    if (!hydratedRef.current || typeof window === "undefined") return;
    localStorage.setItem(CLICK_RECENT_SCREENS_KEY, JSON.stringify(recentScreens));
  }, [recentScreens]);

  useEffect(() => {
    if (!hydratedRef.current || typeof window === "undefined") return;
    localStorage.setItem(CLICK_ACTIVE_SCREEN_KEY, activePathname);
  }, [activePathname]);

  useEffect(() => {
    if (!hydratedRef.current || typeof window === "undefined") return;
    localStorage.setItem(CLICK_RECENT_PANEL_OPEN_KEY, isRecentPanelOpen ? "1" : "0");
  }, [isRecentPanelOpen]);

  const navigateTo = useCallback(
    (href: string) => {
      const target = normalizePath(href);
      setActivePathname(target);
      router.push(target);
    },
    [router],
  );

  const registerScreen = useCallback(
    (title: string, nextPathname?: string) => {
      const targetPathname = normalizePath(nextPathname ?? pathname);
      const now = Date.now();

      setOpenScreens((prev) => {
        const existing = prev.find((screen) => screen.pathname === targetPathname);
        if (existing && existing.title === title) {
          return prev;
        }

        return mergeScreen(prev, {
          pathname: targetPathname,
          title,
          lastVisitedAt: now,
        });
      });

      setRecentScreens((prev) => {
        const existing = prev.find((screen) => screen.pathname === targetPathname);
        if (existing && existing.title === title) {
          return prev;
        }

        return mergeScreen(
          prev,
          {
            pathname: targetPathname,
            title,
            lastVisitedAt: now,
          },
          MAX_RECENT_SCREENS,
        );
      });
    },
    [pathname],
  );

  const closeScreen = useCallback(
    (targetPathname: string) => {
      const normalizedTarget = normalizePath(targetPathname);
      const remainingScreens = openScreens.filter((screen) => screen.pathname !== normalizedTarget);

      setOpenScreens(remainingScreens);
      setCachedChildren((prev) => {
        const next = { ...prev };
        delete next[normalizedTarget];
        return next;
      });

      if (normalizedTarget !== pathname) {
        if (activePathname === normalizedTarget) {
          setActivePathname(pathname);
        }
        return;
      }

      const nextScreen = [...remainingScreens].sort((a, b) => b.lastVisitedAt - a.lastVisitedAt)[0];
      const fallbackPath = nextScreen?.pathname ?? FALLBACK_SCREEN;
      setActivePathname(fallbackPath);
      router.push(fallbackPath);
    },
    [activePathname, openScreens, pathname, router],
  );

  const contextValue = useMemo<WorkspaceContextValue>(
    () => ({
      activePathname,
      openScreens,
      recentScreens,
      isRecentPanelOpen,
      isRecentDrawerOpen,
      navigateTo,
      closeScreen,
      registerScreen,
      toggleRecentPanel: () => setIsRecentPanelOpen((prev) => !prev),
      openRecentDrawer: () => setIsRecentDrawerOpen(true),
      closeRecentDrawer: () => setIsRecentDrawerOpen(false),
    }),
    [activePathname, closeScreen, isRecentDrawerOpen, isRecentPanelOpen, navigateTo, openScreens, recentScreens, registerScreen],
  );

  return (
    <WorkspaceContext.Provider value={contextValue}>
      <div className="flex min-h-screen flex-col bg-slate-50">
        <TopNav />
        <ActiveScreensBar
          openScreens={openScreens}
          activePathname={activePathname}
          navigateTo={navigateTo}
          closeScreen={closeScreen}
          openRecentDrawer={() => setIsRecentDrawerOpen(true)}
        />

        <div className="flex min-h-0 flex-1">
          <div className="relative min-w-0 flex-1 overflow-hidden">
            {openScreens.map((screen) => {
              const node = cachedChildren[screen.pathname] ?? (screen.pathname === pathname ? children : null);
              const isVisible = screen.pathname === activePathname;

              return (
                <div
                  key={screen.pathname}
                  className={`absolute inset-0 flex flex-col bg-slate-50 transition-opacity duration-200 ${
                    isVisible ? "z-10 opacity-100" : "z-0 opacity-0 pointer-events-none"
                  }`}
                  style={{
                    visibility: isVisible ? "visible" : "hidden",
                    // Adding a slight delay to visibility hidden so the fade out completes
                    transition: "opacity 200ms ease, visibility 200ms ease"
                  }}
                  aria-hidden={!isVisible}
                >
                  {node || (
                    <div className="flex flex-1 items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <RecentScreensPanel
            recentScreens={recentScreens}
            activePathname={activePathname}
            openScreens={openScreens}
            isOpen={isRecentPanelOpen}
            navigateTo={navigateTo}
            toggleRecentPanel={() => setIsRecentPanelOpen((prev) => !prev)}
          />
        </div>
      </div>

      {isRecentDrawerOpen && (
        <RecentScreensDrawer
          recentScreens={recentScreens}
          activePathname={activePathname}
          openScreens={openScreens}
          navigateTo={navigateTo}
          onClose={() => setIsRecentDrawerOpen(false)}
        />
      )}
      
      <AIAssistant />
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
