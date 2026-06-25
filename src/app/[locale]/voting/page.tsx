import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getDashboardContext } from "@/lib/dal";
import { hasMinimumRole } from "@/lib/rbac";
import { getVotingOverview } from "@/lib/voting-dal";
import type {
  PastVoteData,
  OtherOpenPollData,
  NextMeetingData,
  VotingHistoryStripEntry,
} from "@/lib/voting-dal";
import { VotingShell } from "@/components/voting/voting-shell";
import { ActiveVoteHero } from "@/components/voting/active-vote-hero";
import { VotingHeaderActions } from "@/components/voting/voting-header-actions";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "voting.shell" });
  return { title: t("title") };
}

export default async function VotingPageRoute({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getDashboardContext();

  // Tht. § 38 — only owners (tulajdonostárs) have a vote. TENANT may
  // observe deliberations at the meeting, but the SaaS surface itself
  // is owner-only; tenants navigating here directly are redirected.
  if (!hasMinimumRole(ctx.role, "OWNER")) {
    redirect(`/${locale}/dashboard`);
  }

  const data = await getVotingOverview();
  const t = await getTranslations({ locale, namespace: "voting" });
  const isBoardPlus = hasMinimumRole(ctx.role, "BOARD_MEMBER");

  // Quarter label for the page title — small visual touch from the design.
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;

  return (
    <VotingShell
      locale={locale}
      active="active"
      counts={{
        active: data.totalOpenCount,
        meetings: data.totalMeetingCount,
        history: data.totalHistoryCount,
      }}
      titleSuffix={`· ${now.getFullYear()} Q${quarter}`}
      headerActions={isBoardPlus ? <VotingHeaderActions canCreate /> : null}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6">
        {/* MAIN COLUMN */}
        <div>
          {data.active ? (
            <ActiveVoteHero vote={data.active} />
          ) : (
            <EmptyHero locale={locale} isBoardPlus={isBoardPlus} />
          )}

          {/* Past votes section */}
          <div
            className="flex justify-between items-baseline"
            style={{ margin: "32px 0 14px" }}
          >
            <div>
              <h2
                style={{
                  fontFamily: "var(--font-space-grotesk), sans-serif",
                  fontSize: "22px",
                  fontWeight: 500,
                  letterSpacing: "-0.025em",
                }}
              >
                {t("past.title")}
              </h2>
              <p
                className="font-mono"
                style={{
                  fontSize: "11px",
                  color: "var(--color-muted)",
                  margin: "4px 0 0",
                  letterSpacing: "0.05em",
                }}
              >
                {t("past.subtitle", {
                  shown: data.pastVotes.length.toString(),
                })}
              </p>
            </div>
            <Link
              href={`/${locale}/voting/history`}
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--color-ink-soft)",
                textDecoration: "underline",
                textUnderlineOffset: "3px",
              }}
            >
              {t("past.allHistory")}
            </Link>
          </div>

          {data.pastVotes.length === 0 ? (
            <EmptyPast locale={locale} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {data.pastVotes.map((p) => (
                <PastVoteCard key={p.id} vote={p} locale={locale} />
              ))}
            </div>
          )}
        </div>

        {/* SIDEBAR */}
        <aside className="hidden lg:block">
          <OtherOpenPolls polls={data.otherOpenPolls} locale={locale} />
          {data.nextMeeting && (
            <NextMeetingPanel meeting={data.nextMeeting} locale={locale} />
          )}
          <UserHistoryPanel
            history={data.userHistory}
            participation={data.userParticipationRate}
            locale={locale}
          />
          <RulesPanel locale={locale} />
        </aside>
      </div>
    </VotingShell>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────

