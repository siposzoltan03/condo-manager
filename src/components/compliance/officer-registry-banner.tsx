"use client";

import Link from "next/link";
import { useState } from "react";
import { X } from "lucide-react";
import {
  shouldNagAboutRegistry,
  type RegistryStatus,
} from "@/lib/officer-registry";

interface Props {
  status: RegistryStatus;
  /** Locale prefix for the link target — typically passed from the
   *  current route segment. */
  locale: string;
  /** Localized copy. The caller threads next-intl strings through so the
   *  banner stays a pure render component. */
  copy: {
    /** Headline shown in the banner (e.g. "Officer registration due"). */
    title: string;
    /** Friendly description with the deadline / days left interpolated. */
    description: string;
    /** Call-to-action link label. */
    cta: string;
    /** Aria label for the dismiss button. */
    dismiss: string;
  };
}

/**
 * Phase 4 — Tht. § 55/A–D officer-registry deadline banner.
 *
 * Shown when the registration is `due-soon` (within 60 days) or
 * `overdue` (past the deadline). Dismissible per session via local
 * state, but reappears on next visit until the underlying state is
 * actually fixed (i.e. `representativeRegisteredAt` is set).
 *
 * Visibility gating (who sees it) is the caller's responsibility — pass
 * the status only when the viewer is BOARD_MEMBER + isChair or ADMIN.
 */
export function OfficerRegistryBanner({ status, locale, copy }: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || !shouldNagAboutRegistry(status)) return null;
  const isOverdue = status.kind === "overdue";
  return (
    <div
      role="alert"
      className="mb-4 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:gap-4"
      style={{
        background: isOverdue
          ? "color-mix(in srgb, var(--color-danger) 14%, transparent)"
          : "color-mix(in srgb, var(--color-ochre) 18%, transparent)",
        borderColor: isOverdue
          ? "color-mix(in srgb, var(--color-danger) 40%, transparent)"
          : "color-mix(in srgb, var(--color-ochre) 45%, transparent)",
      }}
    >
      <div className="min-w-0 flex-1">
        <p
          className="font-display"
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: isOverdue ? "var(--color-danger)" : "var(--color-ink)",
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
