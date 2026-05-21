"use client";

import { AlertTriangle } from "lucide-react";

interface Props {
  /** The building's current disclosure mode (read from Building row). */
  mode: "INTERNAL_ONLY" | "CLOSED_DELIVERY";
  /** Localized copy. Pass next-intl strings so the component stays
   *  presentational. */
  copy: {
    /** Headline shown in the warning (e.g. "Owner names not for public posting"). */
    title: string;
    /** Description of which surfaces are blocked. */
    description: string;
  };
}

/**
 * Phase 5 — NAIH-compliant arrears disclosure warning.
 *
 * Mounted on any surface that aggregates arrears + owner names where
 * the user could plausibly export, print, or post the result publicly.
 * The component itself doesn't block anything — that's the responsibility
 * of the export/print path (it must check `mode === "INTERNAL_ONLY"` and
 * refuse to render names + amounts in a publicly distributable format).
 * This warning sits above the table as a visible reminder.
 *
 * NAIH explicitly forbids public posting of arrears + names; no PUBLIC
 * disclosure mode exists.
 */
export function ArrearsDisclosureWarning({ mode, copy }: Props) {
  return (
    <div
      role="note"
      className="mb-4 flex items-start gap-3 rounded-xl border p-4"
      style={{
        background: "color-mix(in srgb, var(--color-ochre) 14%, transparent)",
        borderColor: "color-mix(in srgb, var(--color-ochre) 45%, transparent)",
      }}
    >
      <AlertTriangle
        className="mt-0.5 h-5 w-5 shrink-0"
        style={{ color: "var(--color-ochre)" }}
      />
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
        <p
          className="mt-2 font-mono"
          style={{ fontSize: "10.5px", color: "var(--color-muted)", letterSpacing: "0.04em" }}
        >
          MODE · {mode === "INTERNAL_ONLY" ? "INTERNAL_ONLY" : "CLOSED_DELIVERY"}
        </p>
      </div>
    </div>
  );
}