async function PastVoteCard({
  vote,
  locale,
}: {
  vote: PastVoteData;
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "voting" });

  const closedAt = new Date(vote.closedAt)
    .toLocaleDateString("hu-HU", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    .toUpperCase();

  const pillKind =
    vote.result === "passed" ? "pass" : vote.result === "failed" ? "fail" : "exp";
  const pillStyle = {
    pass: { bg: "var(--color-good-soft)", color: "var(--color-good)" },
    fail: {
      bg: "var(--color-danger-soft)",
      color: "var(--color-danger)",
    },
    exp: {
      bg: "color-mix(in srgb, var(--color-ink) 8%, transparent)",
      color: "var(--color-muted)",
    },
  }[pillKind];

  // Render up to 3 stacked-tally segments, plus an "uncast" segment for expired
  // votes that didn't reach quorum.
  const yes = vote.optionTallies[0]?.pct ?? 0;
  const no = vote.optionTallies[1]?.pct ?? 0;
  const abs = vote.optionTallies[2]?.pct ?? 0;
  const uncast =
    vote.result === "expired"
      ? Math.max(
          0,
          100 -
            Math.round(
              (vote.achievedQuorumPct / Math.max(1, vote.requiredQuorumPct)) *
                (yes + no + abs),
            ),
        )
      : 0;

  return (
    <div
      style={{
        background: "var(--color-card)",
        border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "12px",
        padding: "18px 20px",
      }}
    >
      <div
        className="flex justify-between items-center"
        style={{ marginBottom: "12px" }}
      >
        <span
          className="font-mono"
          style={{
            fontSize: "10px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            padding: "3px 8px",
            borderRadius: "4px",
            fontWeight: 700,
            background: pillStyle.bg,
            color: pillStyle.color,
          }}
        >
          {t(`past.result.${vote.result}`)}
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: "10px",
            color: "var(--color-muted)",
            letterSpacing: "0.06em",
          }}
        >
          {closedAt}
        </span>
      </div>
      <h5
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "16px",
          fontWeight: 600,
          letterSpacing: "-0.015em",
          marginBottom: "14px",
          lineHeight: 1.25,
        }}
      >
        {vote.title}
      </h5>
      <div
        className="flex overflow-hidden"
        style={{
          height: "8px",
          borderRadius: "999px",
          background: "color-mix(in srgb, var(--color-ink) 6%, transparent)",
          marginBottom: "8px",
        }}
      >
        <span style={{ width: `${yes}%`, background: "var(--color-moss-2)" }} />
        <span style={{ width: `${no}%`, background: "var(--color-danger)" }} />
        <span style={{ width: `${abs}%`, background: "color-mix(in srgb, var(--color-ink) 25%, transparent)" }} />
        {uncast > 0 && (
          <span
            style={{
              width: `${uncast}%`,
              background: "color-mix(in srgb, var(--color-ink) 6%, transparent)",
            }}
          />
        )}
      </div>
      <div
        className="flex flex-wrap gap-3.5 font-mono"
        style={{ fontSize: "10px", color: "var(--color-muted)", letterSpacing: "0.04em" }}
      >
        <Legend swatch="var(--color-moss-2)" label={t("past.legendYes")} value={yes} />
        <Legend swatch="var(--color-danger)" label={t("past.legendNo")} value={no} />
        {vote.result === "expired" ? (
          <span style={{ color: "var(--color-ochre)" }}>
            {t("past.quorumGap", {
              achieved: vote.achievedQuorumPct.toString(),
              required: vote.requiredQuorumPct.toString(),
            })}
          </span>
        ) : (
          <Legend swatch="color-mix(in srgb, var(--color-ink) 25%, transparent)" label={t("past.legendAbs")} value={abs} />
        )}
      </div>
    </div>
  );
}

function Legend({
  swatch,
  label,
  value,
}: {
  swatch: string;
  label: string;
  value: number;
}) {
  return (
    <span>
      <span
        className="inline-block"
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "2px",
          background: swatch,
          marginRight: "4px",
          verticalAlign: "middle",
        }}
      />
      {label} <b style={{ color: "var(--color-ink)", fontWeight: 600 }}>{value}%</b>
    </span>
  );
}

