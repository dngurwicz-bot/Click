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

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function normalizePath(pathname: string) {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function isAuthPath(pathname: string) {
  return pathname === "/login" || pathname === "/reset-password";
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

  useEffect(() => {
    setActivePathname(pathname);
  }, [pathname]);

  const navigateTo = useCallback(
    (href: string) => {
      const target = normalizePath(href);
      setActivePathname(target);
      router.push(target);
    },
    [router],
  );

  const contextValue = useMemo<WorkspaceContextValue>(
    () => ({
      activePathname,
      openScreens: [],
      recentScreens: [],
      isRecentPanelOpen: false,
      isRecentDrawerOpen: false,
      navigateTo,
      closeScreen: () => {},
      registerScreen: () => {},
      toggleRecentPanel: () => {},
      openRecentDrawer: () => {},
      closeRecentDrawer: () => {},
    }),
    [activePathname, navigateTo],
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
