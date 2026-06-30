"use client";

import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";
import type { MeetingMinutesSignatureData } from "@/lib/dal";

const ROLES: { key: MeetingMinutesSignatureData["role"]; labelKey: string }[] = [
  { key: "CHAIR", labelKey: "minutesSignChair" },
  { key: "AUTHENTICATOR_1", labelKey: "minutesSignAuth1" },
  { key: "AUTHENTICATOR_2", labelKey: "minutesSignAuth2" },
];

/**
 * Read-only signature footer for the on-screen jegyzőkönyv — mirrors the three
 * authentication slots of the minutes PDF so the document on screen reflects
 * who has signed. Signing itself happens in MinutesSignaturesPanel.
 */
export function MinutesSignatureBlock({
  signatures,
}: {
  signatures: MeetingMinutesSignatureData[];
}) {
  const t = useTranslations("voting");
  const byRole = new Map(signatures.map((s) => [s.role, s]));
  const executed = byRole.size === 3;

  return (
    <div className="rounded-xl border border-ink/8 bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-mono text-xs uppercase tracking-wider text-ink">
          {t("minutesSignatureDocTitle")}
        </h3>
        {executed && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 font-mono text-[10.5px] uppercase tracking-wider"
            style={{
              background: "color-mix(in srgb, var(--color-good) 20%, transparent)",
              color: "var(--color-good)",
            }}
          >
            <ShieldCheck className="h-3 w-3" />
            {t("minutesExecuted")}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {ROLES.map(({ key, labelKey }) => {
          const sig = byRole.get(key);
          return (
            <div key={key} className="text-center">
              <div
                className="flex h-12 items-end justify-center pb-1 font-display text-lg"
                style={{ color: sig ? "var(--color-ink)" : "var(--color-muted)" }}
              >
                {sig ? sig.signerName : ""}
              </div>
              <div className="border-t border-ink/25" />
              <p className="mt-1.5 font-mono text-[10.5px] uppercase tracking-wider text-muted">
                {t(labelKey)}
              </p>
              <p className="mt-0.5 text-[11px] text-ink-soft">
                {sig
                  ? new Date(sig.signedAt).toLocaleDateString("hu-HU", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : t("minutesAwaitingSignature")}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
