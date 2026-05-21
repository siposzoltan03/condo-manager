"use client";

import { useTranslations } from "next-intl";
import { Clock, MapPin, ChevronRight, Scale, ShieldCheck, BarChart3 } from "lucide-react";

interface VoteSummary {
  id: string;
  title: string;
  deadline: string;
}

interface MeetingSummary {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string | null;
  rsvpCounts: { attending: number; total: number };
}

interface Props {
  activeVotes: VoteSummary[];
  nextMeeting: MeetingSummary | null;
}

function MiniCountdown({ deadline }: { deadline: string }) {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0)
    return (
      <span className="font-mono text-xs" style={{ color: "var(--color-danger)" }}>
        Closed
      </span>
    );
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return (
    <span className="font-mono text-xs" style={{ color: "var(--color-danger)" }}>
      {days}d {hours}h
    </span>
  );
}

export function VoteSidebar({ activeVotes, nextMeeting }: Props) {
  const t = useTranslations("voting");

  return (
    <div className="space-y-4">
      {/* Other Open Polls */}
      {activeVotes.length > 1 && (
        <div className="rounded-xl border border-ink/8 bg-card p-4">
          <h3 className="mb-3 font-mono text-xs uppercase tracking-wider text-ink">
            {t("otherPolls")}
          </h3>
          <div className="space-y-2">
            {activeVotes.slice(0, 5).map((vote) => (
              <div
                key={vote.id}
                className="flex items-center justify-between rounded-lg border border-ink/8 p-3 transition-colors hover:bg-bg-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{vote.title}</p>
                  <div className="mt-0.5 flex items-center gap-1">
                    <Clock
                      className="h-3 w-3"
                      style={{ color: "var(--color-danger)" }}
                    />
                    <MiniCountdown deadline={vote.deadline} />
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Meeting */}
      {nextMeeting && (
        <div className="rounded-xl bg-ink p-5 text-bg">
          <p className="font-mono text-[10.5px] uppercase tracking-wider opacity-70">
            {t("nextMeeting")}
          </p>
          <p className="mt-2 font-display text-lg leading-tight">
            {new Date(nextMeeting.date).toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
          <p className="mt-1 font-mono text-sm opacity-80">{nextMeeting.time}</p>
          {nextMeeting.location && (
            <div className="mt-1 flex items-center gap-1.5 text-sm opacity-80">
              <MapPin className="h-3.5 w-3.5" />
              {nextMeeting.location}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button className="rounded-md bg-bg px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-ink transition-opacity hover:opacity-90">
              {t("rsvp")}
            </button>
            <button className="rounded-md border border-bg/25 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-bg transition-colors hover:bg-bg/10">
              {t("viewAgenda")}
            </button>
          </div>
        </div>
      )}

      {/* Voting Information */}
      <div className="rounded-xl bg-bg-3 p-4">
        <h3 className="mb-3 font-mono text-xs uppercase tracking-wider text-ink">
          {t("votingInfo")}
        </h3>
        <div className="space-y-2.5">
          <div className="flex items-start gap-2.5 text-xs text-ink-soft">
            <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
            {t("infoWeighted")}
          </div>
          <div className="flex items-start gap-2.5 text-xs text-ink-soft">
            <BarChart3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
            {t("infoQuorum")}
          </div>
          <div className="flex items-start gap-2.5 text-xs text-ink-soft">
            <BarChart3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
            {t("infoMajorityTypes")}
          </div>
          <div className="flex items-start gap-2.5 text-xs text-ink-soft">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
            {t("infoSecret")}
          </div>
        </div>
      </div>
    </div>
  );
}
