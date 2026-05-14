"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { ModuleNavItem } from "@/lib/dashboardScreens";

interface TenantSubscriptionModuleNavItem {
  module_slug: string;
  status: "active" | "removed";
  valid_to?: string | null;
}

export function useTenantModuleNav(selectedTenantId: string) {
  const [modules, setModules] = useState<ModuleNavItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const reload = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadModules() {
      setLoading(true);

      try {
        const catalogPromise = api
          .get<ModuleNavItem[]>("/api/admin/modules")
          .catch(() => [] as ModuleNavItem[]);

        const tenantModulesPromise = selectedTenantId
          ? api
              .get<TenantSubscriptionModuleNavItem[]>(`/api/admin/tenants/${selectedTenantId}/subscription-modules`)
              .catch(() => [] as TenantSubscriptionModuleNavItem[])
          : Promise.resolve([] as TenantSubscriptionModuleNavItem[]);

        const [catalogRows, tenantModuleRows] = await Promise.all([catalogPromise, tenantModulesPromise]);
        if (cancelled) return;

        const activeTenantModuleSlugs = new Set(
          (Array.isArray(tenantModuleRows) ? tenantModuleRows : [])
            .filter((item) => item.status === "active")
            .map((item) => item.module_slug),
        );

        const nextModules = (Array.isArray(catalogRows) ? catalogRows : []).filter(
          (item) => item.is_active && activeTenantModuleSlugs.has(item.slug),
        );

        setModules(nextModules);
      } catch {
        if (!cancelled) {
          setModules([]);
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
