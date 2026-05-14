"use client";

import {
  BarChart3,
  BookOpen,
  Building2,
  ClipboardList,
  FileText,
  FolderTree,
  Home,
  List,
  Package,
  Quote,
  Receipt,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { BILLING_ENABLED } from "@/lib/features";
import type { UserInfo } from "@/lib/api";

export interface ModuleNavItem {
  slug: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

export interface DashboardScreen {
  id: string;
  href: string;
  label: string;
  shortDescription: string;
  fullDescription: string;
  icon: LucideIcon;
  resource?: string;
  navGroup: "primary" | "admin" | "billing" | "module" | "org_admin";
  pinToDashboard?: boolean;
  hideFromNav?: boolean;
}

const DASHBOARD_STORAGE_KEY = "click_dashboard_screen_ids";
const DASHBOARD_EVENT_NAME = "click-dashboard-screens-updated";

export const DASHBOARD_SCREEN_DEFS: DashboardScreen[] = [
  {
    id: "dashboard",
    href: "/dashboard",
    label: "ראשי",
    shortDescription: "העמוד הראשי של המערכת עם גישה מהירה למידע ולעבודה שוטפת.",
    fullDescription:
      "זהו מסך הבית של המערכת. מכאן רואים תמונת מצב כללית, נתוני מערכת מרכזיים, פעילות אחרונה, וקיצורי דרך למסכים שחשובים לעבודה היומית שלך.",
    icon: Home,
    navGroup: "primary",
    pinToDashboard: false,
  },
  {
    id: "admin:tenants",
    href: "/admin/tenants",
    label: "ארגונים",
    shortDescription: "ניהול כל הלקוחות והארגונים במערכת.",
    fullDescription:
      "מסך הארגונים מציג את כל הלקוחות במערכת ומאפשר להיכנס לכל ארגון, לעדכן פרטים, לנהל סטטוס, מודולים פעילים, מסמכי חיוב והגדרות נוספות ברמת הארגון.",
    icon: Building2,
    resource: "tenants",
    navGroup: "admin",
  },
  {
    id: "admin:lookups",
    href: "/admin/lookups",
    label: "רשימות",
    shortDescription: "ניהול רשימות ערכים ותוכן קבוע במערכת.",
    fullDescription:
      "מסך הרשימות מאפשר לנהל רשימות מערכתיות כמו ערכי בחירה, קטלוגים, וספריות נתונים שמוזנות למסכים אחרים. שינויים כאן משפיעים על טפסים ותהליכים ברחבי המערכת.",
    icon: List,
    resource: "lookups",
    navGroup: "admin",
  },
  {
    id: "admin:modules",
    href: "/admin/modules",
    label: "מודולים",
    shortDescription: "ניהול מודולים, סטטוס פעילות ומחירון.",
    fullDescription:
      "מסך המודולים משמש להגדרה ותחזוקה של מודולי המערכת: שמות, מאפיינים, זמינות, ומסלולי תמחור. זהו המקום שבו מנהלים את שכבת המוצרים של המערכת.",
    icon: Package,
    resource: "modules",
    navGroup: "admin",
  },
  {
    id: "admin:reports",
    href: "/admin/reports",
    label: "דוחות ו-Insights",
    shortDescription: "סביבת דוחות גלובלית להפקה, ייצוא ושמירת תצוגות.",
    fullDescription:
      "מסך הדוחות פותח את סביבת CLICK Insights ברמת המערכת, כולל דוחות מובנים, תבניות, דוחות שמורים וכלי ייצוא וניתוח, ללא תלות בארגון פעיל.",
    icon: BarChart3,
    resource: "reports",
    navGroup: "admin",
  },
  {
    id: "admin:billing",
    href: "/admin/billing/overview",
    label: "חיובים",
    shortDescription: "מרכז ניהול החיובים, ההצעות, החשבוניות והגדרות ההנפקה.",
    fullDescription:
      "אזור החיובים מרכז את כל פעילות הגבייה והמסמכים במערכת: סקירה תקופתית, הצעות מחיר, חיובים, חשבוניות והגדרות מנפיק. מכאן עוקבים אחרי מצב כספי ומבצעים פעולות תפעוליות.",
    icon: Receipt,
    resource: "billing",
    navGroup: "admin",
    pinToDashboard: false,
  },
  {
    id: "admin:billing:overview",
    href: "/admin/billing/overview",
    label: "סקירת חיובים",
    shortDescription: "תמונת מצב תקופתית של חיובים, חשבוניות והצעות מחיר.",
    fullDescription:
      "מסך סקירת החיובים מרכז KPIs ונתונים לתקופה שנבחרה, כולל חיובים ממתינים, מסמכים שהופקו, תשלומים שבוצעו, פיגורים והצעות מחיר פתוחות.",
    icon: BarChart3,
    resource: "billing",
    navGroup: "billing",
  },
  {
    id: "admin:billing:quotes",
    href: "/admin/billing/quotes",
    label: "הצעות מחיר",
    shortDescription: "יצירה, מעקב וניהול של הצעות מחיר ללקוחות.",
    fullDescription:
      "מסך הצעות המחיר מאפשר לבנות הצעות מסחריות, לעקוב אחר הסטטוס שלהן, להמיר הצעה מאושרת לחשבונית, ולנהל את תהליך המכירה מקצה לקצה.",
    icon: Quote,
    resource: "billing",
    navGroup: "billing",
  },
  {
    id: "admin:billing:charges",
    href: "/admin/billing/charges",
    label: "חיובים",
    shortDescription: "רשימת חיובים, חישובי תקופה והכנה להפקת מסמכים.",
    fullDescription:
      "מסך החיובים מציג חיובים שנוצרו ללקוחות, מאפשר להפיק חיובים מרוכזים, לבדוק סטטוסים, ולוודא שהנתונים מוכנים להמשך תהליך הגבייה וההפקה.",
    icon: Wallet,
    resource: "billing",
    navGroup: "billing",
  },
  {
    id: "admin:billing:invoices",
    href: "/admin/billing/invoices",
    label: "חשבוניות",
    shortDescription: "ניהול מסמכי חיוב, תשלום, סגירה וסטטוסים.",
    fullDescription:
      "מסך החשבוניות מאפשר לצפות בכל החשבוניות, לבצע פעולות כמו סגירה, סימון כשולם, בדיקת סטטוסים ומעקב אחרי מסמכים פתוחים או בפיגור.",
    icon: FileText,
    resource: "billing",
    navGroup: "billing",
  },
  {
    id: "admin:billing:settings",
    href: "/admin/billing/settings",
    label: "הגדרות מנפיק",
    shortDescription: "הגדרות זהות המנפיק והנתונים שמופיעים במסמכי חיוב.",
    fullDescription:
      "מסך הגדרות המנפיק משמש להגדרת פרטי היישות המנפיקה במסמכי החיוב: שם, מספרים מזהים, פרטי התקשרות ונתוני תצוגה נוספים שישפיעו על הצעות מחיר וחשבוניות.",
    icon: Receipt,
    resource: "billing",
    navGroup: "billing",
  },
  {
    id: "admin:users",
    href: "/admin/users",
    label: "משתמשים",
    shortDescription: "ניהול משתמשי מנהל, תפקידים והרשאות.",
    fullDescription:
      "מסך המשתמשים מרכז את כל משתמשי המערכת הניהוליים. כאן מגדירים תפקידים, פותחים או סוגרים הרשאות, מעדכנים גישה זמנית ומנהלים את רמת השליטה של כל משתמש.",
    icon: Users,
    resource: "users",
    navGroup: "admin",
  },
  {
    id: "admin:templates",
    href: "/admin/templates",
    label: "תבניות",
    shortDescription: "ניהול תבניות הקמה ותצורות מוכנות לארגונים.",
    fullDescription:
      "מסך התבניות מאפשר להגדיר תבניות עבודה שניתן להחיל על ארגונים חדשים או קיימים, כולל בחירת מודולים ותצורות ברירת מחדל לתהליכי הקמה ותחזוקה.",
    icon: FileText,
    resource: "templates",
    navGroup: "admin",
  },
  {
    id: "admin:audit",
    href: "/admin/audit",
    label: "Audit",
    shortDescription: "יומן פעולות מערכת ומעקב אחרי שינויים.",
    fullDescription:
      "מסך ה-Audit מציג פעולות שנעשו במערכת, מי ביצע אותן ומתי. הוא משמש לבקרה, תחקור תקלות, מעקב אחר שינויים ועמידה בדרישות תיעוד.",
    icon: ClipboardList,
    resource: "audit",
    navGroup: "admin",
  },
  {
    id: "insights:new_report",
    href: "/admin/reports?new=true",
    label: "יצירת דוח חדש",
    shortDescription: "כניסה מהירה לעמוד יצירת דוח חדש בסביבת Insights.",
    fullDescription: "מסך זה מאפשר לך לעבור ישירות ל-Report Builder כדי לבנות דוח חדש לגמרי מאפס או באמצעות בחירת מודל נתונים.",
    icon: FileText,
    navGroup: "module",
    hideFromNav: true,
  },
  {
    id: "core:employees",
    href: "/admin/core",
    label: "רשימת עובדים",
    shortDescription: "רשימת העובדים המרכזית של CLICK Core.",
    fullDescription:
      "מסך רשימת העובדים מרכז את כלל העובדים, חיפוש, סינון וכניסה לכרטיסי עובד מלאים לצורך צפייה, ניהול ועדכון נתוני HR.",
    icon: ShieldCheck,
    navGroup: "module",
    hideFromNav: true,
  },
  {
    id: "core:structure",
    href: "/admin/core/structure",
    label: "מבנה ארגוני",
    shortDescription: "ניהול שכבות המבנה הארגוני והשיוך ביניהן.",
    fullDescription:
      "מסך המבנה הארגוני מאפשר לנהל חטיבות, אגפים, מחלקות, צוותים ותפקידים, ולהגדיר את ההיררכיה הארגונית של הלקוח הפעיל.",
    icon: ShieldCheck,
    navGroup: "module",
    hideFromNav: true,
  },
  {
    id: "org:positions",
    href: "/org/positions",
    label: "תפקידים",
    shortDescription: "ניהול רשימת התפקידים של הארגון.",
    fullDescription:
      "מסך התפקידים מאפשר לנהל את קטלוג התפקידים הארגוניים: הוספה, עדכון, הגדרת תקופת תוקף ושיוך לרמה הארגונית המתאימה.",
    icon: ShieldCheck,
    navGroup: "org_admin",
  },
  {
    id: "org:structure",
    href: "/org/structure",
    label: "יחידות ארגוניות",
    shortDescription: "ניהול חטיבות, אגפים, מחלקות וצוותים.",
    fullDescription:
      "מסך היחידות הארגוניות מאפשר לנהל את ההיררכיה הארגונית של הארגון: חטיבות, אגפים, מחלקות וצוותים, כולל הגדרת הורה-ילד ומנהל יחידה.",
    icon: FolderTree,
    navGroup: "org_admin",
  },
  {
    id: "org:courses",
    href: "/org/courses",
    label: "קורסים",
    shortDescription: "קטלוג הקורסים וההכשרות הארגוניות.",
    fullDescription:
      "מסך הקורסים מאפשר לנהל את קטלוג הקורסים וההכשרות של הארגון: שם, קטגוריה, משך, חובה/רשות ותקופת תוקף.",
    icon: BookOpen,
    navGroup: "org_admin",
  },
];

const STATIC_SCREEN_BY_ID = new Map(DASHBOARD_SCREEN_DEFS.map((screen) => [screen.id, screen]));

export const ORG_ADMIN_SCREEN_IDS = [
  "org:positions",
  "org:structure",
  "org:courses",
] as const;

export const ADMIN_SCREEN_IDS = [
  "admin:tenants",
  "admin:lookups",
  "admin:modules",
  "admin:reports",
  "admin:billing",
  "admin:users",
  "admin:templates",
  "admin:audit",
] as const;

export const BILLING_SCREEN_IDS = [
  "admin:billing:overview",
  "admin:billing:quotes",
  "admin:billing:charges",
  "admin:billing:invoices",
  "admin:billing:settings",
] as const;

function hasScreenAccess(screen: DashboardScreen, user: UserInfo | null) {
  if (!screen.resource) return true;
  if (!user) return false;
  if (user.role === "super_admin") return true;
  return user.permissions?.some((permission) => permission.resource === screen.resource && permission.can_view) ?? false;
}

export function getStaticScreen(screenId: string) {
  return STATIC_SCREEN_BY_ID.get(screenId) ?? null;
}

export function buildModuleScreen(module: Pick<ModuleNavItem, "slug" | "name">): DashboardScreen {
  const isInsights = module.slug === "insights";
  const isCore = module.slug === "core";
  return {
    id: `module:${module.slug}`,
    href: isCore ? "/admin/core" : `/modules/${module.slug}`,
    label: module.name,
    shortDescription: isInsights
      ? "סביבת דוחות, ניתוח נתונים ותובנות עסקיות."
      : isCore
        ? "שכבת ה-HR המרכזית: עובדים, מבנה ארגוני, כרטיס עובד והיסטוריית שינויים."
      : `כניסה מהירה למודול ${module.name}.`,
    fullDescription: isInsights
      ? "מודול CLICK Insights פותח את סביבת הדוחות והאנליטיקה של המערכת, כולל תבניות, תצוגות שמורות וכלי ניתוח מתקדמים."
      : isCore
        ? "מודול CLICK CORE פותח את אזור ניהול משאבי האנוש המרכזי של המערכת, כולל רשימת עובדים, כרטיס עובד, מבנה ארגוני ויומן אירועים."
      : `זהו מסך העבודה של מודול ${module.name}. מתוך המודול אפשר לגשת לפונקציונליות הייעודית שלו ולבצע פעולות בהתאם למה שחובר והוגדר במערכת.`,
    icon: isInsights ? BarChart3 : isCore ? ShieldCheck : Package,
    navGroup: "module",
  };
}

const ORG_ADMIN_ACCESSIBLE = new Set(["org_admin", "super_admin", "admin"]);

export function getVisibleDashboardScreens({
  modules,
  user,
}: {
  modules: ModuleNavItem[];
  user: UserInfo | null;
}) {
  const staticScreens = DASHBOARD_SCREEN_DEFS.filter((screen) => {
    if (!BILLING_ENABLED && screen.resource === "billing") return false;
    if (screen.id.startsWith("insights:") && !modules.some(m => m.slug === "insights" && m.is_active)) return false;
    if (screen.id.startsWith("core:") && !modules.some(m => m.slug === "core" && m.is_active)) return false;
    if (screen.navGroup === "org_admin" && (!user || !ORG_ADMIN_ACCESSIBLE.has(user.role))) return false;
    return hasScreenAccess(screen, user);
  });

  const moduleScreens = modules
    .filter((module) => module.is_active)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map(buildModuleScreen);

  return [...staticScreens, ...moduleScreens];
}

export function getDashboardDefaultScreenIds(visibleScreens: DashboardScreen[]) {
  // Return an empty array so the dashboard starts empty and only shows what the user explicitly adds.
  return [];
}

export function readPinnedDashboardScreenIds(visibleScreens: DashboardScreen[]) {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(DASHBOARD_STORAGE_KEY);
  const available = new Set(visibleScreens.filter((screen) => screen.pinToDashboard !== false).map((screen) => screen.id));

  if (!raw) return getDashboardDefaultScreenIds(visibleScreens);

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return getDashboardDefaultScreenIds(visibleScreens);

    return parsed
      .filter((value): value is string => typeof value === "string")
      .filter((value, index, items) => items.indexOf(value) === index)
      .filter((value) => available.has(value));
  } catch {
    return getDashboardDefaultScreenIds(visibleScreens);
  }
}

export function writePinnedDashboardScreenIds(screenIds: string[]) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(screenIds));
  window.dispatchEvent(new CustomEvent(DASHBOARD_EVENT_NAME, { detail: { screenIds } }));
}

export function togglePinnedDashboardScreen(screenId: string, visibleScreens: DashboardScreen[]) {
  const current = readPinnedDashboardScreenIds(visibleScreens);
  const available = new Set(visibleScreens.filter((screen) => screen.pinToDashboard !== false).map((screen) => screen.id));
  if (!available.has(screenId)) return current;

  const next = current.includes(screenId)
    ? current.filter((id) => id !== screenId)
    : [...current, screenId];

  writePinnedDashboardScreenIds(next);
  return next;
}

export function subscribeToPinnedDashboardScreens(callback: (screenIds: string[]) => void) {
  if (typeof window === "undefined") return () => {};

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<{ screenIds?: string[] }>;
    callback(Array.isArray(customEvent.detail?.screenIds) ? customEvent.detail.screenIds : []);
  };

  window.addEventListener(DASHBOARD_EVENT_NAME, handler);
  return () => window.removeEventListener(DASHBOARD_EVENT_NAME, handler);
}
