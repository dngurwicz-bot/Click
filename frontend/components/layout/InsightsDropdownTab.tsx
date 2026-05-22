"use client";
import { useState, useRef, useEffect, type MouseEvent as ReactMouseEvent } from "react";
import { BarChart3, ChevronDown, FileText, Save, Share2 } from "lucide-react";
import { api } from "@/lib/api";
import { getStaticScreen, type DashboardScreen } from "@/lib/dashboardScreens";
import { ReportCatalogItem, SavedReportView } from "../reports/types";

export function InsightsDropdownTab({
  active,
  onNavigate,
  onScreenContextMenu,
  insightsScreen,
}: {
  active: boolean;
  onNavigate: (href: string) => void;
  onScreenContextMenu?: (screen: DashboardScreen, event: ReactMouseEvent<HTMLButtonElement>) => void;
  insightsScreen?: DashboardScreen | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [catalog, setCatalog] = useState<ReportCatalogItem[]>([]);
  const [savedReports, setSavedReports] = useState<SavedReportView[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<SavedReportView[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOpen = () => {
    setIsOpen(!isOpen);
    if (!hasLoaded) {
      Promise.all([
        api.get<{ reports: ReportCatalogItem[] }>("/api/insights/reports/catalog"),
        api.get<SavedReportView[]>("/api/insights/reports/saved?kind=report"),
        api.get<SavedReportView[]>("/api/insights/reports/saved?kind=template")
      ]).then(([catalogRes, savedRes, templateRes]) => {
        setCatalog(catalogRes.reports);
        setSavedReports(savedRes);
        setSavedTemplates(templateRes);
        setHasLoaded(true);
      }).catch(console.error);
    }
  };

  const handleSelectTemplate = (id: string) => {
    setIsOpen(false);
    onNavigate(`/admin/reports?template=${id}`);
    // Dispatch custom event so ReportsWorkspace can update immediately without a hard reload if already mounted
    window.dispatchEvent(new CustomEvent('load-report', { detail: { type: 'template', id } }));
  };

  const handleSelectSaved = (id: string) => {
    setIsOpen(false);
    onNavigate(`/admin/reports?saved=${id}`);
    window.dispatchEvent(new CustomEvent('load-report', { detail: { type: 'saved', id } }));
  };

  const handleSelectSavedTemplate = (id: string) => {
    setIsOpen(false);
    onNavigate(`/admin/reports?saved_template=${id}`);
    window.dispatchEvent(new CustomEvent('load-report', { detail: { type: 'saved-template', id } }));
  };

  return (
    <div className="relative h-full flex items-center" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleOpen}
        onContextMenu={insightsScreen && onScreenContextMenu ? (event) => onScreenContextMenu(insightsScreen, event) : undefined}
        className={`relative flex h-full flex-col items-center justify-center gap-0.5 px-3 transition-colors ${
          active ? "text-brand-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
        }`}
        style={{ minWidth: 44 }}
      >
        <div className="flex items-center gap-0.5">
          <BarChart3 size={16} className={active ? "text-brand-500" : "text-slate-400"} />
          <ChevronDown size={10} className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
        <span className="whitespace-nowrap text-[10px] font-medium leading-none">Insights</span>
        {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500" />}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-50 w-64 overflow-hidden rounded border border-slate-200 bg-white shadow-lg text-right">
          
          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onNavigate("/admin/reports?new=true");
                window.dispatchEvent(new CustomEvent('load-report', { detail: { type: 'new' } }));
              }}
              onContextMenu={onScreenContextMenu ? (event) => {
                const screen = getStaticScreen("insights:new_report");
                if (screen) onScreenContextMenu(screen, event);
              } : undefined}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <div className="flex h-5 w-5 items-center justify-center rounded-sm bg-brand-50 text-brand-600 shrink-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>
              </div>
              יצירת דוח חדש
            </button>
          </div>

          <div className="border-y border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            דוחות מערכת
          </div>
          <div className="py-1 max-h-[200px] overflow-y-auto">
            {catalog.map(item => (
              <button
                key={item.id}
                onClick={() => handleSelectTemplate(item.id)}
                className="flex w-full items-start gap-2 px-3 py-2 text-xs transition text-slate-700 hover:bg-slate-50 text-right"
              >
                <FileText size={13} className="text-slate-400 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-slate-800">{item.title}</span>
                  <span className="text-[10px] text-slate-500 line-clamp-1">{item.description}</span>
                </div>
              </button>
            ))}
            {hasLoaded && catalog.length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-400">אין דוחות במערכת</div>
            )}
          </div>

          <div className="border-y border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            התבניות שלי
          </div>
          <div className="py-1 max-h-[160px] overflow-y-auto">
            {savedTemplates.map(item => (
              <button
                key={item.id}
                onClick={() => handleSelectSavedTemplate(item.id)}
                className="flex w-full items-start gap-2 px-3 py-2 text-xs transition text-slate-700 hover:bg-slate-50 text-right"
              >
                <FileText size={13} className="text-brand-500 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5 w-full pr-0">
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium text-slate-800 line-clamp-1">{item.name}</span>
                    {item.visibility === "shared" && <Share2 size={10} className="text-slate-400 shrink-0" />}
                  </div>
                  <span className="text-[10px] text-slate-500 line-clamp-1">{item.dataset}</span>
                </div>
              </button>
            ))}
            {hasLoaded && savedTemplates.length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-400">אין תבניות שמורות</div>
            )}
          </div>

          <div className="border-y border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            הדוחות שלי
          </div>
          <div className="py-1 max-h-[200px] overflow-y-auto">
            {savedReports.map(item => (
              <button
                key={item.id}
                onClick={() => handleSelectSaved(item.id)}
                className="flex w-full items-start gap-2 px-3 py-2 text-xs transition text-slate-700 hover:bg-slate-50 text-right"
              >
                <Save size={13} className="text-slate-400 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5 w-full pr-0">
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium text-slate-800 line-clamp-1">{item.name}</span>
                    {item.visibility === "shared" && <Share2 size={10} className="text-slate-400 shrink-0" />}
                  </div>
                  <span className="text-[10px] text-slate-500 line-clamp-1">{item.dataset}</span>
                </div>
              </button>
            ))}
            {hasLoaded && savedReports.length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-400">אין דוחות שמורים</div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
