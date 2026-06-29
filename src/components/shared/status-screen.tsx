import Link from "next/link";

/**
 * Tiles-styled full-page status card for the dedicated 404 / 403 / 401
 * boundaries (`not-found.tsx`, `forbidden.tsx`, `unauthorized.tsx`). Matches
 * the look of `ErrorRecovery` (the 500 card) so every error state is
 * consistent. Presentational + server-safe — no hooks, no "use client";
 * callers pass already-translated copy.
 */
export function StatusScreen({
  code,
  title,
  description,
  tone = "neutral",
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  code: string;
  title: string;
  description: string;
  /** `danger` tints the code red (403); `neutral` uses ink (404/401). */
  tone?: "neutral" | "danger";
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  const accent = tone === "danger" ? "#c44" : "var(--color-ink)";
  return (
    <div
      className="grid place-items-center"
      style={{ padding: "60px 32px", minHeight: "70vh" }}
    >
      <div
        style={{
          width: "min(520px, 100%)",
          background: "var(--color-card)",
          border:
            "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          borderRadius: "16px",
          padding: "40px 32px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "64px",
            fontWeight: 600,
            letterSpacing: "-0.04em",
            color: accent,
            lineHeight: 1,
            margin: "0 0 10px",
          }}
        >
          {code}
        </p>
        <h1
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "22px",
            fontWeight: 500,
            letterSpacing: "-0.022em",
            margin: "0 0 8px",
          }}
        >
          {title}
        </h1>
        <p
          style={{
            fontSize: "13.5px",
            color: "var(--color-ink-soft)",
            lineHeight: 1.55,
            margin: "0 0 20px",
          }}
        >
          {description}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            href={primaryHref}
            style={{
              padding: "9px 16px",
              fontSize: "12.5px",
              fontWeight: 600,
              borderRadius: "8px",
              background: "var(--color-ink)",
              color: "var(--color-bg)",
              textDecoration: "none",
            }}
          >
            {primaryLabel}
          </Link>
          {secondaryHref && secondaryLabel && (
            <Link
              href={secondaryHref}
              style={{
                padding: "9px 16px",
                fontSize: "12.5px",
                fontWeight: 500,
                borderRadius: "8px",
                background: "transparent",
                color: "var(--color-ink)",
                border:
                  "1px solid color-mix(in srgb, var(--color-ink) 14%, transparent)",
                textDecoration: "none",
              }}
            >
              {secondaryLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
