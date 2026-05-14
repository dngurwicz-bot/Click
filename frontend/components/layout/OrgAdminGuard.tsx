"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser, isLoggedIn, restoreSession } from "@/lib/api";

const ALLOWED_ROLES = ["org_admin", "super_admin", "admin"];

export function OrgAdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function check() {
      if (!isLoggedIn()) {
        router.replace("/login");
        return;
      }

      let user = getStoredUser();
      if (!user) {
        user = await restoreSession().catch(() => null);
      }

      if (!user || !ALLOWED_ROLES.includes(user.role)) {
        router.replace("/dashboard");
        return;
      }

      setReady(true);
    }

    void check();
  }, [router]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-slate-400">
        טוען...
      </div>
    );
  }

  return <>{children}</>;
}
