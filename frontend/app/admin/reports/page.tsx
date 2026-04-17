"use client";

import { useState } from "react";
import { AdminTitleBar, AdminGrandchildLayout } from "@/components/layout/AdminShell";
import { DynamicBuilder } from "@/components/reports/DynamicBuilder";
import { StandardReports } from "@/components/reports/StandardReports";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<"dynamic" | "standard">("dynamic");

  return (
    <AdminGrandchildLayout
      title="Click Insights: דוחות דינמיים"
      backHref="/dashboard"
      backLabel="חזרה לדשבורד"
      maxWidthClass="max-w-6xl"
    >
      <div className="flex gap-4 border-b border-slate-200 mb-6">
        <button
          className={`pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${
            activeTab === "dynamic"
              ? "border-brand-500 text-brand-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => setActiveTab("dynamic")}
        >
          בונה דוחות אישי
        </button>
        <button
          className={`pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${
            activeTab === "standard"
              ? "border-brand-500 text-brand-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => setActiveTab("standard")}
        >
          דוחות בסיסיים מובנים
        </button>
      </div>

      {activeTab === "dynamic" ? <DynamicBuilder /> : <StandardReports />}
    </AdminGrandchildLayout>
  );
}
