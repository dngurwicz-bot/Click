"use client";

export const TENANT_OPTIONS_UPDATED_EVENT = "click:tenant-options-updated";

export function dispatchTenantOptionsUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TENANT_OPTIONS_UPDATED_EVENT));
}