async function OtherOpenPolls({
  polls,
  locale,
}: {
  polls: OtherOpenPollData[];
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "voting" });
  return (
    <SidePanel
      title={t("sidebar.otherOpen")}
      count={polls.length}
    >
      {polls.length === 0 ? (
        <EmptyMini label={t("sidebar.noOtherOpen")} />
      ) : (
        polls.map((p, i) => (
          <Link
            key={p.id}
            href={`/${locale}/voting?focus=${p.id}`}
            className="flex items-center gap-2.5 cursor-pointer transition-colors"
            style={{
              padding: "10px 0",
              borderBottom:
                i < polls.length - 1
                  ? "1px dashed color-mix(in srgb, var(--color-ink) 6%, transparent)"
                  : "none",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div className="flex-1 min-w-0">
              <div
                className="truncate"
                style={{
                  fontSize: "12.5px",
                  fontWeight: 600,
                  letterSpacing: "-0.005em",
                }}
              >
                {p.title}
              </div>
              <div
                className="font-mono"
                style={{
                  fontSize: "10px",
                  color: p.isUrgent ? "var(--color-danger)" : "var(--color-ink-soft)",
                  letterSpacing: "0.05em",
                  marginTop: "2px",
                }}
              >
                {p.daysRemaining > 0 ? `${p.daysRemaining}N ` : ""}
                {p.hoursRemaining}Ó {t("sidebar.remaining")} · {p.quorumPct}%{" "}
                {t("sidebar.quorum")}
              </div>
            </div>
            <span style={{ color: "var(--color-muted)", fontSize: "16px" }}>→</span>
          </Link>
        ))
      )}
    </SidePanel>
  );
}

async function NextMeetingPanel({
  meeting,
  locale,
}: {
  meeting: NextMeetingData;
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "voting" });
  const dt = new Date(meeting.startsAt);
  const dateLabel = dt.toLocaleDateString("hu-HU", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  const time = dt.toLocaleTimeString("hu-HU", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const remainingShown = meeting.totalAttendees - meeting.attendees.length;

  return (
    <div
      style={{
        background: "var(--color-ink)",
        color: "var(--color-bg)",
        border: "1px solid var(--color-ink)",
        borderRadius: "14px",
        padding: "20px",
        marginBottom: "16px",
      }}
    >
      <div
        className="font-mono"
        style={{
          fontSize: "10px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "color-mix(in srgb, var(--color-bg) 55%, transparent)",
          marginBottom: "8px",
        }}
      >
        {t("sidebar.nextMeeting")}
      </div>
      <div
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "22px",
          fontWeight: 500,
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
        }}
      >
        {dateLabel}
      </div>
      <div
        className="flex items-center gap-2"
        style={{
          fontSize: "12.5px",
          color: "color-mix(in srgb, var(--color-bg) 75%, transparent)",
          marginTop: "6px",
        }}
      >
        <ClockIcon />
        {time}
      </div>
      {meeting.location && (
        <div
          className="flex items-center gap-2"
          style={{
            fontSize: "12.5px",
            color: "color-mix(in srgb, var(--color-bg) 75%, transparent)",
            marginTop: "6px",
          }}
        >
          <PinIcon />
          {meeting.location}
        </div>
      )}
      <div className="flex gap-2" style={{ marginTop: "18px" }}>
        <Link
          href={`/${locale}/voting/meetings/${meeting.id}?rsvp=ATTENDING`}
          className="flex-1 text-center transition-opacity hover:opacity-90"
          style={{
            background: "var(--color-ochre)",
            color: "var(--color-ink)",
            border: 0,
            borderRadius: "8px",
            padding: "10px",
            fontWeight: 700,
            fontSize: "12px",
            letterSpacing: "0.02em",
            textDecoration: "none",
          }}
        >
          {t("sidebar.iAmGoing")}
        </Link>
        <Link
          href={`/${locale}/voting/proxy?meeting=${meeting.id}`}
          className="flex-1 text-center transition-colors hover:bg-[color-mix(in_srgb,var(--color-bg)_8%,transparent)]"
          style={{
            background: "transparent",
            border: "1px solid color-mix(in srgb, var(--color-bg) 25%, transparent)",
            color: "var(--color-bg)",
            borderRadius: "8px",
            padding: "10px",
            fontWeight: 500,
            fontSize: "12px",
            textDecoration: "none",
          }}
        >
          {t("sidebar.proxy")}
        </Link>
      </div>
      <div
        className="flex items-center gap-2.5"
        style={{
          marginTop: "18px",
          paddingTop: "14px",
          borderTop: "1px solid color-mix(in srgb, var(--color-bg) 15%, transparent)",
        }}
      >
        <div className="flex">
          {meeting.attendees.map((a, idx) => (
            <span
              key={idx}
              className="grid place-items-center"
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                background:
                  a.tone === "a"
                    ? "var(--color-ochre)"
                    : a.tone === "b"
                      ? "var(--color-moss-2)"
                      : a.tone === "c"
                        ? "color-mix(in srgb, var(--color-bg) 80%, transparent)"
                        : "color-mix(in srgb, var(--color-bg) 25%, transparent)",
                color: a.tone === "d" ? "var(--color-bg)" : "var(--color-ink)",
                border: "2px solid var(--color-ink)",
                marginLeft: idx === 0 ? "0" : "-6px",
                fontFamily: "var(--font-space-grotesk), sans-serif",
                fontWeight: 500,
                fontSize: "9px",
              }}
            >
              {a.initials}
            </span>
          ))}
          {remainingShown > 0 && (
            <span
              className="grid place-items-center"
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                background: "color-mix(in srgb, var(--color-bg) 25%, transparent)",
                color: "var(--color-bg)",
                border: "2px solid var(--color-ink)",
                marginLeft: "-6px",
                fontFamily: "var(--font-space-grotesk), sans-serif",
                fontWeight: 500,
                fontSize: "9px",
              }}
            >
              +{remainingShown}
            </span>
          )}
        </div>
        <div
          className="font-mono"
          style={{
            fontSize: "11px",
            color: "color-mix(in srgb, var(--color-bg) 65%, transparent)",
            letterSpacing: "0.04em",
          }}
        >
          <b style={{ color: "var(--color-bg)", fontWeight: 600 }}>
            {meeting.totalAttendees}
          </b>{" "}
          / {meeting.totalUnits} {t("sidebar.responded")}
        </div>
      </div>
    </div>
  );
}

