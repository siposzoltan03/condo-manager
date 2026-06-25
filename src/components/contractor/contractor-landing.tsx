import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PLAN_CAPS } from "@/lib/marketplace/pricing";

/**
 * Public marketing landing for the contractor marketplace. Self-contained,
 * Tiles palette. Re-uses i18n keys under `marketplace.landing*`.
 */
export async function ContractorLanding({ locale }: { locale: "hu" | "en" }) {
  const t = await getTranslations({ locale, namespace: "marketplace" });

  return (
    <div
      className="min-h-screen"
      style={{
        background: "var(--color-bg)",
        color: "var(--color-ink)",
        fontFamily: "var(--font-manrope), system-ui, sans-serif",
      }}
    >
      <header
        className="flex items-center justify-between"
        style={{ padding: "24px 32px", maxWidth: "1120px", margin: "0 auto" }}
      >
        <Link
          href={`/${locale}`}
          className="flex items-center gap-2.5"
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontWeight: 600,
            fontSize: "20px",
            letterSpacing: "-0.03em",
            textDecoration: "none",
            color: "var(--color-ink)",
          }}
        >
          <span
            className="grid place-items-center rounded-lg"
            style={{
              width: "30px",
              height: "30px",
              background: "var(--color-ink)",
              color: "var(--color-bg)",
              fontWeight: 700,
              fontSize: "15px",
              letterSpacing: "-0.05em",
            }}
          >
            K
          </span>
          Közös
        </Link>
        <nav className="flex items-center gap-4 font-mono" style={{ fontSize: "12px", letterSpacing: "0.04em" }}>
          <Link
            href={`/${locale}/contractor/login`}
            style={{ color: "var(--color-muted)", textDecoration: "underline" }}
          >
            {t("landingCtaLogin")}
          </Link>
          <Link
            href={`/${locale}/contractor/signup`}
            style={{
              padding: "8px 12px",
              borderRadius: "7px",
              background: "var(--color-ink)",
              color: "var(--color-bg)",
              textDecoration: "none",
            }}
          >
            {t("landingCtaSignup")}
          </Link>
        </nav>
      </header>

      <Hero locale={locale} />
      <Features locale={locale} />
      <PricingTable locale={locale} />
      <HowItWorks locale={locale} />
      <FAQ locale={locale} />
      <FooterCta locale={locale} />
    </div>
  );
}

async function Hero({ locale }: { locale: "hu" | "en" }) {
  const t = await getTranslations({ locale, namespace: "marketplace" });
  return (
    <section
      className="relative overflow-hidden"
      style={{
        padding: "60px 32px 80px",
        maxWidth: "1120px",
        margin: "0 auto",
      }}
    >
      <span
        className="font-mono"
        style={{
          fontSize: "12px",
          color: "var(--color-muted)",
          letterSpacing: "0.06em",
        }}
      >
        {t("landingEyebrow")}
      </span>
      <h1
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "clamp(48px, 8vw, 96px)",
          fontWeight: 500,
          letterSpacing: "-0.05em",
          lineHeight: "0.95",
          margin: "10px 0 18px",
          maxWidth: "16ch",
        }}
      >
        {t("landingHero")}
      </h1>
      <p
        style={{
          color: "var(--color-ink-soft)",
          fontSize: "18px",
          lineHeight: "1.55",
          maxWidth: "56ch",
          margin: "0 0 32px",
        }}
      >
        {t("landingHeroSubtitle")}
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href={`/${locale}/contractor/signup`}
          style={{
            padding: "14px 22px",
            borderRadius: "10px",
            background: "var(--color-ink)",
            color: "var(--color-bg)",
            fontSize: "14px",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          {t("landingCtaSignup")}
        </Link>
        <span
          className="font-mono"
          style={{
            fontSize: "12px",
            color: "var(--color-muted)",
            letterSpacing: "0.04em",
          }}
        >
          {t("landingTrialNote")}
        </span>
      </div>
    </section>
  );
}

