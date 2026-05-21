"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { NotificationBell } from "@/components/layout/notification-bell";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

export interface ContractorTopbarData {
  orgName: string;
  plan: "FREE" | "PRO" | "PREMIUM";
  status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELLED";
  trialDaysRemaining: number | null;
  viewerName: string;
}

const SUPPORTED_LOCALES = new Set(["hu", "en"]);

function stripLocale(pathname: string): string {
  const segments = pathname.split("/");
  return segments.length > 1 && SUPPORTED_LOCALES.has(segments[1])
    ? "/" + segments.slice(2).join("/")
    : pathname;
}

/**
 * Top strip of the contractor shell. Mirrors the design:
 *   - Crumbs (mono uppercase, "VÁLLALKOZÓ · <current>")
 *   - Decorative search input with ⌘K hint
 *   - Notification + help icon buttons (dot indicator on notifications)
 *
 * Sign-out lives in the sidebar foot, not here.
 */
export function ContractorTopbar() {
  const t = useTranslations("marketplace");
  const pathname = usePathname();
  const stripped = stripLocale(pathname);

  const crumb = breadcrumbFor(stripped, t);

  return (
    <header
      className="sticky top-0 z-[5] flex items-center gap-3 px-4 py-3 sm:gap-5 lg:px-8 lg:py-4"
      style={{
        borderBottom:
          "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        background: "var(--color-bg)",
      }}
    >
      {/* Spacer reserving room for the hamburger button (rendered by
          ContractorSidebar at fixed left:12px/16px, 44×44). At lg:+ the
          persistent sidebar is visible and the hamburger is hidden. */}
      <div className="lg:hidden" style={{ width: "44px" }} />
      <div
        className="font-mono"
        style={{
          fontSize: "12px",
          color: "var(--color-muted)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        Vállalkozó ·{" "}
        <b style={{ color: "var(--color-ink-soft)", fontWeight: 500 }}>
          {crumb}
        </b>
      </div>

      <div
        className="hidden md:flex items-center gap-2.5"
        style={{
          flex: 1,
          maxWidth: "420px",
          background: "var(--color-card, var(--color-bg))",
          border:
            "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          borderRadius: "8px",
          padding: "8px 12px",
          fontSize: "13px",
        }}
      >
        <SearchIcon />
        <input
          type="text"
          placeholder={t("boardEyebrow")}
          style={{
            flex: 1,
            border: 0,
            outline: 0,
            background: "transparent",
            fontSize: "13px",
            color: "var(--color-ink)",
          }}
        />
        <span
          className="font-mono"
          style={{
            fontSize: "10px",
            padding: "2px 6px",
            borderRadius: "4px",
            background:
              "color-mix(in srgb, var(--color-ink) 8%, transparent)",
            color: "var(--color-ink-soft)",
          }}
        >
          ⌘K
        </span>
      </div>

      <div className="flex items-center gap-3" style={{ marginLeft: "auto" }}>
        <LanguageSwitcher />
        <NotificationBell />
        <IconButton label="Help">
          <HelpIcon />
        </IconButton>
      </div>
    </header>
  );
}

function breadcrumbFor(
  stripped: string,
  t: ReturnType<typeof useTranslations>,
): string {
  if (
    stripped === "/contractor/marketplace" ||
    stripped === "/contractor/marketplace/" ||
    stripped === "/contractor"
  )
    return t("navMarketplace");
  if (stripped.startsWith("/contractor/marketplace/"))
    return `${t("navMarketplace")} / ${t("detailEyebrow").replace(/^\/\s*/, "").trim()}`;
  if (stripped.startsWith("/contractor/projects")) return t("navProjects");
  if (stripped.startsWith("/contractor/settings")) return t("navSettings");
  if (stripped.startsWith("/contractor/billing")) return t("navBilling");
  if (stripped.startsWith("/contractor/onboarding")) return "Onboarding";
  return t("navMarketplace");
}

function IconButton({
  label,
  dot,
  children,
}: {
  label: string;
  dot?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="relative grid h-11 w-11 place-items-center rounded-lg sm:h-[34px] sm:w-[34px]"
      style={{
        border:
          "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        color: "var(--color-ink-soft)",
        background: "var(--color-bg)",
      }}
    >
      {children}
      {dot && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: "5px",
            right: "6px",
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: "var(--color-ochre)",
            border: "1.5px solid var(--color-bg)",
          }}
        />
      )}
    </button>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-muted)" }}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
    </svg>
  );
}
