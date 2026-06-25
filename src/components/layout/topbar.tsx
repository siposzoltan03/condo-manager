"use client";

import { signOut } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useBuilding } from "@/hooks/use-building";
import { NotificationBell } from "./notification-bell";
import { LanguageSwitcher } from "./language-switcher";

const SUPPORTED_LOCALES = new Set(["hu", "en"]);

/**
 * Strip the locale prefix and return human-readable breadcrumb segments
 * for the current path. e.g. /hu/finance/building → ["Finance", "Building"].
 */
function deriveBreadcrumb(pathname: string, t: (k: string) => string): string[] {
  const segments = pathname.split("/").filter(Boolean);
  const start = segments.length > 0 && SUPPORTED_LOCALES.has(segments[0]) ? 1 : 0;
  const crumbs: string[] = [];
  for (let i = start; i < segments.length; i++) {
    const seg = segments[i];
    // Skip uuid/cuid-looking dynamic segments
    if (/^[a-z0-9]{20,}$/i.test(seg)) continue;
    // Map known route keys to nav.* labels
    const knownKeys: Record<string, string> = {
      dashboard: "nav.dashboard",
      finance: "nav.finance",
      voting: "nav.voting",
      maintenance: "nav.maintenance",
      announcements: "nav.communication",
      forum: "nav.forum",
      messages: "nav.messages",
      complaints: "nav.complaints",
      documents: "nav.documents",
      units: "nav.units",
      users: "nav.users",
      settings: "nav.settings",
      admin: "nav.admin",
      buildings: "nav.buildings",
    };
    const key = knownKeys[seg];
    crumbs.push(key ? t(key) : seg.charAt(0).toUpperCase() + seg.slice(1));
  }
  return crumbs;
}

export function TopBar() {
  const t = useTranslations();
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const { user } = useAuth();
  const { buildings, activeBuildingId } = useBuilding();

  const activeBuilding = buildings.find((b) => b.id === activeBuildingId);
  const crumbs = deriveBreadcrumb(pathname, (k) => t(k));

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-3 px-4 sm:gap-5 lg:px-8"
      style={{
        minHeight: "var(--header-h-mobile)",
        background: "var(--color-bg)",
        borderBottom: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
      }}
    >
      {/* Mobile spacer for hamburger button (rendered by Sidebar). At lg:+
          the full sidebar takes its place so the spacer is hidden. */}
      <div className="lg:hidden" style={{ width: "40px" }} />

      {/* Breadcrumbs */}
      <div
        className="font-mono hidden md:block"
        style={{ fontSize: "12px", color: "var(--color-muted)", letterSpacing: "0.04em" }}
      >
        {activeBuilding && <span>{activeBuilding.name}</span>}
        {crumbs.map((c, i) => (
          <span key={i}>
            <span style={{ margin: "0 6px" }}>·</span>
            <b style={{ color: "var(--color-ink-soft)", fontWeight: 500 }}>{c}</b>
          </span>
        ))}
      </div>

      {/* Search (visual placeholder — wire to /search when search lands) */}
      <button
        type="button"
        className="hidden md:flex flex-1 items-center gap-2.5 transition-colors hover:bg-[var(--color-bg-3)]"
        style={{
          maxWidth: "420px",
          padding: "8px 12px",
          background: "var(--color-card)",
          border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          borderRadius: "8px",
          fontSize: "13px",
          color: "var(--color-muted)",
          textAlign: "left",
        }}
        title={tCommon("search")}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4-4" />
        </svg>
        <span className="flex-1">{tCommon("search")}…</span>
        <span
          className="font-mono"
          style={{
            fontSize: "10px",
            padding: "2px 6px",
            borderRadius: "4px",
            background: "color-mix(in srgb, var(--color-ink) 8%, transparent)",
            color: "var(--color-ink-soft)",
          }}
        >
          ⌘ K
        </span>
      </button>

      {/* Right actions */}
      <div className="flex items-center gap-2 ml-auto">
        <LanguageSwitcher />
        <NotificationBell />

        <Link
          href={`/${locale}/settings`}
          className="grid h-11 w-11 place-items-center transition-colors hover:bg-[var(--color-card)] sm:h-9 sm:w-9"
          style={{
            borderRadius: "8px",
            border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
            color: "var(--color-ink-soft)",
          }}
          title={t("nav.settings")}
          aria-label={t("nav.settings")}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </svg>
        </Link>

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: `/${locale}/login` })}
          className="grid h-11 w-11 place-items-center transition-colors hover:bg-[var(--color-card)] sm:h-9 sm:w-9"
          style={{
            borderRadius: "8px",
            border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
            color: "var(--color-ink-soft)",
          }}
          title={tCommon("logout")}
          aria-label={tCommon("logout")}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
        </button>
      </div>

      {/* Voiceover-only user info to keep the existing accessibility surface */}
      <span className="sr-only">{user?.name}</span>
    </header>
  );
}
