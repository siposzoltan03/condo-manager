"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PLAN_CAPS, type Plan } from "@/lib/marketplace/pricing";
import { PageHead } from "./page-head";
import { SettingsTabs } from "./settings-tabs";

export interface BillingUsage {
  bidsLast7Days: number;
  specialtyCount: number;
  regionCount: number;
}

export function ContractorBillingPage({
  locale,
  plan,
  status,
  trialDaysRemaining,
  currentPeriodEndsAt,
  stripeConfigured,
  usage,
}: {
  locale: "hu" | "en";
  plan: Plan;
  status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELLED";
  trialDaysRemaining: number | null;
  currentPeriodEndsAt: string | null;
  stripeConfigured: boolean;
  usage: BillingUsage;
}) {
  const t = useTranslations("marketplace");
  const router = useRouter();
  const [upgrading, setUpgrading] = useState<Plan | null>(null);

  async function upgrade(target: Plan) {
    setUpgrading(target);
    try {
      const res = await fetch("/api/contractor/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: target }),
      });
      if (!res.ok) {
        toast.error(t("billingCheckoutFailed"));
        return;
      }
      const data = (await res.json()) as {
        ok: boolean;
        dev?: boolean;
        url?: string;
      };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      // Dev override — page refresh shows new plan.
      router.refresh();
    } catch {
      toast.error(t("billingCheckoutFailed"));
    } finally {
      setUpgrading(null);
    }
  }

  return (
    <div style={{ color: "var(--color-ink)" }}>
      <div
        className="mx-auto"
        style={{ maxWidth: "880px", padding: "40px 24px 80px" }}
      >
        <PageHead
          eyebrow={`/ ${t("settingsTabsHeading")}`}
          title={t("billingTitle")}
          subtitle={t("billingSubtitle")}
        />

        <SettingsTabs locale={locale} active="billing" />

        {!stripeConfigured && (
          <div
            className="rounded-lg border"
            style={{
              marginBottom: "16px",
              padding: "10px 14px",
              fontSize: "12.5px",
              background:
                "color-mix(in srgb, var(--color-ochre) 14%, transparent)",
              borderColor:
                "color-mix(in srgb, var(--color-ochre) 40%, transparent)",
              color: "var(--color-ink)",
            }}
          >
            {t("billingDevOverrideHint")}
          </div>
        )}

        <PlanStatusHero
          plan={plan}
          status={status}
          trialDaysRemaining={trialDaysRemaining}
          currentPeriodEndsAt={currentPeriodEndsAt}
          usage={usage}
          onUpgrade={() => upgrade(plan === "PRO" ? "PREMIUM" : "PRO")}
          upgrading={upgrading}
          locale={locale}
        />

        <h2
          className="mt-8"
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "20px",
            fontWeight: 500,
            letterSpacing: "-0.02em",
            margin: "32px 0 14px",
          }}
        >
          {t("billingTiersHeading")}
        </h2>

        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          }}
        >
          <TierCard
            target="FREE"
            currentPlan={plan}
            upgrading={upgrading}
            onUpgrade={upgrade}
            locale={locale}
          />
          <TierCard
            target="PRO"
            currentPlan={plan}
            upgrading={upgrading}
            onUpgrade={upgrade}
            locale={locale}
          />
          <TierCard
            target="PREMIUM"
            currentPlan={plan}
            upgrading={upgrading}
            onUpgrade={upgrade}
            locale={locale}
          />
        </div>

        <p
          className="font-mono"
          style={{
            fontSize: "11px",
            color: "var(--color-muted)",
            letterSpacing: "0.04em",
            marginTop: "20px",
            lineHeight: 1.55,
          }}
        >
          {t("billingDowngradeNote")}
        </p>
      </div>
    </div>
  );
}

