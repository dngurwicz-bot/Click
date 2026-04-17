"use client";

import { useEffect, useState } from "react";
import { api, getAuthHeaders } from "@/lib/api";
import { Download, Filter, FileSpreadsheet, Command, TerminalSquare, AlertCircle } from "lucide-react";

interface FieldDef {
  id: string;
  label: string;
  type: string;
  operators: string[];
}

interface EntityDef {
  id: string;
  label: string;
  description: string;
  fields: FieldDef[];
}

export function DynamicBuilder() {
  const [entities, setEntities] = useState<EntityDef[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  
  const [filters, setFilters] = useState<Array<{ field: string; operator: string; value: string }>>([]);
  const [results, setResults] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    api.get<{ entities: EntityDef[] }>("/api/insights/builder/schema")
      .then((res) => {
        setEntities(res.entities);
        if (res.entities.length > 0) {
          setSelectedEntityId(res.entities[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const activeEntity = entities.find(e => e.id === selectedEntityId);

  // Auto-select first few fields when changing entity
  useEffect(() => {
    if (activeEntity) {
      setSelectedFields(activeEntity.fields.slice(0, 3).map(f => f.id));
      setFilters([]);
      setResults([]);
    }
  }, [selectedEntityId, activeEntity]);

  const toggleField = (fieldId: string) => {
    setSelectedFields(prev => 
      prev.includes(fieldId) ? prev.filter(id => id !== fieldId) : [...prev, fieldId]
    );
  };

  const addFilter = () => {
    if (!activeEntity || activeEntity.fields.length === 0) return;
    setFilters([...filters, { field: activeEntity.fields[0].id, operator: "equals", value: "" }]);
  };

  const updateFilter = (index: number, key: string, value: string) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], [key]: value };
    // reset operator if field changes
    if (key === 'field') {
       const fieldObj = activeEntity?.fields.find(f => f.id === value);
       if (fieldObj) newFilters[index].operator = fieldObj.operators[0];
    }
    setFilters(newFilters);
  };

  const executeQuery = async () => {
    if (!selectedEntityId || selectedFields.length === 0) return;
    setExecuting(true);
    try {
      const res = await api.post<any>("/api/insights/builder/execute", {
        entity: selectedEntityId,
        selected_fields: selectedFields,
        filters: filters.filter(f => f.value.trim() !== "" || ["is_null", "is_not_null"].includes(f.operator)),
        limit: 100
      });
      setColumns(res.columns);
      setResults(res.rows);
    } catch (e) {
      console.error(e);
      alert("שגיאה בטעינת הדוח. אנא ודא שהגדרת את הסינונים כראוי.");
    } finally {
      setExecuting(false);
    }
  };

  const exportCsv = async () => {
    if (!selectedEntityId || selectedFields.length === 0) return;
    setExecuting(true);
    try {
      const res = await api.post<any>("/api/insights/builder/export", {
        entity: selectedEntityId,
        selected_fields: selectedFields,
        filters: filters.filter(f => f.value.trim() !== "" || ["is_null", "is_not_null"].includes(f.operator)),
      });
      
      // Decode base64
      const binaryString = window.atob(res.content_base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const blob = new Blob([bytes], { type: "text/csv; charset=utf-8-sig" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("שגיאה בייצוא הדוח");
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-10 opacity-50">טוען נתונים...</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left column Settings */}
        <div className="col-span-1 space-y-6">
          
          {/* Entity Picker */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 p-5 backdrop-blur-lg">
            <h3 className="flex items-center gap-2 font-semibold text-slate-800 mb-4 text-sm">
              <Command size={16} className="text-brand-500" />
              בחר מקור נתונים
            </h3>
            <select 
              value={selectedEntityId}
              onChange={e => setSelectedEntityId(e.target.value)}
              className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all"
            >
              <option disabled value="">-- בחר --</option>
              {entities.map(e => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>
            {activeEntity && (
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">{activeEntity.description}</p>
            )}
          </div>

          {/* Field Picker */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 p-5">
            <h3 className="flex items-center gap-2 font-semibold text-slate-800 mb-3 text-sm">
              <TerminalSquare size={16} className="text-violet-500" />
              בחר עמודות ({selectedFields.length})
            </h3>
            <div className="h-48 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
              {activeEntity?.fields.map(f => {
                const isActive = selectedFields.includes(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => toggleField(f.id)}
                    className={`text-xs w-full text-right px-3 py-2 rounded-md transition-all flex items-center justify-between group ${
                      isActive 
                        ? 'bg-brand-50 border-brand-200 text-brand-700 shadow-sm border' 
                        : 'hover:bg-slate-50 text-slate-600 border border-transparent'
                    }`}
                  >
                    <span>{f.label}</span>
                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-brand-500 shadow-sm shadow-brand-200" />}
                  </button>
                );
              })}
            </div>
            {selectedFields.length === 0 && (
              <div className="text-xs text-red-500 mt-2 flex items-center gap-1">
                <AlertCircle size={12}/> חובה לבחור לפחות עמודה אחת
              </div>
            )}
          </div>

        </div>

        {/* Right column - Filters & Results */}
        <div className="col-span-2 flex flex-col gap-6">
          
          {/* Filters Engine */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 p-5 text-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="flex items-center gap-2 font-semibold text-slate-800">
                <Filter size={16} className="text-orange-500" />
                סינונים בהתאמה אישית
              </h3>
              <button 
                onClick={addFilter}
                className="text-xs font-semibold text-brand-600 hover:text-brand-800 bg-brand-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                + הוסף חוק סינון
              </button>
            </div>
            
            <div className="space-y-3">
              {filters.length === 0 && (
                <div className="text-xs text-slate-400 py-4 text-center border-2 border-dashed border-slate-100 rounded-lg bg-slate-50/50">
                  לא הוגדרו סינונים (הדוח יציג את כל הנתונים)
                </div>
              )}
              {filters.map((f, i) => {
                const fieldDef = activeEntity?.fields.find(fd => fd.id === f.field);
                return (
                  <div key={i} className="flex items-center gap-3 bg-slate-50 border border-slate-100 p-2.5 rounded-lg animate-in fade-in slide-in-from-top-1">
                    <select 
                      value={f.field} onChange={e => updateFilter(i, 'field', e.target.value)}
                      className="bg-white border border-slate-200 rounded p-1.5 w-1/3 outline-none focus:border-brand-300"
                    >
                      {activeEntity?.fields.map(fd => <option key={fd.id} value={fd.id}>{fd.label}</option>)}
                    </select>
                    
                    <select 
                      value={f.operator} onChange={e => updateFilter(i, 'operator', e.target.value)}
                      className="bg-white border border-slate-200 rounded p-1.5 w-1/3 outline-none focus:border-brand-300"
                    >
                      {fieldDef?.operators.map(op => <option key={op} value={op}>{op.replace('_', ' ').toUpperCase()}</option>)}
                    </select>
                    
                    <div className="w-1/3 flex items-center gap-2">
                       {(!["is_null", "is_not_null"].includes(f.operator)) && (
                         <input 
                           type={fieldDef?.type === 'number' ? 'number' : fieldDef?.type === 'date' ? 'date' : 'text'}
                           className="bg-white border border-slate-200 rounded p-1.5 w-full outline-none focus:border-brand-300 placeholder:text-slate-300"
                           value={f.value}
                           onChange={e => updateFilter(i, 'value', e.target.value)}
                           placeholder="ערך..."
                         />
                       )}
                       <button onClick={() => setFilters(filters.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-500 font-bold px-2 rounded-md bg-white border border-slate-200 transition-colors">
                         &times;
                       </button>
                    </div>
                  </div>
                )
              })}
            </div>
            
            <div className="mt-6 flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100">
              <button 
                onClick={executeQuery}
                disabled={executing || selectedFields.length === 0}
                className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-slate-200"
              >
                {executing ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                ) : <Filter size={14}/>}
                הרץ דוח עכשיו
              </button>
              
              <button 
                onClick={exportCsv}
                disabled={executing || selectedFields.length === 0 || results.length === 0}
                className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-emerald-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-200/50"
              >
                <FileSpreadsheet size={15}/>
                ייצא ל-CSV
              </button>
            </div>
            
          </div>
          
        </div>
      </div>
      
      {/* Results View */}
      {results.length > 0 && (
         <div className="bg-white border border-slate-200/70 shadow-sm rounded-xl overflow-hidden mt-2 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-600 tracking-wide uppercase">תצוגה מקדימה ({results.length} שורות)</h3>
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 bg-red-400 rounded-full"/>
                <div className="w-2.5 h-2.5 bg-amber-400 rounded-full"/>
                <div className="w-2.5 h-2.5 bg-green-400 rounded-full"/>
              </div>
            </div>
            <div className="overflow-x-auto">
               <table className="w-full text-sm text-right">
                 <thead className="bg-slate-50 text-slate-500 font-medium">
                   <tr>
                     {columns.map((col) => {
                       const lbl = activeEntity?.fields.find(f => f.id === col)?.label || col;
                       return <th key={col} className="px-4 py-3 border-b border-slate-200 whitespace-nowrap">{lbl}</th>
                     })}
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {results.map((row, i) => (
                     <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                       {columns.map(col => (
                         <td key={col} className="px-4 py-3 text-slate-700 max-w-[200px] truncate whitespace-nowrap">
                            {row[col] ?? <span className="text-slate-300">—</span>}
                         </td>
                       ))}
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>
         </div>
      )}

    </div>
  );
}
