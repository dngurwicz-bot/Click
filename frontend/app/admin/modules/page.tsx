"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, api } from "@/lib/api";
import { TopNav } from "@/components/layout/TopNav";
import { AdminActionBar, AdminCountLabel, AdminSearchField, AdminTitleBar } from "@/components/layout/AdminShell";

interface ModuleListItem {
  id: string;
  slug: string;
  name: string;
  description?: string;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  current_price?: {
    base_price_ils: string;
    valid_from: string;
  };
}

interface MarketPriceAnchor {
  vendor: string;
  product: string;
  price_display: string;
  normalized_monthly_ils: string;
  basis: string;
  source_url: string;
}

interface RecommendedModulePrice {
  base_price_ils: string;
  per_seat_ils: string;
  included_seats: number;
  setup_fee_ils: string;
}

interface PricingRecommendation {
  module_slug: string;
  module_name: string;
  market_category: string;
  benchmark_team_size: number;
  benchmark_window_ils: string;
  action: string;
  rationale: string;
  current_price?: {
    base_price_ils: string;
    per_seat_ils: string;
    included_seats: number;
    setup_fee_ils: string;
    valid_from: string;
  };
  recommended_price: RecommendedModulePrice;
  current_monthly_at_benchmark_ils: string;
  recommended_monthly_at_benchmark_ils: string;
  monthly_delta_ils: string;
  setup_delta_ils: string;
  anchors: MarketPriceAnchor[];
}

interface PricingResearchPayload {
  as_of: string;
  exchange_rate_usd_ils: string;
  exchange_rate_eur_ils: string;
  positioning: string;
  methodology: string;
  modules: PricingRecommendation[];
}

function fmt(val?: string) {
  if (!val) return "—";
  return `₪${parseFloat(val).toLocaleString("he-IL", { minimumFractionDigits: 2 })}`;
}

function fmtDelta(val?: string) {
  if (!val) return "₪0.00";
  const amount = parseFloat(val);
  const prefix = amount > 0 ? "+" : "";
  return `${prefix}₪${amount.toLocaleString("he-IL", { minimumFractionDigits: 2 })}`;
}

