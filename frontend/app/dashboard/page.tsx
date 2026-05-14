"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  LayoutGrid,
  Sparkles,
} from "lucide-react";

import { AdminTitleBar } from "@/components/layout/AdminShell";
import {
  DashboardScreenContextMenu,
  ScreenExplanationModal,
  type ScreenMenuState,
} from "@/components/layout/DashboardScreenContextMenu";
import { useWorkspace } from "@/components/layout/WorkspaceShell";
import { getStoredUser, isLoggedIn, restoreSession, type UserInfo } from "@/lib/api";
import {
  getVisibleDashboardScreens,
  readPinnedDashboardScreenIds,
  subscribeToPinnedDashboardScreens,
  togglePinnedDashboardScreen,
  type DashboardScreen,
} from "@/lib/dashboardScreens";
import { useTenantModuleNav } from "@/lib/tenantModuleNav";

const roleLabel: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "מנהל מערכת",
  support: "תמיכה",
  billing: "כספים",
};

function DashboardScreenCard({
  screen,
  onContextMenu,
}: {
  screen: DashboardScreen;
  onContextMenu: (screen: DashboardScreen, event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const router = useRouter();
  const workspace = useWorkspace();
  const Icon = screen.icon;

  return (
    <button
      type="button"
      onContextMenu={(event) => onContextMenu(screen, event)}
      onClick={() => {
        if (workspace) workspace.navigateTo(screen.href);
        else router.push(screen.href);
      }}
      className="group flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-3.5 text-right transition-all hover:border-brand-200 hover:shadow-sm hover:bg-slate-50"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition-colors group-hover:bg-brand-50 group-hover:text-brand-600">
        <Icon size={18} />
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="truncate text-[13px] font-semibold text-slate-800">{screen.label}</div>
        <div className="truncate text-xs text-slate-500">{screen.shortDescription}</div>
      </div>

      <div className="shrink-0 text-slate-300 transition-colors group-hover:text-brand-500">
        <ChevronLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
      </div>
    </button>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const workspace = useWorkspace();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [pinnedScreenIds, setPinnedScreenIds] = useState<string[]>([]);
  const [screenMenu, setScreenMenu] = useState<ScreenMenuState | null>(null);
  const [explanationScreen, setExplanationScreen] = useState<DashboardScreen | null>(null);
  const { modules, loading, reload } = useTenantModuleNav(workspace?.selectedTenantId ?? "");

  const today = new Date().toLocaleDateString("he-IL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const visibleScreens = useMemo(
    () => getVisibleDashboardScreens({ modules, user }),
    [modules, user],
  );

  const pinnedScreens = useMemo(() => {
    const screenMap = new Map(visibleScreens.map((screen) => [screen.id, screen]));
    return pinnedScreenIds
      .map((screenId) => screenMap.get(screenId))
      .filter((screen): screen is DashboardScreen => Boolean(screen));
  }, [pinnedScreenIds, visibleScreens]);

  const isPinned = screenMenu ? pinnedScreenIds.includes(screenMenu.screen.id) : false;

  function openScreenMenu(screen: DashboardScreen, event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    setScreenMenu({
      screen,
      x: event.clientX,
      y: event.clientY,
    });
  }

  const loadDashboard = useCallback(() => {
    const nextUser = getStoredUser();
    if (nextUser) {
      setUser(nextUser);
    } else {
      void restoreSession()
        .then((resolvedUser) => {
          if (resolvedUser) setUser(resolvedUser);
        })
        .catch(() => undefined);
    }
    reload();
  }, [reload]);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }

    setUser(getStoredUser());
    loadDashboard();
  }, [router, loadDashboard]);

  useEffect(() => {
    setPinnedScreenIds(readPinnedDashboardScreenIds(visibleScreens));
    return subscribeToPinnedDashboardScreens(() => {
      setPinnedScreenIds(readPinnedDashboardScreenIds(visibleScreens));
    });
  }, [visibleScreens]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setScreenMenu(null);
        setExplanationScreen(null);
      }
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-dashboard-context-menu="true"]')) {
        return;
      }
      setScreenMenu(null);
    }

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  if (!user && loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
        <main className="flex flex-1 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </main>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
      <AdminTitleBar
        title={`שלום, ${user.full_name.split(" ")[0]}`}
        onRefresh={loadDashboard}
        utilitySlot={<span className="mr-2 text-[10px] text-slate-400">{today}</span>}
      />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-screen-xl space-y-6 px-4 py-5">
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <LayoutGrid size={15} className="text-brand-500" />
              <h2 className="text-sm font-semibold text-slate-700">כניסה מהירה למסכים שלי</h2>
            </div>

            {pinnedScreens.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                  <LayoutGrid size={22} />
                </div>
                <div className="text-lg font-semibold text-slate-800">הדשבורד שלך מוכן להתאמה אישית</div>
                <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-slate-500">
                  כרגע אין מסכים שמוגדרים לכניסה מהירה. עבור עם העכבר על סרגל הניווט, לחץ קליק ימני על שם המסך הרצוי ובחר
                  &nbsp;&quot;הוסף לדשבורד&quot;.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {pinnedScreens.map((screen) => (
                  <DashboardScreenCard key={screen.id} screen={screen} onContextMenu={openScreenMenu} />
                ))}
              </div>
            )}
          </section>

          <div className="flex justify-start">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">תפקיד</span>
              <span className="text-xs font-semibold text-brand-600">{roleLabel[user.role] ?? user.role}</span>
            </div>
          </div>
        </div>
      </main>

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
    </div>
  );
}
