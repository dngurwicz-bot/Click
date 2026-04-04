"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Logo } from "@/components/layout/Logo";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadRecoverySession() {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!mounted) return;

      if (sessionError) {
        setError(sessionError.message);
      } else if (!data.session) {
        setError("קישור האיפוס אינו תקף או שפג תוקפו. אפשר לבקש קישור חדש ממסך ההתחברות.");
      }

      setReady(true);
    }

    loadRecoverySession();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password.length < 8) {
      setError("הסיסמה החדשה חייבת להכיל לפחות 8 תווים.");
      return;
    }
    if (password !== confirmPassword) {
      setError("אימות הסיסמה אינו תואם.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setSuccess("הסיסמה עודכנה בהצלחה. מעביר למסך ההתחברות...");
      setTimeout(() => router.replace("/login"), 1200);
    } catch (err: unknown) {
      const typedError = err as { message?: string };
      setError(typedError.message ?? "לא הצלחנו לעדכן את הסיסמה. נסה שוב.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#eef1f5" }}>
      <div className="w-full max-w-[460px]">
        <div
          className="bg-white rounded-2xl px-10 py-10"
          style={{ boxShadow: "0 4px 24px 0 rgb(0 0 0 / 0.08), 0 1px 4px 0 rgb(0 0 0 / 0.04)" }}
        >
          <div className="mb-8">
            <Logo href="" size="md" variant="dark" />
          </div>

          <div className="text-right mb-5">
            <h1 className="text-lg font-semibold text-slate-800">בחירת סיסמה חדשה</h1>
            <p className="text-xs text-slate-400 mt-1">הזן סיסמה חדשה לחשבון שלך.</p>
          </div>

          {!ready ? (
            <div className="py-6 text-center text-sm text-slate-400">טוען...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="text-right">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">סיסמה חדשה</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="לפחות 8 תווים"
                />
              </div>

              <div className="text-right">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">אימות סיסמה</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  placeholder="הזן שוב את הסיסמה"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700 text-right">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 text-right">
                  {success}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button type="submit" disabled={loading || !ready} className={btnClass}>
                  {loading ? "מעדכן..." : "עדכן סיסמה"}
                </button>
                <Link href="/login" className="text-sm text-brand-600 hover:text-brand-700 font-medium transition-colors">
                  חזור להתחברות
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 " +
  "placeholder-slate-300 text-right " +
  "focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition";

const btnClass =
  "px-6 py-2.5 rounded-lg bg-[#3b5bdb] hover:bg-[#3451c7] active:bg-[#2f48b0] " +
  "disabled:opacity-60 disabled:cursor-not-allowed " +
  "text-white text-sm font-semibold transition-colors shadow-sm";
