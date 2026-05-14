"use client";

import { useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import { getCoreStructureItemsForLevels, type OrgStructureLevel } from "@/app/admin/core/structure/config";

export interface TenantOrgStructureConfig {
  levels: OrgStructureLevel[];
  position_attachment_level: OrgStructureLevel | null;
  is_hierarchical: boolean;
}

export const ORG_STRUCTURE_UPDATED_EVENT = "click:org-structure-updated";

export function dispatchOrgStructureUpdated(tenantId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ORG_STRUCTURE_UPDATED_EVENT, { detail: { tenantId } }));
}

export function useTenantOrgStructureItems(selectedTenantId: string) {
  const [tenantConfig, setTenantConfig] = useState<TenantOrgStructureConfig | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    function handleOrgStructureUpdated(event: Event) {
      const customEvent = event as CustomEvent<{ tenantId?: string }>;
      if (!selectedTenantId || customEvent.detail?.tenantId !== selectedTenantId) return;
      setRefreshKey((current) => current + 1);
    }

    window.addEventListener(ORG_STRUCTURE_UPDATED_EVENT, handleOrgStructureUpdated);
    return () => window.removeEventListener(ORG_STRUCTURE_UPDATED_EVENT, handleOrgStructureUpdated);
  }, [selectedTenantId]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedTenantId) {
      setTenantConfig(null);
      return;
    }

    api
      .get<TenantOrgStructureConfig>(`/api/admin/tenants/${selectedTenantId}/org-structure`)
      .then((data) => {
        if (!cancelled) setTenantConfig(data);
      })
      .catch(() => {
        if (!cancelled) setTenantConfig(null);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey, selectedTenantId]);

  const structureItems = useMemo(() => {
    if (!tenantConfig?.levels?.length) return [];
    return getCoreStructureItemsForLevels(tenantConfig.levels);
  }, [tenantConfig]);

  return { tenantConfig, structureItems };
}
