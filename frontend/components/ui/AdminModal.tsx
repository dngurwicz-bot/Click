"use client";

import { type ComponentPropsWithoutRef, type ReactNode } from "react";
import { X } from "lucide-react";

// ── CSS constants ─────────────────────────────────────────────────────────────

export const ADMIN_MODAL_ACTION_PRIMARY =
  "flex items-center gap-1.5 rounded bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

export const ADMIN_MODAL_ACTION_SECONDARY =
  "flex items-center gap-1.5 rounded bg-white border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

export const ADMIN_MODAL_ACTION_DANGER =
  "flex items-center gap-1.5 rounded bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

export const ADMIN_MODAL_ACTION_WARNING =
  "flex items-center gap-1.5 rounded bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

// 2-column form grid — tight desktop spacing
export const ADMIN_MODAL_GRID =
  "grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2";

// 3-column form grid — for sections with many fields
export const ADMIN_MODAL_GRID_3 =
  "grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-3";

// Standard text input — filled style (no border, gray bg)
export const ADMIN_MODAL_INPUT =
  "w-full rounded bg-slate-100 px-3 py-2 text-sm text-slate-800 " +
  "focus:bg-brand-50 focus:outline-none focus:ring-1 focus:ring-brand-300 " +
  "disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

// Date input — compact fixed width, monospace, filled
export const ADMIN_MODAL_DATE_INPUT =
  "w-36 rounded bg-slate-100 px-3 py-2 text-sm text-slate-800 font-mono " +
  "focus:bg-brand-50 focus:outline-none focus:ring-1 focus:ring-brand-300 " +
  "disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

export const ADMIN_MODAL_TEXTAREA =
  "w-full rounded bg-slate-100 px-3 py-2 text-sm text-slate-800 " +
  "focus:bg-brand-50 focus:outline-none focus:ring-1 focus:ring-brand-300 " +
  "resize-y min-h-[80px] disabled:opacity-50 transition-colors";

// Full-page overlay — covers everything below the top nav, solid white
export const ADMIN_MODAL_OVERLAY_CLASS =
  "fixed inset-x-0 bottom-0 top-[52px] z-50 bg-white";

export const ADMIN_MODAL_CONTAINER_CLASS =
  "flex h-full w-full overflow-hidden";

export const ADMIN_MODAL_PANEL_CLASS =
  "relative flex h-full w-full flex-col overflow-hidden bg-white";

// ── Components ────────────────────────────────────────────────────────────────

interface AdminModalProps {
  onBackdropClick?: () => void;
  children: ReactNode;
}

export function AdminModal({ children }: AdminModalProps) {
  return (
    <div className={ADMIN_MODAL_OVERLAY_CLASS}>
      <div className={ADMIN_MODAL_CONTAINER_CLASS}>
        {children}
      </div>
    </div>
  );
}

interface AdminModalPanelProps extends ComponentPropsWithoutRef<"div"> {
  className?: string;
  children: ReactNode;
}

export function AdminModalPanel({ className, children, ...props }: AdminModalPanelProps) {
  return (
    <div
      {...props}
      className={`${ADMIN_MODAL_PANEL_CLASS} ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

interface AdminModalHeaderProps {
  title: ReactNode;
  subtitle?: string;
  onClose?: () => void;
}

export function AdminModalHeader({ title, subtitle, onClose }: AdminModalHeaderProps) {
  return (
    // justify-between in RTL: first child → physical RIGHT, last child → physical LEFT
    <div
      className="flex items-center justify-between border-b border-slate-200 bg-white px-5 shrink-0"
      style={{ minHeight: 48 }}
    >
      {/* RIGHT side in RTL — title + optional subtitle */}
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
        {subtitle && <span className="h-3.5 w-px bg-slate-200" />}
        {subtitle && <span className="text-sm text-slate-400">{subtitle}</span>}
      </div>
      {/* LEFT side in RTL — close button */}
      {onClose && (
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          title="סגור"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

interface AdminModalBodyProps {
  className?: string;
  children: ReactNode;
}

export function AdminModalBody({ className, children }: AdminModalBodyProps) {
  return (
    <div
      className={`overflow-y-auto bg-slate-50 px-6 py-5 ${className ?? ""}`}
      style={{ flex: "1 1 auto" }}
    >
      {children}
    </div>
  );
}

interface AdminModalFooterProps {
  className?: string;
  children: ReactNode;
}

export function AdminModalFooter({ className, children }: AdminModalFooterProps) {
  // justify-start in RTL = physical RIGHT — buttons always on the right
  return (
    <div
      className={`flex items-center gap-2 border-t border-slate-200 bg-white px-5 py-3 shrink-0 ${className ?? "justify-start"}`}
    >
      {children}
    </div>
  );
}

interface AdminModalMessageProps {
  tone?: "info" | "warning" | "danger" | "success";
  children: ReactNode;
}

const MESSAGE_STYLES = {
  info:    "bg-blue-50 border border-blue-200 text-blue-800",
  warning: "bg-amber-50 border border-amber-200 text-amber-800",
  danger:  "bg-red-50 border border-red-200 text-red-800",
  success: "bg-emerald-50 border border-emerald-200 text-emerald-800",
};

export function AdminModalMessage({ tone = "info", children }: AdminModalMessageProps) {
  return (
    <div className={`rounded px-3 py-2 text-sm leading-relaxed ${MESSAGE_STYLES[tone]}`}>
      {children}
    </div>
  );
}

interface AdminFieldProps {
  label?: ReactNode;
  value?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function AdminField({ label, value, className, children }: AdminFieldProps) {
  return (
    <div className={className}>
      <label className="mb-0.5 block text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </label>
      <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 min-h-[36px]">
        {children ?? value ?? "—"}
      </div>
    </div>
  );
}

interface AdminDateFieldsProps {
  fromLabel?: string;
  fromField: ReactNode;
  toLabel?: string;
  toField: ReactNode;
  className?: string;
}

export function AdminDateFields({
  fromLabel = "מתאריך",
  fromField,
  toLabel = "עד תאריך",
  toField,
  className,
}: AdminDateFieldsProps) {
  return (
    <div className={`flex items-end gap-4 ${className ?? ""}`}>
      <div>
        <label className="mb-0.5 block text-xs font-medium uppercase tracking-wide text-slate-400">
          {fromLabel}
        </label>
        {fromField}
      </div>
      <div>
        <label className="mb-0.5 block text-xs font-medium uppercase tracking-wide text-slate-400">
          {toLabel}
        </label>
        {toField}
      </div>
    </div>
  );
}
