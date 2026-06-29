import type { Metadata } from "next";
import Link from "next/link";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getDashboardContext } from "@/lib/dal";
import { allows } from "@/lib/authz";
import {
  getVotingOverview,
  getMeetingList,
  getPendingResignations,
  getPendingAgendaInbox,
} from "@/lib/voting-dal";
import type { MeetingListItem } from "@/lib/voting-dal";
import { VotingShell } from "@/components/voting/voting-shell";
import { VotingHeaderActions } from "@/components/voting/voting-header-actions";
import { PendingResignationsCard } from "@/components/voting/pending-resignations-card";
import { PendingAgendaInbox } from "@/components/voting/pending-agenda-inbox";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "voting.shell" });
  return { title: `${t("title")} · ${t("tab.meetings")}` };
}

export default async function VotingMeetingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getDashboardContext();
  const [overview, list, resignations, pendingInbox] = await Promise.all([
    getVotingOverview(),
    getMeetingList(),
    getPendingResignations(),
    getPendingAgendaInbox(),
  ]);
  const t = await getTranslations({ locale, namespace: "voting" });
  const isBoardPlus = allows(ctx, "vote.start");

  return (
    <VotingShell
      locale={locale}
      active="meetings"
      counts={{
        active: overview.totalOpenCount,
        meetings: list.totalCount,
        history: overview.totalHistoryCount,
      }}
      titleKey="voting.meetings.title"
      ledeKey="voting.meetings.lede"
      headerActions={isBoardPlus ? <VotingHeaderActions canCreate /> : null}
    >
      {pendingInbox.isBoardPlus && pendingInbox.items.length > 0 && (
        <PendingAgendaInbox
          locale={locale}
          items={pendingInbox.items}
          nextMeeting={pendingInbox.nextMeeting}
        />
      )}

      {resignations.isBoardPlus && resignations.items.length > 0 && (
        <PendingResignationsCard items={resignations.items} />
      )}

      {list.upcoming.length === 0 && list.past.length === 0 ? (
        <EmptyState locale={locale} isBoardPlus={isBoardPlus} />
      ) : (
        <>
          {list.upcoming.length > 0 && (
            <Section
              eyebrow={t("meetings.upcomingEyebrow", {
                count: list.upcoming.length.toString(),
              })}
              title={t("meetings.upcomingTitle")}
            >
              <div className="grid gap-3.5 md:grid-cols-2">
                {list.upcoming.map((m, idx) => (
                  <MeetingCard
                    key={m.id}
                    meeting={m}
                    locale={locale}
                    featured={idx === 0}
                  />
                ))}
              </div>
            </Section>
          )}

          {list.past.length > 0 && (
            <Section
              eyebrow={t("meetings.pastEyebrow", {
                count: list.past.length.toString(),
              })}
              title={t("meetings.pastTitle")}
            >
              <div className="grid gap-3.5 md:grid-cols-2">
                {list.past.map((m) => (
                  <MeetingCard key={m.id} meeting={m} locale={locale} past />
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </VotingShell>
  );
}

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: "32px" }}>
      <div style={{ marginBottom: "14px" }}>
        <span
          className="font-mono"
          style={{
            fontSize: "10px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--color-muted)",
          }}
        >
          {eyebrow}
        </span>
        <h2
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "22px",
            fontWeight: 500,
            letterSpacing: "-0.025em",
            marginTop: "4px",
          }}
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

async function MeetingCard({
  meeting,
  locale,
  featured = false,
  past = false,
}: {
  meeting: MeetingListItem;
  locale: string;
  featured?: boolean;
  past?: boolean;
}) {
  const t = await getTranslations({ locale, namespace: "voting" });

  const dt = new Date(meeting.startsAt);
  const dateLabel = dt.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  const time = dt.toLocaleTimeString("hu-HU", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const totalRsvps = meeting.attending + meeting.notAttending + meeting.proxy;
  const dark = featured && !past;

  return (
    <Link
      href={`/${locale}/voting/meetings/${meeting.id}`}
      className="block transition-shadow hover:shadow-lg"
      style={{
        background: dark ? "var(--color-ink)" : "var(--color-card)",
        color: dark ? "var(--color-bg)" : "var(--color-ink)",
        border: dark
          ? "1px solid var(--color-ink)"
          : "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "14px",
        padding: "20px",
        textDecoration: "none",
        opacity: past ? 0.92 : 1,
      }}
    >
      <div className="flex justify-between items-start gap-3" style={{ marginBottom: "10px" }}>
        <span
          className="font-mono"
          style={{
            fontSize: "10px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: dark
              ? "color-mix(in srgb, var(--color-bg) 55%, transparent)"
              : "var(--color-muted)",
          }}
        >
          {past
            ? t("meetings.statusPast")
            : meeting.isRepeated
              ? t("meetings.statusRepeated")
              : t("meetings.statusUpcoming")}
        </span>
        <RsvpBadge status={meeting.myRsvp} dark={dark} t={t} />
      </div>
      <h3
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: featured ? "22px" : "18px",
          fontWeight: 600,
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
          marginBottom: "10px",
        }}
      >
        {meeting.title}
      </h3>
      <div
        className="flex flex-wrap gap-x-4 gap-y-1.5"
        style={{ fontSize: "12.5px", color: dark ? "color-mix(in srgb, var(--color-bg) 75%, transparent)" : "var(--color-ink-soft)" }}
      >
        <span className="inline-flex items-center gap-1.5">
          <CalendarMiniIcon /> {dateLabel} · {time}
        </span>
        {meeting.location && (
          <span className="inline-flex items-center gap-1.5">
            <PinMiniIcon /> {meeting.location}
          </span>
        )}
      </div>

      {/* eslint-disable-next-line responsive/mobile-first -- compact 3-stat panel: short numeric values fit ~110px tiles at 360px */}
      <div
        className="grid grid-cols-3 gap-3 font-mono"
        style={{
          marginTop: "16px",
          paddingTop: "14px",
          borderTop: dark
            ? "1px solid color-mix(in srgb, var(--color-bg) 15%, transparent)"
            : "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
          fontSize: "10px",
          letterSpacing: "0.04em",
          color: dark ? "color-mix(in srgb, var(--color-bg) 65%, transparent)" : "var(--color-muted)",
          textTransform: "uppercase",
        }}
      >
        <Stat
          label={t("meetings.statAttending")}
          value={`${meeting.attending}`}
          tone={dark ? "bg" : "ink"}
        />
        <Stat
          label={t("meetings.statRsvps")}
          value={`${totalRsvps} / ${meeting.totalUnits}`}
          tone={dark ? "bg" : "ink"}
        />
        <Stat
          label={t("meetings.statVotes")}
          value={`${meeting.voteCount}`}
          tone={dark ? "bg" : "ink"}
        />
      </div>

      {(meeting.agendaCount > 0 || meeting.hasMinutes) && (
        <div
          className="flex flex-wrap gap-1.5"
          style={{ marginTop: "12px" }}
        >
          {meeting.agendaCount > 0 && (
            <Pill dark={dark}>
              {t("meetings.agendaItems", { n: meeting.agendaCount.toString() })}
            </Pill>
          )}
          {meeting.hasMinutes && (
            <Pill dark={dark}>{t("meetings.hasMinutesPill")}</Pill>
          )}
        </div>
      )}
    </Link>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ink" | "bg";
}) {
  return (
    <div>
      <div>{label}</div>
      <div
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "16px",
          fontWeight: 600,
          color: tone === "bg" ? "var(--color-bg)" : "var(--color-ink)",
          marginTop: "2px",
          letterSpacing: "-0.01em",
          textTransform: "none",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Pill({ children, dark }: { children: React.ReactNode; dark: boolean }) {
  return (
    <span
      className="font-mono"
      style={{
        fontSize: "10px",
        padding: "3px 8px",
        borderRadius: "4px",
        background: dark
          ? "color-mix(in srgb, var(--color-bg) 12%, transparent)"
          : "color-mix(in srgb, var(--color-ink) 7%, transparent)",
        color: dark
          ? "color-mix(in srgb, var(--color-bg) 80%, transparent)"
          : "var(--color-ink-soft)",
        letterSpacing: "0.04em",
        fontWeight: 500,
      }}
    >
      {children}
    </span>
  );
}

function RsvpBadge({
  status,
  dark,
  t,
}: {
  status: MeetingListItem["myRsvp"];
  dark: boolean;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  if (!status) return null;
  const tone =
    status === "ATTENDING"
      ? { bg: "var(--color-good-soft)", color: "var(--color-good)" }
      : status === "PROXY"
        ? {
            bg: "color-mix(in srgb, var(--color-ochre) 22%, transparent)",
            color:
              "color-mix(in srgb, var(--color-ochre) 80%, var(--color-ink))",
          }
        : {
            bg: "color-mix(in srgb, var(--color-ink) 8%, transparent)",
            color: "var(--color-muted)",
          };
  // For dark cards, force a light surface so the pill stays readable.
  const bg = dark ? tone.bg : tone.bg;
  return (
    <span
      className="font-mono"
      style={{
        fontSize: "10px",
        padding: "3px 8px",
        borderRadius: "4px",
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        background: bg,
        color: tone.color,
      }}
    >
      {t(`rsvpStatus_${status}`)}
    </span>
  );
}

async function EmptyState({
  locale,
  isBoardPlus,
}: {
  locale: string;
  isBoardPlus: boolean;
}) {
  const t = await getTranslations({ locale, namespace: "voting.meetings" });
  return (
    <div
      style={{
        background: "var(--color-card)",
        border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "14px",
        padding: "64px 32px",
        textAlign: "center",
      }}
    >
      <div
        className="grid place-items-center mx-auto"
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "color-mix(in srgb, var(--color-ochre) 22%, transparent)",
          color: "color-mix(in srgb, var(--color-ochre) 80%, var(--color-ink))",
          marginBottom: "18px",
        }}
      >
        <CalendarMiniIcon size={22} />
      </div>
      <h2
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "22px",
          fontWeight: 500,
          letterSpacing: "-0.025em",
          marginBottom: "8px",
        }}
      >
        {t("emptyTitle")}
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
        {isBoardPlus ? t("emptyBodyBoard") : t("emptyBodyMember")}
      </p>
    </div>
  );
}

function CalendarMiniIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function PinMiniIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