export default function ModulesPage() {
  const router = useRouter();
  const [modules, setModules] = useState<ModuleListItem[]>([]);
  const [research, setResearch] = useState<PricingResearchPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  function loadModules() {
    setLoading(true);
    Promise.all([
      api.get<ModuleListItem[]>("/api/admin/modules"),
      api.get<PricingResearchPayload>("/api/admin/modules/pricing-recommendations"),
    ])
      .then(([moduleData, researchData]) => {
        setModules([...moduleData].sort((a, b) => a.sort_order - b.sort_order));
        setResearch(researchData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    loadModules();
  }, [router]);

  const filtered = modules.filter((m) =>
    m.name.includes(search) || m.slug.includes(search)
  );
  const filteredRecommendations = (research?.modules ?? []).filter((m) =>
    m.module_name.includes(search) || m.module_slug.includes(search)
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <TopNav />

      <main className="flex-1 overflow-hidden flex flex-col">
        <AdminTitleBar title="מודולים ומחירון" onRefresh={loadModules} />

        <AdminActionBar
          start={<AdminSearchField value={search} onChange={setSearch} />}
          end={!loading ? <AdminCountLabel>{filtered.length} מודולים</AdminCountLabel> : undefined}
        />

        {research && (
          <section className="bg-slate-50 border-b border-slate-200 px-3 py-3 shrink-0">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-4">
                <div className="text-right">
                  <h2 className="text-sm font-semibold text-slate-800">סקר שוק והמלצות תמחור</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {research.positioning} | שערי המרה ל-{new Date(research.as_of).toLocaleDateString("he-IL")}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1">USD/ILS {research.exchange_rate_usd_ils}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1">EUR/ILS {research.exchange_rate_eur_ils}</span>
                </div>
              </div>

              <div className="px-4 py-3 text-xs text-slate-600 border-b border-slate-100 bg-slate-50/60">
                {research.methodology}
              </div>

              <div className="overflow-auto">
                <table className="w-full min-w-[1080px] text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="text-right px-4 py-2.5 font-semibold border-b border-slate-200">מודול</th>
                      <th className="text-right px-4 py-2.5 font-semibold border-b border-slate-200">קטגוריית שוק</th>
                      <th className="text-right px-4 py-2.5 font-semibold border-b border-slate-200">עוגן שוק</th>
                      <th className="text-right px-4 py-2.5 font-semibold border-b border-slate-200">נוכחי ל-10 משתמשים</th>
                      <th className="text-right px-4 py-2.5 font-semibold border-b border-slate-200">מומלץ ל-10 משתמשים</th>
                      <th className="text-right px-4 py-2.5 font-semibold border-b border-slate-200">מבנה מומלץ</th>
                      <th className="text-right px-4 py-2.5 font-semibold border-b border-slate-200">דלתא</th>
                      <th className="text-right px-4 py-2.5 font-semibold border-b border-slate-200">פעולה</th>
                      <th className="text-right px-4 py-2.5 font-semibold border-b border-slate-200">מקורות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecommendations.map((row, index) => (
                      <tr key={row.module_slug} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                        <td className="align-top px-4 py-3 border-b border-slate-100">
                          <div className="font-semibold text-slate-800">{row.module_name}</div>
                          <div className="font-mono text-[11px] text-slate-400 mt-1">{row.module_slug}</div>
                          <div className="text-[11px] text-slate-500 mt-2 leading-5 max-w-[230px]">{row.rationale}</div>
                        </td>
                        <td className="align-top px-4 py-3 border-b border-slate-100 text-slate-600 max-w-[180px]">{row.market_category}</td>
                        <td className="align-top px-4 py-3 border-b border-slate-100 text-slate-600">
                          <div className="font-medium text-slate-700">{row.benchmark_window_ils}</div>
                          <div className="text-[11px] text-slate-400 mt-1">benchmark של {row.benchmark_team_size} משתמשים</div>
                        </td>
                        <td className="align-top px-4 py-3 border-b border-slate-100 text-slate-700">
                          <div className="font-semibold">{fmt(row.current_monthly_at_benchmark_ils)}</div>
                          <div className="text-[11px] text-slate-500 mt-1">
                            בסיס {fmt(row.current_price?.base_price_ils)} | מושב {fmt(row.current_price?.per_seat_ils)}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            כלול {row.current_price?.included_seats ?? 0} | הקמה {fmt(row.current_price?.setup_fee_ils)}
                          </div>
                        </td>
                        <td className="align-top px-4 py-3 border-b border-slate-100 text-slate-800">
                          <div className="font-semibold">{fmt(row.recommended_monthly_at_benchmark_ils)}</div>
                          <div className="text-[11px] text-slate-500 mt-1">
                            הקמה {fmt(row.recommended_price.setup_fee_ils)}
                          </div>
                        </td>
                        <td className="align-top px-4 py-3 border-b border-slate-100 text-slate-600">
                          <div>בסיס {fmt(row.recommended_price.base_price_ils)}</div>
                          <div className="mt-1">למושב {fmt(row.recommended_price.per_seat_ils)}</div>
                          <div className="mt-1">כולל {row.recommended_price.included_seats}</div>
                        </td>
                        <td className="align-top px-4 py-3 border-b border-slate-100">
                          <div className={`font-semibold ${parseFloat(row.monthly_delta_ils) > 0 ? "text-amber-700" : parseFloat(row.monthly_delta_ils) < 0 ? "text-emerald-700" : "text-slate-600"}`}>
                            {fmtDelta(row.monthly_delta_ils)}
                          </div>
                          <div className={`text-[11px] mt-1 ${parseFloat(row.setup_delta_ils) > 0 ? "text-amber-700" : parseFloat(row.setup_delta_ils) < 0 ? "text-emerald-700" : "text-slate-500"}`}>
                            הקמה {fmtDelta(row.setup_delta_ils)}
                          </div>
                        </td>
                        <td className="align-top px-4 py-3 border-b border-slate-100">
                          <span className="inline-flex rounded-full bg-brand-50 text-brand-700 px-2.5 py-1 font-medium">
                            {row.action}
                          </span>
                        </td>
                        <td className="align-top px-4 py-3 border-b border-slate-100 text-[11px] text-slate-500">
                          <div className="space-y-2 min-w-[180px]">
                            {row.anchors.map((anchor) => (
                              <div key={`${row.module_slug}-${anchor.vendor}-${anchor.product}`}>
                                <a
                                  href={anchor.source_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-medium text-brand-700 hover:text-brand-800 underline underline-offset-2"
                                >
                                  {anchor.vendor} / {anchor.product}
                                </a>
                                <div className="mt-0.5">{anchor.price_display}</div>
                                <div className="text-slate-400 mt-0.5">
                                  {anchor.normalized_monthly_ils !== "0.00" ? fmt(anchor.normalized_monthly_ils) : "מחיר לא שקוף"} | {anchor.basis}
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ── Table ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto bg-white min-h-0">
          {loading ? (
            <div className="py-20 flex flex-col items-center gap-3 text-slate-400">
              <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">טוען...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-sm">לא נמצאו מודולים</div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap w-8">סדר</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">שם המודול</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">מזהה</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">מחיר נוכחי</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">בתוקף מ-</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, i) => (
                  <tr
                    key={m.slug}
                    className={`cursor-pointer transition-colors
                      ${i % 2 === 0 ? "bg-white hover:bg-brand-50/40" : "bg-slate-50/60 hover:bg-brand-50/40"}`}
                    onClick={() => router.push(`/admin/modules/${m.slug}`)}
                  >
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-400 text-center">{m.sort_order}</td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-800 font-medium">
                      {m.name}
                      {m.is_required && (
                        <span className="mr-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">נדרש</span>
                      )}
                    </td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-500 font-mono text-[11px]">{m.slug}</td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-600">{fmt(m.current_price?.base_price_ils)}</td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-500">
                      {m.current_price?.valid_from
                        ? new Date(m.current_price.valid_from).toLocaleDateString("he-IL")
                        : "—"}
                    </td>
                    <td className="px-4 py-2 border-b border-slate-100">
                      {m.is_active ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />פעיל
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />לא פעיל
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </main>
    </div>
  );
}