function PlanStatusHero({
  plan,
  status,
  trialDaysRemaining,
  currentPeriodEndsAt,
  usage,
  onUpgrade,
  upgrading,
  locale,
}: {
  plan: Plan;
  status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELLED";
  trialDaysRemaining: number | null;
  currentPeriodEndsAt: string | null;
  usage: BillingUsage;
  onUpgrade: () => void;
  upgrading: Plan | null;
  locale: "hu" | "en";
}) {
  const t = useTranslations("marketplace");
  const planLabel =
    plan === "PREMIUM"
      ? t("billingActivePlanPremium")
      : plan === "PRO"
        ? t("billingActivePlanPro")
        : t("billingActivePlanFree");
  const caps = PLAN_CAPS[plan];
  const upgradeTarget = plan === "PRO" ? "PREMIUM" : plan === "FREE" ? "PRO" : null;
  const upgradeLabel =
    upgradeTarget === "PREMIUM"
      ? t("billingUpgradePremium")
      : upgradeTarget === "PRO"
        ? t("billingUpgradePro")
        : null;

  const subLine =
    status === "TRIALING" && trialDaysRemaining !== null ? (
      <>
        {t("billingStatusTrialing")} —{" "}
        <b style={{ color: "var(--color-ochre)" }}>
          {t("planTrialBadge", { days: trialDaysRemaining })}
        </b>
      </>
    ) : currentPeriodEndsAt ? (
      t("billingCurrentUntil", {
        date: new Date(currentPeriodEndsAt).toLocaleDateString(locale),
      })
    ) : status === "PAST_DUE" ? (
      t("billingStatusPastDue")
    ) : status === "CANCELLED" ? (
      t("billingStatusCancelled")
    ) : (
      t("billingStatusActive")
    );

  return (
    <section
      className="rounded-xl border"
      style={{
        padding: "24px 28px",
        background: "var(--color-bg-3)",
        borderColor: "color-mix(in srgb, var(--color-ink) 10%, transparent)",
        marginBottom: "16px",
      }}
    >
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            className="font-mono"
            style={{
              fontSize: "11px",
              color: "var(--color-muted)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {t("billingActivePlanLabel")}
            {status === "TRIALING" && " · "}
            {status === "TRIALING" && t("billingStatusTrialing").toLowerCase()}
          </span>
          <p
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: "44px",
              fontWeight: 500,
              letterSpacing: "-0.035em",
              lineHeight: 1,
              margin: "8px 0 6px",
            }}
          >
            {planLabel}
          </p>
          <p
            style={{
              fontSize: "13px",
              color: "var(--color-ink-soft)",
              margin: 0,
            }}
          >
            {subLine}
          </p>
        </div>
        {upgradeTarget && upgradeLabel && (
          <button
            type="button"
            onClick={onUpgrade}
            disabled={upgrading !== null}
            className="disabled:opacity-60"
            style={{
              padding: "12px 18px",
              borderRadius: "10px",
              fontSize: "13px",
              fontWeight: 600,
              background: "var(--color-ink)",
              color: "var(--color-bg)",
              flexShrink: 0,
            }}
          >
            {upgrading === upgradeTarget ? "…" : upgradeLabel}
          </button>
        )}
      </div>

      <dl
        className="grid grid-cols-1 sm:grid-cols-3 mt-5"
        style={{
          gap: "16px 24px",
          paddingTop: "16px",
          borderTop:
            "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
          margin: "20px 0 0",
        }}
      >
        <UsageStat
          value={usage.bidsLast7Days}
          cap={caps.bidsPer7Days}
          label={t("billingUsageBidsLabel")}
        />
        <UsageStat
          value={usage.specialtyCount}
          cap={caps.specialties}
          label={t("billingUsageSpecialtiesLabel")}
        />
        <UsageStat
          value={usage.regionCount}
          cap={caps.regions}
          label={t("billingUsageRegionsLabel")}
        />
      </dl>
    </section>
  );
}

