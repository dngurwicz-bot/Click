"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, restoreSession } from "@/lib/api";
import { TENANT_OPTIONS_UPDATED_EVENT } from "@/lib/workspaceTenants";
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
  tenantOptions: WorkspaceTenantOption[];
  selectedTenantId: string;
  setSelectedTenantId: (tenantId: string) => void;
  tenantSelectorVisible: boolean;
  tenantOptionsLoading: boolean;
  navigateTo: (href: string) => void;
  closeScreen: (pathname: string) => void;
  registerScreen: (title: string, pathname?: string) => void;
  toggleRecentPanel: () => void;
  openRecentDrawer: () => void;
  closeRecentDrawer: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const TENANT_STORAGE_KEY = "click_selected_tenant_id";
const OPEN_SCREENS_STORAGE_KEY = "click_open_screens";
const RECENT_SCREENS_STORAGE_KEY = "click_recent_screens";
const RECENT_PANEL_STORAGE_KEY = "click_recent_panel_open";
const RECENT_DRAWER_STORAGE_KEY = "click_recent_drawer_open";
const MAX_OPEN_SCREENS = 8;
const MAX_RECENT_SCREENS = 12;

export interface WorkspaceTenantOption {
  tenant_id: string;
  org_number: number;
  name_he: string;
}

function normalizePath(pathname: string) {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function isAuthPath(pathname: string) {
  return pathname === "/login" || pathname === "/reset-password";
}

function readBooleanStorage(storageKey: string) {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(storageKey) === "true";
}

function readStoredScreens(storageKey: string): ScreenDescriptor[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is ScreenDescriptor =>
          typeof item?.pathname === "string" &&
          typeof item?.title === "string" &&
          typeof item?.lastVisitedAt === "number",
      )
      .map((item) => ({
        pathname: normalizePath(item.pathname),
        title: item.title,
        lastVisitedAt: item.lastVisitedAt,
      }));
  } catch {
    return [];
  }
}

function writeStoredScreens(storageKey: string, screens: ScreenDescriptor[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(screens));
}

