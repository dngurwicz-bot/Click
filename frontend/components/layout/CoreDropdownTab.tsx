"use client";

import { useState, useRef, useEffect, type MouseEvent as ReactMouseEvent } from "react";
import { ChevronDown, FolderTree, ShieldCheck } from "lucide-react";
import { type DashboardScreen, getStaticScreen } from "@/lib/dashboardScreens";

const CORE_LINKS = [
  { href: "/admin/core",                       label: "רשימת עובדים",  icon: ShieldCheck, screenId: "core:employees" },
  { href: "/admin/core/structure",             label: "מבנה ארגוני",   icon: FolderTree,  screenId: "core:structure"  },
];

export function CoreDropdownTab({
  active,
  onNavigate,
  onScreenContextMenu,
  coreScreen,
}: {
  active: boolean;
  onNavigate: (href: string) => void;
  onScreenContextMenu?: (screen: DashboardScreen, event: ReactMouseEvent<HTMLButtonElement>) => void;
  coreScreen?: DashboardScreen | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return (
    <div className="relative h-full flex items-center" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        onContextMenu={coreScreen && onScreenContextMenu ? (e) => onScreenContextMenu(coreScreen, e) : undefined}
        className={`relative flex h-full items-center gap-1.5 whitespace-nowrap px-4 text-sm transition-colors ${
          active ? "text-brand-600 font-medium" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
        }`}
      >
        CLICK Core
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500" />}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-50 w-52 overflow-hidden rounded border border-slate-200 bg-white shadow-lg text-right">
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            CLICK Core
          </div>
          <div className="py-1">
            {CORE_LINKS.map(({ href, label, icon: Icon, screenId }) => {
              const screen = getStaticScreen(screenId);
              return (
                <button
                  key={href}
                  type="button"
                  onClick={() => { setIsOpen(false); onNavigate(href); }}
                  onContextMenu={screen && onScreenContextMenu ? (e) => onScreenContextMenu(screen, e) : undefined}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 transition hover:bg-slate-50"
                >
                  <Icon size={13} className="shrink-0 text-slate-400" />
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