async function UserHistoryPanel({
  history,
  participation,
  locale,
}: {
  history: VotingHistoryStripEntry[];
  participation: number;
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "voting" });
  return (
    <SidePanel
      title={t("sidebar.yourHistory")}
      count={`${Math.round(participation * 100)}%`}
    >
      <div
        className="font-mono"
        style={{
          fontSize: "10px",
          color: "var(--color-muted)",
          letterSpacing: "0.05em",
        }}
      >
        {t("sidebar.last24")}
      </div>
      <div className="flex gap-[3px]" style={{ marginTop: "12px" }}>
        {history.map((h, i) => (
          <i
            key={i}
            style={{
              flex: 1,
              height: "22px",
              borderRadius: "3px",
              background:
                h.kind === "y"
                  ? "var(--color-moss-2)"
                  : h.kind === "n"
                    ? "var(--color-danger)"
                    : h.kind === "a"
                      ? "color-mix(in srgb, var(--color-ink) 22%, transparent)"
                      : h.kind === "x"
                        ? "color-mix(in srgb, var(--color-ochre) 70%, transparent)"
                        : "color-mix(in srgb, var(--color-ink) 8%, transparent)",
            }}
          />
        ))}
      </div>
      <div
        className="flex flex-wrap gap-3 font-mono"
        style={{
          marginTop: "10px",
          fontSize: "10px",
          color: "var(--color-muted)",
          letterSpacing: "0.04em",
        }}
      >
        <Swatch color="var(--color-moss-2)" label={t("sidebar.kindYes")} />
        <Swatch color="var(--color-danger)" label={t("sidebar.kindNo")} />
        <Swatch
          color="color-mix(in srgb, var(--color-ink) 22%, transparent)"
          label={t("sidebar.kindAbs")}
        />
        <Swatch
          color="color-mix(in srgb, var(--color-ochre) 70%, transparent)"
          label={t("sidebar.kindLive")}
        />
      </div>
    </SidePanel>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span>
      <span
        className="inline-block"
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "2px",
          background: color,
          marginRight: "4px",
          verticalAlign: "middle",
        }}
      />
      {label}
    </span>
  );
}

