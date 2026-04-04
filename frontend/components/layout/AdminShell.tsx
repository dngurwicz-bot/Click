"use client";

import Link from "next/link";
import { ChevronRight, HelpCircle, Printer, RefreshCw, Search } from "lucide-react";

export function AdminTitleBar({
  title,
  backHref,
  backLabel,
  onRefresh,
  utilitySlot,
}: {
  title: string;
  backHref?: string;
  backLabel?: string;
  onRefresh?: () => void;
  utilitySlot?: React.ReactNode;
}) {
  return (
    <div
      className="bg-white border-b border-slate-200 flex items-center justify-between px-3 py-1.5 shrink-0"
      style={{ boxShadow: "0 1px 0 0 #e2e8f0" }}
    >
      <div className="flex items-center gap-0.5">
        <button
          title="עזרה"
          className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <HelpCircle size={13} />
        </button>
        <button
          title="הדפסה"
          className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <Printer size={13} />
        </button>
        <button
          title="רענן"
          onClick={onRefresh}
          disabled={!onRefresh}
          className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-60"
        >
          <RefreshCw size={13} />
        </button>
        {utilitySlot}
      </div>

      <div className="flex items-center gap-2">
        {backHref && (
          <>
            <Link
              href={backHref}
              className="text-xs text-slate-400 hover:text-brand-600 transition-colors flex items-center gap-1"
            >
              <ChevronRight size={12} />
              {backLabel ?? "חזרה"}
            </Link>
            <span className="text-slate-300 text-xs">/</span>
          </>
        )}
        <h1 className="text-sm font-semibold tracking-wide" style={{ color: "#1c2831" }}>
          {title}
        </h1>
      </div>
    </div>
  );
}

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
    <div className="bg-slate-50 border-b border-slate-200 flex items-center justify-between px-3 py-1.5 shrink-0 gap-4">
      <div className="flex items-center gap-2 min-w-0">{start}</div>
      <div className="flex items-center gap-2 min-w-0">{center}</div>
      <div className="flex items-center gap-2 min-w-0">{end}</div>
    </div>
  );
}

export function AdminSearchField({
  value,
  onChange,
  placeholder = "חיפוש...",
  widthClass = "w-48",
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
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`pr-8 pl-3 py-1.5 text-xs border border-slate-300 bg-white rounded-md
          focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100
          text-right transition-colors ${widthClass}`}
      />
    </div>
  );
}

export function AdminCountLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-slate-400 font-medium">{children}</div>;
}

export function AdminSectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
        <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function AdminGrandchildLayout({
  title,
  backHref,
  backLabel,
  onRefresh,
  children,
  maxWidthClass = "max-w-4xl",
}: {
  title: string;
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
