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
    <div className="min-h-screen bg-bg-3">
      <PublicNav />

      <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
        {loading ? (
          <div className="rounded-xl border border-tile-a bg-card p-10 text-center shadow-sm">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-moss" />
            <p className="mt-4 text-sm font-medium text-ink-soft">
              {t("redirecting")}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-tile-a bg-card p-8 shadow-sm">
            <h1 className="text-2xl font-extrabold text-ink">
              {t("title")}
            </h1>
            <p className="mt-2 text-sm text-ink-soft">
              {t("subtitle", { plan: planSlug })}
            </p>

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                <p className="text-sm text-danger">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-ink-soft"
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
                className="mt-1 block w-full rounded-lg border border-tile-a px-3 py-2 text-sm shadow-sm focus:border-moss focus:outline-none focus:ring-1 focus:ring-moss"
              />
              <button
                type="submit"
                className="mt-4 w-full rounded-lg bg-moss px-4 py-3 text-sm font-semibold text-card transition hover:opacity-90"
              >
                {t("continueToPayment")}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-muted">
              <Link
                href="/pricing"
                className="text-moss underline transition hover:opacity-80"
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
