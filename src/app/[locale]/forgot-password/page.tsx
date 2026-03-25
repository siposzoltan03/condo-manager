"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Mail, Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      // still show success to prevent enumeration
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: "#faf8ff" }}
    >
      <div className="w-full max-w-md">
        <div className="rounded-xl bg-white p-10 shadow-xl">
          {sent ? (
            <div className="text-center">
              <CheckCircle className="mx-auto h-12 w-12" style={{ color: "#002045" }} />
              <h1
                className="mt-4 text-2xl font-extrabold"
                style={{ color: "#002045", fontFamily: "Manrope, sans-serif" }}
              >
                {t("forgotPassword")}
              </h1>
              <p className="mt-3 text-sm" style={{ color: "#43474e" }}>
                {t("passwordResetSent")}
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center gap-2 text-sm font-medium hover:underline"
                style={{ color: "#002045" }}
              >
                <ArrowLeft className="h-4 w-4" />
                {tCommon("login")}
              </Link>
            </div>
          ) : (
            <>
              <h1
                className="text-2xl font-extrabold"
                style={{ color: "#002045", fontFamily: "Manrope, sans-serif" }}
              >
                {t("forgotPassword")}
              </h1>
              <p className="mt-2 text-sm" style={{ color: "#43474e" }}>
                Enter your email address and we will send you a link to reset
                your password.
              </p>
              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "#43474e" }}
                  >
                    {tCommon("email")} address
                  </label>
                  <div className="relative mt-2">
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full rounded-lg border border-transparent py-4 px-5 pr-12 text-sm outline-none transition-colors focus:border-[#002045] focus:ring-1 focus:ring-[#002045]"
                      style={{ backgroundColor: "#f2f3ff", color: "#131b2e" }}
                      placeholder="you@example.com"
                    />
                    <Mail
                      className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5"
                      style={{ color: "#43474e" }}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center rounded-lg py-4 text-sm font-bold text-white shadow transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: "#002045" }}
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
                  style={{ color: "#002045" }}
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
