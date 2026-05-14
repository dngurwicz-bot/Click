"use client";

import Link from "next/link";
import { FolderTree, ShieldCheck } from "lucide-react";

import { AdminGrandchildLayout, AdminSectionCard } from "@/components/layout/AdminShell";
import { useWorkspace } from "@/components/layout/WorkspaceShell";
import { CORE_STRUCTURE_ITEMS } from "./config";

export default function CoreStructureOverviewPage() {
  const workspace = useWorkspace();
  const tenantId = workspace?.selectedTenantId ?? "";

  return (
    <AdminGrandchildLayout
      title="מבנה ארגוני"
      backHref="/admin/core"
      backLabel="כרטיס עובד"
      maxWidthClass="max-w-5xl"
    >
      <AdminSectionCard title="בחר רמת ניהול">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CORE_STRUCTURE_ITEMS.map((item) => (
            <Link
              key={item.key}
              href={tenantId ? `${item.href}?tenant_id=${tenantId}` : item.href}
              className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-300 hover:bg-brand-50/30"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                {item.key === "position" ? <ShieldCheck size={18} /> : <FolderTree size={18} />}
              </div>
              <div className="text-sm font-semibold text-slate-800">{item.label}</div>
              <div className="mt-1 text-xs text-slate-500">{item.title}</div>
            </Link>
          ))}
        </div>
      </AdminSectionCard>
    </AdminGrandchildLayout>
  );
}
