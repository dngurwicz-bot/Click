"use client";

import { getStoredUser } from "@/lib/api";
import { LOOKUP_ADMIN_HREF, LOOKUP_ORG_HREF } from "@/lib/lookupRegistry";
import { LookupPickerField } from "./LookupPickerField";

interface FormFieldProps {
  label: string;
  required?: boolean;
  value?: string | null;
  type?: "text" | "email" | "select" | "textarea";
  options?: { value: string; label: string; code?: string }[];
  readOnly?: boolean;
  onChange?: (v: string) => void;
  span?: number;
  lookupKey?: string;
  lookupHref?: string;
  canAdmin?: boolean;
}

function resolveAdminProps(
  lookupKey: string | undefined,
  lookupHref: string | undefined,
  canAdmin: boolean | undefined,
): { resolvedHref: string | undefined; resolvedCanAdmin: boolean } {
  const user = getStoredUser();
  const role = user?.role ?? "";
  const isSuperOrAdmin = role === "super_admin" || role === "admin";
  const isOrgAdmin = role === "org_admin";

  const href =
    lookupHref ??
    (lookupKey
      ? isSuperOrAdmin
        ? LOOKUP_ADMIN_HREF[lookupKey]
        : isOrgAdmin
          ? LOOKUP_ORG_HREF[lookupKey]
          : undefined
      : undefined);

  return {
    resolvedHref: href,
    resolvedCanAdmin: canAdmin ?? (isSuperOrAdmin || isOrgAdmin),
  };
}

export function FormField({
  label,
  required,
  value,
  type = "text",
  options,
  readOnly = true,
  onChange,
  lookupKey,
  lookupHref,
  canAdmin,
}: FormFieldProps) {
  if (type === "select") {
    const { resolvedHref, resolvedCanAdmin } = resolveAdminProps(lookupKey, lookupHref, canAdmin);
    return (
      <LookupPickerField
        label={label}
        required={required}
        value={value}
        options={options ?? []}
        readOnly={readOnly}
        onChange={onChange}
        lookupHref={resolvedHref}
        canAdmin={resolvedCanAdmin}
      />
    );
  }

  const inputClass =
    "flex-1 min-w-0 rounded px-3 py-2 text-sm text-right bg-slate-100 " +
    "focus:outline-none focus:ring-1 focus:ring-brand-300 focus:bg-brand-50 " +
    "disabled:opacity-50 read-only:cursor-default " +
    "transition-colors";

  return (
    <div className="flex items-center gap-2 min-h-[34px]">
      <label
        className="text-xs sm:text-sm font-medium text-slate-500 shrink-0 text-right whitespace-nowrap"
        style={{ minWidth: "96px" }}
      >
        {required && <span className="text-red-400 ml-0.5">*</span>}
        {label}
      </label>
      {type === "textarea" ? (
        <textarea
          value={value ?? ""}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
          rows={2}
          className={`${inputClass} resize-none`}
        />
      ) : (
        <input
          type={type}
          value={value ?? ""}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
          className={inputClass}
        />
      )}
    </div>
  );
}
