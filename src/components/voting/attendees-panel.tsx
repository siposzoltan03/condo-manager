import { useTranslations } from "next-intl";
import { Users } from "lucide-react";
import type { MeetingAttendee } from "@/lib/dal";

interface AttendeesPanelProps {
  attendees: MeetingAttendee[];
}

interface StatusVisuals {
  dotColor: string;
  labelColor: string;
  i18nKey: string;
}

const STATUS_CONFIG: Record<string, StatusVisuals> = {
  ATTENDING: {
    dotColor: "var(--color-good)",
    labelColor: "var(--color-good)",
    i18nKey: "rsvpAttending",
  },
  NOT_ATTENDING: {
    dotColor: "var(--color-danger)",
    labelColor: "var(--color-danger)",
    i18nKey: "rsvpNotAttending",
  },
  PROXY: {
    dotColor: "var(--color-ochre)",
    labelColor:
      "color-mix(in srgb, var(--color-ochre) 75%, var(--color-ink))",
    i18nKey: "rsvpProxy",
  },
};

export function AttendeesPanel({ attendees }: AttendeesPanelProps) {
  const t = useTranslations("voting");

  const groups = Object.entries(STATUS_CONFIG)
    .map(([status, config]) => ({
      status,
      config,
      members: attendees.filter((a) => a.status === status),
    }))
    .filter((g) => g.members.length > 0);

  return (
    <div className="rounded-xl border border-ink/8 bg-card p-5">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted" />
          <h3 className="font-mono text-xs uppercase tracking-wider text-ink">
            {t("attendeesTitle")}
          </h3>
        </div>
        <p className="mt-1 ml-6 text-[11px] text-muted leading-snug">
          {t("attendeesSubtitle")}
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted">{t("noAttendees")}</p>
      ) : (
        <div className="space-y-4">
          {groups.map(({ status, config, members }) => (
            <div key={status}>
              <p
                className="mb-2 font-mono text-[10.5px] uppercase tracking-wider"
                style={{ color: config.labelColor }}
              >
                {t(config.i18nKey)} · {members.length}
              </p>
              <div className="space-y-1.5">
                {members.map((m) => (
                  <div key={m.userId} className="flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: config.dotColor }}
                    />
                    <span className="text-sm text-ink">{m.userName}</span>
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
