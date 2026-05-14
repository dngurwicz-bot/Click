"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import clsx from "clsx";

export const ADMIN_MODAL_PANEL = "w-full rounded-2xl border border-slate-200 bg-white shadow-2xl";
export const ADMIN_MODAL_HEADER = "border-b border-slate-200 bg-[#dce4f0] px-5 py-4";
export const ADMIN_MODAL_BODY = "px-5 py-4";
export const ADMIN_MODAL_FOOTER = "flex items-center justify-end gap-2 rounded-b-2xl border-t border-slate-200 bg-slate-50 px-5 py-3";
export const ADMIN_MODAL_INPUT = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-right focus:border-brand-400 focus:outline-none";
export const ADMIN_MODAL_TEXTAREA = `${ADMIN_MODAL_INPUT} min-h-24`;
export const ADMIN_MODAL_DATE_INPUT = `${ADMIN_MODAL_INPUT} font-mono`;
export const ADMIN_MODAL_LABEL = "mb-1 block text-xs font-semibold text-slate-600";
export const ADMIN_MODAL_HELP = "text-[11px] text-slate-500";
export const ADMIN_MODAL_GRID = "grid gap-4 md:grid-cols-2";
export const ADMIN_MODAL_ACTION_PRIMARY = "rounded-md bg-[#0d6efd] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#0b5ed7] disabled:opacity-50";
export const ADMIN_MODAL_ACTION_SECONDARY = "rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50";
export const ADMIN_MODAL_ACTION_WARNING = "rounded-md bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50";
export const ADMIN_MODAL_ACTION_DANGER = "rounded-md bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50";

export function AdminModal({
  children,
  onBackdropClick,
}: {
  children: ReactNode;
  onBackdropClick?: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(event) => {
        if (event.target === event.currentTarget) onBackdropClick?.();
      }}
    >
      {children}
    </div>
  );
}

export function AdminModalPanel({
  children,
  className,
  dir = "rtl",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  dir?: "rtl" | "ltr";
  onClick?: () => void;
}) {
  return (
    <div className={clsx(ADMIN_MODAL_PANEL, className)} dir={dir} onClick={onClick}>
      {children}
    </div>
  );
}

export function AdminModalHeader({
  title,
  subtitle,
  onClose,
  className,
  titleClassName,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <div className={clsx("flex items-start justify-between gap-3", ADMIN_MODAL_HEADER, className)}>
      <div>
        <h3 className={clsx("text-sm font-semibold text-[#1a3a6e]", titleClassName)}>{title}</h3>
        {subtitle ? <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p> : null}
      </div>
      <button onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-white/70 hover:text-slate-700">
        <X size={16} />
      </button>
    </div>
  );
}

export function AdminModalBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx(ADMIN_MODAL_BODY, className)}>{children}</div>;
}

export function AdminModalFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx(ADMIN_MODAL_FOOTER, className)}>{children}</div>;
}

export function AdminField({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className={ADMIN_MODAL_LABEL}>{label}</label>
      {children}
    </div>
  );
}

export function AdminDateFields({
  fromLabel = "תוקף מתאריך",
  toLabel = "תוקף עד (אופציונלי)",
  fromField,
  toField,
  className,
}: {
  fromLabel?: ReactNode;
  toLabel?: ReactNode;
  fromField: ReactNode;
  toField: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("grid gap-4 border-t border-slate-200 pt-4 md:grid-cols-2", className)}>
      <AdminField label={fromLabel}>{fromField}</AdminField>
      <AdminField label={toLabel}>{toField}</AdminField>
    </div>
  );
}

export function AdminModalMessage({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "warning" | "danger";
  children: ReactNode;
  className?: string;
}) {
  const toneClasses =
    tone === "danger"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-slate-200 bg-slate-50 text-slate-600";

  return <div className={clsx("rounded-xl border px-4 py-3 text-xs", toneClasses, className)}>{children}</div>;
}
