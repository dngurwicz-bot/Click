"use client";

import Link from "next/link";
import { FolderTree, ShieldCheck } from "lucide-react";

import { AdminGrandchildLayout, AdminSectionCard } from "@/components/layout/AdminShell";
import { useWorkspace } from "@/components/layout/WorkspaceShell";
import { getStoredUser } from "@/lib/api";
import { getOrgStructureNavEntries, useTenantOrgStructureItems } from "@/lib/orgStructureConfig";

const ORG_STRUCTURE_ITEM_TITLES = {
  overview: "סקירה של המבנה הארגוני הזמין לארגון הפעיל",
  division: "ניהול חטיבות ארגוניות",
  department: "ניהול אגפים",
  section: "ניהול מחלקות",
  team: "ניהול צוותים",
  position: "ניהול תפקידים",
} as const;

export default function OrgStructureOverviewPage() {
  const workspace = useWorkspace();
  const user = getStoredUser();
  const selectedTenantId = workspace?.selectedTenantId ?? user?.tenant_id ?? "";
  const { tenantConfig } = useTenantOrgStructureItems(selectedTenantId);
  const items = getOrgStructureNavEntries(tenantConfig?.levels ?? []).filter((item) => item.key !== "overview");

  return (
    <AdminGrandchildLayout
      title="יחידות ארגוניות"
      backHref="/dashboard"
      backLabel="ראשי"
      maxWidthClass="max-w-5xl"
    >
      <AdminSectionCard title="בחר רמת ניהול">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const Icon = item.key === "position" ? ShieldCheck : FolderTree;
            return (
              <Link
                key={item.key}
                href={item.href}
                className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-300 hover:bg-brand-50/30"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon size={18} />
                </div>
                <div className="text-sm font-semibold text-slate-800">{item.label}</div>
                <div className="mt-1 text-xs text-slate-500">{ORG_STRUCTURE_ITEM_TITLES[item.key]}</div>
              </Link>
            );
          })}
        </div>
      </AdminSectionCard>
    </AdminGrandchildLayout>
  );
}
