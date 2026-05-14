"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { ChevronDown, ChevronRight, FolderTree, ShieldCheck } from "lucide-react";

import type { DashboardScreen } from "@/lib/dashboardScreens";
import { getStaticScreen } from "@/lib/dashboardScreens";
import { useTenantOrgStructureItems } from "@/lib/orgStructureConfig";
import { useWorkspace } from "./WorkspaceShell";

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
  const workspace = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const [structureOpen, setStructureOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedTenantId = workspace?.selectedTenantId ?? "";
  const { structureItems } = useTenantOrgStructureItems(selectedTenantId);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setStructureOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const employeeScreen = getStaticScreen("core:employees");
  const structureScreen = getStaticScreen("core:structure");

  return (
    <div className="relative h-full flex items-center" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        onContextMenu={coreScreen && onScreenContextMenu ? (event) => onScreenContextMenu(coreScreen, event) : undefined}
        className={`relative flex h-full items-center gap-1.5 whitespace-nowrap px-4 text-sm transition-colors ${
          active ? "font-medium text-brand-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
        }`}
      >
        CLICK Core
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500" />}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-[190px] overflow-visible rounded border border-slate-200 bg-white shadow-lg text-right">
          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setStructureOpen(false);
                onNavigate("/admin/core");
              }}
              onContextMenu={employeeScreen && onScreenContextMenu ? (event) => onScreenContextMenu(employeeScreen, event) : undefined}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs transition text-slate-700 hover:bg-slate-50"
            >
              <ShieldCheck size={13} className="text-slate-400 shrink-0" />
              רשימת עובדים
            </button>
            <button
              type="button"
              onClick={() => setStructureOpen((value) => !value)}
              onContextMenu={structureScreen && onScreenContextMenu ? (event) => onScreenContextMenu(structureScreen, event) : undefined}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs transition text-slate-700 hover:bg-slate-50"
            >
              <FolderTree size={13} className="text-slate-400 shrink-0" />
              <span className="flex-1 text-right">מבנה ארגוני</span>
              <ChevronRight size={11} className={`text-slate-400 transition-transform ${structureOpen ? "rotate-180" : ""}`} />
            </button>
          </div>

          {structureOpen && (
            <div className="absolute right-full top-[34px] z-50 mr-1 min-w-[190px] overflow-hidden rounded border border-slate-200 bg-white shadow-lg">
              <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                מבנה ארגוני
              </div>
              <div className="py-1">
                {structureItems.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-400">
                    {selectedTenantId ? "לא הוגדר מבנה ארגוני ללקוח" : "בחר לקוח כדי להציג מבנה ארגוני"}
                  </div>
                ) : structureItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      setStructureOpen(false);
                      onNavigate(item.href);
                    }}
                    onContextMenu={structureScreen && onScreenContextMenu ? (event) => onScreenContextMenu(structureScreen, event) : undefined}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs transition text-slate-700 hover:bg-slate-50"
                  >
                    {item.key === "position" ? (
                      <ShieldCheck size={12} className="text-slate-400 shrink-0" />
                    ) : (
                      <FolderTree size={12} className="text-slate-400 shrink-0" />
                    )}
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
