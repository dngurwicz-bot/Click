"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { ModuleNavItem } from "@/lib/dashboardScreens";

interface TenantSubscriptionModuleNavItem {
  module_slug: string;
  status: "active" | "removed";
  valid_to?: string | null;
}

const tenantModulesCache = new Map<string, ModuleNavItem[]>();
const tenantModulesRequests = new Map<string, Promise<ModuleNavItem[]>>();

function fetchTenantModules(selectedTenantId: string) {
  const cacheKey = selectedTenantId || "__empty__";
  const cached = tenantModulesCache.get(cacheKey);
  if (cached) {
    return Promise.resolve(cached);
  }

  const existingRequest = tenantModulesRequests.get(cacheKey);
  if (existingRequest) {
    return existingRequest;
  }

  const request = (async () => {
    const catalogPromise = api
      .get<ModuleNavItem[]>("/api/admin/modules")
      .catch(() => [] as ModuleNavItem[]);

    const tenantModulesPromise = selectedTenantId
      ? api
          .get<TenantSubscriptionModuleNavItem[]>(`/api/admin/tenants/${selectedTenantId}/subscription-modules`)
          .catch(() => [] as TenantSubscriptionModuleNavItem[])
      : Promise.resolve([] as TenantSubscriptionModuleNavItem[]);

    const [catalogRows, tenantModuleRows] = await Promise.all([catalogPromise, tenantModulesPromise]);

    const activeTenantModuleSlugs = new Set(
      (Array.isArray(tenantModuleRows) ? tenantModuleRows : [])
        .filter((item) => item.status === "active")
        .map((item) => item.module_slug),
    );

    const nextModules = (Array.isArray(catalogRows) ? catalogRows : []).filter(
      (item) => item.is_active && activeTenantModuleSlugs.has(item.slug),
    );

    tenantModulesCache.set(cacheKey, nextModules);
    tenantModulesRequests.delete(cacheKey);
    return nextModules;
  })().catch((error) => {
    tenantModulesRequests.delete(cacheKey);
    throw error;
  });

  tenantModulesRequests.set(cacheKey, request);
  return request;
}

export function useTenantModuleNav(selectedTenantId: string) {
  const [modules, setModules] = useState<ModuleNavItem[]>(() => tenantModulesCache.get(selectedTenantId || "__empty__") ?? []);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const reload = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadModules() {
      const cacheKey = selectedTenantId || "__empty__";
      const cached = tenantModulesCache.get(cacheKey);
      if (cached) {
        setModules(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        const nextModules = await fetchTenantModules(selectedTenantId);
        if (cancelled) return;
        setModules(nextModules);
      } catch {
        if (!cancelled) {
          if (!tenantModulesCache.has(cacheKey)) {
            setModules([]);
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadModules();

    return () => {
      cancelled = true;
    };
  }, [refreshKey, selectedTenantId]);

  return { modules, loading, reload };
}
