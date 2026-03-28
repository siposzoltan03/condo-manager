"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, X, UserPlus } from "lucide-react";

interface Props {
  meetingId: string;
  currentStatus: string | null;
  onChanged: () => void;
}

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
        onChanged();
      }
    } catch {
      // silent
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
          className="flex items-center gap-1.5 rounded-md bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          {t("rsvpAttending")}
        </button>
        <button
          onClick={() => handleRsvp("NOT_ATTENDING")}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
          {t("rsvpNotAttending")}
        </button>
        <button
          onClick={() => handleRsvp("PROXY")}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
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
      className="rounded-md bg-[#002045] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#002045]/90"
    >
      {currentStatus ? t("changeRsvp") : t("rsvp")}
    </button>
  );
}
