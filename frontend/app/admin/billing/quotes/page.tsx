"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { isLoggedIn, api } from "@/lib/api";
import { AdminActionBar, AdminCountLabel, AdminSearchField, AdminStatusBar, AdminTitleBar } from "@/components/layout/AdminShell";
import {
  type QuoteListItem,
  type TenantListItem,
  QUOTE_STATUS,
  QuoteBuilderModal,
  QuoteDetailModal,
  StatusBadge,
  fmt,
  fmtDate,
  openQuotePdf,
} from "../_shared";

export default function BillingQuotesPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<QuoteListItem[]>([]);
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [quoteFilterStatus, setQuoteFilterStatus] = useState("");
  const [quoteSearch, setQuoteSearch] = useState("");
  const [showNewQuote, setShowNewQuote] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    const quoteParams = new URLSearchParams();
    if (quoteFilterStatus) quoteParams.set("status", quoteFilterStatus);
    if (quoteSearch) quoteParams.set("search", quoteSearch);

    Promise.all([
      api.get<QuoteListItem[]>(`/api/admin/billing/quotes?${quoteParams}`).catch(() => [] as QuoteListItem[]),
      api.get<{ tenant_id: string; org_number: number; name_he: string }[]>("/api/admin/tenants"),
    ])
      .then(([nextQuotes, nextTenants]) => {
        setQuotes(nextQuotes);
        setTenants(nextTenants.map((tenant) => ({ tenant_id: tenant.tenant_id, name_he: tenant.name_he, org_number: tenant.org_number })));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [quoteFilterStatus, quoteSearch]);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }

    loadData();
  }, [loadData, router]);

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AdminTitleBar title="חיובים - הצעות מחיר" onRefresh={loadData} />

      <AdminActionBar
        start={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowNewQuote(true)}
              className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
            >
              <Plus size={12} /> הצעת מחיר חדשה
            </button>
            <AdminSearchField value={quoteSearch} onChange={setQuoteSearch} widthClass="w-44" />
          </div>
        }
        center={
          <select
            value={quoteFilterStatus}
            onChange={(event) => setQuoteFilterStatus(event.target.value)}
            aria-label="סטטוס"
            className="w-28 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-right text-xs focus:border-brand-400 focus:outline-none"
          >
            <option value="">כל הסטטוסים</option>
            <option value="draft">טיוטה</option>
            <option value="sent">נשלח</option>
            <option value="accepted">אושר</option>
            <option value="declined">נדחה</option>
            <option value="expired">פג תוקף</option>
          </select>
        }
        end={!loading ? <AdminCountLabel>{quotes.length} הצעות</AdminCountLabel> : undefined}
      />

      <div className="min-h-0 flex-1 overflow-auto bg-white">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : (
          <table className="admin-data-table w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr>
                {["מס׳ הצעה", "כותרת", "לקוח / פרוספקט", "תוקף עד", "סה״כ", "סטטוס", "PDF"].map((heading) => (
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
              {quotes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    אין הצעות מחיר
                  </td>
                </tr>
              ) : (
                quotes.map((quote, index) => {
                  const status = QUOTE_STATUS[quote.status] ?? QUOTE_STATUS.draft;
                  return (
                    <tr
                      key={quote.id}
                      className={`cursor-pointer transition-colors ${index % 2 === 0 ? "bg-white hover:bg-brand-50/40" : "bg-slate-50/60 hover:bg-brand-50/40"}`}
                      onClick={() => setSelectedQuoteId(quote.id)}
                    >
                      <td className="border-b border-slate-100 px-4 py-2 font-bold text-brand-700">
                        {quote.quote_number ?? <span className="font-normal text-slate-400">טיוטה</span>}
                      </td>
                      <td className="max-w-[200px] truncate border-b border-slate-100 px-4 py-2 font-medium text-slate-800" title={quote.title}>
                        {quote.title}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-2 text-slate-600">{quote.tenant_name ?? quote.prospect_name ?? "—"}</td>
                      <td className="whitespace-nowrap border-b border-slate-100 px-4 py-2 text-slate-600">{fmtDate(quote.valid_until)}</td>
                      <td className="cell-numeric border-b border-slate-100 px-4 py-2 font-bold text-slate-800">{fmt(quote.total_ils)}</td>
                      <td className="border-b border-slate-100 px-4 py-2">
                        <StatusBadge cfg={status} />
                      </td>
                      <td className="border-b border-slate-100 px-4 py-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openQuotePdf(quote.id);
                          }}
                          className="text-[11px] text-brand-700 hover:underline"
                        >
                          PDF
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      <AdminStatusBar total={quotes.length} label="הצעות מחיר" />

      {showNewQuote && (
        <QuoteBuilderModal
          tenants={tenants}
          onClose={() => setShowNewQuote(false)}
          onSaved={() => {
            setShowNewQuote(false);
            loadData();
          }}
        />
      )}

      {selectedQuoteId && (
        <QuoteDetailModal
          quoteId={selectedQuoteId}
          onClose={() => setSelectedQuoteId(null)}
          onUpdated={() => {
            setSelectedQuoteId(null);
            loadData();
          }}
        />
      )}
    </main>
  );
}
