"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Check, X as XIcon, Building2 } from "lucide-react";
import { PublicNav } from "./public-nav";

type Plan = {
  slug: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  maxBuildings: number;
  maxUnitsPerBuilding: number;
  features: string[];
  trialDays: number;
};

const allFeatures = [
  "complaints",
  "announcements",
  "messaging",
  "documents",
  "finance",
  "voting",
  "maintenance",
  "forum",
  "api_access",
  "custom_branding",
  "audit_exports",
] as const;

export function PricingPage() {
  const t = useTranslations("pricing");
  const tLanding = useTranslations("landing");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/plans")
      .then((res) => res.json())
      .then((data) => {
        setPlans(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const isYearly = billingPeriod === "yearly";

  return (
    <div className="min-h-screen bg-card">
      <PublicNav />

      {/* Header */}
      <section className="bg-bg-3 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-soft">
            {t("subtitle")}
          </p>

          {/* Billing Toggle */}
          <div className="mt-10 flex items-center justify-center gap-3">
            <span
              className={`text-sm font-medium ${!isYearly ? "text-ink" : "text-muted"}`}
            >
              {t("monthly")}
            </span>
            <button
              onClick={() => setBillingPeriod(isYearly ? "monthly" : "yearly")}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                isYearly ? "bg-moss" : "bg-bg-2"
              }`}
              role="switch"
              aria-checked={isYearly}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-card shadow ring-0 transition-transform ${
                  isYearly ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <span
              className={`text-sm font-medium ${isYearly ? "text-ink" : "text-muted"}`}
            >
              {t("yearly")}
            </span>
            {isYearly && (
              <span className="rounded-full bg-good/15 px-2.5 py-0.5 text-xs font-semibold text-good">
                {t("savePercent")}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Plan Cards */}
      <section className="-mt-8 pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-tile-a border-t-moss" />
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-3">
              {plans.map((plan) => {
                const isPopular = plan.slug === "pro";
                const price = isYearly ? plan.priceYearly : plan.priceMonthly;
                const periodLabel = isYearly ? t("perYear") : t("perMonth");

                return (
                  <div
                    key={plan.slug}
                    className={`relative rounded-2xl border-2 bg-card p-8 shadow-sm ${
                      isPopular
                        ? "border-moss shadow-lg"
                        : "border-tile-a"
                    }`}
                  >
                    {isPopular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-moss px-4 py-1 text-xs font-bold text-card">
                        {t("mostPopular")}
                      </span>
                    )}

                    <h3 className="text-lg font-bold text-ink">{plan.name}</h3>

                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-ink">
                        €{price.toFixed(0)}
                      </span>
                      <span className="text-sm text-muted">{periodLabel}</span>
                    </div>

                    <p className="mt-2 text-xs text-muted">
                      {t("trialNote", { days: plan.trialDays })}
                    </p>

                    {/* Limits */}
                    <div className="mt-6 space-y-2 border-b border-tile-a pb-6">
                      <p className="text-sm text-ink-soft">
                        <span className="font-semibold">
                          {plan.maxBuildings === -1
                            ? t("unlimited")
                            : plan.maxBuildings}
                        </span>{" "}
                        {t("buildings", { count: plan.maxBuildings === -1 ? 2 : plan.maxBuildings })}
                      </p>
                      <p className="text-sm text-ink-soft">
                        {t("upTo")}{" "}
                        <span className="font-semibold">
                          {plan.maxUnitsPerBuilding === -1
                            ? t("unlimited")
                            : plan.maxUnitsPerBuilding}
                        </span>{" "}
                        {t("units")}
                      </p>
                    </div>

                    {/* Features */}
                    <ul className="mt-6 space-y-3">
                      {allFeatures.map((feature) => {
                        const included = plan.features.includes(feature);
                        return (
                          <li key={feature} className="flex items-center gap-2">
                            {included ? (
                              <Check className="h-4 w-4 shrink-0 text-good" />
                            ) : (
                              <XIcon className="h-4 w-4 shrink-0 text-tile-a" />
                            )}
                            <span
                              className={`text-sm ${
                                included ? "text-ink-soft" : "text-muted"
                              }`}
                            >
                              {t(`feature.${feature}`)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>

                    {/* CTA */}
                    <Link
                      href={`/checkout/${plan.slug}?period=${billingPeriod}`}
                      className={`mt-8 block rounded-lg px-4 py-3 text-center text-sm font-semibold transition ${
                        isPopular
                          ? "bg-moss text-card hover:opacity-90"
                          : "border border-moss text-moss hover:bg-moss/5"
                      }`}
                    >
                      {t("getStarted")}
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Feature Comparison Table */}
      {!loading && plans.length > 0 && (
        <section className="bg-bg-3 py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <h2 className="mb-10 text-center text-2xl font-extrabold text-ink">
              {t("comparisonTitle")}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-tile-a">
                    <th className="pb-4 pr-6 font-medium text-muted">{t("featureLabel")}</th>
                    {plans.map((plan) => (
                      <th
                        key={plan.slug}
                        className="pb-4 text-center font-bold text-ink"
                      >
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Limits rows */}
                  <tr className="border-b border-tile-a">
                    <td className="py-3 pr-6 font-medium text-ink-soft">{t("buildings")}</td>
                    {plans.map((plan) => (
                      <td key={plan.slug} className="py-3 text-center text-ink-soft">
                        {plan.maxBuildings === -1 ? t("unlimited") : plan.maxBuildings}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-tile-a">
                    <td className="py-3 pr-6 font-medium text-ink-soft">{t("unitsPerBuilding")}</td>
                    {plans.map((plan) => (
                      <td key={plan.slug} className="py-3 text-center text-ink-soft">
                        {plan.maxUnitsPerBuilding === -1
                          ? t("unlimited")
                          : plan.maxUnitsPerBuilding}
                      </td>
                    ))}
                  </tr>
                  {/* Feature rows */}
                  {allFeatures.map((feature) => (
                    <tr key={feature} className="border-b border-tile-a">
                      <td className="py-3 pr-6 font-medium text-ink-soft">
                        {t(`feature.${feature}`)}
                      </td>
                      {plans.map((plan) => (
                        <td key={plan.slug} className="py-3 text-center">
                          {plan.features.includes(feature) ? (
                            <Check className="mx-auto h-4 w-4 text-good" />
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-tile-a bg-card py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted" />
            <span className="text-sm text-muted">{tLanding("footerCopyright")}</span>
          </div>
          <div className="flex gap-6">
            <Link href="/login" className="text-sm text-muted transition hover:text-ink-soft">
              {tLanding("footerLogin")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
