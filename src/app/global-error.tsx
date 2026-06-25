"use client";

import { useEffect } from "react";

/**
 * Catastrophic-error boundary. Triggered when something throws inside
 * the root layout itself (i18n provider, theme, fonts, etc.) — at that
 * point even the locale-level `[locale]/error.tsx` can't render. We
 * provide our own minimal `<html>`/`<body>` and i18n-free copy.
 *
 * Keep this dependency-free: no next-intl, no Tiles CSS variables, no
 * Link from next/link. If the system is broken enough to land here, we
 * can't trust those layers either.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Catastrophic root-layout error:", error);
  }, [error]);

  return (
    <html lang="hu">
      <body
        style={{
          margin: 0,
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', sans-serif",
          background: "#eeeae2",
          color: "#16181a",
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "20px",
        }}
      >
        <main
          style={{
            width: "min(520px, 100%)",
            background: "#fff",
            border: "1px solid rgba(22, 24, 26, 0.1)",
            borderRadius: "16px",
            padding: "40px 36px",
            textAlign: "center",
          }}
        >
          <div
            aria-hidden
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "rgba(204, 68, 68, 0.18)",
              color: "#c44",
              fontSize: "26px",
              margin: "0 auto 16px",
              display: "grid",
              placeItems: "center",
            }}
          >
            ⚠
          </div>
          <h1
            style={{
              fontSize: "28px",
              fontWeight: 500,
              letterSpacing: "-0.025em",
              margin: "0 0 8px",
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: "13.5px",
              color: "rgba(22, 24, 26, 0.65)",
              lineHeight: 1.55,
              margin: "0 0 20px",
            }}
          >
            The application hit a problem it couldn&apos;t recover from. Try
            reloading; if the issue persists, contact support and quote the
            reference below.
          </p>
          {error.digest && (
            <div
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "10.5px",
                color: "rgba(22, 24, 26, 0.5)",
                letterSpacing: "0.06em",
                marginBottom: "20px",
              }}
            >
              Error reference: {error.digest}
            </div>
          )}
          <div
            style={{
              display: "flex",
              gap: "8px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                padding: "10px 18px",
                fontSize: "12.5px",
                fontWeight: 600,
                borderRadius: "8px",
                background: "#16181a",
                color: "#eeeae2",
                border: 0,
                cursor: "pointer",
              }}
            >
              ↻ Try again
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages --
               * global-error.tsx runs when the root layout has crashed; using
               * next/link could itself fail because Link relies on the
               * router context the layout sets up. A raw <a> always works.
               */}
            <a
              href="/"
              style={{
                padding: "10px 18px",
                fontSize: "12.5px",
                fontWeight: 500,
                borderRadius: "8px",
                background: "transparent",
                color: "#16181a",
                border: "1px solid rgba(22, 24, 26, 0.14)",
                textDecoration: "none",
              }}
            >
              Reload home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
