"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";

/**
 * Reusable Tiles-styled recovery card for module-level `error.tsx`
 * files. Renders inside the locale layout so the sidebar/topbar are
 * still visible — the user can navigate elsewhere even if this section
 * is broken.
 *
 * Pass `homeHref` (relative, no locale) to override the back-button
 * destination — defaults to the dashboard.
 */
interface Props {
  error: Error & { digest?: string };
  reset: () => void;
  /** Optional headline override. */
  title?: string;
  /** Optional body-copy override. */
  description?: string;
  /** Override for the secondary back-link target (no locale prefix). */
  homeHref?: string;
  /** Override for the secondary back-link label. */
  homeLabel?: string;
}

export function ErrorRecovery({
  error,
  reset,
  title,
  description,
  homeHref,
  homeLabel,
}: Props) {
  const t = useTranslations("common");
  const locale = useLocale();

  useEffect(() => {
    console.error("Module-level error:", error);
  }, [error]);

  return (
    <div
      className="grid place-items-center"
      style={{ padding: "60px 32px", minHeight: "60vh" }}
    >
      <div
        style={{
          width: "min(520px, 100%)",
          background: "var(--color-card)",
          border:
            "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          borderRadius: "16px",
          padding: "36px 32px",
          textAlign: "center",
        }}
      >
        <div
          aria-hidden
          className="grid place-items-center mx-auto"
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            background: "color-mix(in srgb, #c44 16%, transparent)",
            color: "#c44",
            fontSize: "22px",
            marginBottom: "14px",
          }}
        >
          ⚠
        </div>
        <h2
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "22px",
            fontWeight: 500,
            letterSpacing: "-0.022em",
            marginBottom: "8px",
          }}
        >
          {title ?? t("errorTitle")}
        </h2>
        <p
          style={{
            fontSize: "13px",
            color: "var(--color-ink-soft)",
            lineHeight: 1.55,
            marginBottom: "16px",
          }}
        >
          {description ?? t("errorDesc")}
        </p>
        {error.digest && (
          <div
            className="font-mono"
            style={{
              fontSize: "10.5px",
              color: "var(--color-muted)",
              letterSpacing: "0.06em",
              marginBottom: "18px",
            }}
          >
            {t("errorRefId")} {error.digest}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="transition-opacity hover:opacity-90"
            style={{
              padding: "9px 16px",
              fontSize: "12.5px",
              fontWeight: 600,
              borderRadius: "8px",
              background: "var(--color-ink)",
              color: "var(--color-bg)",
              border: 0,
              cursor: "pointer",
            }}
          >
            ↻ {t("retry")}
          </button>
          <Link
            href={`/${locale}${homeHref ?? "/dashboard"}`}
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
            {homeLabel ?? t("errorGoHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
