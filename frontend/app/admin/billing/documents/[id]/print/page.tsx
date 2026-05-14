"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
/* eslint-disable @next/next/no-img-element */

interface InvoiceLine {
  id: string;
  description: string;
  amount_ils: string;
}

interface TenantInvoiceDetail {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string;
  billing_period: string;
  subtotal_ils: string;
  vat_pct: string;
  vat_ils: string;
  total_ils: string;
  lines: InvoiceLine[];
}

export default function DocumentPrintPage() {
  const { id } = useParams() as { id: string };
  const [inv, setInv] = useState<TenantInvoiceDetail | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<TenantInvoiceDetail>(`/api/admin/billing/documents/${id}`),
      api.get<any>(`/api/admin/billing/settings`)
    ])
      .then(([invoiceData, settingsData]) => {
        setInv(invoiceData);
        setSettings(settingsData);
        setTimeout(() => {
          window.print();
        }, 800);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading || !inv || !settings) return <div className="p-10 text-center font-sans text-gray-500">טוען מסמך...</div>;

  const hexColor = settings.invoice_primary_color || "#1e3a8a";
  const primaryBg = { backgroundColor: hexColor };
  const primaryText = { color: hexColor };

  return (
    <div className="min-h-screen bg-slate-100 font-sans print:bg-white" dir="rtl">
      {/* Non-print controls */}
      <div className="print:hidden max-w-4xl mx-auto p-4 flex justify-between items-center">
        <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white font-bold rounded shadow hover:bg-blue-700">
          הדפס / שמור כ-PDF
        </button>
        <button onClick={() => window.close()} className="px-4 py-2 bg-slate-200 text-slate-800 font-bold rounded shadow hover:bg-slate-300">
          סגור כרטיסייה
        </button>
      </div>

      {/* The Paper */}
      <div className="max-w-[210mm] min-h-[297mm] mx-auto bg-white shadow-2xl print:shadow-none p-12 relative flex flex-col">
        
        {/* Header Ribbon / Accent */}
        <div className="absolute top-0 right-0 left-0 h-4" style={primaryBg} />

        <div className="flex justify-between items-start mt-6 mb-16 border-b pb-8 border-slate-200">
          <div className="space-y-1 text-slate-600">
            {settings.issuer_logo_url ? (
               <img src={settings.issuer_logo_url} alt="Logo" className="h-16 w-auto mb-4 object-contain" />
            ) : (
               <h1 className="text-3xl font-black mb-4" style={primaryText}>{settings.issuer_name_he}</h1>
            )}
            <p><strong className="text-slate-800">ח.פ / ע.מ:</strong> {settings.issuer_tax_id}</p>
            <p>{settings.issuer_address}</p>
            <p>{settings.issuer_phone} • {settings.issuer_email}</p>
          </div>
          <div className="text-left">
             <h2 className="text-5xl font-black mb-2" style={primaryText}>חשבונית מס</h2>
             <p className="text-xl font-bold text-slate-700"># {inv.invoice_number}</p>
          </div>
        </div>

        <div className="flex justify-between gap-10 mb-12">
          {/* Bill To */}
          <div className="flex-1 space-y-1">
             <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">לכבוד</p>
             <h3 className="text-xl font-bold text-slate-800">לקוח (צריך לשלוף שם)</h3>
          </div>
          {/* Details */}
          <div className="flex-1 grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
             <div>
                <p className="text-xs font-bold text-slate-400 uppercase">תאריך הוצאה</p>
                <p className="font-semibold text-slate-800">{new Date(inv.issue_date).toLocaleDateString("he-IL")}</p>
             </div>
             <div>
                <p className="text-xs font-bold text-slate-400 uppercase">תאריך לתשלום</p>
                <p className="font-semibold text-slate-800">{new Date(inv.due_date).toLocaleDateString("he-IL")}</p>
             </div>
             <div className="col-span-2">
                <p className="text-xs font-bold text-slate-400 uppercase">תקופת חיוב</p>
                <p className="font-semibold text-slate-800">{inv.billing_period}</p>
             </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-800">
                <th className="py-3 px-2 text-right font-bold text-slate-800">תיאור שירות / פריט</th>
                <th className="py-3 px-2 text-right font-bold text-slate-800 w-32">סכום ש&quot;ח</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inv.lines.map((l) => (
                <tr key={l.id}>
                  <td className="py-4 px-2 text-slate-700 font-medium">{l.description}</td>
                  <td className="py-4 px-2 text-right text-slate-800 font-bold tracking-tight">₪ {parseFloat(l.amount_ils).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-between items-end mt-12 pt-8 border-t-2 border-slate-800">
          <div className="max-w-xs text-sm text-slate-500 whitespace-pre-wrap">
             <p className="font-bold text-slate-800 mb-1">הוראות תשלום:</p>
             {settings.payment_instructions}
          </div>
          <div className="w-64 space-y-3">
             <div className="flex justify-between text-slate-600">
               <span>סה&quot;כ ביניים:</span>
               <span className="font-bold">₪ {parseFloat(inv.subtotal_ils).toLocaleString()}</span>
             </div>
             <div className="flex justify-between text-slate-600">
               <span>מע&quot;מ ({inv.vat_pct}%):</span>
               <span className="font-bold">₪ {parseFloat(inv.vat_ils).toLocaleString()}</span>
             </div>
             <div className="flex justify-between border-t border-slate-200 pt-3">
               <span className="text-xl font-black text-slate-800">לתשלום סה&quot;כ:</span>
               <span className="text-xl font-black" style={primaryText}>₪ {parseFloat(inv.total_ils).toLocaleString()}</span>
             </div>
          </div>
        </div>

        {/* Footer */}
        {settings.footer_text && (
           <div className="mt-16 text-center text-xs text-slate-400 border-t border-slate-100 pt-6">
             {settings.footer_text}
           </div>
        )}
      </div>
    </div>
  );
}
