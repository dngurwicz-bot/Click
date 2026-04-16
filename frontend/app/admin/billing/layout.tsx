import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default function BillingLayout({
  children,
}: {
  children: ReactNode;
}) {
  void children;
  redirect("/admin/modules");
}