function mergeScreen(items: ScreenDescriptor[], screen: ScreenDescriptor, maxItems: number) {
  return [screen, ...items.filter((item) => item.pathname !== screen.pathname)].slice(0, maxItems);
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
  const [activePathname, setActivePathname] = useState(pathname);
  const [openScreens, setOpenScreens] = useState<ScreenDescriptor[]>(() => readStoredScreens(OPEN_SCREENS_STORAGE_KEY));
  const [recentScreens, setRecentScreens] = useState<ScreenDescriptor[]>(() => readStoredScreens(RECENT_SCREENS_STORAGE_KEY));
  const [isRecentPanelOpen, setIsRecentPanelOpen] = useState<boolean>(() => readBooleanStorage(RECENT_PANEL_STORAGE_KEY));
  const [isRecentDrawerOpen, setIsRecentDrawerOpen] = useState<boolean>(() => readBooleanStorage(RECENT_DRAWER_STORAGE_KEY));
  const [tenantOptions, setTenantOptions] = useState<WorkspaceTenantOption[]>([]);
  const [selectedTenantId, setSelectedTenantIdState] = useState("");
  const [tenantOptionsLoading, setTenantOptionsLoading] = useState(true);

  useEffect(() => {
    setActivePathname(pathname);
  }, [pathname]);

  useEffect(() => {
    writeStoredScreens(OPEN_SCREENS_STORAGE_KEY, openScreens);
  }, [openScreens]);

  useEffect(() => {
    writeStoredScreens(RECENT_SCREENS_STORAGE_KEY, recentScreens);
  }, [recentScreens]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(RECENT_PANEL_STORAGE_KEY, String(isRecentPanelOpen));
  }, [isRecentPanelOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(RECENT_DRAWER_STORAGE_KEY, String(isRecentDrawerOpen));
  }, [isRecentDrawerOpen]);

  useEffect(() => {
    let cancelled = false;

    async function loadTenantOptions() {
      setTenantOptionsLoading(true);
      try {
        await restoreSession();
        const rows = await api.get<WorkspaceTenantOption[]>("/api/admin/tenants");
        if (cancelled) return;
        const safeRows = Array.isArray(rows) ? rows : [];
        setTenantOptions(safeRows);
        setSelectedTenantIdState((current) => {
          const saved = typeof window === "undefined" ? "" : window.localStorage.getItem(TENANT_STORAGE_KEY) ?? "";
          const preferred = current || saved;
          if (preferred && safeRows.some((row) => row.tenant_id === preferred)) {
            return preferred;
          }
          return safeRows[0]?.tenant_id ?? "";
        });
      } catch {
        if (!cancelled) {
          setTenantOptions([]);
          setSelectedTenantIdState("");
        }
      } finally {
        if (!cancelled) {
          setTenantOptionsLoading(false);
        }
      }
    }

    function handleTenantOptionsUpdated() {
      void loadTenantOptions();
    }

    void loadTenantOptions();
    window.addEventListener(TENANT_OPTIONS_UPDATED_EVENT, handleTenantOptionsUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener(TENANT_OPTIONS_UPDATED_EVENT, handleTenantOptionsUpdated);
    };
  }, []);

  const setSelectedTenantId = useCallback((tenantId: string) => {
    setSelectedTenantIdState(tenantId);
    if (typeof window !== "undefined") {
      if (tenantId) {
        window.localStorage.setItem(TENANT_STORAGE_KEY, tenantId);
      } else {
        window.localStorage.removeItem(TENANT_STORAGE_KEY);
      }
    }
  }, []);

  const navigateTo = useCallback(
    (href: string) => {
      const target = normalizePath(href);
      setActivePathname(target);
      router.push(target);
    },
    [router],
  );

  const registerScreen = useCallback((title: string, screenPathname?: string) => {
    const target = normalizePath(screenPathname ?? activePathname);
    const screen: ScreenDescriptor = {
      pathname: target,
      title,
      lastVisitedAt: Date.now(),
    };
    setOpenScreens((current) => mergeScreen(current, screen, MAX_OPEN_SCREENS));
    setRecentScreens((current) => mergeScreen(current, screen, MAX_RECENT_SCREENS));
    setActivePathname(target);
  }, [activePathname]);

  const closeScreen = useCallback((screenPathname: string) => {
    const target = normalizePath(screenPathname);
    const nextOpenScreens = openScreens.filter((item) => item.pathname !== target);
    const nextRecentScreens = recentScreens.filter((item) => item.pathname !== target);
    setOpenScreens(nextOpenScreens);
    setRecentScreens(nextRecentScreens);

    if (target !== activePathname) return;

    const fallback =
      nextOpenScreens[0]?.pathname ??
      nextRecentScreens[0]?.pathname ??
      "/dashboard";
    navigateTo(fallback);
  }, [activePathname, navigateTo, openScreens, recentScreens]);

  const toggleRecentPanel = useCallback(() => {
    setIsRecentPanelOpen((current) => !current);
  }, []);

  const openRecentDrawer = useCallback(() => {
    setIsRecentDrawerOpen(true);
  }, []);

  const closeRecentDrawer = useCallback(() => {
    setIsRecentDrawerOpen(false);
  }, []);

  const contextValue = useMemo<WorkspaceContextValue>(
    () => ({
      activePathname,
      openScreens,
      recentScreens,
      isRecentPanelOpen,
      isRecentDrawerOpen,
      tenantOptions,
      selectedTenantId,
      setSelectedTenantId,
      tenantSelectorVisible: true,
      tenantOptionsLoading,
      navigateTo,
      closeScreen,
      registerScreen,
      toggleRecentPanel,
      openRecentDrawer,
      closeRecentDrawer,
    }),
    [
      activePathname,
      closeRecentDrawer,
      closeScreen,
      isRecentDrawerOpen,
      isRecentPanelOpen,
      navigateTo,
      openRecentDrawer,
      openScreens,
      recentScreens,
      registerScreen,
      selectedTenantId,
      setSelectedTenantId,
      tenantOptions,
      tenantOptionsLoading,
      toggleRecentPanel,
    ],
  );

  return (
    <WorkspaceContext.Provider value={contextValue}>
      <div className="flex min-h-screen flex-col bg-slate-50">
        <TopNav />

        <div className="flex min-h-0 flex-1">
          <div className="relative min-w-0 flex-1 overflow-hidden">
            <div className="absolute inset-0 flex flex-col bg-slate-50">
              {children}
            </div>
          </div>
        </div>
      </div>

      <AIAssistant />
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