async function Features({ locale }: { locale: "hu" | "en" }) {
  const t = await getTranslations({ locale, namespace: "marketplace" });
  const items = [
    { title: t("landingFeature1Title"), body: t("landingFeature1Body") },
    { title: t("landingFeature2Title"), body: t("landingFeature2Body") },
    { title: t("landingFeature3Title"), body: t("landingFeature3Body") },
    { title: t("landingFeature4Title"), body: t("landingFeature4Body") },
  ];
  return (
    <section
      style={{
        padding: "60px 32px",
        background: "var(--color-bg-3)",
      }}
    >
      <div style={{ maxWidth: "1120px", margin: "0 auto" }}>
        <h2
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "32px",
            fontWeight: 500,
            letterSpacing: "-0.035em",
            margin: "0 0 28px",
          }}
        >
          {t("landingFeaturesHeading")}
        </h2>
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          {items.map((item) => (
            <article
              key={item.title}
              className="rounded-xl"
              style={{
                padding: "20px",
                background: "var(--color-bg)",
                border: "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
              }}
            >
              <h3
                style={{
                  fontFamily: "var(--font-space-grotesk), sans-serif",
                  fontSize: "17px",
                  fontWeight: 500,
                  letterSpacing: "-0.015em",
                  margin: "0 0 8px",
                }}
              >
                {item.title}
              </h3>
              <p
                style={{
                  fontSize: "13.5px",
                  color: "var(--color-ink-soft)",
                  lineHeight: "1.55",
                  margin: 0,
                }}
              >
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

async function PricingTable({ locale }: { locale: "hu" | "en" }) {
  const t = await getTranslations({ locale, namespace: "marketplace" });
  return (
    <section style={{ padding: "60px 32px" }}>
      <div style={{ maxWidth: "1120px", margin: "0 auto" }}>
        <h2
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "32px",
            fontWeight: 500,
            letterSpacing: "-0.035em",
            margin: "0 0 8px",
          }}
        >
          {t("landingPricingHeading")}
        </h2>
        <p
          className="font-mono"
          style={{
            fontSize: "12px",
            color: "var(--color-muted)",
            letterSpacing: "0.04em",
            margin: "0 0 28px",
          }}
        >
          {t("landingTrialNote")}
        </p>
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          }}
        >
          <Tier
            target="FREE"
            name={t("landingPricingFreeName")}
            desc={t("landingPricingFreeDesc")}
            badge={null}
            locale={locale}
          />
          <Tier
            target="PRO"
            name={t("landingPricingProName")}
            desc={t("landingPricingProDesc")}
            badge={t("landingPricingMostPopular")}
            locale={locale}
          />
          <Tier
            target="PREMIUM"
            name={t("landingPricingPremiumName")}
            desc={t("landingPricingPremiumDesc")}
            badge={t("featuredLabel")}
            locale={locale}
          />
        </div>
      </div>
    </section>
  );
}

