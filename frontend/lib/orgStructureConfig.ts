"use client";

import { useEffect, useMemo, useState } from "react";

import { api, getOrgAdminTenantId } from "@/lib/api";
import { getCoreStructureItemsForLevels, type OrgStructureLevel } from "@/app/admin/core/structure/config";

export interface TenantOrgStructureConfig {
  levels: OrgStructureLevel[];
  position_attachment_level: OrgStructureLevel | null;
  is_hierarchical: boolean;
}

export interface OrgStructureNavEntry {
  key: OrgStructureLevel | "position";
  href: string;
  label: string;
}

const ORG_STRUCTURE_LEVEL_NAV: Record<OrgStructureLevel, OrgStructureNavEntry> = {
  division: { key: "division", href: "/org/structure/division", label: "חטיבות" },
  department: { key: "department", href: "/org/structure/department", label: "אגפים" },
  section: { key: "section", href: "/org/structure/section", label: "מחלקות" },
  team: { key: "team", href: "/org/structure/team", label: "צוותים" },
};

const ORG_POSITION_NAV: OrgStructureNavEntry = {
  key: "position",
  href: "/org/positions",
  label: "תפקידים",
};

export const ORG_STRUCTURE_UPDATED_EVENT = "click:org-structure-updated";

const tenantOrgStructureCache = new Map<string, TenantOrgStructureConfig>();
const tenantOrgStructureRequests = new Map<string, Promise<TenantOrgStructureConfig>>();

function getTenantOrgStructureCacheKey(selectedTenantId: string, orgAdminTenantId: string | null) {
  return `${orgAdminTenantId ? "org" : "admin"}:${selectedTenantId}`;
}

function fetchTenantOrgStructure(
  selectedTenantId: string,
  orgAdminTenantId: string | null,
) {
  const cacheKey = getTenantOrgStructureCacheKey(selectedTenantId, orgAdminTenantId);
  const cached = tenantOrgStructureCache.get(cacheKey);
  if (cached) {
    return Promise.resolve(cached);
  }

  const existingRequest = tenantOrgStructureRequests.get(cacheKey);
  if (existingRequest) {
    return existingRequest;
  }

  const request = api
    .get<TenantOrgStructureConfig>(
      orgAdminTenantId
        ? "/api/org/org-structure"
        : `/api/admin/tenants/${selectedTenantId}/org-structure`,
    )
    .then((data) => {
      tenantOrgStructureCache.set(cacheKey, data);
      tenantOrgStructureRequests.delete(cacheKey);
      return data;
    })
    .catch((error) => {
      tenantOrgStructureRequests.delete(cacheKey);
      throw error;
    });

  tenantOrgStructureRequests.set(cacheKey, request);
  return request;
}

export function dispatchOrgStructureUpdated(tenantId: string) {
  if (typeof window === "undefined") return;
  tenantOrgStructureCache.delete(getTenantOrgStructureCacheKey(tenantId, null));
  tenantOrgStructureCache.delete(getTenantOrgStructureCacheKey(tenantId, tenantId));
  window.dispatchEvent(new CustomEvent(ORG_STRUCTURE_UPDATED_EVENT, { detail: { tenantId } }));
}

export function getOrgStructureNavEntries(levels: OrgStructureLevel[]) {
  return [
    { key: "overview", href: "/org/structure", label: "סקירה כללית" } as const,
    ...levels.map((level) => ORG_STRUCTURE_LEVEL_NAV[level]).filter(Boolean),
    ORG_POSITION_NAV,
  ];
}

export function useTenantOrgStructureItems(selectedTenantId: string) {
  const orgAdminTenantId = getOrgAdminTenantId();
  const cacheKey = selectedTenantId ? getTenantOrgStructureCacheKey(selectedTenantId, orgAdminTenantId) : "";
  const [tenantConfig, setTenantConfig] = useState<TenantOrgStructureConfig | null>(() =>
    cacheKey ? tenantOrgStructureCache.get(cacheKey) ?? null : null,
  );
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
    if (!selectedTenantId) {
      setTenantConfig(null);
      return;
    }

    const nextCacheKey = getTenantOrgStructureCacheKey(selectedTenantId, orgAdminTenantId);
    const cached = tenantOrgStructureCache.get(nextCacheKey);
    if (cached) {
      setTenantConfig(cached);
    }

    let cancelled = false;

    fetchTenantOrgStructure(selectedTenantId, orgAdminTenantId)
      .then((data) => {
        if (!cancelled) setTenantConfig(data);
      })
      .catch(() => {
        if (!cancelled && !tenantOrgStructureCache.has(nextCacheKey)) setTenantConfig(null);
      });

    return () => {
      cancelled = true;
    };
  }, [orgAdminTenantId, refreshKey, selectedTenantId]);

  const structureItems = useMemo(() => {
    if (!tenantConfig?.levels?.length) return [];
    return getCoreStructureItemsForLevels(tenantConfig.levels);
  }, [tenantConfig]);

  return { tenantConfig, structureItems };
}
