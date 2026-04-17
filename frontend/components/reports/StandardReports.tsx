"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Download, FileText, PieChart } from "lucide-react";

interface ReportCatalogItem {
  id: string;
  title: string;
  description: string;
  audience: string;
  supports_date_range: boolean;
  supports_status_filter: boolean;
  supports_module_filter: boolean;
  is_available: boolean;
  availability_note?: string;
}

export function StandardReports() {
  const [catalog, setCatalog] = useState<ReportCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ reports: ReportCatalogItem[] }>("/api/insights/reports/catalog")
      .then((res) => {
        setCatalog(res.reports);
      })
      .catch((e) => console.error("Failed to load catalog", e))
      .finally(() => setLoading(false));
  }, []);

  const downloadReport = async (item: ReportCatalogItem, format: 'pdf' | 'csv') => {
    try {
      const res = await api.post<any>("/api/insights/reports/export", {
        report_id: item.id,
        format: format,
        filters: {}
      });
      
      const fileExt = format === 'pdf' ? 'pdf' : 'csv';
      const mime = format === 'pdf' ? 'application/pdf' : 'text/csv; charset=utf-8-sig';
      const binaryString = window.atob(res.content_base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const blob = new Blob([bytes], { type: mime });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.file_name || `${item.id}.${fileExt}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert("שגיאה בייצוא הדוח");
      console.error(e);
    }
  };

  if (loading) {
    return <div className="text-center py-10 opacity-50">טוען קטלוג דוחות...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {catalog.map(item => (
        <div key={item.id} className={`bg-white border rounded-xl p-5 flex flex-col gap-3 shadow-sm transition-all hover:shadow-md ${!item.is_available ? 'opacity-60 grayscale' : 'border-slate-200'}`}>
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600">
              <PieChart size={20} />
            </div>
            {!item.is_available && (
              <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">
                חסומה גישה
              </span>
            )}
          </div>
          
          <div>
            <h3 className="font-bold text-slate-800 text-base">{item.title}</h3>
            <p className="text-xs text-slate-500 mt-1 h-8 overflow-hidden">{item.description}</p>
          </div>
          
          <div className="text-[10px] text-slate-400">
            קהל יעד: <span className="font-semibold text-slate-600">{item.audience}</span>
          </div>

          <div className="mt-auto pt-4 border-t border-slate-100 flex gap-2">
            <button 
              disabled={!item.is_available}
              onClick={() => downloadReport(item, 'pdf')}
              className="flex-1 flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <FileText size={14}/> PDF
            </button>
            <button 
              disabled={!item.is_available}
              onClick={() => downloadReport(item, 'csv')}
              className="flex-1 flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <Download size={14}/> CSV
            </button>
          </div>
          {item.availability_note && (
             <div className="text-[10px] text-red-500 text-center mt-1">{item.availability_note}</div>
          )}
        </div>
      ))}
    </div>
  );
}
