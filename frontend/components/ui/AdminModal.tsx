"use client";

import { type ReactNode } from "react";
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

// ── Components ────────────────────────────────────────────────────────────────

interface AdminModalProps {
  onBackdropClick?: () => void;
  children: ReactNode;
}

export function AdminModal({ onBackdropClick, children }: AdminModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
      style={{ background: "rgba(15, 23, 42, 0.45)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onBackdropClick?.();
      }}
    >
      {children}
    </div>
  );
}

interface AdminModalPanelProps {
  className?: string;
  children: ReactNode;
}

export function AdminModalPanel({ className, children }: AdminModalPanelProps) {
  return (
    <div
      className={`relative w-full rounded-xl bg-white shadow-2xl ${className ?? "max-w-lg"}`}
      style={{ maxHeight: "90vh", display: "flex", flexDirection: "column" }}
    >
      {children}
    </div>
  );
}

interface AdminModalHeaderProps {
  title: string;
  subtitle?: string;
  onClose?: () => void;
}

export function AdminModalHeader({ title, subtitle, onClose }: AdminModalHeaderProps) {
  return (
    <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 shrink-0">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        >
          <X size={14} />
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
    <div className={`overflow-y-auto px-5 py-4 ${className ?? ""}`} style={{ flex: "1 1 auto" }}>
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
    <div className={`flex items-center gap-2 border-t border-slate-100 px-5 py-3 shrink-0 ${className ?? "justify-end"}`}>
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
  label: string;
  value?: ReactNode;
  className?: string;
}

export function AdminField({ label, value, className }: AdminFieldProps) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-medium text-slate-500 mb-1">{label}</label>
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 min-h-[32px]">
        {value ?? "—"}
      </div>
    </div>
  );
}

interface AdminDateFieldsProps {
  fromLabel?: string;
  fromField: ReactNode;
  toLabel?: string;
  toField: ReactNode;
}

export function AdminDateFields({ fromLabel = "מתאריך", fromField, toLabel = "עד תאריך", toField }: AdminDateFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
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
