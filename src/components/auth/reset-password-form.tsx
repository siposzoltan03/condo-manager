"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Lock, Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import Link from "next/link";

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError(t("passwordTooShort"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (res.ok) {
        setSuccess(true);
      } else {
        const data = await res.json();
        setError(data.error ?? tCommon("error"));
      }
    } catch {
      setError(tCommon("error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: "var(--color-bg-3)" }}
    >
      <div className="w-full max-w-md">
        <div className="rounded-xl bg-card p-10 shadow-xl">
          {success ? (
            <div className="text-center">
              <CheckCircle className="mx-auto h-12 w-12" style={{ color: "var(--color-moss)" }} />
              <h1
                className="mt-4 text-2xl font-extrabold font-display"
                style={{ color: "var(--color-moss)" }}
              >
                {t("resetPassword")}
              </h1>
              <p className="mt-3 text-sm" style={{ color: "var(--color-ink-soft)" }}>
                {t("resetSuccess")}
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg py-3 px-6 text-sm font-bold text-card shadow transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--color-moss)" }}
              >
                {t("signIn")}
              </Link>
            </div>
          ) : (
            <>
              <h1
                className="text-2xl font-extrabold font-display"
                style={{ color: "var(--color-moss)" }}
              >
                {t("resetPassword")}
              </h1>
              <p className="mt-2 text-sm" style={{ color: "var(--color-ink-soft)" }}>
                {t("resetPasswordDesc")}
              </p>

              {!token && (
                <div className="mt-4 rounded-lg bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger">
                  {t("invalidToken")}
                </div>
              )}

              {error && (
                <div className="mt-4 rounded-lg bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                <div>
                  <label
                    htmlFor="password"
                    className="block text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--color-ink-soft)" }}
                  >
                    {t("newPassword")}
                  </label>
                  <div className="relative mt-2">
                    <input
                      id="password"
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full rounded-lg border border-transparent py-4 px-5 pr-12 text-sm outline-none transition-colors focus:border-moss focus:ring-1 focus:ring-moss"
                      style={{ backgroundColor: "var(--color-bg-3)", color: "var(--color-ink)" }}
                      placeholder="••••••••"
                    />
                    <Lock
                      className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5"
                      style={{ color: "var(--color-ink-soft)" }}
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--color-ink-soft)" }}
                  >
                    {t("confirmPassword")}
                  </label>
                  <div className="relative mt-2">
                    <input
                      id="confirmPassword"
                      type="password"
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="block w-full rounded-lg border border-transparent py-4 px-5 pr-12 text-sm outline-none transition-colors focus:border-moss focus:ring-1 focus:ring-moss"
                      style={{ backgroundColor: "var(--color-bg-3)", color: "var(--color-ink)" }}
                      placeholder="••••••••"
                    />
                    <Lock
                      className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5"
                      style={{ color: "var(--color-ink-soft)" }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !token}
                  className="flex w-full items-center justify-center rounded-lg py-4 text-sm font-bold text-card shadow transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: "var(--color-moss)" }}
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    t("resetPassword")
                  )}
                </button>
              </form>

              <div className="mt-5 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
                  style={{ color: "var(--color-moss)" }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  {tCommon("login")}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
