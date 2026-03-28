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
  if (diff <= 0) return <span className="text-red-600">Closed</span>;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return (
    <span className="font-mono text-xs text-red-600">
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
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-semibold text-slate-900">
            {t("otherPolls")}
          </h3>
          <div className="space-y-2">
            {activeVotes.slice(0, 5).map((vote) => (
              <div
                key={vote.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-3 transition-colors hover:bg-slate-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {vote.title}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3 text-red-500" />
                    <MiniCountdown deadline={vote.deadline} />
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Meeting */}
      {nextMeeting && (
        <div className="rounded-xl bg-[#002045] p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
            {t("nextMeeting")}
          </p>
          <p className="mt-2 text-lg font-bold">
            {new Date(nextMeeting.date).toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
          <p className="mt-1 text-sm opacity-90">{nextMeeting.time}</p>
          {nextMeeting.location && (
            <div className="mt-1 flex items-center gap-1.5 text-sm opacity-80">
              <MapPin className="h-3.5 w-3.5" />
              {nextMeeting.location}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-[#002045] transition-colors hover:bg-white/90">
              {t("rsvp")}
            </button>
            <button className="rounded-lg border border-white/30 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/10">
              {t("viewAgenda")}
            </button>
          </div>
        </div>
      )}

      {/* Voting Information */}
      <div className="rounded-xl bg-slate-50 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">
          {t("votingInfo")}
        </h3>
        <div className="space-y-2.5">
          <div className="flex items-start gap-2.5 text-xs text-slate-600">
            <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            {t("infoWeighted")}
          </div>
          <div className="flex items-start gap-2.5 text-xs text-slate-600">
            <BarChart3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            {t("infoQuorum")}
          </div>
          <div className="flex items-start gap-2.5 text-xs text-slate-600">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            {t("infoSecret")}
          </div>
        </div>
      </div>
    </div>
  );
}
