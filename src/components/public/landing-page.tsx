import { useTranslations } from "next-intl";
import Link from "next/link";
import { PublicNav } from "./public-nav";

/**
 * Public landing page. Tiles design system, Hungarian-first.
 *
 * The deep-dive sections render inline DOM mockups instead of PNG
 * screenshots — they match the in-app surfaces exactly and don't drift
 * when the product is redesigned.
 */
export function LandingPage() {
  const t = useTranslations("landing");

  return (
    <div className="min-h-screen bg-bg text-ink font-manrope">
      <PublicNav />

      {/* ─── HERO ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 pt-16 pb-12 sm:pt-24 sm:pb-16">
        <Eyebrow>{t("hero.eyebrow")}</Eyebrow>
        <h1
          className="mt-4 font-display text-5xl sm:text-7xl text-ink leading-[0.95]"
          style={{ letterSpacing: "-0.04em", fontWeight: 500 }}
        >
          {t("hero.titleL1")}
          <br />
          {t("hero.titleL2pre")}{" "}
          <span style={{ color: "var(--color-moss)", fontStyle: "italic", fontWeight: 400 }}>
            {t("hero.titleL2ochre")}
          </span>
          <br />
          <span className="text-muted" style={{ fontWeight: 400 }}>
            {t("hero.titleL3")}
          </span>
        </h1>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-16 items-start">
          <p className="text-lg text-ink-soft leading-relaxed max-w-prose">
            {t("hero.lede")}
          </p>
          <div className="flex flex-col gap-3 sm:items-end">
            <div className="flex flex-wrap gap-3">
              <Link href="/pricing" className={primaryBtn()}>
                {t("hero.ctaPrimary")} <span aria-hidden>→</span>
              </Link>
              <Link href="/pricing" className={ghostBtn()}>
                {t("hero.ctaSecondary")}
              </Link>
            </div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted sm:text-right">
              {t("hero.metaL1")}
              <br />
              {t("hero.metaL2")}
            </p>
          </div>
        </div>
      </section>

      {/* ─── BENTO GRID ─────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 pb-16">
        <BentoGrid t={t} />
      </section>

      {/* ─── LOGO STRIP ─────────────────────────────────────── */}
      <section
        className="border-y border-ink/10"
        style={{ background: "var(--color-bg-2)" }}
      >
        <div className="mx-auto max-w-7xl px-6 py-6 flex flex-wrap items-center gap-8">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted">
            {t("logoStrip.label")}
          </span>
          <div className="flex flex-wrap gap-x-8 gap-y-3 items-center text-ink-soft">
            <span className="font-display text-base">Duna Residence</span>
            <span className="font-mono text-xs uppercase tracking-wider">Belváros 14</span>
            <span className="font-display text-base">Margit Park</span>
            <span className="font-mono text-xs uppercase tracking-wider">Buda 209</span>
            <span className="font-display text-base">Fehérvári út</span>
          </div>
        </div>
      </section>

      {/* ─── MODULES (8 MODULES) ────────────────────────────── */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-24">
        <SectionHead
          eyebrow={t("modules.eyebrow")}
          title={t("modules.title")}
          softLine={t("modules.titleSoft")}
          lede={t("modules.lede")}
        />
        <div className="mt-12 grid gap-px sm:grid-cols-2 lg:grid-cols-4 rounded-2xl border border-ink/8 overflow-hidden bg-ink/8">
          {MODULES.map((m, i) => (
            <div
              key={m.key}
              className="bg-bg p-6 flex flex-col gap-3 min-h-[180px] relative"
            >
              <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">
                {String(i + 1).padStart(2, "0")} /
              </span>
              <div
                className="w-11 h-11 rounded-lg grid place-items-center font-display text-lg"
                style={{ background: m.tone.bg, color: m.tone.fg, fontWeight: 600 }}
              >
                {m.glyph}
              </div>
              <h3 className="font-display text-lg leading-tight" style={{ letterSpacing: "-0.02em", fontWeight: 500 }}>
                {t(`modules.items.${m.key}.title`)}
              </h3>
              <p className="text-sm text-ink-soft leading-relaxed">
                {t(`modules.items.${m.key}.body`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── DEEP DIVE ──────────────────────────────────────── */}
      <section
        className="border-y border-ink/10"
        style={{ background: "var(--color-bg-2)" }}
      >
        <div className="mx-auto max-w-7xl px-6 py-24">
          <SectionHead
            eyebrow={t("deep.eyebrow")}
            title={t("deep.title")}
            softLine={t("deep.titleSoft")}
            lede={t("deep.lede")}
          />
          <div className="mt-16 space-y-24">
            <DeepDive
              flip={false}
              tag={t("deep.voting.tag")}
              title={t("deep.voting.title")}
              titleSoft={t("deep.voting.titleSoft")}
              body={t("deep.voting.body")}
              bullets={[
                t("deep.voting.b1"),
                t("deep.voting.b2"),
                t("deep.voting.b3"),
                t("deep.voting.b4"),
              ]}
              mock={
                <Shot
                  src="/screenshots/meeting-detail.png"
                  alt={t("deep.voting.title")}
                  caption={t("deep.voting.mockTitle")}
                />
              }
            />
            <DeepDive
              flip
              tag={t("deep.finance.tag")}
              title={t("deep.finance.title")}
              titleSoft={t("deep.finance.titleSoft")}
              body={t("deep.finance.body")}
              bullets={[
                t("deep.finance.b1"),
                t("deep.finance.b2"),
                t("deep.finance.b3"),
                t("deep.finance.b4"),
              ]}
              mock={
                <Shot
                  src="/screenshots/finance.png"
                  alt={t("deep.finance.title")}
                  caption={t("deep.finance.mockTitle")}
                />
              }
            />
            <DeepDive
              flip={false}
              tag={t("deep.maint.tag")}
              title={t("deep.maint.title")}
              titleSoft={t("deep.maint.titleSoft")}
              body={t("deep.maint.body")}
              bullets={[
                t("deep.maint.b1"),
                t("deep.maint.b2"),
                t("deep.maint.b3"),
                t("deep.maint.b4"),
              ]}
              mock={
                <Shot
                  src="/screenshots/maintenance.png"
                  alt={t("deep.maint.title")}
                  caption={t("deep.maint.mockTitle")}
                />
              }
            />
          </div>
        </div>
      </section>

      {/* ─── REPORTS BADGE STRIP ────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <SectionHead
          eyebrow={t("reports.eyebrow")}
          title={t("reports.title")}
          softLine={t("reports.titleSoft")}
          lede={t("reports.lede")}
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {REPORT_KINDS.map((r) => (
            <div
              key={r}
              className="rounded-xl border border-ink/8 bg-card p-5"
            >
              <div className="font-mono text-[10.5px] uppercase tracking-wider text-muted mb-2">
                {t(`reports.kinds.${r}.eyebrow`)}
              </div>
              <p className="font-display text-base leading-snug" style={{ fontWeight: 500 }}>
                {t(`reports.kinds.${r}.label`)}
              </p>
              <p className="mt-2 text-xs text-ink-soft leading-relaxed">
                {t(`reports.kinds.${r}.body`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── COMING SOON · MARKETPLACE TEASER ───────────────── */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div
          className="rounded-2xl p-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"
          style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}
        >
          <div className="flex-1">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--color-ochre)" }}>
              {t("marketplace.eyebrow")}
            </span>
            <h2
              className="mt-3 font-display text-3xl sm:text-4xl leading-tight"
              style={{ letterSpacing: "-0.025em", fontWeight: 500 }}
            >
              {t("marketplace.title")}{" "}
              <span style={{ color: "var(--color-ochre)", fontStyle: "italic" }}>
                {t("marketplace.titleOchre")}
              </span>
            </h2>
            <p className="mt-4 text-base leading-relaxed max-w-xl" style={{ color: "color-mix(in srgb, var(--color-bg) 70%, transparent)" }}>
              {t("marketplace.body")}
            </p>
          </div>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-lg px-5 py-3 font-mono text-[11px] uppercase tracking-wider transition-opacity hover:opacity-90 self-start lg:self-auto"
            style={{ background: "var(--color-bg)", color: "var(--color-ink)" }}
          >
            {t("marketplace.cta")} <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      {/* ─── HOW IT WORKS · 4 STEPS ─────────────────────────── */}
      <section
        className="border-y border-ink/10"
        style={{ background: "var(--color-bg-3)" }}
      >
        <div className="mx-auto max-w-7xl px-6 py-24">
          <SectionHead
            eyebrow={t("steps.eyebrow")}
            title={t("steps.title")}
            softLine={t("steps.titleSoft")}
            lede={t("steps.lede")}
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="rounded-xl bg-card border border-ink/8 p-6">
                <span
                  className="inline-block font-display text-2xl mb-3"
                  style={{ color: "var(--color-moss)", fontWeight: 500, letterSpacing: "-0.025em" }}
                >
                  {String(n).padStart(2, "0")}
                </span>
                <h4 className="font-display text-base leading-tight" style={{ fontWeight: 500, letterSpacing: "-0.015em" }}>
                  {t(`steps.s${n}.title`)}
                </h4>
                <p className="mt-2 text-sm text-ink-soft leading-relaxed">
                  {t(`steps.s${n}.body`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── STATS ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4 bg-ink/8 rounded-2xl overflow-hidden border border-ink/8">
          {STATS.map((s) => (
            <div key={s.key} className="bg-bg p-8">
              <div
                className="font-display"
                style={{ fontSize: "44px", letterSpacing: "-0.035em", fontWeight: 500, lineHeight: 1 }}
              >
                {s.num}
                <span className="text-muted" style={{ fontSize: "20px", marginLeft: 4 }}>
                  {s.unit}
                </span>
              </div>
              <div className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                {t(`stats.${s.key}`)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── PRICING PREVIEW ────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-24 border-t border-ink/10">
        <SectionHead
          eyebrow={t("pricing.eyebrow")}
          title={t("pricing.title")}
          softLine={t("pricing.titleSoft")}
          lede={t("pricing.lede")}
        />
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          <PricingCard
            t={t}
            keyName="starter"
            price="9 900"
            cta={ghostBtn()}
          />
          <PricingCard
            t={t}
            keyName="board"
            price="24 900"
            featured
            cta={primaryBtn({ background: "var(--color-bg)", color: "var(--color-ink)" })}
          />
          <PricingCard
            t={t}
            keyName="office"
            price={t("pricing.office.priceCustom")}
            cta={ghostBtn()}
          />
        </div>
      </section>

      {/* ─── TRUST ──────────────────────────────────────────── */}
      <section
        className="border-y border-ink/10"
        style={{ background: "var(--color-bg-2)" }}
      >
        <div className="mx-auto max-w-7xl px-6 py-24">
          <SectionHead
            eyebrow={t("trust.eyebrow")}
            title={t("trust.title")}
            softLine={t("trust.titleSoft")}
            lede={t("trust.lede")}
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map((tr) => (
              <div key={tr.key} className="rounded-xl bg-card border border-ink/8 p-6">
                <div
                  className="w-10 h-10 rounded-lg grid place-items-center mb-4"
                  style={{
                    background: "color-mix(in srgb, var(--color-moss) 14%, transparent)",
                    color: "var(--color-moss)",
                  }}
                >
                  <span aria-hidden style={{ fontSize: 18 }}>
                    {tr.glyph}
                  </span>
                </div>
                <h4 className="font-display text-base leading-tight" style={{ fontWeight: 500, letterSpacing: "-0.015em" }}>
                  {t(`trust.items.${tr.key}.title`)}
                </h4>
                <p className="mt-2 text-sm text-ink-soft leading-relaxed">
                  {t(`trust.items.${tr.key}.body`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ──────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-28 text-center">
        <h2
          className="font-display text-5xl sm:text-6xl leading-[0.95]"
          style={{ letterSpacing: "-0.04em", fontWeight: 500 }}
        >
          {t("finalCta.title")}{" "}
          <span className="text-muted" style={{ fontWeight: 400 }}>
            {t("finalCta.titleSoft")}
          </span>
        </h2>
        <p className="mt-6 text-lg text-ink-soft max-w-xl mx-auto leading-relaxed">
          {t("finalCta.body")}
        </p>
        <div className="mt-10 flex flex-wrap gap-3 justify-center">
          <Link href="/pricing" className={primaryBtn()}>
            {t("finalCta.ctaPrimary")} <span aria-hidden>→</span>
          </Link>
          <Link href="/pricing" className={ghostBtn()}>
            {t("finalCta.ctaSecondary")}
          </Link>
        </div>
      </section>

      {/* ─── FOOTER ─────────────────────────────────────────── */}
      <footer className="border-t border-ink/10" style={{ background: "var(--color-bg-3)" }}>
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Link href="/" className="inline-flex items-center gap-2">
                <span
                  className="w-7 h-7 rounded-md grid place-items-center font-display"
                  style={{ background: "var(--color-ink)", color: "var(--color-bg)", fontWeight: 600 }}
                >
                  K
                </span>
                <span className="font-display text-lg" style={{ fontWeight: 600, letterSpacing: "-0.015em" }}>
                  Közös
                </span>
              </Link>
              <p className="mt-4 text-sm text-ink-soft max-w-[32ch]">
                {t("footer.tagline")}
              </p>
            </div>
            {(["product", "company", "support", "legal"] as const).map((col) => (
              <div key={col}>
                <h5 className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted mb-4">
                  {t(`footer.col.${col}.title`)}
                </h5>
                <ul className="space-y-2 text-sm text-ink-soft">
                  {([1, 2, 3, 4] as const).map((i) => (
                    <li key={i}>
                      <Link href="/" className="hover:text-ink transition-colors">
                        {t(`footer.col.${col}.l${i}`)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 pt-6 border-t border-ink/10 flex flex-wrap items-center justify-between gap-4 font-mono text-[11px] text-muted">
            <span>{t("footer.copyright")}</span>
            <span>{t("footer.contact")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ───────────────────────────── helpers ─────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
      <span
        className="w-1.5 h-1.5 rounded-full inline-block"
        style={{
          background: "var(--color-moss)",
          boxShadow: "0 0 0 3px color-mix(in srgb, var(--color-moss) 25%, transparent)",
        }}
      />
      {children}
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  softLine,
  lede,
}: {
  eyebrow: string;
  title: string;
  softLine?: string;
  lede: string;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr] lg:gap-16 items-end">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2
          className="mt-4 font-display text-4xl sm:text-5xl leading-[0.95]"
          style={{ letterSpacing: "-0.035em", fontWeight: 500 }}
        >
          {title}
          {softLine && (
            <>
              <br />
              <span className="text-muted" style={{ fontWeight: 400 }}>
                {softLine}
              </span>
            </>
          )}
        </h2>
      </div>
      <p className="text-lg text-ink-soft max-w-prose leading-relaxed">{lede}</p>
    </div>
  );
}

function primaryBtn(override?: React.CSSProperties): string {
  void override;
  // Tailwind doesn't accept arbitrary CSSProperties; consumers wrap with inline
  // style if they need an alternate primary tint.
  return "inline-flex items-center gap-2 rounded-lg bg-ink text-bg px-5 py-3 font-mono text-[11px] uppercase tracking-wider transition-opacity hover:opacity-90";
}

function ghostBtn(): string {
  return "inline-flex items-center gap-2 rounded-lg border border-ink/20 bg-card text-ink px-5 py-3 font-mono text-[11px] uppercase tracking-wider hover:bg-bg-3 transition-colors";
}

// ───────────────────────────── module list ─────────────────────────────

const MODULES = [
  { key: "ann", glyph: "H", tone: { bg: "var(--color-bg-3)", fg: "var(--color-ink)" } },
  { key: "forum", glyph: "F", tone: { bg: "color-mix(in srgb, var(--color-blue) 14%, transparent)", fg: "var(--color-blue)" } },
  { key: "msg", glyph: "Ü", tone: { bg: "var(--color-bg-3)", fg: "var(--color-ink-soft)" } },
  { key: "fin", glyph: "P", tone: { bg: "color-mix(in srgb, var(--color-moss) 18%, transparent)", fg: "var(--color-moss)" } },
  { key: "maint", glyph: "K", tone: { bg: "color-mix(in srgb, var(--color-ochre) 22%, transparent)", fg: "color-mix(in srgb, var(--color-ochre) 75%, var(--color-ink))" } },
  { key: "complaints", glyph: "R", tone: { bg: "color-mix(in srgb, var(--color-danger) 14%, transparent)", fg: "var(--color-danger)" } },
  { key: "vote", glyph: "S", tone: { bg: "var(--color-ink)", fg: "var(--color-bg)" } },
  { key: "docs", glyph: "D", tone: { bg: "var(--color-bg-3)", fg: "var(--color-ink-soft)" } },
] as const;

const REPORT_KINDS = [
  "minutes",
  "yearEnd",
  "rezsi",
  "audit",
] as const;

const STATS = [
  { key: "buildings", num: "412", unit: "+" },
  { key: "residents", num: "18.4", unit: "k" },
  { key: "tickets", num: "2.3", unit: "M" },
  { key: "uptime", num: "99.9", unit: "%" },
] as const;

const TRUST = [
  { key: "eu", glyph: "🛡" },
  { key: "law", glyph: "§" },
  { key: "audit", glyph: "⎆" },
  { key: "ownership", glyph: "↗" },
] as const;

// ───────────────────────────── bento ─────────────────────────────

function BentoGrid({ t }: { t: (k: string) => string }) {
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
      style={{ gridAutoRows: "minmax(140px, auto)" }}
    >
      {/* Voting tile — large */}
      <div
        className="rounded-2xl p-6 flex flex-col justify-between"
        style={{
          background: "var(--color-ink)",
          color: "var(--color-bg)",
          gridColumn: "span 3",
          gridRow: "span 2",
        }}
      >
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em]" style={{ color: "color-mix(in srgb, var(--color-bg) 60%, transparent)" }}>
          {t("bento.voting.label")}
        </span>
        <div>
          <div className="font-mono text-[11px]" style={{ color: "color-mix(in srgb, var(--color-bg) 65%, transparent)", marginBottom: 8 }}>
            VOTE-2026-014
          </div>
          <h3 className="font-display text-2xl leading-tight" style={{ fontWeight: 500, letterSpacing: "-0.025em" }}>
            {t("bento.voting.title")}
            <br />
            <span style={{ color: "color-mix(in srgb, var(--color-bg) 55%, transparent)" }}>
              {t("bento.voting.sub")}
            </span>
          </h3>
          <MiniBar label={t("bento.voting.yes")} pct={68} on />
          <MiniBar label={t("bento.voting.no")} pct={22} />
        </div>
      </div>

      {/* Finance tile — medium */}
      <div
        className="rounded-2xl p-6 flex flex-col justify-between"
        style={{
          background: "var(--color-bg-3)",
          gridColumn: "span 3",
          gridRow: "span 2",
        }}
      >
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">
          {t("bento.finance.label")}
        </span>
        <div>
          <div
            className="font-display"
            style={{ fontSize: 56, letterSpacing: "-0.04em", lineHeight: 1, fontWeight: 500, color: "var(--color-moss)" }}
          >
            8.1M
            <span className="text-muted" style={{ fontSize: 18, marginLeft: 6 }}>
              Ft
            </span>
          </div>
          <Spark heights={[40, 55, 50, 65, 60, 70, 85, 100]} />
        </div>
      </div>

      {/* Maintenance tile */}
      <div
        className="rounded-2xl p-6 flex flex-col justify-between"
        style={{
          background: "color-mix(in srgb, var(--color-ochre) 22%, var(--color-card))",
          gridColumn: "span 2",
        }}
      >
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">
          {t("bento.maint.label")}
        </span>
        <div>
          <div className="font-display" style={{ fontSize: 48, letterSpacing: "-0.04em", lineHeight: 1, fontWeight: 500 }}>
            4
          </div>
          <p className="mt-1 text-sm text-ink-soft">{t("bento.maint.body")}</p>
        </div>
      </div>

      {/* Residents tile */}
      <div
        className="rounded-2xl p-6 flex flex-col justify-between"
        style={{
          background: "var(--color-card)",
          border: "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
          gridColumn: "span 2",
        }}
      >
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">
          {t("bento.residents.label")}
        </span>
        <div>
          <h3 className="font-display text-2xl" style={{ fontWeight: 500, letterSpacing: "-0.025em" }}>
            {t("bento.residents.title")}
          </h3>
          <div className="mt-3 flex">
            {["#b89a70", "#6f8357", "#a7c4d6", "#c89858", "#9a7aa0"].map((c, i) => (
              <span
                key={i}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: c,
                  marginLeft: i === 0 ? 0 : -8,
                  border: "2px solid var(--color-card)",
                }}
              />
            ))}
            <span
              className="font-mono text-[10px]"
              style={{
                width: 26,
                height: 26,
                marginLeft: -8,
                borderRadius: "50%",
                background: "var(--color-ochre)",
                border: "2px solid var(--color-card)",
                display: "grid",
                placeItems: "center",
                color: "var(--color-ink)",
                fontWeight: 700,
              }}
            >
              +19
            </span>
          </div>
        </div>
      </div>

      {/* Status tile */}
      <div
        className="rounded-2xl p-6"
        style={{
          background: "var(--color-card)",
          border: "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
          gridColumn: "span 2",
        }}
      >
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">
          {t("bento.status.label")}
        </span>
        <div className="mt-3 space-y-2">
          <StatusRow tone="good" text={t("bento.status.platform")} />
          <StatusRow tone="good" text={t("bento.status.bank")} />
          <StatusRow tone="ochre" text={t("bento.status.upcoming")} />
        </div>
      </div>
    </div>
  );
}

function MiniBar({ label, pct, on }: { label: string; pct: number; on?: boolean }) {
  return (
    <div className="flex items-center gap-3 mt-3">
      <span className="font-mono text-[11px]" style={{ width: 100, color: on ? "var(--color-bg)" : "color-mix(in srgb, var(--color-bg) 55%, transparent)" }}>
        {label}
      </span>
      <div className="flex-1 h-1.5 rounded-full" style={{ background: "color-mix(in srgb, var(--color-bg) 14%, transparent)" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: on ? "var(--color-ochre)" : "color-mix(in srgb, var(--color-bg) 30%, transparent)",
          }}
        />
      </div>
      <span className="font-mono text-[11px]" style={{ width: 36, textAlign: "right", color: on ? "var(--color-bg)" : "color-mix(in srgb, var(--color-bg) 55%, transparent)" }}>
        {pct}%
      </span>
    </div>
  );
}

function Spark({ heights }: { heights: number[] }) {
  return (
    <div className="mt-4 flex items-end gap-1.5" style={{ height: 60 }}>
      {heights.map((h, i) => (
        <span
          key={i}
          className="flex-1 rounded-sm"
          style={{
            height: `${h}%`,
            background: i >= heights.length - 2 ? "var(--color-moss)" : "color-mix(in srgb, var(--color-moss) 35%, transparent)",
          }}
        />
      ))}
    </div>
  );
}

function StatusRow({ tone, text }: { tone: "good" | "ochre" | "danger"; text: string }) {
  const color =
    tone === "good"
      ? "var(--color-good)"
      : tone === "ochre"
        ? "var(--color-ochre)"
        : "var(--color-danger)";
  return (
    <div className="flex items-center gap-2 text-sm text-ink-soft">
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color }} />
      <span>{text}</span>
    </div>
  );
}

// ───────────────────────────── deep dive ─────────────────────────────

function DeepDive({
  flip,
  tag,
  title,
  titleSoft,
  body,
  bullets,
  mock,
}: {
  flip: boolean;
  tag: string;
  title: string;
  titleSoft: string;
  body: string;
  bullets: string[];
  mock: React.ReactNode;
}) {
  return (
    <div className={`grid gap-12 lg:gap-16 items-center ${flip ? "lg:grid-cols-[1fr_1.1fr]" : "lg:grid-cols-[1.1fr_1fr]"}`}>
      <div className={flip ? "lg:order-2" : ""}>
        <span
          className="inline-block font-mono text-[10.5px] uppercase tracking-[0.14em] px-2 py-1 rounded"
          style={{
            background: "color-mix(in srgb, var(--color-ink) 6%, transparent)",
            color: "var(--color-ink-soft)",
          }}
        >
          {tag}
        </span>
        <h3
          className="mt-4 font-display text-3xl sm:text-4xl leading-[0.98]"
          style={{ letterSpacing: "-0.03em", fontWeight: 500 }}
        >
          {title}
          <br />
          <span className="text-muted" style={{ fontWeight: 400 }}>
            {titleSoft}
          </span>
        </h3>
        <p className="mt-5 text-base text-ink-soft leading-relaxed max-w-prose">{body}</p>
        <ul className="mt-6 space-y-2.5">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-ink-soft">
              <span style={{ color: "var(--color-moss)", fontWeight: 600 }}>→</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={flip ? "lg:order-1" : ""}>{mock}</div>
    </div>
  );
}

function Shot({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption: string;
}) {
  return (
    <MockFrame title={caption} bodyPad={false}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="block w-full h-auto"
        style={{ display: "block" }}
      />
    </MockFrame>
  );
}

function MockFrame({
  title,
  children,
  bodyPad = true,
}: {
  title: string;
  children: React.ReactNode;
  bodyPad?: boolean;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "var(--color-card)",
        border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        boxShadow:
          "0 32px 48px -24px color-mix(in srgb, var(--color-ink) 18%, transparent)",
      }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 border-b"
        style={{
          borderColor: "color-mix(in srgb, var(--color-ink) 8%, transparent)",
          background: "var(--color-bg-3)",
        }}
      >
        <span className="w-2 h-2 rounded-full" style={{ background: "var(--color-moss)" }} />
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted">
          {title}
        </span>
        <span className="ml-auto flex gap-1.5">
          {[1, 2, 3].map((i) => (
            <span
              key={i}
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ background: "color-mix(in srgb, var(--color-ink) 12%, transparent)" }}
            />
          ))}
        </span>
      </div>
      <div className={bodyPad ? "p-5" : ""}>{children}</div>
    </div>
  );
}


// ───────────────────────────── pricing card ─────────────────────────────

function PricingCard({
  t,
  keyName,
  price,
  featured,
  cta,
}: {
  t: (k: string) => string;
  keyName: string;
  price: string;
  featured?: boolean;
  cta: string;
}) {
  const isCustom = price === t("pricing.office.priceCustom");
  return (
    <div
      className="rounded-2xl p-7 relative flex flex-col gap-5"
      style={
        featured
          ? {
              background: "var(--color-ink)",
              color: "var(--color-bg)",
              border: "1px solid var(--color-ink)",
            }
          : {
              background: "var(--color-card)",
              border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
            }
      }
    >
      {featured && (
        <span
          className="absolute top-4 right-4 font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded"
          style={{ background: "var(--color-ochre)", color: "var(--color-ink)", fontWeight: 700 }}
        >
          {t("pricing.popular")}
        </span>
      )}
      <div>
        <div className="font-display text-xl" style={{ fontWeight: 600, letterSpacing: "-0.02em" }}>
          {t(`pricing.${keyName}.name`)}
        </div>
        <p
          className="text-sm mt-1"
          style={{ color: featured ? "color-mix(in srgb, var(--color-bg) 70%, transparent)" : "var(--color-muted)" }}
        >
          {t(`pricing.${keyName}.sub`)}
        </p>
      </div>
      <div
        className="font-display"
        style={{ fontSize: 48, letterSpacing: "-0.035em", lineHeight: 1, fontWeight: 500 }}
      >
        {isCustom ? (
          price
        ) : (
          <>
            {price}
            <span
              className="font-manrope ml-1"
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: featured ? "color-mix(in srgb, var(--color-bg) 65%, transparent)" : "var(--color-muted)",
              }}
            >
              Ft/hó
            </span>
          </>
        )}
      </div>
      <ul
        className="space-y-2 py-4 flex-1 border-y"
        style={{
          borderColor: featured
            ? "color-mix(in srgb, var(--color-bg) 18%, transparent)"
            : "color-mix(in srgb, var(--color-ink) 8%, transparent)",
        }}
      >
        {([1, 2, 3, 4, 5] as const).map((i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm">
            <span style={{ color: featured ? "var(--color-ochre)" : "var(--color-moss)", fontWeight: 700 }}>
              ✓
            </span>
            <span style={{ color: featured ? "color-mix(in srgb, var(--color-bg) 88%, transparent)" : "var(--color-ink-soft)" }}>
              {t(`pricing.${keyName}.f${i}`)}
            </span>
          </li>
        ))}
      </ul>
      <Link href="/pricing" className={cta}>
        {t(`pricing.${keyName}.cta`)} <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
