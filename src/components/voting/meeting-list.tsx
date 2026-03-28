"use client";

import { useTranslations } from "next-intl";
import { MeetingCard } from "./meeting-card";

interface MeetingSummary {
  id: string;
  title: string;
  description: string | null;
  date: string;
  time: string;
  location: string | null;
  rsvpCounts: { attending: number; notAttending: number; proxy: number; total: number };
  myRsvp: string | null;
  voteCount: number;
  createdAt: string;
}

interface Props {
  meetings: MeetingSummary[];
  onRsvpChanged: () => void;
}

export function MeetingList({ meetings, onRsvpChanged }: Props) {
  const t = useTranslations("voting");

  if (meetings.length === 0) {
    return (
      <div className="flex min-h-[20vh] items-center justify-center rounded-xl bg-white p-8 shadow-sm">
        <p className="text-slate-500">{t("noMeetings")}</p>
      </div>
    );
  }

  const upcoming = meetings.filter((m) => new Date(m.date) >= new Date());
  const past = meetings.filter((m) => new Date(m.date) < new Date());

  return (
    <div className="space-y-6">
      {upcoming.length > 0 && (
        <div>
          <h2 className="mb-4 text-xl font-semibold text-[#002045]">
            {t("upcomingMeetings")}
          </h2>
          <div className="space-y-3">
            {upcoming.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                onRsvpChanged={onRsvpChanged}
              />
            ))}
          </div>
        </div>
      )}
      {past.length > 0 && (
        <div>
          <h2 className="mb-4 text-xl font-semibold text-[#002045]">
            {t("pastMeetings")}
          </h2>
          <div className="space-y-3">
            {past.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                onRsvpChanged={onRsvpChanged}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
