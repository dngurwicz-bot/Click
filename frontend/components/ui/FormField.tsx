"use client";

interface FormFieldProps {
  label: string;
  required?: boolean;
  value?: string | null;
  type?: "text" | "email" | "select" | "textarea";
  options?: { value: string; label: string }[];
  readOnly?: boolean;
  onChange?: (v: string) => void;
  span?: number;
}

export function FormField({
  label, required, value, type = "text",
  options, readOnly = true, onChange,
}: FormFieldProps) {
  const inputClass =
    `flex-1 min-w-0 border border-slate-200 rounded px-2.5 py-1 text-xs text-right bg-white
     focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100
     disabled:bg-slate-50 disabled:text-slate-400 read-only:bg-slate-50 read-only:text-slate-600
     transition-colors`;

  return (
    <div className="flex items-center gap-2 min-h-[28px]">
      <label className="text-xs font-medium text-slate-500 shrink-0 text-right whitespace-nowrap"
             style={{ minWidth: "88px" }}>
        {required && <span className="text-red-400 ml-0.5">*</span>}
        {label}
      </label>
      {type === "select" ? (
        <select
          value={value ?? ""}
          disabled={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
          className={inputClass}
        >
          <option value="" />
          {options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea
          value={value ?? ""}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
          rows={2}
          className={`${inputClass} resize-none`}
        />
      ) : (
        <input
          type={type}
          value={value ?? ""}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
          className={inputClass}
        />
      )}
    </div>
  );
}
