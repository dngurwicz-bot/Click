"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { BarChart3 } from "lucide-react";

import { AdminTitleBar } from "@/components/layout/AdminShell";
import { isLoggedIn } from "@/lib/api";
import { ReportsWorkspace } from "@/components/reports/ReportsWorkspace";

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[280px] items-center justify-center px-6 py-10">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <BarChart3 size={20} />
        </div>
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
      </div>
    </div>
  );
}

export default function ModulePage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = typeof params?.slug === "string" ? params.slug : "";

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
    }
  }, [router]);

  if (slug !== "insights") {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
        <AdminTitleBar title="מודול" />
        <main className="flex-1 overflow-auto">
          <EmptyState title="המודול הזה עדיין לא חובר למסך עבודה" body="הניווט למודול פעיל, אבל עדיין לא נבנה עבורו workspace ייעודי." />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
      <AdminTitleBar title="CLICK Insights" />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-[1500px] px-4 py-5">
          <ReportsWorkspace />
        </div>
      </main>
    </div>
  );
}
