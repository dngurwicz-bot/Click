"use client";

import { type ComponentPropsWithoutRef, type ReactNode } from "react";
import { X } from "lucide-react";

// ── CSS constants ─────────────────────────────────────────────────────────────

export const ADMIN_MODAL_ACTION_PRIMARY =
  "flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

export const ADMIN_MODAL_ACTION_SECONDARY =
  "flex items-center gap-1.5 rounded-md bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

export const ADMIN_MODAL_ACTION_DANGER =
  "flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

export const ADMIN_MODAL_ACTION_WARNING =
  "flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

export const ADMIN_MODAL_GRID =
  "grid grid-cols-1 gap-4 sm:grid-cols-2";

export const ADMIN_MODAL_INPUT =
  "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-400";

export const ADMIN_MODAL_TEXTAREA =
  "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 resize-y min-h-[80px] disabled:bg-slate-50";

export const ADMIN_MODAL_OVERLAY_CLASS =
  "fixed inset-x-0 bottom-0 top-[52px] z-50 bg-[linear-gradient(180deg,rgba(241,245,249,0.92)_0%,rgba(226,232,240,0.96)_100%)] backdrop-blur-sm";

export const ADMIN_MODAL_CONTAINER_CLASS =
  "flex h-full w-full justify-center overflow-hidden px-2 pb-2 pt-1 sm:px-3 sm:pb-3 sm:pt-2 lg:px-4 lg:pb-4";

export const ADMIN_MODAL_PANEL_CLASS =
  "relative flex h-full w-full flex-col overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]";

// ── Components ────────────────────────────────────────────────────────────────

interface AdminModalProps {
  onBackdropClick?: () => void;
  children: ReactNode;
}

export function AdminModal({ onBackdropClick, children }: AdminModalProps) {
  return (
    <div className={ADMIN_MODAL_OVERLAY_CLASS}>
      <div
        className={ADMIN_MODAL_CONTAINER_CLASS}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onBackdropClick?.();
        }}
      >
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
    <div className="flex items-start justify-between border-b border-slate-200 bg-[#dce4f0] px-6 py-5 shrink-0">
      <div>
        <h2 className="text-lg font-bold text-[#1a3a6e]">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/70 hover:text-slate-700"
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
    <div className={`overflow-y-auto px-6 py-6 ${className ?? ""}`} style={{ flex: "1 1 auto" }}>
      {children}
    </div>
  );
}

interface AdminModalFooterProps {
  className?: string;
  children: ReactNode;
}

export function AdminModalFooter({ className, children }: AdminModalFooterProps) {
  return (
    <div className={`flex items-center gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 shrink-0 ${className ?? "justify-end"}`}>
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
    <div className={`rounded-lg px-3 py-2.5 text-xs leading-relaxed ${MESSAGE_STYLES[tone]}`}>
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
      <label className="block text-[11px] font-medium text-slate-500 mb-1">{label}</label>
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 min-h-[32px]">
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

export function AdminDateFields({ fromLabel = "מתאריך", fromField, toLabel = "עד תאריך", toField, className }: AdminDateFieldsProps) {
  return (
    <div className={`grid grid-cols-2 gap-3 ${className ?? ""}`}>
      <div>
        <label className="block text-[11px] font-medium text-slate-500 mb-1">{fromLabel}</label>
        {fromField}
      </div>
      <div>
        <label className="block text-[11px] font-medium text-slate-500 mb-1">{toLabel}</label>
        {toField}
      </div>
    </div>
  );
}
