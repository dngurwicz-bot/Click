"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { isLoggedIn, api } from "@/lib/api";
import { AdminActionBar, AdminCountLabel, AdminSearchField, AdminStatusBar, AdminTitleBar } from "@/components/layout/AdminShell";
import { HebrewMonthPicker } from "@/components/ui/HebrewMonthPicker";
import {
  type BillingSettingsOut,
  type InvoiceListItem,
  type TenantListItem,
  INVOICE_STATUS,
  InvoiceDetailModal,
  NewInvoiceModal,
  openInvoicePdf,
  periodLabel,
  StatusBadge,
  fmt,
  fmtDate,
} from "../_shared";

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function BillingInvoicesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [billingSettings, setBillingSettings] = useState<BillingSettingsOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState(currentPeriod());
  const [filterTenantId, setFilterTenantId] = useState("");
  const [filterStatus, setFilterStatus] = useState(searchParams.get("status") ?? "");
  const [search, setSearch] = useState("");
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceListItem | null>(null);

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
      api.get<InvoiceListItem[]>(`/api/admin/billing/invoices?${params}`),
      api.get<{ tenant_id: string; org_number: number; name_he: string }[]>("/api/admin/tenants"),
      api.get<BillingSettingsOut>("/api/admin/billing/settings").catch(() => null),
    ])
      .then(([nextInvoices, nextTenants, nextSettings]) => {
        setInvoices(nextInvoices);
        setTenants(nextTenants.map((tenant) => ({ tenant_id: tenant.tenant_id, name_he: tenant.name_he, org_number: tenant.org_number })));
        setBillingSettings(nextSettings);
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

  const filteredInvoices = invoices.filter(
    (invoice) => !search || invoice.tenant_name?.includes(search) || invoice.invoice_number.includes(search),
  );

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AdminTitleBar title="חיובים - חשבוניות" onRefresh={loadData} />

      <AdminActionBar
        start={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowNewInvoice(true)}
              className="flex items-center gap-1.5 rounded-md border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100"
            >
              <Plus size={12} /> חשבונית חדשה
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
              <option value="draft">טיוטה</option>
              <option value="sent">נשלח</option>
              <option value="paid">שולם</option>
              <option value="overdue">בפיגור</option>
              <option value="cancelled">מבוטל</option>
            </select>
          </div>
        }
        end={!loading ? <AdminCountLabel>{filteredInvoices.length} פריטים</AdminCountLabel> : undefined}
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
                {["מס' חשבונית", "ארגון", "תקופה", "הנפקה", "לתשלום עד", "לפני מע\"מ", "מע\"מ", "סה\"כ", "סטטוס", "PDF"].map((heading) => (
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
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-slate-400">
                    אין חשבוניות להצגה
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice, index) => {
                  const status = INVOICE_STATUS[invoice.status] ?? INVOICE_STATUS.draft;
                  return (
                    <tr
                      key={invoice.id}
                      className={`cursor-pointer transition-colors ${index % 2 === 0 ? "bg-white hover:bg-brand-50/40" : "bg-slate-50/60 hover:bg-brand-50/40"}`}
                      onDoubleClick={() => setSelectedInvoice(invoice)}
                    >
                      <td className="border-b border-slate-100 px-4 py-2 font-bold text-brand-700">{invoice.invoice_number}</td>
                      <td className="border-b border-slate-100 px-4 py-2 font-medium text-slate-800">{invoice.tenant_name ?? "—"}</td>
                      <td className="whitespace-nowrap border-b border-slate-100 px-4 py-2 text-slate-600">{periodLabel(invoice.billing_period)}</td>
                      <td className="whitespace-nowrap border-b border-slate-100 px-4 py-2 text-slate-600">{fmtDate(invoice.issue_date)}</td>
                      <td className={`whitespace-nowrap border-b border-slate-100 px-4 py-2 ${invoice.status === "overdue" ? "font-medium text-red-600" : "text-slate-600"}`}>
                        {fmtDate(invoice.due_date)}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-2 text-left tabular-nums text-slate-600">{fmt(invoice.subtotal_ils)}</td>
                      <td className="border-b border-slate-100 px-4 py-2 text-left tabular-nums text-slate-500">{fmt(invoice.vat_ils)}</td>
                      <td className="border-b border-slate-100 px-4 py-2 text-left font-bold tabular-nums text-slate-800">{fmt(invoice.total_ils)}</td>
                      <td className="border-b border-slate-100 px-4 py-2">
                        <StatusBadge cfg={status} />
                      </td>
                      <td className="border-b border-slate-100 px-4 py-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openInvoicePdf(invoice.id, "statement");
                            }}
                            className="text-[11px] text-brand-700 hover:underline"
                          >
                            PDF
                          </button>
                          {billingSettings?.can_render_tax_invoice ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openInvoicePdf(invoice.id, "tax");
                              }}
                              className="text-[11px] text-slate-600 hover:underline"
                            >
                              מס
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      <AdminStatusBar total={filteredInvoices.length} label="חשבוניות" />

      {showNewInvoice && (
        <NewInvoiceModal
          tenants={tenants}
          onClose={() => setShowNewInvoice(false)}
          onSaved={() => {
            setShowNewInvoice(false);
            loadData();
          }}
        />
      )}

      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          billingSettings={billingSettings}
          onClose={() => setSelectedInvoice(null)}
          onUpdated={() => {
            setSelectedInvoice(null);
            loadData();
          }}
        />
      )}
    </main>
  );
}
