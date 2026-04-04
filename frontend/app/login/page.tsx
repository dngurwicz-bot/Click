"use client";

import { useState, FormEvent, ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { login } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Logo } from "@/components/layout/Logo";

export default function LoginPage() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  const [forgotMode,    setForgotMode]    = useState(false);
  const [forgotEmail,   setForgotEmail]   = useState("");
  const [forgotSuccess, setForgotSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError("יש להזין כתובת דואר אלקטרוני.");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(normalizedEmail)) {
      setError("יש להזין כתובת דואר אלקטרוני תקינה.");
      return;
    }
    if (!password) {
      setError("יש להזין סיסמה.");
      return;
    }

    setLoading(true);
    try {
      await login(normalizedEmail, password);
      window.location.replace("/dashboard");
    } catch (err: unknown) {
      const apiErr = err as { error?: string; message?: string };
      setError(apiErr.error ?? apiErr.message ?? "שגיאה בהתחברות. נסה שנית.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: sbError } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (sbError) throw sbError;
      setForgotSuccess(true);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message ?? "שגיאה בשליחת המייל. נסה שנית.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "#eef1f5" }}
    >
      <div className="w-full max-w-[460px]">
        {/* Card */}
        <div
          className="bg-white rounded-2xl px-10 py-10"
          style={{ boxShadow: "0 4px 24px 0 rgb(0 0 0 / 0.08), 0 1px 4px 0 rgb(0 0 0 / 0.04)" }}
        >
          {/* Logo */}
          <div className="mb-8">
            <Logo href="" size="md" variant="dark" />
          </div>

          {forgotMode ? (
            forgotSuccess ? (
              /* ── Forgot success ── */
              <div className="space-y-5 text-right">
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-4 text-sm text-emerald-700">
                  נשלח קישור לאיפוס סיסמה לכתובת <strong>{forgotEmail}</strong>.<br />
                  בדוק את תיבת הדואר שלך.
                </div>
                <button
                  onClick={() => { setForgotMode(false); setForgotSuccess(false); setForgotEmail(""); }}
                  className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
                >
                  חזור להתחברות
                </button>
              </div>
            ) : (
              /* ── Forgot form ── */
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div className="text-right mb-1">
                  <h2 className="text-base font-semibold text-slate-800">איפוס סיסמה</h2>
                  <p className="text-xs text-slate-400 mt-1">הזן את כתובת הדואר שלך ונשלח קישור לאיפוס.</p>
                </div>

                <FormRow label="דואר אלקטרוני">
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className={inputClass}
                    placeholder="admin@company.co.il"
                  />
                </FormRow>

                {error && <ErrorBox>{error}</ErrorBox>}

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className={btnClass}
                  >
                    {loading ? "שולח..." : "שלח קישור"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setForgotMode(false); setError(null); }}
                    className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    חזור להתחברות
                  </button>
                </div>
              </form>
            )
          ) : (
            /* ── Login form ── */
            <form noValidate onSubmit={handleSubmit} className="space-y-4">
              <FormRow label="דואר אלקטרוני">
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="admin@company.co.il"
                />
              </FormRow>

              <FormRow label="סיסמה">
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputClass} pl-10`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400
                               hover:text-slate-600 transition-colors"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </FormRow>

              {error && <ErrorBox>{error}</ErrorBox>}

              {/* Actions row — button left, forgot right (RTL) */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className={btnClass}
                >
                  {loading ? "מתחבר..." : "כניסה"}
                </button>

                <button
                  type="button"
                  onClick={() => { setForgotMode(true); setForgotEmail(email); setError(null); }}
                  className="text-sm text-brand-600 hover:text-brand-700 font-medium transition-colors"
                >
                  שכחת סיסמה?
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-slate-400 text-xs mt-5">
          CLICK · DNG HUB &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

/* ── Shared styles ── */

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 " +
  "placeholder-slate-300 text-right " +
  "focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition";

const btnClass =
  "px-6 py-2.5 rounded-lg bg-[#3b5bdb] hover:bg-[#3451c7] active:bg-[#2f48b0] " +
  "disabled:opacity-60 disabled:cursor-not-allowed " +
  "text-white text-sm font-semibold transition-colors shadow-sm";

/* ── FormRow: label above input (RTL safe) ── */
function FormRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-semibold text-slate-700 text-right">
        {label}
      </label>
      {children}
    </div>
  );
}

/* ── Error box ── */
function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 text-right flex items-start gap-2">
      <span className="shrink-0">⚠</span>
      <span>{children}</span>
    </div>
  );
}
