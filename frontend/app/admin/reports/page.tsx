"use client";

import { AdminGrandchildLayout } from "@/components/layout/AdminShell";
import { ReportsWorkspace } from "@/components/reports/ReportsWorkspace";

export default function ReportsPage() {
  return (
    <AdminGrandchildLayout
      title="CLICK Insights"
      backHref="/dashboard"
      backLabel="חזרה לדשבורד"
      maxWidthClass="max-w-[1500px]"
    >
      <ReportsWorkspace />
    </AdminGrandchildLayout>
  );
}
