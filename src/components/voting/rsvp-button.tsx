"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, X, UserPlus } from "lucide-react";

interface Props {
  meetingId: string;
  currentStatus: string | null;
  onChanged: () => void;
}

const OPTION_STYLE: Record<"good" | "danger" | "ochre", React.CSSProperties> = {
  good: {
    background: "color-mix(in srgb, var(--color-good) 14%, transparent)",
    color: "var(--color-good)",
  },
  danger: {
    background: "color-mix(in srgb, var(--color-danger) 14%, transparent)",
    color: "var(--color-danger)",
  },
  ochre: {
    background: "color-mix(in srgb, var(--color-ochre) 22%, transparent)",
    color: "color-mix(in srgb, var(--color-ochre) 75%, var(--color-ink))",
  },
};

export function RsvpButton({ meetingId, currentStatus, onChanged }: Props) {
  const t = useTranslations("voting");
  const [loading, setLoading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  async function handleRsvp(status: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/voting/meetings/${meetingId}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success(t("rsvpUpdated"));
        onChanged();
      }
    } catch {
      toast.error(t("somethingWentWrong"));
    } finally {
      setLoading(false);
      setShowOptions(false);
    }
  }

  if (showOptions) {
    return (
      <div className="flex flex-col gap-1">
        <button
          onClick={() => handleRsvp("ATTENDING")}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-opacity hover:opacity-80 disabled:opacity-50"
          style={OPTION_STYLE.good}
        >
          <Check className="h-3.5 w-3.5" />
          {t("rsvpAttending")}
        </button>
        <button
          onClick={() => handleRsvp("NOT_ATTENDING")}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-opacity hover:opacity-80 disabled:opacity-50"
          style={OPTION_STYLE.danger}
        >
          <X className="h-3.5 w-3.5" />
          {t("rsvpNotAttending")}
        </button>
        <button
          onClick={() => handleRsvp("PROXY")}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-opacity hover:opacity-80 disabled:opacity-50"
          style={OPTION_STYLE.ochre}
        >
          <UserPlus className="h-3.5 w-3.5" />
          {t("rsvpProxy")}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowOptions(true)}
      className="rounded-md bg-ink px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-bg hover:opacity-90 transition-opacity"
    >
      {currentStatus ? t("changeRsvp") : t("rsvp")}
    </button>
  );
}
