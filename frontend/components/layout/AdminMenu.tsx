"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Building2, Package, Users, FileText, ClipboardList, List, Receipt, ShieldCheck } from "lucide-react";
import { BILLING_ENABLED } from "@/lib/features";
import { useWorkspace } from "./WorkspaceShell";

const ADMIN_LINKS = [
  { href: "/admin/tenants",   label: "ניהול ארגונים",         icon: Building2 },
  { href: "/admin/lookups",   label: "ניהול רשימות ארגוניות", icon: List },
  { href: "/admin/modules",   label: "מודולים ומחירון",        icon: Package },
  { href: "/admin/core",      label: "CORE עובדים וארגון",    icon: ShieldCheck },
  ...(BILLING_ENABLED ? [{ href: "/admin/billing", label: "חיובים וחשבוניות", icon: Receipt }] : []),
  { href: "/admin/users",     label: "משתמשי מערכת",      icon: Users },
  { href: "/admin/templates", label: "תבניות הקמה",        icon: FileText },
  { href: "/admin/audit",     label: "Audit Log",          icon: ClipboardList },
];

export function AdminMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const workspace = useWorkspace();

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
                   text-slate-300 hover:bg-white/10 hover:text-white
                   border border-white/15 transition-colors duration-150"
      >
        ניהול מערכת
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 mt-2 w-52 rounded-xl border border-slate-200
                     bg-white shadow-lg overflow-hidden z-50"
          style={{ boxShadow: "0 8px 24px -4px rgb(0 0 0 / 0.12), 0 4px 8px -4px rgb(0 0 0 / 0.06)" }}
        >
          <div className="py-1">
            {ADMIN_LINKS.map(({ href, label, icon: Icon }) => (
              <button
                key={href}
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (workspace) workspace.navigateTo(href);
                  else router.push(href);
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700
                           hover:bg-brand-50 hover:text-brand-700 transition-colors duration-100"
              >
                <Icon size={15} className="shrink-0 text-slate-400" />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
