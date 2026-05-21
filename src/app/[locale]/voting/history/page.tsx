import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getVotingOverview, getVotingHistory } from "@/lib/voting-dal";
import type { VotingHistoryItem } from "@/lib/voting-dal";
import { VotingShell } from "@/components/voting/voting-shell";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ result?: string; majority?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "voting.shell" });
  return { title: `${t("title")} · ${t("tab.history")}` };
}

export default async function VotingHistoryPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const [overview, history] = await Promise.all([
    getVotingOverview(),
    getVotingHistory(),
  ]);
  const t = await getTranslations({ locale, namespace: "voting" });

  // Apply filters in-memory (the dataset is bounded to ~100 closed votes).
  const resultFilter = sp.result;
  const majorityFilter = sp.majority;
  const filtered = history.items.filter((v) => {
    if (resultFilter && v.result !== resultFilter) return false;
    if (majorityFilter && v.majorityType !== majorityFilter) return false;
    return true;
  });

  return (
    <VotingShell
      locale={locale}
      active="history"
      counts={{
        active: overview.totalOpenCount,
        meetings: overview.totalMeetingCount,
        history: history.totalCount,
      }}
      titleKey="voting.history.title"
      ledeKey="voting.history.lede"
    >
      <SummaryStrip
        total={history.totalCount}
        passed={history.passedCount}
        failed={history.failedCount}
        expired={history.expiredCount}
        locale={locale}
      />

      <FilterBar
        locale={locale}
        currentResult={resultFilter ?? "all"}
        currentMajority={majorityFilter ?? "all"}
      />

      {filtered.length === 0 ? (
        <EmptyState locale={locale} hasFilter={!!resultFilter || !!majorityFilter} />
      ) : (
        <div style={{ marginTop: "20px" }}>
          {/* Header row */}
          <div
            className="hidden md:grid font-mono"
            style={{
              gridTemplateColumns: "minmax(0, 2.6fr) 110px 110px minmax(0, 1.4fr) 110px",
              gap: "16px",
              padding: "10px 16px",
              fontSize: "10px",
              letterSpacing: "0.08em",
              color: "var(--color-muted)",
              textTransform: "uppercase",
              borderBottom: "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
            }}
          >
            <span>{t("history.colTitle")}</span>
            <span>{t("history.colResult")}</span>
            <span>{t("history.colMajority")}</span>
            <span>{t("history.colTally")}</span>
            <span style={{ textAlign: "right" }}>{t("history.colClosed")}</span>
          </div>

          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {filtered.map((v) => (
              <HistoryRow key={v.id} vote={v} locale={locale} />
            ))}
          </ul>
        </div>
      )}
    </VotingShell>
  );
}

async function SummaryStrip({
  total,
  passed,
  failed,
  expired,
  locale,
}: {
  total: number;
  passed: number;
  failed: number;
  expired: number;
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "voting.history" });
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  return (
    <div
      className="grid grid-cols-2 md:grid-cols-4 gap-3"
      style={{ marginBottom: "20px" }}
    >
      <SummaryTile label={t("statTotal")} value={total.toString()} />
      <SummaryTile label={t("statPassed")} value={passed.toString()} tone="good" />
      <SummaryTile label={t("statFailed")} value={failed.toString()} tone="danger" />
      <SummaryTile
        label={t("statPassRate")}
        value={`${passRate}%`}
        suffix={`(${expired} ${t("statExpiredSuffix")})`}
      />
    </div>
  );
}

