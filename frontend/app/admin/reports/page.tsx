"use client";

import { Suspense } from "react";
import { ReportsWorkspace } from "@/components/reports/ReportsWorkspace";

export default function ReportsPage() {
  return (
    <div className="flex h-full flex-col">
      <Suspense fallback={<div className="flex-1 flex items-center justify-center">טוען...</div>}>
        <ReportsWorkspace />
      </Suspense>
    </div>
  );
}
