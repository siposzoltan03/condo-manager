"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { MapPin, Users, Calendar, ClipboardList, FileText, ArrowRight } from "lucide-react";
import { RsvpButton } from "./rsvp-button";
import { AgendaModal } from "./agenda-modal";

interface MeetingSummary {
  id: string;
  title: string;
  description: string | null;
  date: string;
  time: string;
  location: string | null;
  agenda?: unknown;
  hasMinutes?: boolean;
  rsvpCounts: { attending: number; notAttending: number; proxy: number; total: number };
  myRsvp: string | null;
  voteCount: number;
}

interface Props {
  meeting: MeetingSummary;
  onRsvpChanged: () => void;
}

const RSVP_STYLE: Record<string, React.CSSProperties> = {
  ATTENDING: {
    background: "color-mix(in srgb, var(--color-good) 18%, transparent)",
    color: "var(--color-good)",
  },
  NOT_ATTENDING: {
    background: "color-mix(in srgb, var(--color-danger) 16%, transparent)",
    color: "var(--color-danger)",
  },
  PROXY: {
    background: "color-mix(in srgb, var(--color-ochre) 22%, transparent)",
    color: "color-mix(in srgb, var(--color-ochre) 75%, var(--color-ink))",
  },
};

export function MeetingCard({ meeting, onRsvpChanged }: Props) {
  const t = useTranslations("voting");
  const [showAgenda, setShowAgenda] = useState(false);
  const meetingDate = new Date(meeting.date);
  const day = meetingDate.getDate();
  const month = meetingDate.toLocaleDateString(undefined, { month: "short" });
  const isPast = meetingDate < new Date();

  return (
    <div className="flex items-start gap-4 rounded-xl border border-ink/8 bg-card p-5">
      {/* Date badge */}
      <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-bg-3 text-ink">
        <span className="font-display text-2xl leading-none">{day}</span>
        <span className="mt-0.5 font-mono text-[10.5px] uppercase tracking-wider text-muted">
          {month}
        </span>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/voting/meetings/${meeting.id}`}
            className="font-display text-lg text-ink leading-tight hover:opacity-70 transition-opacity"
          >
            {meeting.title}
          </Link>
          {meeting.hasMinutes && (
            <span title={t("hasMinutes")}>
              <FileText className="h-4 w-4 text-muted shrink-0" />
            </span>
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted" />
            {meeting.time}
          </span>
          {meeting.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted" />
              {meeting.location}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 text-muted">
            <Users className="h-3.5 w-3.5" />
            {t("attendeeCount", {
              attending: meeting.rsvpCounts.attending,
              total: meeting.rsvpCounts.total,
            })}
          </span>
        </div>

        {meeting.description && (
          <p className="mt-2 text-sm text-ink-soft line-clamp-2">
            {meeting.description}
          </p>
        )}

        {/* Agenda button */}
        {Array.isArray(meeting.agenda) && meeting.agenda.length > 0 && (
          <button
            onClick={() => setShowAgenda(true)}
            className="mt-2 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-ink-soft hover:text-ink transition-colors"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            {t("viewAgenda")}
          </button>
        )}

        {/* RSVP status + View Details */}
        <div className="mt-3 flex items-center gap-3">
          {meeting.myRsvp && (
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider"
              style={RSVP_STYLE[meeting.myRsvp]}
            >
              {t(`rsvpStatus_${meeting.myRsvp}`)}
            </span>
          )}
          <Link
            href={`/voting/meetings/${meeting.id}`}
            className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-ink-soft hover:text-ink transition-colors"
          >
            {t("viewDetails")}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Actions */}
      {!isPast && (
        <div className="shrink-0">
          <RsvpButton
            meetingId={meeting.id}
            currentStatus={meeting.myRsvp}
            onChanged={onRsvpChanged}
          />
        </div>
      )}

      {showAgenda && (
        <AgendaModal
          meetingTitle={meeting.title}
          agenda={meeting.agenda}
          onClose={() => setShowAgenda(false)}
        />
      )}
    </div>
  );
}