function SummaryTile({
  label,
  value,
  suffix,
  tone,
}: {
  label: string;
  value: string;
  suffix?: string;
  tone?: "good" | "danger";
}) {
  const valueColor =
    tone === "good"
      ? "var(--color-good)"
      : tone === "danger"
        ? "var(--color-danger)"
        : "var(--color-ink)";
  return (
    <div
      style={{
        background: "var(--color-card)",
        border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "12px",
        padding: "14px 16px",
      }}
    >
      <div
        className="font-mono"
        style={{
          fontSize: "10px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--color-muted)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "26px",
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: valueColor,
          marginTop: "4px",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {suffix && (
        <div
          className="font-mono"
          style={{
            fontSize: "10px",
            color: "var(--color-muted)",
            marginTop: "4px",
            letterSpacing: "0.04em",
          }}
        >
          {suffix}
        </div>
      )}
    </div>
  );
}

async function FilterBar({
  locale,
  currentResult,
  currentMajority,
}: {
  locale: string;
  currentResult: string;
  currentMajority: string;
}) {
  const t = await getTranslations({ locale, namespace: "voting.history" });

  function buildHref(key: "result" | "majority", value: string): string {
    const params = new URLSearchParams();
    if (key === "result") {
      if (value !== "all") params.set("result", value);
      if (currentMajority !== "all") params.set("majority", currentMajority);
    } else {
      if (currentResult !== "all") params.set("result", currentResult);
      if (value !== "all") params.set("majority", value);
    }
    const q = params.toString();
    return q ? `/${locale}/voting/history?${q}` : `/${locale}/voting/history`;
  }

  const resultOptions = [
    { value: "all", label: t("filterAll") },
    { value: "passed", label: t("filterPassed") },
    { value: "failed", label: t("filterFailed") },
    { value: "expired", label: t("filterExpired") },
  ];
  const majorityOptions = [
    { value: "all", label: t("filterAll") },
    { value: "SIMPLE_MAJORITY", label: t("filterSimple") },
    { value: "TWO_THIRDS", label: t("filterTwoThirds") },
    { value: "FOUR_FIFTHS", label: t("filterFourFifths") },
  ];

  return (
    <div className="flex flex-wrap gap-4" style={{ marginBottom: "8px" }}>
      <FilterGroup
        label={t("filterResult")}
        options={resultOptions}
        current={currentResult}
        buildHref={(v) => buildHref("result", v)}
      />
      <FilterGroup
        label={t("filterMajority")}
        options={majorityOptions}
        current={currentMajority}
        buildHref={(v) => buildHref("majority", v)}
      />
    </div>
  );
}

function FilterGroup({
  label,
  options,
  current,
  buildHref,
}: {
  label: string;
  options: { value: string; label: string }[];
  current: string;
  buildHref: (value: string) => string;
}) {
  return (
    <div>
      <div
        className="font-mono"
        style={{
          fontSize: "10px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--color-muted)",
          marginBottom: "6px",
        }}
      >
        {label}
      </div>
      <div
        className="flex gap-1"
        style={{
          background: "var(--color-card)",
          padding: "3px",
          borderRadius: "8px",
          border: "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
        }}
      >
        {options.map((opt) => {
          const isOn = opt.value === current;
          return (
            <a
              key={opt.value}
              href={buildHref(opt.value)}
              style={{
                padding: "5px 10px",
                fontSize: "12px",
                fontWeight: isOn ? 600 : 500,
                color: isOn ? "var(--color-bg)" : "var(--color-ink-soft)",
                background: isOn ? "var(--color-ink)" : "transparent",
                borderRadius: "6px",
                textDecoration: "none",
                cursor: "pointer",
                transition: "background 120ms",
                whiteSpace: "nowrap",
              }}
            >
              {opt.label}
            </a>
          );
        })}
      </div>
    </div>
  );
}

async function HistoryRow({
  vote,
  locale,
}: {
  vote: VotingHistoryItem;
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "voting" });

  const closedAt = new Date(vote.closedAt).toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const pillKind =
    vote.result === "passed" ? "pass" : vote.result === "failed" ? "fail" : "exp";
  const pillStyle = {
    pass: { bg: "var(--color-good-soft)", color: "var(--color-good)" },
    fail: { bg: "var(--color-danger-soft)", color: "var(--color-danger)" },
    exp: {
      bg: "color-mix(in srgb, var(--color-ink) 8%, transparent)",
      color: "var(--color-muted)",
    },
  }[pillKind];

  return (
    <li
      style={{
        padding: "16px",
        borderBottom:
          "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
      }}
    >
      <div
        className="grid items-start gap-3 md:gap-4"
        style={{
          gridTemplateColumns: "1fr",
        }}
      >
        <div
          className="md:grid"
          style={{
            gridTemplateColumns: "minmax(0, 2.6fr) 110px 110px minmax(0, 1.4fr) 110px",
            gap: "16px",
            display: "grid",
          }}
        >
          {/* Title + reference */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="font-mono"
                style={{
                  fontSize: "10px",
                  letterSpacing: "0.08em",
                  color: "var(--color-muted)",
                  textTransform: "uppercase",
                }}
              >
                {vote.reference}
              </span>
              {vote.isSecret && (
                <span
                  className="font-mono"
                  style={{
                    fontSize: "9px",
                    padding: "2px 6px",
                    borderRadius: "3px",
                    background: "color-mix(in srgb, var(--color-ochre) 20%, transparent)",
                    color: "color-mix(in srgb, var(--color-ochre) 80%, var(--color-ink))",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  {t("history.secretPill")}
                </span>
              )}
            </div>
            <h3
              style={{
                fontFamily: "var(--font-space-grotesk), sans-serif",
                fontSize: "15px",
                fontWeight: 600,
                letterSpacing: "-0.015em",
                marginTop: "4px",
                lineHeight: 1.3,
              }}
            >
              {vote.title}
            </h3>
            {vote.userChoiceLabel && (
              <div
                className="font-mono"
                style={{
                  fontSize: "10px",
                  color: "var(--color-ink-soft)",
                  marginTop: "4px",
                  letterSpacing: "0.04em",
                }}
              >
                {t("history.youVoted", { choice: vote.userChoiceLabel })}
              </div>
            )}
          </div>

          {/* Result pill */}
          <div>
            <span
              className="font-mono inline-block"
              style={{
                fontSize: "10px",
                padding: "4px 10px",
                borderRadius: "5px",
                background: pillStyle.bg,
                color: pillStyle.color,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {t(`past.result.${vote.result}`)}
            </span>
          </div>

          {/* Majority */}
          <div
            className="font-mono"
            style={{
              fontSize: "11px",
              color: "var(--color-ink-soft)",
              letterSpacing: "0.04em",
              alignSelf: "center",
            }}
          >
            {t(`majorityShort_${vote.majorityType}`)}
          </div>

          {/* Tally bar */}
          <div style={{ alignSelf: "center" }}>
            <div
              className="flex overflow-hidden"
              style={{
                height: "6px",
                borderRadius: "999px",
                background: "color-mix(in srgb, var(--color-ink) 6%, transparent)",
              }}
            >
              <span style={{ width: `${vote.yesPct}%`, background: "var(--color-moss-2)" }} />
              <span style={{ width: `${vote.noPct}%`, background: "var(--color-danger)" }} />
              <span
                style={{
                  width: `${vote.abstainPct}%`,
                  background: "color-mix(in srgb, var(--color-ink) 25%, transparent)",
                }}
              />
            </div>
            <div
              className="flex gap-2 font-mono"
              style={{
                fontSize: "10px",
                color: "var(--color-muted)",
                marginTop: "4px",
                letterSpacing: "0.04em",
              }}
            >
              <span style={{ color: "var(--color-moss-2)" }}>{vote.yesPct}%</span>
              <span style={{ color: "var(--color-danger)" }}>{vote.noPct}%</span>
              <span>{vote.abstainPct}%</span>
            </div>
          </div>

          {/* Closed date */}
          <div
            className="font-mono"
            style={{
              fontSize: "10px",
              color: "var(--color-muted)",
              letterSpacing: "0.06em",
              textAlign: "right",
              alignSelf: "center",
            }}
          >
            {closedAt}
            <div style={{ marginTop: "3px" }}>
              {t("history.castShare", { pct: vote.totalCastPct.toString() })}
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

async function EmptyState({
  locale,
  hasFilter,
}: {
  locale: string;
  hasFilter: boolean;
}) {
  const t = await getTranslations({ locale, namespace: "voting.history" });
  return (
    <div
      style={{
        background: "var(--color-card)",
        border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "14px",
        padding: "48px 32px",
        textAlign: "center",
        marginTop: "20px",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "20px",
          fontWeight: 500,
          letterSpacing: "-0.02em",
          marginBottom: "8px",
        }}
      >
        {hasFilter ? t("emptyFilteredTitle") : t("emptyTitle")}
      </h2>
      <p
        style={{
          color: "var(--color-ink-soft)",
          fontSize: "14px",
          maxWidth: "44ch",
          margin: "0 auto",
          lineHeight: 1.55,
        }}
      >
        {hasFilter ? t("emptyFilteredBody") : t("emptyBody")}
      </p>
    </div>
  );
}
