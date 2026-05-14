export type CoreStructureRouteKey = "division" | "department" | "section" | "team" | "position";
export type OrgStructureLevel = "division" | "department" | "section" | "team";

export interface CoreStructureConfigItem {
  key: CoreStructureRouteKey;
  href: string;
  label: string;
  title: string;
  createLabel: string;
  searchPlaceholder: string;
  emptyMessage: string;
  unitType?: "division" | "department" | "section" | "team";
  parentType?: "division" | "department" | "section";
  parentLabel?: string;
}

export const CORE_STRUCTURE_CONFIG: Record<CoreStructureRouteKey, CoreStructureConfigItem> = {
  division: {
    key: "division",
    href: "/admin/core/structure/division",
    label: "חטיבה",
    title: "ניהול חטיבות",
    createLabel: "חטיבה חדשה",
    searchPlaceholder: "חיפוש חטיבה...",
    emptyMessage: "לא נמצאו חטיבות",
    unitType: "division",
  },
  department: {
    key: "department",
    href: "/admin/core/structure/department",
    label: "אגף",
    title: "ניהול אגפים",
    createLabel: "אגף חדש",
    searchPlaceholder: "חיפוש אגף...",
    emptyMessage: "לא נמצאו אגפים",
    unitType: "department",
    parentType: "division",
    parentLabel: "חטיבה",
  },
  section: {
    key: "section",
    href: "/admin/core/structure/section",
    label: "מחלקה",
    title: "ניהול מחלקות",
    createLabel: "מחלקה חדשה",
    searchPlaceholder: "חיפוש מחלקה...",
    emptyMessage: "לא נמצאו מחלקות",
    unitType: "section",
    parentType: "department",
    parentLabel: "אגף",
  },
  team: {
    key: "team",
    href: "/admin/core/structure/team",
    label: "צוות",
    title: "ניהול צוותים",
    createLabel: "צוות חדש",
    searchPlaceholder: "חיפוש צוות...",
    emptyMessage: "לא נמצאו צוותים",
    unitType: "team",
    parentType: "section",
    parentLabel: "מחלקה",
  },
  position: {
    key: "position",
    href: "/admin/core/structure/position",
    label: "תפקיד",
    title: "ניהול תפקידים",
    createLabel: "תפקיד חדש",
    searchPlaceholder: "חיפוש תפקיד...",
    emptyMessage: "לא נמצאו תפקידים",
  },
};

export const CORE_STRUCTURE_ITEMS = Object.values(CORE_STRUCTURE_CONFIG);

export const CORE_STRUCTURE_LEVEL_TO_ROUTE_KEY: Record<OrgStructureLevel, CoreStructureRouteKey> = {
  division: "division",
  department: "department",
  section: "section",
  team: "team",
};

export function getCoreStructureItemsForLevels(levels: OrgStructureLevel[]) {
  return [
    ...levels
      .map((level) => CORE_STRUCTURE_CONFIG[CORE_STRUCTURE_LEVEL_TO_ROUTE_KEY[level]])
      .filter(Boolean),
    CORE_STRUCTURE_CONFIG.position,
  ];
}
