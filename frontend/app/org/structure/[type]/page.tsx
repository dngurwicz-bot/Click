import { notFound } from "next/navigation";

import { CORE_STRUCTURE_CONFIG, type CoreStructureRouteKey } from "@/app/admin/core/structure/config";

import { OrgStructureManagementPage } from "../OrgStructureManagementPage";

export default async function OrgStructureTypedPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const config = CORE_STRUCTURE_CONFIG[type as CoreStructureRouteKey];

  if (!config?.unitType) {
    notFound();
  }

  return <OrgStructureManagementPage config={config} />;
}
