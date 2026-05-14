import { notFound } from "next/navigation";

import { StructureManagementPage } from "../StructureManagementPage";
import { CORE_STRUCTURE_CONFIG, type CoreStructureRouteKey } from "../config";

export default async function CoreStructureTypedPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const config = CORE_STRUCTURE_CONFIG[type as CoreStructureRouteKey];

  if (!config) {
    notFound();
  }

  return <StructureManagementPage config={config} />;
}