function UsageStat({
  value,
  cap,
  label,
}: {
  value: number;
  cap: number | null;
  label: string;
}) {
  const t = useTranslations("marketplace");
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "26px",
          fontWeight: 500,
          letterSpacing: "-0.03em",
          color: "var(--color-ink)",
        }}
      >
        {value}
        <small
          className="font-mono"
          style={{
            marginLeft: "6px",
            fontSize: "11px",
            color: "var(--color-muted)",
            fontWeight: 500,
            letterSpacing: "0.04em",
          }}
        >
          {cap === null
            ? t("billingUsageUnlimitedSuffix")
            : `/ ${cap}`}
        </small>
      </div>
      <div
        className="font-mono"
        style={{
          fontSize: "10.5px",
          color: "var(--color-muted)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginTop: "4px",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function TierCard({
  target,
  currentPlan,
  upgrading,
  onUpgrade,
  locale,
}: {
  target: Plan;
  currentPlan: Plan;
  upgrading: Plan | null;
  onUpgrade: (target: Plan) => void;
  locale: "hu" | "en";
}) {
  const t = useTranslations("marketplace");
  const caps = PLAN_CAPS[target];
  const isCurrent = target === currentPlan;
  const isUpgrade =
    (currentPlan === "FREE" && (target === "PRO" || target === "PREMIUM")) ||
    (currentPlan === "PRO" && target === "PREMIUM");

  const labelMap: Record<Plan, string> = {
    FREE: t("billingActivePlanFree"),
    PRO: t("billingActivePlanPro"),
    PREMIUM: t("billingActivePlanPremium"),
  };

  return (
    <article
      className="rounded-xl border flex flex-col"
      style={{
        padding: "18px 18px 16px",
        background: "var(--color-bg-3)",
        borderColor: isCurrent
          ? "var(--color-ink)"
          : "color-mix(in srgb, var(--color-ink) 10%, transparent)",
      }}
    >
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h3
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "20px",
            fontWeight: 500,
            letterSpacing: "-0.02em",
            margin: 0,
          }}
        >
          {labelMap[target]}
        </h3>
        {target === "PREMIUM" && (
          <span
            className="font-mono"
            style={{
              fontSize: "9px",
              padding: "2px 6px",
              borderRadius: "4px",
              background: "var(--color-ochre)",
              color: "var(--color-ink)",
              letterSpacing: "0.08em",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            {t("featuredLabel")}
          </span>
        )}
      </div>

      <p
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "26px",
          fontWeight: 500,
          letterSpacing: "-0.03em",
          margin: "0 0 12px",
        }}
      >
        {target === "FREE"
          ? t("billingFreePrice")
          : `${caps.monthlyPriceFt.toLocaleString(locale)} `}
        {target !== "FREE" && (
          <span
            className="font-mono"
            style={{
              fontSize: "11px",
              color: "var(--color-muted)",
              letterSpacing: "0.04em",
            }}
          >
            {t("billingPerMonth")}
          </span>
        )}
      </p>

      <ul
        className="flex flex-col gap-1"
        style={{
          fontSize: "13px",
          color: "var(--color-ink-soft)",
          listStyle: "none",
          padding: 0,
          margin: 0,
          flex: 1,
        }}
      >
        <Feature
          label={t("billingCapBids")}
          value={
            caps.bidsPer7Days === null
              ? t("billingCapUnlimited")
              : t("billingFeatureBidsValue", { value: caps.bidsPer7Days })
          }
        />
        <Feature
          label={t("billingCapSpecialties")}
          value={
            caps.specialties === null
              ? t("billingCapUnlimited")
              : String(caps.specialties)
          }
        />
        <Feature
          label={t("billingCapRegions")}
          value={
            caps.regions === null
              ? t("billingCapUnlimited")
              : String(caps.regions)
          }
        />
        <Feature
          label={t("billingCapFeatured")}
          value={caps.featuredRanking ? "✓" : "—"}
        />
      </ul>

      <div style={{ marginTop: "16px" }}>
        {isCurrent ? (
          <button
            type="button"
            disabled
            className="w-full font-mono"
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              fontSize: "12px",
              background: "var(--color-bg)",
              color: "var(--color-muted)",
              letterSpacing: "0.04em",
              opacity: 0.7,
              cursor: "default",
            }}
          >
            {t("billingUpgradeFree")}
          </button>
        ) : isUpgrade ? (
          <button
            type="button"
            onClick={() => onUpgrade(target)}
            disabled={upgrading !== null}
            className="w-full disabled:opacity-60"
            style={{
              padding: "11px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              background: "var(--color-ink)",
              color: "var(--color-bg)",
            }}
          >
            {upgrading === target
              ? "…"
              : target === "PRO"
                ? t("billingUpgradePro")
                : t("billingUpgradePremium")}
          </button>
        ) : (
          <span
            className="font-mono"
            style={{
              fontSize: "11px",
              color: "var(--color-muted)",
              letterSpacing: "0.04em",
            }}
          >
            —
          </span>
        )}
      </div>
    </article>
  );
}

function Feature({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span style={{ color: "var(--color-ink-soft)" }}>{label}</span>
      <span
        className="font-mono"
        style={{
          fontSize: "12px",
          color: "var(--color-ink)",
          fontWeight: 600,
          letterSpacing: "0.02em",
        }}
      >
        {value}
      </span>
    </li>
  );
}
