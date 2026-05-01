"use client";

import { HelpCircle, LayoutGrid, MinusCircle, PlusCircle, X } from "lucide-react";

import type { DashboardScreen } from "@/lib/dashboardScreens";

export interface ScreenMenuState {
  screen: DashboardScreen;
  x: number;
  y: number;
}

export function DashboardScreenContextMenu({
  menu,
  isPinned,
  onTogglePin,
  onExplain,
  onClose,
}: {
  menu: ScreenMenuState | null;
  isPinned: boolean;
  onTogglePin: () => void;
  onExplain: () => void;
  onClose: () => void;
}) {
  if (!menu) return null;

  return (
    <div
      data-dashboard-context-menu="true"
      className="fixed z-[80] min-w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      style={{ left: Math.min(menu.x, window.innerWidth - 236), top: Math.min(menu.y, window.innerHeight - 160) }}
      role="menu"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-right">
        <div className="text-xs font-semibold text-slate-800">{menu.screen.label}</div>
        <div className="mt-0.5 text-[11px] text-slate-500">{menu.screen.shortDescription}</div>
      </div>

      <div className="py-1">
        {menu.screen.pinToDashboard !== false && (
          <button
            type="button"
            onClick={onTogglePin}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 transition hover:bg-slate-50"
          >
            {isPinned ? <MinusCircle size={14} className="text-rose-500" /> : <PlusCircle size={14} className="text-emerald-500" />}
            {isPinned ? "הסר מהדשבורד" : "הוסף לדשבורד"}
          </button>
        )}

        <button
          type="button"
          onClick={onExplain}
          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 transition hover:bg-slate-50"
        >
          <HelpCircle size={14} className="text-brand-500" />
          הסבר
        </button>

        <button
          type="button"
          onClick={onClose}
          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 transition hover:bg-slate-50"
        >
          <X size={14} />
          סגור
        </button>
      </div>
    </div>
  );
}

export function ScreenExplanationModal({
  screen,
  onClose,
}: {
  screen: DashboardScreen | null;
  onClose: () => void;
}) {
  if (!screen) return null;

  const Icon = screen.icon;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 px-4" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Icon size={18} />
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-slate-900">{screen.label}</div>
              <div className="mt-1 text-xs text-slate-500">{screen.shortDescription}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="סגור"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5 text-right">
          <div className="rounded-2xl border border-brand-100 bg-brand-50/50 px-4 py-3">
            <div className="mb-1 flex items-center justify-end gap-2 text-xs font-semibold text-brand-700">
              <LayoutGrid size={13} />
              מה המסך עושה
            </div>
            <p className="text-sm leading-7 text-slate-700">{screen.fullDescription}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold text-slate-600">נתיב מסך</div>
            <div className="mt-1 text-xs text-slate-500" dir="ltr">
              {screen.href}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
