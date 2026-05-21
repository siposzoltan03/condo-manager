import Link from "next/link";
import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface DomainShellTab {
  /** Stable key used both for active-match and React rendering. */
  key: string;
  /** href the tab links to. */
  href: string;
  /** Localized label rendered inside the tab. */
  label: string;
  /** Optional numeric count rendered as a small badge after the label. */
  count?: number | null;
}

export interface DomainShellProps {
  /** Currently active tab key. */
  active?: string;
  tabs?: DomainShellTab[];
  /** Page title — h1. */
  title: string;
  /** Muted suffix rendered after the title (e.g. "· 2026 Q2"). */
  titleSuffix?: string;
  /** Short subtitle paragraph below the title. */
  lede?: string;
  /** Right-side action slot (next to title at sm:+, below it on phone). */
  headerActions?: ReactNode;
  /** Locale, only needed if the count badges should format their numbers
   *  with locale-aware separators. Pass "hu" or "en". */
  locale?: string;
  children: ReactNode;
}

/**
 * Shared page shell used by voting, maintenance, and finance surfaces.
 *
 * Responsive treatment landed in Phase B/C/E:
 *  - Phone: `px-4 py-6` outer padding, 28 px H1, tab links `min-h-11`,
 *    tab strip horizontally scrollable, `overflow-x-hidden` on the wrap
 *    as a safety net for KPI strips with minor element overflow.
 *  - Desktop (`lg:+`): `px-8 py-8` padding, 44 px H1, normal-height tabs.
 *
 * Plan ref: docs/plans/2026-05-18-mobile-responsive.md §A + §B.2/B.5/C.1.
 */
export function DomainShell({
  active,
  tabs,
  title,
  titleSuffix,
  lede,
  headerActions,
  locale = "hu",
  children,
}: DomainShellProps) {
  return (
    <div
      className="overflow-x-hidden px-4 py-6 lg:overflow-x-visible lg:px-8 lg:py-8 mx-auto"
      style={{ maxWidth: "1440px" }}
    >
      {/* Page header */}
      <header className="mb-6 flex flex-col gap-4 sm:mb-7 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-8">
        <div>
          <h1
            className="text-[28px] sm:text-[36px] lg:text-[44px]"
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontWeight: 500,
              letterSpacing: "-0.035em",
              lineHeight: 1.05,
            }}
          >
            {title}
            {titleSuffix && (
              <span style={{ color: "var(--color-muted)", fontWeight: 400 }}>
                {" "}
                {titleSuffix}
              </span>
            )}
          </h1>
          {lede && (
            <p
              style={{
                color: "var(--color-ink-soft)",
                margin: "8px 0 0",
                maxWidth: "52ch",
              }}
            >
              {lede}
            </p>
          )}
        </div>
        {headerActions && (
          <div className="flex flex-wrap gap-2">{headerActions}</div>
        )}
      </header>

      {/* Tabs — `overflow-x: auto; overflow-y: hidden` lets the strip
          scroll horizontally on narrow viewports without ever showing a
          vertical scrollbar. */}
      {tabs && tabs.length > 0 && (
        <div
          className="flex gap-0.5"
          style={{
            overflowX: "auto",
            overflowY: "hidden",
            borderBottom:
              "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
            marginBottom: "28px",
          }}
        >
          {tabs.map((tab) => {
            const isOn = tab.key === active;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                className={cn(
                  "inline-flex min-h-11 items-center px-4 py-2.5 transition-colors hover:text-[var(--color-ink)] whitespace-nowrap sm:min-h-0",
                )}
                style={{
                  fontSize: "13px",
                  fontWeight: isOn ? 600 : 500,
                  color: isOn ? "var(--color-ink)" : "var(--color-ink-soft)",
                  borderBottom: isOn
                    ? "2px solid var(--color-ink)"
                    : "2px solid transparent",
                  marginBottom: "-1px",
                  textDecoration: "none",
                }}
              >
                {tab.label}
                {tab.count !== null && tab.count !== undefined && (
                  <span
                    className="font-mono"
                    style={{
                      marginLeft: "8px",
                      fontSize: "10px",
                      padding: "2px 7px",
                      borderRadius: "4px",
                      background:
                        "color-mix(in srgb, var(--color-ink) 7%, transparent)",
                      fontWeight: 500,
                    }}
                  >
                    {tab.count.toLocaleString(locale === "en" ? "en-US" : "hu-HU")}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {children}
    </div>
  );
}
