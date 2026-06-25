"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CreateVoteModal } from "./create-vote-modal";
import { CreateMeetingModal } from "./create-meeting-modal";

interface Props {
  /** When true, both buttons are enabled. When false (member view), neither is. */
  canCreate: boolean;
}

/**
 * Client wrapper for the voting page-header actions: opens Create Vote and
 * Create Meeting modals on a server-rendered VotingShell.
 */
export function VotingHeaderActions({ canCreate }: Props) {
  const t = useTranslations("voting");
  const router = useRouter();
  const [voteOpen, setVoteOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);

  if (!canCreate) return null;

  return (
    <>
      <Button
        variant="ghost"
        icon={<CalendarIcon />}
        onClick={() => setMeetingOpen(true)}
      >
        {t("actions.callMeeting")}
      </Button>
      <Button
        variant="primary"
        icon={<PlusIcon />}
        onClick={() => setVoteOpen(true)}
      >
        {t("actions.newVote")}
      </Button>

      <CreateVoteModal
        open={voteOpen}
        onClose={() => setVoteOpen(false)}
        onCreated={() => {
          setVoteOpen(false);
          router.refresh();
        }}
      />
      <CreateMeetingModal
        open={meetingOpen}
        onClose={() => setMeetingOpen(false)}
        onCreated={() => {
          setMeetingOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}

function Button({
  variant,
  icon,
  onClick,
  children,
}: {
  variant: "ghost" | "primary";
  icon: React.ReactNode;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const styles = {
    ghost: {
      background: "var(--color-card)",
      color: "var(--color-ink)",
      border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
    },
    primary: {
      background: "var(--color-ink)",
      color: "var(--color-bg)",
      border: "1px solid var(--color-ink)",
    },
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 transition-opacity hover:opacity-90"
      style={{
        padding: "9px 14px",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: 600,
        cursor: "pointer",
        ...styles,
      }}
    >
      {icon}
      {children}
    </button>
  );
}

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
