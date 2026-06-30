"use client";

import Link from "next/link";
import { useState } from "react";
import { X } from "lucide-react";

interface Props {
  /** True when the building requires a committee (computed from totalUnits). */
  requiresAuditCommittee: boolean;
  /** True when at least one active AuditorMembership row exists. Stubbed
   *  as false until Phase 2 lands the model. */
  hasActiveCommittee: boolean;
  locale: string;
  copy: {
    title: string;
    description: string;
    cta: string;
    dismiss: string;
  };
}

/**
 * Phase 4 — Tht. § 27(3) audit-committee mandate banner.
 *
 * Shown when totalUnits > 25 and there is no active committee.
 * `hasActiveCommittee` is wired to AuditorMembership in Phase 2; until
 * then callers pass `false` and the banner always fires for buildings
 * over the threshold. That's correct: the building does need a
 * committee, regardless of whether we have a UI to track its members.
 *
 * Visibility gating (who sees it) is the caller's responsibility.
 * Shown to BOARD_MEMBER + isChair and ADMIN.
 */
export function AuditCommitteeRequiredBanner({
  requiresAuditCommittee,
  hasActiveCommittee,
  locale,
  copy,
}: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  if (!requiresAuditCommittee || hasActiveCommittee) return null;
  return (
    <div
      role="alert"
      className="mb-4 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:gap-4"
      style={{
        background: "color-mix(in srgb, var(--color-blue) 14%, transparent)",
        borderColor: "color-mix(in srgb, var(--color-blue) 40%, transparent)",
      }}
    >
      <div className="min-w-0 flex-1">
        <p
          className="font-display"
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--color-ink)",
            letterSpacing: "-0.005em",
          }}
        >
          {copy.title}
        </p>
        <p
          className="mt-1"
          style={{ fontSize: "13px", color: "var(--color-ink-soft)" }}
        >
          {copy.description}
        </p>
      </div>
      <Link
        href={`/${locale}/admin/officer-registry`}
        className="inline-flex min-h-11 items-center self-start rounded-md px-4 font-mono text-[11px] uppercase tracking-wider sm:min-h-0 sm:self-auto"
        style={{
          background: "var(--color-ink)",
          color: "var(--color-bg)",
          padding: "8px 14px",
        }}
      >
        {copy.cta}
      </Link>
      <button
        type="button"
        aria-label={copy.dismiss}
        onClick={() => setDismissed(true)}
        className="inline-flex h-11 w-11 items-center justify-center self-end rounded-md text-muted transition-colors hover:bg-bg-3 sm:h-9 sm:w-9 sm:self-auto"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
