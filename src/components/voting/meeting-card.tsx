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

export function MeetingCard({ meeting, onRsvpChanged }: Props) {
  const t = useTranslations("voting");
  const [showAgenda, setShowAgenda] = useState(false);
  const meetingDate = new Date(meeting.date);
  const day = meetingDate.getDate();
  const month = meetingDate.toLocaleDateString(undefined, { month: "short" });
  const isPast = meetingDate < new Date();

  return (
    <div className="flex items-start gap-4 rounded-xl bg-white p-5 shadow-sm">
      {/* Date badge */}
      <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-[#002045]/10 text-[#002045]">
        <span className="text-2xl font-bold leading-none">{day}</span>
        <span className="text-xs font-medium uppercase">{month}</span>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/voting/meetings/${meeting.id}`}
            className="text-lg font-semibold text-slate-900 hover:text-[#002045] transition-colors"
          >
            {meeting.title}
          </Link>
          {meeting.hasMinutes && (
            <span title={t("hasMinutes")}><FileText className="h-4 w-4 text-[#515f74] shrink-0" /></span>
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {meeting.time}
          </div>
          {meeting.location && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {meeting.location}
            </div>
          )}
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {t("attendeeCount", {
              attending: meeting.rsvpCounts.attending,
              total: meeting.rsvpCounts.total,
            })}
          </div>
        </div>

        {meeting.description && (
          <p className="mt-2 text-sm text-slate-600 line-clamp-2">
            {meeting.description}
          </p>
        )}

        {/* Agenda button */}
        {Array.isArray(meeting.agenda) && meeting.agenda.length > 0 && (
          <button
            onClick={() => setShowAgenda(true)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#002045] hover:underline"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            {t("viewAgenda")}
          </button>
        )}

        {/* RSVP status badge + View Details */}
        <div className="mt-2 flex items-center gap-3">
          {meeting.myRsvp && (
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                meeting.myRsvp === "ATTENDING"
                  ? "bg-green-100 text-green-800"
                  : meeting.myRsvp === "NOT_ATTENDING"
                  ? "bg-red-100 text-red-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {t(`rsvpStatus_${meeting.myRsvp}`)}
            </span>
          )}
          <Link
            href={`/voting/meetings/${meeting.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#002045] hover:underline"
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
