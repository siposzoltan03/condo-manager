"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, AlertCircle } from "lucide-react";
import { PublicNav } from "./public-nav";

type Props = {
  planSlug: string;
};

export function CheckoutRedirect({ planSlug }: Props) {
  const t = useTranslations("checkout");
  const searchParams = useSearchParams();
  const period = searchParams.get("period") || "monthly";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planSlug,
          billingPeriod: period,
          email,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 404) {
          setError(t("planNotFound"));
        } else {
          setError(data.error || t("error"));
        }
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(t("error"));
        setLoading(false);
      }
    } catch {
      setError(t("error"));
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicNav />

      <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#002045]" />
            <p className="mt-4 text-sm font-medium text-slate-600">
              {t("redirecting")}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-extrabold text-slate-900">
              {t("title")}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {t("subtitle", { plan: planSlug })}
            </p>

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700"
              >
                {t("enterEmail")}
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
              />
              <button
                type="submit"
                className="mt-4 w-full rounded-lg bg-[#002045] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#003060]"
              >
                {t("continueToPayment")}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-slate-500">
              <Link
                href="/pricing"
                className="text-[#002045] underline transition hover:text-[#003060]"
              >
                {t("backToPricing")}
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
