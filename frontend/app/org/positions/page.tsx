import { OrgStructureManagementPage } from "../structure/OrgStructureManagementPage";
import { CORE_STRUCTURE_CONFIG } from "@/app/admin/core/structure/config";

export default function OrgPositionsPage() {
  return <OrgStructureManagementPage config={CORE_STRUCTURE_CONFIG.position} />;
}
