"use client";

import { usePathname, useRouter } from "next/navigation";
import { ShieldCheck, type LucideIcon } from "lucide-react";
import { useWorkspace } from "./WorkspaceShell";

interface SidebarItem {
  href: string;
  label: string;
  icon: LucideIcon;
  matchFn?: (pathname: string) => boolean;
}

interface SidebarConfig {
  moduleLabel: string;
  items: SidebarItem[];
}

const SIDEBAR_CONFIGS: Array<{ pathPrefix: string; config: SidebarConfig }> = [
  {
    pathPrefix: "/admin/core",
    config: {
      moduleLabel: "CLICK Core",
      items: [
        {
          href: "/admin/core",
          label: "רשימת עובדים",
          icon: ShieldCheck,
          matchFn: (p) => p === "/admin/core" || p.startsWith("/admin/core/"),
        },
      ],
    },
  },
];

function getSidebarConfig(pathname: string): SidebarConfig | null {
  for (const { pathPrefix, config } of SIDEBAR_CONFIGS) {
    if (pathname === pathPrefix || pathname.startsWith(`${pathPrefix}/`)) {
      return config;
    }
  }
  return null;
}

export function ModuleSidebar() {
  const pathname = usePathname() ?? "";
  const workspace = useWorkspace();
  const router = useRouter();
  const config = getSidebarConfig(pathname);

  if (!config) return null;

  function navigate(href: string) {
    if (workspace) workspace.navigateTo(href);
    else router.push(href);
  }

  return (
    <aside className="hidden w-48 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="border-b border-slate-100 px-4 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {config.moduleLabel}
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {config.items.map((item) => {
          const Icon = item.icon;
          const isActive = item.matchFn
            ? item.matchFn(pathname)
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <button
              key={item.href}
              type="button"
              onClick={() => navigate(item.href)}
              className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? "border-r-2 border-brand-500 bg-brand-50 font-medium text-brand-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <Icon
                size={14}
                className={isActive ? "shrink-0 text-brand-500" : "shrink-0 text-slate-400"}
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