function Tier({
  target,
  name,
  desc,
  badge,
  locale,
}: {
  target: "FREE" | "PRO" | "PREMIUM";
  name: string;
  desc: string;
  badge: string | null;
  locale: "hu" | "en";
}) {
  const caps = PLAN_CAPS[target];
  const priceLabel =
    target === "FREE"
      ? "0 Ft"
      : `${caps.monthlyPriceFt.toLocaleString(locale)} Ft / hó`;
  return (
    <article
      className="rounded-xl border"
      style={{
        padding: "22px 22px 18px",
        background: "var(--color-bg)",
        borderColor:
          target === "PRO"
            ? "var(--color-ink)"
            : "color-mix(in srgb, var(--color-ink) 12%, transparent)",
      }}
    >
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h3
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "22px",
            fontWeight: 500,
            letterSpacing: "-0.02em",
            margin: 0,
          }}
        >
          {name}
        </h3>
        {badge && (
          <span
            className="font-mono"
            style={{
              fontSize: "9.5px",
              padding: "2px 7px",
              borderRadius: "4px",
              background:
                target === "PREMIUM" ? "var(--color-ochre)" : "var(--color-ink)",
              color:
                target === "PREMIUM" ? "var(--color-ink)" : "var(--color-bg)",
              letterSpacing: "0.08em",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <p
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "26px",
          fontWeight: 500,
          letterSpacing: "-0.03em",
          margin: "0 0 10px",
        }}
      >
        {priceLabel}
      </p>
      <p
        style={{
          fontSize: "13.5px",
          color: "var(--color-ink-soft)",
          lineHeight: "1.55",
          margin: "0 0 16px",
        }}
      >
        {desc}
      </p>
      <Link
        href={`/${locale}/contractor/signup`}
        style={{
          display: "inline-block",
          padding: "10px 14px",
          borderRadius: "8px",
          background:
            target === "PRO" ? "var(--color-ink)" : "var(--color-bg-3)",
          color: target === "PRO" ? "var(--color-bg)" : "var(--color-ink)",
          fontSize: "13px",
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        {target === "FREE" ? "Ingyenes csomag →" : `Válts ${name}-ra →`}
      </Link>
    </article>
  );
}

async function HowItWorks({ locale }: { locale: "hu" | "en" }) {
  const t = await getTranslations({ locale, namespace: "marketplace" });
  const steps = [
    { title: t("landingStep1Title"), body: t("landingStep1Body") },
    { title: t("landingStep2Title"), body: t("landingStep2Body") },
    { title: t("landingStep3Title"), body: t("landingStep3Body") },
    { title: t("landingStep4Title"), body: t("landingStep4Body") },
  ];
  return (
    <section
      style={{
        padding: "60px 32px",
        background: "var(--color-bg-3)",
      }}
    >
      <div style={{ maxWidth: "1120px", margin: "0 auto" }}>
        <h2
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "32px",
            fontWeight: 500,
            letterSpacing: "-0.035em",
            margin: "0 0 28px",
          }}
        >
          {t("landingHowItWorksHeading")}
        </h2>
        <ol
          className="grid gap-4"
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          {steps.map((s) => (
            <li
              key={s.title}
              className="rounded-xl"
              style={{
                padding: "20px",
                background: "var(--color-bg)",
                border:
                  "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-space-grotesk), sans-serif",
                  fontSize: "15px",
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                  margin: "0 0 6px",
                }}
              >
                {s.title}
              </p>
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--color-ink-soft)",
                  lineHeight: "1.5",
                  margin: 0,
                }}
              >
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

async function FAQ({ locale }: { locale: "hu" | "en" }) {
  const t = await getTranslations({ locale, namespace: "marketplace" });
  const qa = [
    { q: t("landingFaqQ1"), a: t("landingFaqA1") },
    { q: t("landingFaqQ2"), a: t("landingFaqA2") },
    { q: t("landingFaqQ3"), a: t("landingFaqA3") },
  ];
  return (
    <section style={{ padding: "60px 32px" }}>
      <div style={{ maxWidth: "780px", margin: "0 auto" }}>
        <h2
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "32px",
            fontWeight: 500,
            letterSpacing: "-0.035em",
            margin: "0 0 24px",
          }}
        >
          {t("landingFaqHeading")}
        </h2>
        <div className="flex flex-col gap-4">
          {qa.map((item, i) => (
            <div
              key={i}
              className="rounded-xl"
              style={{
                padding: "16px 18px",
                background: "var(--color-bg-3)",
                border:
                  "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
              }}
            >
              <p
                style={{
                  fontSize: "15px",
                  fontWeight: 600,
                  margin: "0 0 6px",
                }}
              >
                {item.q}
              </p>
              <p
                style={{
                  fontSize: "13.5px",
                  color: "var(--color-ink-soft)",
                  lineHeight: "1.55",
                  margin: 0,
                }}
              >
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

async function FooterCta({ locale }: { locale: "hu" | "en" }) {
  const t = await getTranslations({ locale, namespace: "marketplace" });
  return (
    <section
      style={{
        padding: "80px 32px",
        background: "var(--color-ink)",
        color: "var(--color-bg)",
        textAlign: "center",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "clamp(36px, 6vw, 56px)",
          fontWeight: 500,
          letterSpacing: "-0.04em",
          lineHeight: "1.05",
          margin: "0 0 20px",
        }}
      >
        {t("landingHero")}
      </h2>
      <Link
        href={`/${locale}/contractor/signup`}
        style={{
          display: "inline-block",
          padding: "14px 24px",
          borderRadius: "10px",
          background: "var(--color-ochre)",
          color: "var(--color-ink)",
          fontSize: "14px",
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        {t("landingCtaSignup")}
      </Link>
    </section>
  );
}