async function RulesPanel({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "voting.sidebar.rules" });
  const items = [
    { icon: "shield", text: t("secret") },
    { icon: "chart", text: t("weighted") },
    { icon: "clock", text: t("autoClose") },
    { icon: "doc", text: t("pdfMinutes") },
  ] as const;
  return (
    <SidePanel title={t("title")}>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {items.map((it, i) => (
          <li
            key={i}
            className="flex gap-2.5 items-start"
            style={{
              fontSize: "12.5px",
              color: "var(--color-ink-soft)",
              padding: "7px 0",
              lineHeight: 1.45,
            }}
          >
            <span
              style={{
                color: "var(--color-moss-2)",
                flexShrink: 0,
                marginTop: "2px",
              }}
            >
              <RuleIcon kind={it.icon} />
            </span>
            {it.text}
          </li>
        ))}
      </ul>
    </SidePanel>
  );
}

function SidePanel({
  title,
  count,
  children,
}: {
  title: string;
  count?: number | string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--color-card)",
        border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "14px",
        padding: "20px",
        marginBottom: "16px",
      }}
    >
      <h4
        className="flex justify-between items-center"
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "14px",
          fontWeight: 600,
          letterSpacing: "-0.015em",
          marginBottom: "14px",
        }}
      >
        {title}
        {count !== undefined && count !== null && (
          <span
            className="font-mono"
            style={{
              fontSize: "10px",
              padding: "2px 7px",
              borderRadius: "4px",
              background: "color-mix(in srgb, var(--color-ink) 7%, transparent)",
              color: "var(--color-ink-soft)",
              fontWeight: 500,
              letterSpacing: "0.04em",
            }}
          >
            {count}
          </span>
        )}
      </h4>
      {children}
    </div>
  );
}

function EmptyMini({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: "14px 0",
        textAlign: "center",
        color: "var(--color-muted)",
        fontSize: "12px",
      }}
    >
      {label}
    </div>
  );
}

async function EmptyHero({
  locale,
  isBoardPlus,
}: {
  locale: string;
  isBoardPlus: boolean;
}) {
  const t = await getTranslations({ locale, namespace: "voting.empty" });
  return (
    <div
      style={{
        background: "var(--color-ink)",
        color: "var(--color-bg)",
        borderRadius: "18px",
        padding: "48px 32px",
        textAlign: "center",
        marginBottom: "20px",
      }}
    >
      <div
        className="grid place-items-center mx-auto"
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "color-mix(in srgb, var(--color-moss-2) 30%, transparent)",
          color: "var(--color-moss-2)",
          marginBottom: "16px",
        }}
      >
        <BallotIcon />
      </div>
      <h2
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "24px",
          fontWeight: 500,
          letterSpacing: "-0.025em",
          marginBottom: "10px",
        }}
      >
        {t("activeTitle")}
      </h2>
      <p
        style={{
          color: "color-mix(in srgb, var(--color-bg) 70%, transparent)",
          fontSize: "14px",
          maxWidth: "44ch",
          margin: "0 auto",
          lineHeight: 1.55,
        }}
      >
        {t("activeBody")}
      </p>
      {isBoardPlus && (
        <p
          className="font-mono"
          style={{
            marginTop: "18px",
            color: "color-mix(in srgb, var(--color-bg) 55%, transparent)",
            fontSize: "10px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {t("startVoteHint")}
        </p>
      )}
    </div>
  );
}

async function EmptyPast({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "voting.empty" });
  return (
    <div
      style={{
        background: "var(--color-card)",
        border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "12px",
        padding: "32px",
        textAlign: "center",
        color: "var(--color-muted)",
        fontSize: "13px",
      }}
    >
      {t("pastEmpty")}
    </div>
  );
}


function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function BallotIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 11H5a2 2 0 0 0-2 2v7h18v-7a2 2 0 0 0-2-2h-4" />
      <rect x="9" y="3" width="6" height="8" rx="1" />
    </svg>
  );
}

function RuleIcon({ kind }: { kind: "shield" | "chart" | "clock" | "doc" }) {
  const common = {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (kind === "shield")
    return (
      <svg {...common}>
        <path d="M12 2L4 7v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V7z" />
      </svg>
    );
  if (kind === "chart")
    return (
      <svg {...common}>
        <path d="M3 3v18h18" />
        <path d="M7 14l4-4 4 4 5-5" />
      </svg>
    );
  if (kind === "clock")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}
