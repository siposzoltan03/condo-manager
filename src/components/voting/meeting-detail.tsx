"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Printer,
  ClipboardList,
  Vote,
  Calendar,
  MapPin,
  Clock,
} from "lucide-react";
import { AttendeesPanel } from "./attendees-panel";
import { VoteResultCard } from "./vote-result-card";
import { MinutesViewer } from "./minutes-viewer";
import { MinutesEditor } from "./minutes-editor";
import type { MeetingDetailData } from "@/lib/dal";

interface MeetingDetailProps {
  meeting: MeetingDetailData;
}

export function MeetingDetail({ meeting }: MeetingDetailProps) {
  const t = useTranslations("voting");
  const [activeTab, setActiveTab] = useState<"overview" | "minutes">("overview");

  const meetingDate = new Date(meeting.date);
  const day = meetingDate.getDate();
  const month = meetingDate.toLocaleDateString(undefined, { month: "short" });
  const fullDate = meetingDate.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const agendaItems = Array.isArray(meeting.agenda) ? meeting.agenda : [];

  const attendingCount = meeting.attendees.filter((a) => a.status === "ATTENDING").length;
  const notAttendingCount = meeting.attendees.filter((a) => a.status === "NOT_ATTENDING").length;
  const proxyCount = meeting.attendees.filter((a) => a.status === "PROXY").length;

  return (
    <div className="space-y-6">
      {/* Back + Print */}
      <div className="flex items-center justify-between no-print">
        <Link
          href="/voting"
          className="inline-flex items-center gap-1 text-sm font-medium text-[#515f74] hover:text-[#002045] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToMeetings")}
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg border border-[#c4c6cf]/40 bg-white px-4 py-2 text-sm font-medium text-[#515f74] hover:text-[#002045] hover:bg-[#f2f3ff] transition-colors"
        >
          <Printer className="h-4 w-4" />
          {t("printMeeting")}
        </button>
      </div>

      {/* Header */}
      <div className="flex items-start gap-5">
        <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-xl bg-[#002045] text-white">
          <span className="text-3xl font-extrabold leading-none">{day}</span>
          <span className="text-xs font-medium uppercase tracking-wider">{month}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-manrope text-2xl font-bold text-[#002045]">
            {meeting.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#515f74]">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {fullDate}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {meeting.time}
            </span>
            {meeting.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {meeting.location}
              </span>
            )}
            <span>{t("organizedBy", { name: meeting.createdBy.name })}</span>
          </div>

          {/* RSVP badges */}
          <div className="mt-3 flex flex-wrap gap-2">
            {attendingCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                {attendingCount} {t("rsvpAttending").toLowerCase()}
              </span>
            )}
            {notAttendingCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                {notAttendingCount} {t("rsvpNotAttending").toLowerCase()}
              </span>
            )}
            {proxyCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                {proxyCount} {t("rsvpProxy").toLowerCase()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-[#c4c6cf]/20 no-print">
        {(["overview", "minutes"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "border-b-2 border-[#002045] text-[#002045] font-bold"
                : "text-[#515f74] hover:text-[#002045]"
            }`}
          >
            {t(tab === "overview" ? "tabOverview" : "tabMinutes")}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Agenda + Votes */}
          <div className="lg:col-span-8 space-y-6">
            {/* Agenda */}
            <div className="rounded-xl bg-white p-5 shadow-sm border border-[#c4c6cf]/20">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardList className="h-4 w-4 text-[#002045]" />
                <h3 className="text-sm font-bold text-[#002045]">{t("agendaTitle")}</h3>
              </div>
              {agendaItems.length === 0 ? (
                <p className="text-sm text-[#515f74]">{t("noAgenda")}</p>
              ) : (
                <ol className="space-y-3">
                  {agendaItems.map((item: unknown, i: number) => {
                    const title = typeof item === "string" ? item : (item as Record<string, unknown>)?.title ?? `Item ${i + 1}`;
                    const desc = typeof item === "object" && item !== null ? (item as Record<string, unknown>)?.description : null;
                    return (
                      <li key={i} className="flex gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f2f3ff] text-xs font-bold text-[#002045]">
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-[#131b2e]">{String(title)}</p>
                          {typeof desc === "string" && <p className="text-xs text-[#515f74] mt-0.5">{desc}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            {/* Votes */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Vote className="h-4 w-4 text-[#002045]" />
                <h3 className="text-sm font-bold text-[#002045]">{t("votesInMeeting")}</h3>
              </div>
              {meeting.votes.length === 0 ? (
                <p className="text-sm text-[#515f74]">{t("noVotesInMeeting")}</p>
              ) : (
                <div className="space-y-4">
                  {meeting.votes.map((vote) => (
                    <VoteResultCard key={vote.id} vote={vote} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Attendees */}
          <div className="lg:col-span-4">
            <AttendeesPanel attendees={meeting.attendees} />
          </div>
        </div>
      )}

      {/* Minutes Tab */}
      {activeTab === "minutes" && (
        <div>
          {meeting.canEditMinutes ? (
            <MinutesEditor
              meetingId={meeting.id}
              initialMinutes={meeting.minutes}
              updatedAt={meeting.minutesUpdatedAt}
              updatedBy={meeting.minutesUpdatedBy}
            />
          ) : (
            <MinutesViewer
              minutes={meeting.minutes}
              updatedAt={meeting.minutesUpdatedAt}
              updatedBy={meeting.minutesUpdatedBy}
            />
          )}
        </div>
      )}
    </div>
  );
}
