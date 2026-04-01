import { useTranslations } from "next-intl";
import { Users } from "lucide-react";
import type { MeetingAttendee } from "@/lib/dal";

interface AttendeesPanelProps {
  attendees: MeetingAttendee[];
}

const STATUS_CONFIG: Record<string, { color: string; dot: string; key: string }> = {
  ATTENDING: { color: "text-emerald-700", dot: "bg-emerald-500", key: "rsvpAttending" },
  NOT_ATTENDING: { color: "text-red-700", dot: "bg-red-500", key: "rsvpNotAttending" },
  PROXY: { color: "text-amber-700", dot: "bg-amber-500", key: "rsvpProxy" },
};

export function AttendeesPanel({ attendees }: AttendeesPanelProps) {
  const t = useTranslations("voting");

  const groups = Object.entries(STATUS_CONFIG).map(([status, config]) => ({
    status,
    config,
    members: attendees.filter((a) => a.status === status),
  })).filter((g) => g.members.length > 0);

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm border border-[#c4c6cf]/20">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-4 w-4 text-[#002045]" />
        <h3 className="text-sm font-bold text-[#002045]">{t("attendeesTitle")}</h3>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-[#515f74]">{t("noAttendees")}</p>
      ) : (
        <div className="space-y-4">
          {groups.map(({ status, config, members }) => (
            <div key={status}>
              <p className={`text-xs font-bold uppercase tracking-wider ${config.color} mb-2`}>
                {t(config.key)} ({members.length})
              </p>
              <div className="space-y-1.5">
                {members.map((m) => (
                  <div key={m.userId} className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${config.dot}`} />
                    <span className="text-sm text-[#131b2e]">{m.userName}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
