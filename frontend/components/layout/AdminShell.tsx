"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, HelpCircle, Printer, RefreshCw, Search } from "lucide-react";
import { useWorkspace } from "./WorkspaceShell";

/** Priority-style screen title bar */
export function AdminTitleBar({
  title,
  titleNode,
  backHref,
  backLabel,
  onRefresh,
  utilitySlot,
}: {
  title: string;
  titleNode?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  onRefresh?: () => void;
  utilitySlot?: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const workspace = useWorkspace();
  const registerScreen = workspace?.registerScreen;

  useEffect(() => {
    if (!pathname || !registerScreen) return;
    registerScreen(title, pathname);
  }, [pathname, title, registerScreen]);

  return (
    <div className="flex h-[var(--priority-title-bar-h,44px)] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
      {/* Left: utility icons */}
      <div className="flex items-center gap-0.5">
        <button
          title="עזרה"
          className="flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <HelpCircle size={13} />
        </button>
        <button
          title="הדפסה"
          className="flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <Printer size={13} />
        </button>
        <button
          title="רענן"
          onClick={onRefresh}
          disabled={!onRefresh}
          className="flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
        >
          <RefreshCw size={13} />
        </button>
        {utilitySlot}
      </div>

      {/* Right: breadcrumb + title */}
      <div className="flex items-center gap-1.5 text-right">
        {backHref && (
          <>
            <button
              type="button"
              onClick={() => {
                if (workspace) workspace.navigateTo(backHref);
                else router.push(backHref);
              }}
              className="flex items-center gap-0.5 text-xs text-slate-400 transition hover:text-brand-600"
            >
              <ChevronLeft size={12} />
              {backLabel ?? "חזרה"}
            </button>
            <span className="text-slate-300 text-xs">›</span>
          </>
        )}
        {titleNode ? titleNode : <h1 className="text-sm font-semibold text-slate-800">{title}</h1>}
      </div>
    </div>
  );
}

/** Priority-style action/filter bar */
export function AdminActionBar({
  start,
  center,
  end,
}: {
  start?: React.ReactNode;
  center?: React.ReactNode;
  end?: React.ReactNode;
}) {
  return (
    <div className="flex h-[var(--priority-action-bar-h,40px)] shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-4 gap-3">
      <div className="flex items-center gap-2 min-w-0">{start}</div>
      <div className="flex items-center gap-2 min-w-0">{center}</div>
      <div className="flex items-center gap-2 min-w-0">{end}</div>
    </div>
  );
}

/** Priority-style search field */
export function AdminSearchField({
  value,
  onChange,
  placeholder = "חיפוש...",
  widthClass = "w-44",
}: {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  widthClass?: string;
}) {
  return (
    <div className="relative">
      <Search size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        placeholder={placeholder}
        aria-label={placeholder || "חיפוש"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`pr-8 pl-3 py-1 text-xs border border-slate-300 bg-white rounded
          focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100
          text-right transition-colors ${widthClass}`}
      />
    </div>
  );
}

/** Compact record count label */
export function AdminCountLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-slate-400 font-medium">{children}</span>;
}

/** Priority-style section card */
export function AdminSectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded border border-slate-200 overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-100 bg-slate-50">
        <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

/** Bottom status bar — Priority ERP style */
export function AdminStatusBar({
  total,
  label,
  current,
}: {
  total: number;
  label: string;
  current?: number;
}) {
  return (
    <div className="flex h-[var(--priority-status-bar-h,28px)] shrink-0 items-center justify-between border-t border-slate-200 bg-white px-4">
      <div className="text-[11px] text-slate-400">CLICK Admin</div>
      <div className="flex items-center gap-3 text-[11px] text-slate-500">
        {current !== undefined && (
          <span>
            {current} / {total}
          </span>
        )}
        <span>{total} רשומות</span>
        <span className="text-slate-300">|</span>
        <span className="text-slate-400">{label}</span>
      </div>
    </div>
  );
}

/** Grandchild page layout wrapper */
export function AdminGrandchildLayout({
  title,
  titleNode,
  backHref,
  backLabel,
  onRefresh,
  children,
  maxWidthClass = "max-w-4xl",
}: {
  title: string;
  titleNode?: React.ReactNode;
  backHref: string;
  backLabel: string;
  onRefresh?: () => void;
  children: React.ReactNode;
  maxWidthClass?: string;
}) {
  return (
    <>
      <AdminTitleBar
        title={title}
        titleNode={titleNode}
        backHref={backHref}
        backLabel={backLabel}
        onRefresh={onRefresh}
      />
      <main className="flex-1 overflow-auto">
        <div className={`mx-auto px-4 py-5 ${maxWidthClass}`}>
          {children}
        </div>
      </main>
    </>
  );
}
