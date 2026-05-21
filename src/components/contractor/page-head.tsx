"use client";

import type { ReactNode } from "react";

/**
 * Shared `page-head` block used by every authenticated contractor page.
 *   • eyebrow with optional moss `pulse` dot
 *   • Space Grotesk h1 (44px, -0.035em tracking)
 *   • description paragraph capped at 56ch
 *   • optional `hd-acts` cluster, right-aligned (wraps under on narrow)
 *
 * Mirrors the design's `.page-head` + `.eyebrow` + `.eyebrow .pulse`
 * pattern exactly.
 */
export function PageHead({
  eyebrow,
  pulse = false,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  pulse?: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div
      className="flex items-end justify-between gap-8 flex-wrap"
      style={{ marginBottom: "28px" }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          className="font-mono inline-flex items-center"
          style={{
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--color-muted)",
            marginBottom: "14px",
            gap: "10px",
          }}
        >
          {pulse && <PulseDot />}
          {eyebrow}
        </div>
        <h1
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "44px",
            fontWeight: 500,
            letterSpacing: "-0.035em",
            lineHeight: 1,
            margin: 0,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              color: "var(--color-ink-soft)",
              margin: "10px 0 0",
              maxWidth: "56ch",
              fontSize: "14px",
              lineHeight: 1.55,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex gap-2 flex-wrap items-center">{actions}</div>
      )}
    </div>
  );
}

function PulseDot() {
  return (
    <span
      aria-hidden
      style={{
        width: "7px",
        height: "7px",
        borderRadius: "50%",
        background: "color-mix(in srgb, var(--color-moss) 70%, var(--color-good) 30%)",
        boxShadow:
          "0 0 0 3px color-mix(in srgb, var(--color-moss) 25%, transparent)",
        flexShrink: 0,
      }}
    />
  );
}
