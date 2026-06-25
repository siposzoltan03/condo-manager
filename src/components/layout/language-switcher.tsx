"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";

const SUPPORTED = ["hu", "en"] as const;
type Locale = (typeof SUPPORTED)[number];

/**
 * Compact HU · EN locale toggle. Tiles-styled to match the topbar chrome.
 * Tap targets are 44 px on phone (via `min-h-11`); shrinks to compact at
 * `sm:+` so it doesn't dominate desktop layouts. Used by both the main
 * app topbar (`layout/topbar.tsx`) and the contractor portal topbar.
 */
export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function switchLocale(next: Locale) {
    if (next === locale) return;
    const segments = pathname.split("/");
    if (
      segments.length > 1 &&
      (SUPPORTED as readonly string[]).includes(segments[1])
    ) {
      segments[1] = next;
    } else {
      segments.splice(1, 0, next);
    }
    router.push(segments.join("/"));
  }

  return (
    <div
      className="inline-flex items-center font-mono"
      style={{
        fontSize: "11px",
        color: "var(--color-muted)",
        letterSpacing: "0.04em",
        padding: "4px 8px",
        borderRadius: "7px",
        border:
          "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        background: "var(--color-bg)",
        gap: "6px",
      }}
      aria-label="Language"
    >
      {SUPPORTED.map((code, i) => (
        <span key={code} className="flex items-center gap-1.5">
          {i > 0 && (
            <span aria-hidden style={{ color: "var(--color-muted)" }}>
              ·
            </span>
          )}
          <button
            type="button"
            onClick={() => switchLocale(code)}
            aria-pressed={locale === code}
            className="inline-flex min-h-11 items-center sm:min-h-0"
            style={{
              color:
                locale === code ? "var(--color-ink)" : "var(--color-muted)",
              fontWeight: locale === code ? 600 : 500,
            }}
          >
            {code.toUpperCase()}
          </button>
        </span>
      ))}
    </div>
  );
}
