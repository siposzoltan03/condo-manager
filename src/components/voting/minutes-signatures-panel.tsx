"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, FileSignature, ShieldCheck } from "lucide-react";
import {
  signMeetingMinutes,
  type MinutesSignatureRoleInput,
} from "@/app/actions/voting";
import type { MeetingMinutesSignatureData } from "@/lib/dal";

interface Props {
  meetingId: string;
  signatures: MeetingMinutesSignatureData[];
  /** Board-and-up; only board members can sign. */
  canSign: boolean;
  /** Used to detect "I already signed in another role". */
  currentUserId: string;
}

const ROLES: { key: MinutesSignatureRoleInput; labelKey: string }[] = [
  { key: "CHAIR", labelKey: "minutesSignChair" },
  { key: "AUTHENTICATOR_1", labelKey: "minutesSignAuth1" },
  { key: "AUTHENTICATOR_2", labelKey: "minutesSignAuth2" },
];

function formatSignedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MinutesSignaturesPanel({
  meetingId,
  signatures,
  canSign,
  currentUserId,
}: Props) {
  const t = useTranslations("voting");
  const router = useRouter();
  const [pendingRole, setPendingRole] = useState<MinutesSignatureRoleInput | null>(
    null,
  );

  const byRole = new Map(signatures.map((s) => [s.role, s]));
  const filledCount = byRole.size;
  const isExecuted = filledCount === 3;
  const userAlreadySigned = signatures.some(
    (s) => s.signerId === currentUserId,
  );

  async function handleSign(role: MinutesSignatureRoleInput) {
    setPendingRole(role);
    try {
      const result = await signMeetingMinutes(meetingId, role);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("minutesSigned"));
        router.refresh();
      }
    } catch {
      toast.error(t("somethingWentWrong"));
    } finally {
      setPendingRole(null);
    }
  }

  return (
    <div className="rounded-xl border border-ink/8 bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSignature className="h-4 w-4 text-muted" />
          <h3 className="font-mono text-xs uppercase tracking-wider text-ink">
            {t("minutesSignaturesTitle")}
          </h3>
        </div>
        {isExecuted ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 font-mono text-[10.5px] uppercase tracking-wider"
            style={{
              background:
                "color-mix(in srgb, var(--color-good) 20%, transparent)",
              color: "var(--color-good)",
            }}
          >
            <ShieldCheck className="h-3 w-3" />
            {t("minutesExecuted")}
          </span>
        ) : (
          <span className="font-mono text-[11px] text-muted">
            {filledCount}/3
          </span>
        )}
      </div>

      <div className="space-y-2">
        {ROLES.map(({ key, labelKey }) => {
          const sig = byRole.get(key);
          const isPending = pendingRole === key;
          return (
            <div
              key={key}
              className="flex items-center justify-between gap-3 rounded-lg border border-ink/8 bg-card px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10.5px] uppercase tracking-wider text-muted">
                  {t(labelKey)}
                </p>
                {sig ? (
                  <div className="mt-0.5 flex items-baseline gap-2">
                    <span className="text-sm text-ink truncate">
                      {sig.signerName}
                    </span>
                    <span className="font-mono text-[11px] text-muted">
                      {formatSignedAt(sig.signedAt)}
                    </span>
                  </div>
                ) : (
                  <p className="mt-0.5 text-sm text-muted">
                    {t("minutesAwaitingSignature")}
                  </p>
                )}
              </div>
              {sig ? (
                <CheckCircle2
                  className="h-4 w-4"
                  style={{ color: "var(--color-good)" }}
                />
              ) : canSign && !userAlreadySigned ? (
                <button
                  type="button"
                  onClick={() => handleSign(key)}
                  disabled={isPending}
                  className="rounded-md bg-ink px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-bg hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isPending ? t("signing") : t("sign")}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {!canSign && !isExecuted && (
        <p className="mt-3 text-xs text-muted">{t("minutesSignBoardOnly")}</p>
      )}
      {canSign && userAlreadySigned && !isExecuted && (
        <p className="mt-3 text-xs text-muted">{t("minutesAlreadySignedHint")}</p>
      )}
    </div>
  );
}
