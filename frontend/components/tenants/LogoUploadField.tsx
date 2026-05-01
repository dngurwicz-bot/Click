"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Camera, Trash2 } from "lucide-react";
import { uploadLogoFile } from "@/lib/logo-upload";

interface LogoUploadFieldProps {
  value?: string | null;
  onChange: (value: string) => void | Promise<void>;
  storageKey: string;
  size?: number;
  label?: string;
  hint?: string;
  className?: string;
  showRemove?: boolean;
}

export function LogoUploadField({
  value,
  onChange,
  storageKey,
  size = 96,
  label = "לוגו",
  hint = "לחץ להעלאת לוגו",
  className = "",
  showRemove = true,
}: LogoUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | undefined>(value || undefined);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    setPreview(value || undefined);
  }, [value]);

  useEffect(() => () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
  }, []);

  const boxStyle = useMemo(() => ({ width: size, height: size }), [size]);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    const localUrl = URL.createObjectURL(file);
    objectUrlRef.current = localUrl;
    setPreview(localUrl);

    try {
      const publicUrl = await uploadLogoFile(file, storageKey);
      await onChange(publicUrl);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setPreview(publicUrl);
    } catch (err: unknown) {
      setPreview(value || undefined);
      setError((err as { message?: string })?.message || "שגיאה בהעלאה");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    const previousPreview = preview;

    setUploading(true);
    setError(null);

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPreview(undefined);

    try {
      await onChange("");
      if (inputRef.current) inputRef.current.value = "";
    } catch (err: unknown) {
      setPreview(previousPreview || value || undefined);
      setError((err as { message?: string })?.message || "שגיאה בעדכון הלוגו");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {(label || (showRemove && (preview || value))) ? (
        <div className="flex items-center justify-between gap-2">
          {label ? <label className="text-xs font-medium text-slate-600">{label}</label> : <span />}
          {showRemove && (preview || value) ? (
            <button
              type="button"
              onClick={handleRemove}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
            >
              <Trash2 size={12} />
              הסר
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => !uploading && inputRef.current?.click()}
          className="group relative overflow-hidden rounded-lg border border-dashed border-slate-300 bg-white transition-colors hover:border-brand-400"
          style={boxStyle}
          title={hint}
        >
          {preview ? (
            <Image src={preview} alt="לוגו" fill sizes={`${size}px`} className="object-contain p-2" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Building2 size={Math.max(20, Math.round(size / 3))} className="text-slate-300" />
            </div>
          )}

          {uploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
              <Camera size={20} className="text-white drop-shadow" />
            </div>
          )}
        </button>

        <div className="min-w-0 text-xs text-slate-500">
          <div className="font-medium text-slate-700">{uploading ? "מעלה לוגו..." : "בחירת תמונה"}</div>
          <div className="mt-1 leading-5">{error || hint}</div>
        </div>
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}
