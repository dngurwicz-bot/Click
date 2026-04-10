"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Clock, Quote, Send, X, Zap } from "lucide-react";
import { isLoggedIn, api } from "@/lib/api";
import { AdminTitleBar } from "@/components/layout/AdminShell";
import {
  type BillingChargeOut,
  type InvoiceListItem,
  type QuoteListItem,
  currentPeriod,
  fmt,
  GenerateChargesModal,
  periodLabel,
} from "../_shared";
import { HebrewMonthPicker } from "@/components/ui/HebrewMonthPicker";

export default function BillingOverviewPage() {
  const router = useRouter();
  const [filterPeriod, setFilterPeriod] = useState(currentPeriod());
  const [loading, setLoading] = useState(true);
  const [charges, setCharges] = useState<BillingChargeOut[]>([]);
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [quotes, setQuotes] = useState<QuoteListItem[]>([]);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generateResult, setGenerateResult] = useState<{ created: number; skipped: number; tenants_processed: number } | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);

    const chargeParams = new URLSearchParams();
    chargeParams.set("billing_period", filterPeriod);
    const invoiceParams = new URLSearchParams(chargeParams);

    Promise.all([
      api.get<BillingChargeOut[]>(`/api/admin/billing/charges?${chargeParams}`),
      api.get<InvoiceListItem[]>(`/api/admin/billing/invoices?${invoiceParams}`),
      api.get<QuoteListItem[]>("/api/admin/billing/quotes").catch(() => [] as QuoteListItem[]),
    ])
      .then(([nextCharges, nextInvoices, nextQuotes]) => {
        setCharges(nextCharges);
        setInvoices(nextInvoices);
        setQuotes(nextQuotes);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filterPeriod]);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }

    loadData();
  }, [loadData, router]);

  const pendingTotal = charges.filter((charge) => charge.status === "pending").reduce((sum, charge) => sum + parseFloat(charge.amount_after_discount_ils), 0);
  const invoicedTotal = invoices.filter((invoice) => invoice.status !== "cancelled").reduce((sum, invoice) => sum + parseFloat(invoice.total_ils), 0);
  const paidTotal = invoices.filter((invoice) => invoice.status === "paid").reduce((sum, invoice) => sum + parseFloat(invoice.total_ils), 0);
  const overdueTotal = invoices.filter((invoice) => invoice.status === "overdue").reduce((sum, invoice) => sum + parseFloat(invoice.total_ils), 0);
  const overdueCount = invoices.filter((invoice) => invoice.status === "overdue").length;
  const pendingCount = charges.filter((charge) => charge.status === "pending").length;
  const openQuotes = quotes.filter((quote) => quote.status === "draft" || quote.status === "sent");
  const openQuotesCount = openQuotes.length;
  const openQuotesTotal = openQuotes.reduce((sum, quote) => sum + parseFloat(quote.total_ils), 0);

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AdminTitleBar title="חיובים - סקירה" onRefresh={loadData} />

      <div className="flex-1 overflow-auto bg-slate-50 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">סקירה לתקופה</h2>
          <HebrewMonthPicker
            value={filterPeriod}
            onChange={setFilterPeriod}
            className="w-36 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-right text-xs focus:border-brand-400 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
          {[
            {
              label: "ממתין לחיוב",
              amount: pendingTotal,
              count: pendingCount,
              color: "amber",
              icon: <Clock size={16} className="text-amber-500" />,
              href: "/admin/billing/charges?status=pending",
            },
            {
              label: "חויב תקופה",
              amount: invoicedTotal,
              count: invoices.filter((invoice) => invoice.status !== "cancelled").length,
              color: "blue",
              icon: <Send size={16} className="text-blue-500" />,
              href: "/admin/billing/invoices",
            },
            {
              label: "שולם",
              amount: paidTotal,
              count: invoices.filter((invoice) => invoice.status === "paid").length,
              color: "emerald",
              icon: <CheckCircle2 size={16} className="text-emerald-500" />,
              href: "/admin/billing/invoices?status=paid",
            },
            {
              label: "בפיגור",
              amount: overdueTotal,
              count: overdueCount,
              color: "red",
              icon: <AlertCircle size={16} className="text-red-500" />,
              href: "/admin/billing/invoices?status=overdue",
            },
          ].map((kpi) => (
            <button
              key={kpi.label}
              type="button"
              onClick={() => router.push(kpi.href)}
              className={`rounded-xl border px-4 py-3 text-right shadow-sm transition-all hover:border-brand-200 hover:shadow-md ${
                kpi.color === "red" && kpi.count > 0 ? "border-red-200 bg-white" : "border-slate-200 bg-white"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                {kpi.icon}
                {kpi.count > 0 && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      kpi.color === "amber"
                        ? "bg-amber-100 text-amber-700"
                        : kpi.color === "blue"
                          ? "bg-blue-100 text-blue-700"
                          : kpi.color === "emerald"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                    }`}
                  >
                    {kpi.count}
                  </span>
                )}
              </div>
              <div
                className={`text-lg font-bold tabular-nums ${
                  kpi.color === "amber"
                    ? "text-amber-700"
                    : kpi.color === "blue"
                      ? "text-blue-700"
                      : kpi.color === "emerald"
                        ? "text-emerald-700"
                        : kpi.count > 0
                          ? "text-red-700"
                          : "text-slate-600"
                }`}
              >
                {fmt(kpi.amount)}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">{kpi.label}</div>
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-700">מחזור חיוב - {periodLabel(filterPeriod)}</h3>
            <button
              type="button"
              onClick={() => setShowGenerate(true)}
              className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
            >
              <Zap size={11} /> ייצר חיובים לתקופה
            </button>
          </div>
          <div className="space-y-2">
            {[
              { done: pendingTotal > 0 || invoicedTotal > 0, label: "חיובים נוצרו", sub: `${charges.filter((charge) => charge.status !== "cancelled").length} חיובים פעילים` },
              { done: invoicedTotal > 0, label: "חשבוניות הוצאו", sub: `${invoices.filter((invoice) => invoice.status !== "cancelled" && invoice.status !== "draft").length} חשבוניות נשלחו` },
              { done: paidTotal > 0, label: "תשלומים התקבלו", sub: `${invoices.filter((invoice) => invoice.status === "paid").length} חשבוניות שולמו` },
            ].map((step) => (
              <div key={step.label} className="flex items-center gap-3">
                <span
                  className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    step.done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"
                  }`}
                >
                  {step.done ? "✓" : "·"}
                </span>
                <div>
                  <span className={`text-xs font-medium ${step.done ? "text-slate-700" : "text-slate-400"}`}>{step.label}</span>
                  <span className="mr-2 text-[11px] text-slate-400">{step.sub}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {openQuotesCount > 0 && (
          <div className="rounded-xl border border-blue-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Quote size={14} className="text-blue-500" />
                <span className="text-xs font-semibold text-slate-700">{openQuotesCount} הצעות מחיר פתוחות</span>
                <span className="text-xs text-slate-500">(סה&quot;כ: {fmt(openQuotesTotal)})</span>
              </div>
              <button
                type="button"
                onClick={() => router.push("/admin/billing/quotes")}
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                לניהול הצעות
              </button>
            </div>
          </div>
        )}

        {generateResult && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
            <CheckCircle2 size={14} />
            <span>
              נוצרו <strong>{generateResult.created}</strong> חיובים חדשים ({generateResult.skipped} קיימים, {generateResult.tenants_processed} ארגונים)
            </span>
            <button
              type="button"
              onClick={() => setGenerateResult(null)}
              className="mr-auto text-emerald-500 hover:text-emerald-700"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-10">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        )}
      </div>

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
