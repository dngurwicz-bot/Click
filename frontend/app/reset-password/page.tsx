"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Logo } from "@/components/layout/Logo";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase puts the session tokens in the URL hash on redirect
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("הסיסמה חייבת להכיל לפחות 6 תווים.");
      return;
    }
    if (password !== confirm) {
      setError("הסיסמאות אינן תואמות.");
      return;
    }

    setLoading(true);
    try {
      const { error: sbError } = await supabase.auth.updateUser({ password });
      if (sbError) throw sbError;
      router.replace("/login");
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message ?? "שגיאה באיפוס הסיסמה. נסה שנית.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-700 to-brand-500 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <div className="flex flex-col items-center mb-8 gap-2">
          <Logo href="" size="lg" />
          <p className="text-slate-500 text-sm">מערכת ניהול משאבי אנוש</p>
        </div>

        {!ready ? (
          <div className="text-center text-slate-500 text-sm py-4">
            מאמת קישור לאיפוס סיסמה...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-800 mb-4 text-right">בחר סיסמה חדשה</h2>
              <label htmlFor="new-password" className="block text-sm font-medium text-slate-700 mb-1">
                סיסמה חדשה
              </label>
              <input
                id="new-password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 placeholder-slate-400
                           focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
                           transition text-right"
                placeholder="לפחות 6 תווים"
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700 mb-1">
                אימות סיסמה
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 placeholder-slate-400
                           focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
                           transition text-right"
                placeholder="הזן שוב את הסיסמה"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-60 disabled:cursor-not-allowed
                         text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {loading ? "שומר..." : "שמור סיסמה חדשה"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
