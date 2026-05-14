"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser, restoreSession } from "@/lib/api";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (getStoredUser()) {
      router.replace("/dashboard");
      return;
    }
    void restoreSession()
      .then((user) => {
        router.replace(user ? "/dashboard" : "/login");
      })
      .catch(() => {
        router.replace("/login");
      });
  }, [router]);

  return null;
}
