"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  deactivateAccount,
  submitBoardResignation,
  requestAccountDeletion,
} from "@/app/actions/profile";
import { useConfirm } from "@/components/shared/confirm-dialog";
import type { ProfileResignation } from "@/lib/profile-dal";

interface Props {
  isBoardMember: boolean;
  pendingResignation: ProfileResignation | null;
}

export function DangerZone({ isBoardMember, pendingResignation }: Props) {
  const t = useTranslations("profile.danger");
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<"deact" | "resign" | "delete" | null>(null);

  async function onDeactivate() {
    const ok = await confirm({ title: t("deactivateConfirm"), danger: true });
    if (!ok) return;
    setBusy("deact");
    try {
      const result = await deactivateAccount();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("deactivateDone"));
      // Sign out so the inactive user is forced off the app immediately.
      await signOut({ callbackUrl: "/login" });
    } finally {
      setBusy(null);
    }
  }

  async function onResign() {
    if (pendingResignation) {
      toast.info(t("resignAlreadyPending"));
      return;
    }
    const reason = prompt(t("resignPrompt")) ?? undefined;
    if (reason === null) return; // user cancelled
    setBusy("resign");
    try {
      const result = await submitBoardResignation({
        reason: reason || undefined,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("resignDone"));
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function onDelete() {
    const first = await confirm({ title: t("deleteConfirm"), danger: true });
    if (!first) return;
    const second = await confirm({
      title: t("deleteSecondConfirm"),
      danger: true,
    });
    if (!second) return;
    setBusy("delete");
    try {
      const result = await requestAccountDeletion();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("deleteDone"));
      await signOut({ callbackUrl: "/login" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      style={{
        background: "color-mix(in srgb, var(--color-danger) 5%, var(--color-card))",
        border: "1px solid var(--color-danger-soft)",
        borderRadius: "14px",
        padding: "20px 24px",
        marginTop: "18px",
      }}
    >
      <h2
        style={{
          color: "var(--color-danger)",
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "16px",
          fontWeight: 600,
          marginBottom: "12px",
        }}
      >
        {t("title")}
      </h2>
      <DangerRow
        title={t("deactivateTitle")}
        desc={t("deactivateDesc")}
        cta={busy === "deact" ? t("deactivating") : t("deactivateCta")}
        onClick={onDeactivate}
        disabled={busy !== null}
      />
      {isBoardMember && (
        <DangerRow
          title={
            pendingResignation
              ? t("resignPendingTitle")
              : t("resignTitle")
          }
          desc={
            pendingResignation && pendingResignation.meetingDate
              ? t("resignPendingDesc", {
                  date: new Date(
                    pendingResignation.meetingDate,
                  ).toLocaleDateString("hu-HU"),
                })
              : pendingResignation
                ? t("resignPendingDescNoMeeting")
                : t("resignDesc")
          }
          cta={
            pendingResignation
              ? t("resignPendingCta")
              : busy === "resign"
                ? t("resigning")
                : t("resignCta")
          }
          onClick={onResign}
          disabled={busy !== null || !!pendingResignation}
        />
      )}
      <DangerRow
        title={t("deleteTitle")}
        desc={t("deleteDesc")}
        cta={busy === "delete" ? t("deleting") : t("deleteCta")}
        onClick={onDelete}
        disabled={busy !== null}
      />
    </div>
  );
}

function DangerRow({
  title,
  desc,
  cta,
  onClick,
  disabled,
}: {
  title: string;
  desc: string;
  cta: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="flex justify-between items-center gap-4"
      style={{
        padding: "12px 0",
        borderTop:
          "1px solid color-mix(in srgb, var(--color-danger) 12%, transparent)",
      }}
    >
      <div>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--color-ink)",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: "12px",
            color: "var(--color-muted)",
            marginTop: "2px",
            maxWidth: "62ch",
            lineHeight: 1.45,
          }}
        >
          {desc}
        </div>
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="transition-opacity hover:opacity-80 disabled:opacity-50"
        style={{
          padding: "8px 14px",
          fontSize: "12px",
          fontWeight: 600,
          borderRadius: "8px",
          background: "var(--color-card)",
          color: "var(--color-danger)",
          border: "1px solid var(--color-danger-soft)",
          cursor: disabled ? "not-allowed" : "pointer",
          flexShrink: 0,
        }}
      >
        {cta}
      </button>
    </div>
  );
}
