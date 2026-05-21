"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import type { ContractorTopbarData } from "./contractor-topbar";

/**
 * Left rail of the contractor shell. Implements the design spec:
 *   - 4px gradient accent (moss → moss-2 → ochre) at the very top
 *   - Brand row: K mark + Közös + "Vállalkozó" portal-tag
 *   - Org card: avatar + org name + plan-and-trial sub
 *   - Section labels (Munka / Erőforrások) in mono uppercase
 *   - Nav items with icons + optional badges
 *   - Footer: viewer avatar + name + sign-out icon
 */
export function ContractorSidebar({ data }: { data: ContractorTopbarData }) {
  const t = useTranslations("marketplace");
  const locale = useLocale();
  const pathname = usePathname();

  // Primary nav — matches the design's `Munka` section. Billing isn't a
  // peer here; it's reached via the Settings sub-nav.
  const items: Array<{
    href: string;
    label: string;
    icon: React.ReactNode;
    matchAll?: boolean;
  }> = [
    {
      href: `/${locale}/contractor/marketplace`,
      label: t("navMarketplace"),
      icon: <IconStack />,
      matchAll: true,
    },
    {
      href: `/${locale}/contractor/leads`,
      label: t("navLeads"),
      icon: <IconInbox />,
    },
    {
      href: `/${locale}/contractor/projects`,
      label: t("navProjects"),
      icon: <IconBox />,
    },
    {
      href: `/${locale}/contractor/settings`,
      label: t("navSettings"),
      icon: <IconGear />,
    },
  ];

  const resources: Array<{ href: string; label: string; icon: React.ReactNode }> = [
    {
      href: `/${locale}/contractor`,
      label: t("navHowItWorks"),
      icon: <IconClock />,
    },
    {
      href: `/${locale}/contractor#faq`,
      label: t("navHelp"),
      icon: <IconHelp />,
    },
  ];

  // Treat both /settings and /billing as the same active item — billing
  // is a tab within settings on the design side.
  function isItemActive(href: string, matchAll: boolean | undefined): boolean {
    if (
      href.endsWith("/contractor/settings") &&
      (pathname.startsWith(`${href}`) ||
        pathname.startsWith(`/${locale}/contractor/billing`))
    ) {
      return true;
    }
    return matchAll
      ? pathname.startsWith(href)
      : pathname === href || pathname.startsWith(`${href}/`);
  }

  const planLabel =
    data.plan === "PREMIUM"
      ? t("planBadgePremium")
      : data.plan === "PRO"
        ? t("planBadgePro")
        : t("planBadgeFree");
  const planSub =
    data.status === "TRIALING" && data.trialDaysRemaining !== null
      ? `${planLabel} · ${t("planTrialBadge", { days: data.trialDaysRemaining })}`
      : `${planLabel} · ${
          data.status === "ACTIVE"
            ? t("billingStatusActive")
            : data.status === "PAST_DUE"
              ? t("billingStatusPastDue")
              : data.status === "CANCELLED"
                ? t("billingStatusCancelled")
                : t("billingStatusActive")
        }`;

  const [mobileOpen, setMobileOpen] = useState(false);

  // Body scroll lock when the mobile drawer is open. Same pattern as
  // src/components/layout/sidebar.tsx — keeps the underlying page from
  // scrolling behind the drawer.
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  const sidebarBody = (
    <>
      <span
        aria-hidden
        style={{
          display: "block",
          height: "4px",
          background:
            "linear-gradient(90deg, var(--color-moss) 0%, color-mix(in srgb, var(--color-moss) 60%, var(--color-ochre) 40%) 60%, var(--color-ochre) 100%)",
          margin: "0 -14px 16px",
        }}
      />

      <Link
        href={`/${locale}/contractor/marketplace`}
        className="flex items-center gap-2.5"
        style={{
          padding: "4px 8px 8px",
          textDecoration: "none",
          color: "var(--color-ink)",
        }}
      >
        <span
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "7px",
            background: "var(--color-ink)",
            color: "var(--color-bg)",
            display: "grid",
            placeItems: "center",
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontWeight: 700,
            fontSize: "14px",
          }}
        >
          K
        </span>
        <span
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontWeight: 600,
            fontSize: "17px",
            letterSpacing: "-0.02em",
            flex: "1 1 auto",
          }}
        >
          Közös
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: "9.5px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            padding: "3px 7px",
            background: "var(--color-moss)",
            color: "#f5f2e6",
            borderRadius: "4px",
          }}
        >
          Vállalkozó
        </span>
      </Link>

      <div
        style={{
          background: "var(--color-card, var(--color-bg))",
          border:
            "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          borderRadius: "10px",
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          margin: "6px 0 20px",
        }}
      >
        <span
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "7px",
            background: "var(--color-ink)",
            color: "var(--color-bg)",
            display: "grid",
            placeItems: "center",
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontWeight: 600,
            fontSize: "13px",
            flexShrink: 0,
          }}
        >
          {initialsOf(data.orgName)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong
            className="block truncate"
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: "14px",
              fontWeight: 600,
              letterSpacing: "-0.015em",
            }}
            title={data.orgName}
          >
            {data.orgName}
          </strong>
          <small
            className="font-mono"
            style={{
              fontSize: "10px",
              color: "var(--color-muted)",
              letterSpacing: "0.05em",
            }}
          >
            {planSub}
          </small>
        </div>
      </div>

      <span
        className="font-mono"
        style={{
          fontSize: "10px",
          color: "var(--color-muted)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          padding: "14px 10px 6px",
        }}
      >
        {t("navWorkArea")}
      </span>

      <nav className="flex flex-col gap-px">
        {items.map((it) => (
          <NavItem
            key={it.href}
            href={it.href}
            label={it.label}
            icon={it.icon}
            active={isItemActive(it.href, it.matchAll)}
            onNavigate={() => setMobileOpen(false)}
          />
        ))}
      </nav>

      <span
        className="font-mono"
        style={{
          fontSize: "10px",
          color: "var(--color-muted)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          padding: "20px 10px 6px",
        }}
      >
        {t("navResources")}
      </span>

      <nav className="flex flex-col gap-px">
        {resources.map((it) => (
          <NavItem
            key={it.href + it.label}
            href={it.href}
            label={it.label}
            icon={it.icon}
            active={false}
            onNavigate={() => setMobileOpen(false)}
          />
        ))}
      </nav>

      <div
        style={{
          marginTop: "auto",
          padding: "14px 10px 4px",
          borderTop:
            "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <span
          style={{
            width: "30px",
            height: "30px",
            borderRadius: "50%",
            background: "var(--color-ochre)",
            color: "var(--color-ink)",
            display: "grid",
            placeItems: "center",
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontWeight: 500,
            fontSize: "12px",
            flexShrink: 0,
          }}
        >
          {initialsOf(data.viewerName)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong
            className="block truncate"
            style={{
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
            title={data.viewerName}
          >
            {data.viewerName}
          </strong>
          <small
            className="font-mono"
            style={{
              fontSize: "10px",
              color: "var(--color-muted)",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            {t("navAccount")}
          </small>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          aria-label={t("navSignOut")}
          title={t("navSignOut")}
          style={{
            color: "var(--color-muted)",
            display: "grid",
            placeItems: "center",
            width: "30px",
            height: "30px",
            borderRadius: "6px",
          }}
        >
          <IconSignOut />
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger trigger — visible below `lg:` per plan §0.5
          (tablet stays in drawer mode, no icon-only middle state). */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-2 z-50 inline-flex h-11 w-11 items-center justify-center rounded-lg text-bg lg:hidden sm:left-4 sm:top-3"
        style={{ background: "var(--color-ink)" }}
        aria-label="Menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: "color-mix(in srgb, var(--color-ink) 50%, transparent)" }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className="fixed inset-y-0 left-0 z-50 flex flex-col transition-transform duration-300 lg:hidden"
        style={{
          width: "244px",
          background: "var(--color-bg-2)",
          borderRight: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          padding: "0 14px 14px",
          overflowY: "auto",
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-md text-muted transition-colors hover:bg-bg-3"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
        {sidebarBody}
      </aside>

      {/* Desktop persistent sidebar — fixed-position 244px column.
          Main content gets `lg:pl-[244px]` from the shell to clear it. */}
      <aside
        className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex-col"
        style={{
          width: "244px",
          background: "var(--color-bg-2)",
          borderRight:
            "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          padding: "0 14px 14px",
          overflowY: "auto",
        }}
      >
        {sidebarBody}
      </aside>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function initialsOf(name: string): string {
  if (!name) return "—";
  const parts = name
    .trim()
    .split(/[\s.-]+/)
    .filter(Boolean);
  if (parts.length === 0) return name.slice(0, 2).toUpperCase();
  const first = parts[0]!;
  const second = parts[1];
  if (!second) return first.slice(0, 2).toUpperCase();
  return (first[0]! + second[0]!).toUpperCase();
}

function NavItem({
  href,
  label,
  icon,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-3"
      style={{
        padding: "9px 10px",
        borderRadius: "8px",
        fontSize: "13.5px",
        fontWeight: 500,
        background: active ? "var(--color-ink)" : "transparent",
        color: active ? "var(--color-bg)" : "var(--color-ink-soft)",
        textDecoration: "none",
      }}
    >
      <span
        aria-hidden
        style={{ width: "18px", height: "18px", flexShrink: 0 }}
      >
        {icon}
      </span>
      {label}
    </Link>
  );
}

// ── Icons (1.6 stroke, matches design) ───────────────────────────────────

function IconStack() {
  // Storefront-style glyph mirrors the design's marketplace icon.
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l1-5h16l1 5" />
      <path d="M5 9v11h14V9" />
      <path d="M9 13h6" />
    </svg>
  );
}

function IconInbox() {
  // Envelope-with-V — "submitted bids" inbox.
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function IconBox() {
  // Boxed stack — projects.
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7l-8 4-8-4M20 7v10l-8 4-8-4V7" />
      <path d="M4 7l8-4 8 4" />
    </svg>
  );
}

function IconGear() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 0 1 4.27 16.96l.06-.06A1.65 1.65 0 0 0 4.66 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 4.29l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.16.38.24.79.24 1.2v1.6c0 .41-.08.82-.24 1.2z" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function IconHelp() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
    </svg>
  );
}

function IconSignOut() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}
