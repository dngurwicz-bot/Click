"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, api } from "@/lib/api";
import { AdminTitleBar } from "@/components/layout/AdminShell";
import { BillingSettingsPanel, type BillingSettingsOut } from "../_shared";

export default function BillingSettingsPage() {
  const router = useRouter();
  const [billingSettings, setBillingSettings] = useState<BillingSettingsOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    api
      .get<BillingSettingsOut>("/api/admin/billing/settings")
      .then(setBillingSettings)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }

    loadData();
  }, [loadData, router]);

  async function saveBillingSettings() {
    if (!billingSettings) return;
    setSaving(true);
    try {
      const saved = await api.put<BillingSettingsOut>("/api/admin/billing/settings", {
        issuer_name_he: billingSettings.issuer_name_he,
        issuer_name_en: billingSettings.issuer_name_en || null,
        issuer_tax_id: billingSettings.issuer_tax_id || null,
        issuer_address: billingSettings.issuer_address || null,
        issuer_phone: billingSettings.issuer_phone || null,
        issuer_email: billingSettings.issuer_email || null,
        issuer_logo_url: billingSettings.issuer_logo_url || null,
        payment_instructions: billingSettings.payment_instructions || null,
        footer_text: billingSettings.footer_text || null,
      });
      setBillingSettings(saved);
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AdminTitleBar title="חיובים - הגדרות מנפיק" onRefresh={loadData} />
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : (
          <BillingSettingsPanel value={billingSettings} onChange={setBillingSettings} onSave={saveBillingSettings} saving={saving} />
        )}
      </div>
    </main>
  );
}
