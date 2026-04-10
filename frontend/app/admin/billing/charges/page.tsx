"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, X, Zap } from "lucide-react";
import { isLoggedIn, api } from "@/lib/api";
import { AdminActionBar, AdminCountLabel, AdminSearchField, AdminStatusBar, AdminTitleBar } from "@/components/layout/AdminShell";
import { HebrewMonthPicker } from "@/components/ui/HebrewMonthPicker";
import {
  type BillingChargeOut,
  type TenantListItem,
  CHARGE_STATUS,
  CHARGE_TYPE_LABELS,
  currentPeriod,
  fmt,
  GenerateChargesModal,
  periodLabel,
  StatusBadge,
} from "../_shared";

export default function BillingChargesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [charges, setCharges] = useState<BillingChargeOut[]>([]);
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState(currentPeriod());
  const [filterTenantId, setFilterTenantId] = useState("");
  const [filterStatus, setFilterStatus] = useState(searchParams.get("status") ?? "");
  const [search, setSearch] = useState("");
  const [showGenerate, setShowGenerate] = useState(false);
  const [generateResult, setGenerateResult] = useState<{ created: number; skipped: number; tenants_processed: number } | null>(null);

  useEffect(() => {
    setFilterStatus(searchParams.get("status") ?? "");
  }, [searchParams]);

  const loadData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterPeriod) params.set("billing_period", filterPeriod);
    if (filterTenantId) params.set("tenant_id", filterTenantId);
    if (filterStatus) params.set("status", filterStatus);

    Promise.all([
      api.get<BillingChargeOut[]>(`/api/admin/billing/charges?${params}`),
      api.get<{ tenant_id: string; org_number: number; name_he: string }[]>("/api/admin/tenants"),
    ])
      .then(([nextCharges, nextTenants]) => {
        setCharges(nextCharges);
        setTenants(nextTenants.map((tenant) => ({ tenant_id: tenant.tenant_id, name_he: tenant.name_he, org_number: tenant.org_number })));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filterPeriod, filterStatus, filterTenantId]);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }

    loadData();
  }, [loadData, router]);

  const filteredCharges = charges.filter(
    (charge) =>
      !search ||
      charge.tenant_name?.includes(search) ||
      charge.description.includes(search) ||
      charge.module_name?.includes(search),
  );

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AdminTitleBar title="חיובים - חיובים" onRefresh={loadData} />

      <AdminActionBar
        start={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowGenerate(true)}
              className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
            >
              <Zap size={12} /> ייצר חיובים
            </button>
            <AdminSearchField value={search} onChange={setSearch} widthClass="w-44" />
          </div>
        }
        center={
          <div className="flex items-center gap-2">
            <HebrewMonthPicker
              value={filterPeriod}
              onChange={setFilterPeriod}
              className="w-36 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-right text-xs focus:border-brand-400 focus:outline-none"
            />
            <select
              value={filterTenantId}
              onChange={(event) => setFilterTenantId(event.target.value)}
              className="w-40 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-right text-xs focus:border-brand-400 focus:outline-none"
            >
              <option value="">כל הארגונים</option>
              {tenants.map((tenant) => (
                <option key={tenant.tenant_id} value={tenant.tenant_id}>
                  {tenant.name_he}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value)}
              className="w-28 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-right text-xs focus:border-brand-400 focus:outline-none"
            >
              <option value="">כל הסטטוסים</option>
              <option value="pending">ממתין</option>
              <option value="invoiced">חויב</option>
              <option value="cancelled">מבוטל</option>
            </select>
          </div>
        }
        end={!loading ? <AdminCountLabel>{filteredCharges.length} פריטים</AdminCountLabel> : undefined}
      />

      <div className="min-h-0 flex-1 overflow-auto bg-white">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr>
                {["ארגון", "תקופה", "מודול", "סוג", "תיאור", "מחיר יח׳", "סכום", "הנחה%", "לחיוב", "סטטוס"].map((heading) => (
                  <th
                    key={heading}
                    className="whitespace-nowrap border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-right font-semibold text-slate-600"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCharges.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-slate-400">
                    אין חיובים להצגה
                  </td>
                </tr>
              ) : (
                filteredCharges.map((charge, index) => {
                  const status = CHARGE_STATUS[charge.status] ?? CHARGE_STATUS.pending;
                  return (
                    <tr
                      key={charge.id}
                      className={`transition-colors ${index % 2 === 0 ? "bg-white hover:bg-brand-50/40" : "bg-slate-50/60 hover:bg-brand-50/40"}`}
                    >
                      <td className="border-b border-slate-100 px-4 py-2 font-medium text-slate-800">{charge.tenant_name ?? "—"}</td>
                      <td className="whitespace-nowrap border-b border-slate-100 px-4 py-2 text-slate-600">{periodLabel(charge.billing_period)}</td>
                      <td className="border-b border-slate-100 px-4 py-2 text-slate-600">{charge.module_name ?? charge.module_slug ?? "—"}</td>
                      <td className="border-b border-slate-100 px-4 py-2 text-slate-500">{CHARGE_TYPE_LABELS[charge.charge_type] ?? charge.charge_type}</td>
                      <td className="max-w-[200px] truncate border-b border-slate-100 px-4 py-2 text-slate-700" title={charge.description}>
                        {charge.description}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-2 text-left tabular-nums text-slate-600">{fmt(charge.unit_price_ils)}</td>
                      <td className="border-b border-slate-100 px-4 py-2 text-left tabular-nums text-slate-600">{fmt(charge.amount_ils)}</td>
                      <td className="border-b border-slate-100 px-4 py-2 tabular-nums text-slate-500">
                        {parseFloat(charge.discount_pct) > 0 ? `${charge.discount_pct}%` : "—"}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-2 text-left font-semibold tabular-nums text-slate-800">{fmt(charge.amount_after_discount_ils)}</td>
                      <td className="border-b border-slate-100 px-4 py-2">
                        <StatusBadge cfg={status} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      <AdminStatusBar total={filteredCharges.length} label="חיובים" />

      {generateResult && (
        <div className="fixed bottom-4 left-4 z-30 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700 shadow-lg">
          <CheckCircle2 size={14} />
          <span>
            נוצרו <strong>{generateResult.created}</strong> חיובים חדשים ({generateResult.skipped} קיימים, {generateResult.tenants_processed} ארגונים)
          </span>
          <button
            type="button"
            onClick={() => setGenerateResult(null)}
            className="text-emerald-500 hover:text-emerald-700"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {showGenerate && (
        <GenerateChargesModal
          onClose={() => setShowGenerate(false)}
          onDone={(result) => {
            setShowGenerate(false);
            setGenerateResult(result);
            loadData();
          }}
        />
      )}
    </main>
  );
}
