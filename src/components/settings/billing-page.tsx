"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { CreditCard, BarChart3, Clock, ExternalLink } from "lucide-react";

interface SubscriptionData {
  planSlug: string;
  planName: string;
  features: string[];
  maxBuildings: number;
  maxUnitsPerBuilding: number;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  isLegacy: boolean;
  hasStripe?: boolean;
}

interface UsageData {
  buildings: { current: number; max: number };
  units: { current: number; max: number };
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  TRIALING: "bg-blue-100 text-blue-800",
  PAST_DUE: "bg-red-100 text-red-800",
  CANCELED: "bg-slate-100 text-slate-600",
  EXPIRED: "bg-slate-100 text-slate-600",
};

export function BillingPage() {
  const t = useTranslations("billing");
  const tCommon = useTranslations("common");
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [subRes, usageRes] = await Promise.all([
        fetch("/api/subscription"),
        fetch("/api/subscription/usage"),
      ]);

      if (subRes.ok) {
        setSubscription(await subRes.json());
      }
      if (usageRes.ok) {
        setUsage(await usageRes.json());
      }
    } catch {
      setError("Failed to load billing data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      } else {
        const data = await res.json();
        setError(data.error || "Failed to open billing portal");
      }
    } catch {
      setError("Failed to open billing portal");
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-slate-500">{tCommon("loading")}</p>
      </div>
    );
  }

  if (error && !subscription) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="rounded-lg bg-red-50 px-6 py-4 text-center">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  const trialDaysRemaining = subscription?.trialEndsAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(subscription.trialEndsAt).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : null;

  const isTrialing = subscription?.subscriptionStatus === "TRIALING";
  const trialExpired =
    isTrialing && trialDaysRemaining !== null && trialDaysRemaining <= 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("subtitle")}</p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Trial Countdown */}
      {isTrialing && trialDaysRemaining !== null && (
        <div
          className={`rounded-xl border p-6 shadow-sm ${
            trialExpired
              ? "border-red-200 bg-red-50"
              : trialDaysRemaining <= 3
                ? "border-amber-200 bg-amber-50"
                : "border-blue-200 bg-blue-50"
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <Clock
              className={`h-5 w-5 ${
                trialExpired
                  ? "text-red-600"
                  : trialDaysRemaining <= 3
                    ? "text-amber-600"
                    : "text-blue-600"
              }`}
            />
            <h2
              className={`text-lg font-semibold ${
                trialExpired
                  ? "text-red-900"
                  : trialDaysRemaining <= 3
                    ? "text-amber-900"
                    : "text-blue-900"
              }`}
            >
              {trialExpired
                ? t("trialExpired")
                : t("trialEndsIn", { days: trialDaysRemaining })}
            </h2>
          </div>
          {!trialExpired && (
            <div className="mb-3">
              <div className="h-2 w-full rounded-full bg-white/60">
                <div
                  className={`h-2 rounded-full transition-all ${
                    trialDaysRemaining <= 3 ? "bg-amber-500" : "bg-blue-500"
                  }`}
                  style={{
                    width: `${Math.max(0, Math.min(100, ((14 - trialDaysRemaining) / 14) * 100))}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-600">
                {t("daysRemaining", { days: trialDaysRemaining })}
              </p>
            </div>
          )}
          {(trialExpired || trialDaysRemaining <= 3) && (
            <a
              href="/en/pricing"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              {t("choosePlan")}
            </a>
          )}
        </div>
      )}

      {/* Current Plan Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <CreditCard className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900">
            {t("currentPlan")}
          </h2>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl font-bold text-slate-900">
            {subscription?.isLegacy ? t("legacyPlan") : subscription?.planName}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              STATUS_STYLES[subscription?.subscriptionStatus || ""] || STATUS_STYLES.ACTIVE
            }`}
          >
            {t(`status_${subscription?.subscriptionStatus || "ACTIVE"}`)}
          </span>
        </div>
        {subscription?.isLegacy && (
          <p className="text-sm text-slate-500 mb-4">
            {t("legacyDescription")}
          </p>
        )}
      </div>

      {/* Usage Card */}
      {usage && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">
              {t("usage")}
            </h2>
          </div>
          <div className="space-y-4">
            {/* Buildings usage */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-700">
                  {t("buildings")}
                </span>
                <span className="text-sm text-slate-500">
                  {usage.buildings.max === -1
                    ? `${usage.buildings.current} / ${t("unlimited")}`
                    : `${usage.buildings.current} / ${usage.buildings.max}`}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100">
                <div
                  className={`h-2 rounded-full transition-all ${
                    usage.buildings.max !== -1 &&
                    usage.buildings.current >= usage.buildings.max
                      ? "bg-red-500"
                      : "bg-blue-500"
                  }`}
                  style={{
                    width:
                      usage.buildings.max === -1
                        ? "10%"
                        : `${Math.min(100, (usage.buildings.current / usage.buildings.max) * 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* Units usage */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-700">
                  {t("units")}
                </span>
                <span className="text-sm text-slate-500">
                  {usage.units.max === -1
                    ? `${usage.units.current} / ${t("unlimited")}`
                    : `${usage.units.current} / ${usage.units.max}`}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100">
                <div
                  className={`h-2 rounded-full transition-all ${
                    usage.units.max !== -1 &&
                    usage.units.current >= usage.units.max
                      ? "bg-red-500"
                      : "bg-blue-500"
                  }`}
                  style={{
                    width:
                      usage.units.max === -1
                        ? "10%"
                        : `${Math.min(100, (usage.units.current / usage.units.max) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleManageSubscription}
            disabled={portalLoading || subscription?.isLegacy}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              subscription?.isLegacy
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
            title={
              subscription?.isLegacy ? t("noStripeSubscription") : undefined
            }
          >
            <ExternalLink className="h-4 w-4" />
            {portalLoading ? tCommon("loading") : t("manageSubscription")}
          </button>
          <a
            href="/en/pricing"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            {t("viewPricing")}
          </a>
        </div>
      </div>
    </div>
  );
}
