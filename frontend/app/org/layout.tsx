import { OrgAdminGuard } from "@/components/layout/OrgAdminGuard";

export default function OrgAdminLayout({ children }: { children: React.ReactNode }) {
  return <OrgAdminGuard>{children}</OrgAdminGuard>;
}
