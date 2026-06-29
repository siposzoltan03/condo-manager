"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/hooks/use-auth";
import type { Capability } from "@/lib/authz";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { BuildingSwitcher } from "@/components/layout/building-switcher";
import { UpgradeModal } from "@/components/shared/upgrade-modal";

interface NavItem {
  key: string;
  href: string;
  icon: (props: { className?: string }) => React.ReactNode;
  /** Caps that grant visibility (ANY); omit/empty = visible to everyone. */
  capabilities?: Capability[];
  featureSlug?: string;
  requiredPlan?: string;
  badgeCount?: number;
  badgeAlert?: boolean;
  subItems?: { key: string; href: string; capabilities?: Capability[] }[];
}

interface NavSection {
  label: string;
  items: NavItem[];
  capabilities?: Capability[];
}

// ── Inline icons matching the dashboard design exactly ────────────────────

function Ic(props: {
  d: string;
  paths?: string[];
  rect?: { x: number; y: number; w: number; h: number; rx?: number };
  circle?: { cx: number; cy: number; r: number };
  className?: string;
}) {
  return (
    <svg
      className={props.className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {props.rect && (
        <rect
          x={props.rect.x}
          y={props.rect.y}
          width={props.rect.w}
          height={props.rect.h}
          rx={props.rect.rx}
        />
      )}
      {props.circle && (
        <circle cx={props.circle.cx} cy={props.circle.cy} r={props.circle.r} />
      )}
      <path d={props.d} />
      {props.paths?.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

const Icons = {
  dashboard: (p: { className?: string }) => (
    <Ic
      className={p.className}
      d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2z"
      paths={["M9 22V12h6v10"]}
    />
  ),
  finance: (p: { className?: string }) => (
    <Ic
      className={p.className}
      rect={{ x: 2, y: 5, w: 20, h: 14, rx: 2 }}
      d="M2 10h20"
      paths={["M6 15h4"]}
    />
  ),
  voting: (p: { className?: string }) => (
    <svg
      className={p.className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 11H5a2 2 0 0 0-2 2v7h18v-7a2 2 0 0 0-2-2h-4" />
      <rect x="9" y="3" width="6" height="8" rx="1" />
    </svg>
  ),
  maintenance: (p: { className?: string }) => (
    <Ic
      className={p.className}
      d="M14 2l6 6-11 11H3v-6z"
      paths={["M12 4l6 6"]}
    />
  ),
  communication: (p: { className?: string }) => (
    <Ic
      className={p.className}
      d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
    />
  ),
  documents: (p: { className?: string }) => (
    <Ic
      className={p.className}
      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
      paths={["M14 2v6h6"]}
    />
  ),
  units: (p: { className?: string }) => (
    <Ic
      className={p.className}
      rect={{ x: 3, y: 3, w: 18, h: 18, rx: 2 }}
      d="M9 3v18M3 9h18"
    />
  ),
  residents: (p: { className?: string }) => (
    <Ic
      className={p.className}
      circle={{ cx: 12, cy: 8, r: 4 }}
      d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2"
    />
  ),
  buildings: (p: { className?: string }) => (
    <Ic
      className={p.className}
      d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"
      paths={["M9 9h.01M9 13h.01M9 17h.01"]}
    />
  ),
  settings: (p: { className?: string }) => (
    <Ic
      className={p.className}
      circle={{ cx: 12, cy: 12, r: 3 }}
      d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
    />
  ),
};

// ── Nav structure ──────────────────────────────────────────────────────────

// AUDITOR visibility note (Phase 2 / Phase 3 truth table):
//   AUDITOR is ranked at BOARD_MEMBER's level in ROLE_HIERARCHY (3), so
//   any item gated at `minimumRole: "TENANT" | "OWNER" | "BOARD_MEMBER"`
//   shows up for auditors as well. That matches the plan's read-only
//   tier — auditors *see* the surfaces but cannot mutate.
//   Per-action write enforcement is at the API endpoints (via `can()`),
//   not in the sidebar. Items gated at `minimumRole: "ADMIN"` or
//   "SUPER_ADMIN" stay hidden from AUDITOR.
const sections: NavSection[] = [
  {
    label: "navSection.workshop",
    items: [
      { key: "dashboard", href: "/dashboard", icon: Icons.dashboard },
      {
        key: "finance",
        href: "/finance",
        icon: Icons.finance,
        // Tht. § 16, § 38 — finance is owner-only (own-unit finance) or
        // board/admin (building finance).
        capabilities: ["view.own.unit.finance", "view.building.finance"],
        featureSlug: "finance",
        requiredPlan: "pro",
      },
      {
        key: "voting",
        href: "/voting",
        icon: Icons.voting,
        // Tht. § 38 — owners vote; board/admin manage. Tenants do not vote.
        capabilities: ["vote.cast", "view.boardContext"],
        featureSlug: "voting",
        requiredPlan: "pro",
      },
      {
        key: "maintenance",
        href: "/maintenance",
        icon: Icons.maintenance,
        featureSlug: "maintenance",
        requiredPlan: "pro",
        subItems: [
          { key: "maintenanceContractors", href: "/maintenance/contractors", capabilities: ["contractor.view"] },
          { key: "maintenanceScheduled", href: "/maintenance/scheduled", capabilities: ["board.manage"] },
        ],
      },
      {
        key: "communication",
        href: "/communication",
        icon: Icons.communication,
        subItems: [
          { key: "complaints", href: "/complaints" },
        ],
      },
      { key: "documents", href: "/documents", icon: Icons.documents },
    ],
  },
  {
    label: "navSection.house",
    items: [
      // Plan-truth-table row "Units (lakások)" — board-only. OWNER and
      // TENANT see their own unit on the dashboard tile, never the full
      // unit ledger. (Tht. § 16, § 38 — owners have legal standing on
      // their own unit, not on the building's full register.)
      { key: "units", href: "/units", icon: Icons.units, capabilities: ["units.manage"] },
      { key: "residents", href: "/residents", icon: Icons.residents },
    ],
  },
  {
    label: "navSection.platform",
    capabilities: ["view.adminContext", "platform.admin"],
    items: [
      { key: "buildings", href: "/admin/buildings", icon: Icons.buildings, capabilities: ["platform.admin"] },
      {
        key: "settings",
        href: "/settings",
        icon: Icons.settings,
        capabilities: ["view.adminContext"],
        subItems: [
          { key: "settingsInvitations", href: "/settings/invitations", capabilities: ["users.manage"] },
          { key: "settingsBilling", href: "/settings/billing", capabilities: ["view.adminContext"] },
        ],
      },
    ],
  },
];

const PLAN_BADGE: Record<string, string> = { pro: "PRO", enterprise: "ENT" };
const SUPPORTED_LOCALES = new Set(["hu", "en"]);

// ── Component ──────────────────────────────────────────────────────────────

export function Sidebar() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const { canAny, user } = useAuth();
  const { hasFeature, planSlug, isLegacy } = usePlanFeatures();
  // useBuilding is consumed by the inline BuildingSwitcher; no need to read it here.
  const [mobileOpen, setMobileOpen] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState<{
    featureName: string;
    requiredPlan: string;
  } | null>(null);

  // Lock body scroll while the mobile drawer is open so the underlying
  // page doesn't scroll behind the drawer.
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  function strippedPath(): string {
    const segments = pathname.split("/");
    return segments.length > 1 && SUPPORTED_LOCALES.has(segments[1])
      ? "/" + segments.slice(2).join("/")
      : pathname;
  }

  /** Highlights the item only when the route matches exactly. */
  function isActive(href: string): boolean {
    return strippedPath() === href;
  }

  /** True when the route is on this item or any descendant — drives sub-list expand. */
  function isOnBranch(href: string): boolean {
    const stripped = strippedPath();
    return stripped === href || stripped.startsWith(href + "/");
  }

  const isFeatureAvailable = (item: NavItem) =>
    !item.featureSlug || isLegacy || hasFeature(item.featureSlug);

  const showFor = (caps?: Capability[]) => !caps || caps.length === 0 || canAny(...caps);

  const visibleSections = sections
    .filter((s) => showFor(s.capabilities))
    .map((s) => ({
      ...s,
      items: s.items.filter((i) => showFor(i.capabilities)),
    }))
    .filter((s) => s.items.length > 0);

  const userInitials = (user?.name ?? "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const sidebarBody = (
    <>
      {/* Brand */}
      <div className="flex items-center gap-2.5" style={{ padding: "4px 8px 20px" }}>
        <span
          className="grid place-items-center"
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "7px",
            background: "var(--color-ink)",
            color: "var(--color-bg)",
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
          }}
        >
          Közös
        </span>
      </div>

      {/* Building card with built-in dropdown when multiple buildings exist. */}
      <div style={{ marginBottom: "22px" }}>
        <BuildingSwitcher />
      </div>

      {/* Sections */}
      {visibleSections.map((section) => (
        <div key={section.label}>
          <div
            className="font-mono"
            style={{
              fontSize: "10px",
              color: "var(--color-muted)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "14px 10px 6px",
            }}
          >
            {t(section.label)}
          </div>
          {section.items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const onBranch = isOnBranch(item.href);
            const available = isFeatureAvailable(item);
            const visibleSubItems =
              item.subItems?.filter((sub) => showFor(sub.capabilities)) ?? [];
            const planBadge = item.requiredPlan ? PLAN_BADGE[item.requiredPlan] : null;

            if (!available) {
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    setUpgradeModal({
                      featureName: t(item.key),
                      requiredPlan: item.requiredPlan ?? "pro",
                    })
                  }
                  className="flex items-center gap-3 w-full transition-colors"
                  style={{
                    padding: "9px 10px",
                    borderRadius: "8px",
                    color: "var(--color-muted)",
                    fontWeight: 500,
                    fontSize: "13.5px",
                    marginBottom: "1px",
                    cursor: "not-allowed",
                    opacity: 0.7,
                  }}
                >
                  <Icon className="flex-shrink-0" />
                  <span>{t(item.key)}</span>
                  {planBadge && (
                    <span
                      className="ml-auto font-mono"
                      style={{
                        fontSize: "9px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: "var(--color-ochre)",
                        color: "var(--color-ink)",
                        letterSpacing: "0.05em",
                        fontWeight: 700,
                      }}
                    >
                      {planBadge}
                    </span>
                  )}
                </button>
              );
            }

            return (
              <div key={item.key}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 transition-colors"
                  style={{
                    padding: "9px 10px",
                    borderRadius: "8px",
                    background: active ? "var(--color-ink)" : "transparent",
                    color: active ? "var(--color-bg)" : "var(--color-ink-soft)",
                    fontWeight: 500,
                    fontSize: "13.5px",
                    marginBottom: "1px",
                  }}
                >
                  <Icon className="flex-shrink-0" />
                  <span>{t(item.key)}</span>
                  {item.badgeCount !== undefined && item.badgeCount > 0 && (
                    <span
                      className="font-mono"
                      style={{
                        marginLeft: "auto",
                        fontSize: "10px",
                        padding: "1px 7px",
                        borderRadius: "5px",
                        background: item.badgeAlert
                          ? "var(--color-ochre)"
                          : active
                            ? "var(--color-bg)"
                            : "color-mix(in srgb, var(--color-ink) 10%, transparent)",
                        color: item.badgeAlert
                          ? "var(--color-ink)"
                          : active
                            ? "var(--color-ink)"
                            : "var(--color-ink-soft)",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {item.badgeCount}
                    </span>
                  )}
                </Link>
                {onBranch && visibleSubItems.length > 0 && (
                  <div style={{ marginLeft: "30px", marginTop: "2px", marginBottom: "4px" }}>
                    {visibleSubItems.map((sub) => {
                      const subActive = isActive(sub.href);
                      return (
                        <Link
                          key={sub.key}
                          href={sub.href}
                          onClick={() => setMobileOpen(false)}
                          className="block transition-colors"
                          style={{
                            padding: "6px 10px",
                            borderRadius: "6px",
                            fontSize: "12.5px",
                            background: subActive ? "var(--color-ink)" : "transparent",
                            color: subActive ? "var(--color-bg)" : "var(--color-ink-soft)",
                            fontWeight: 500,
                          }}
                        >
                          · {t(sub.key)}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Side foot: user identity → links to profile/settings */}
      <Link
        href={`/${locale}/settings`}
        className="mt-auto flex items-center gap-2.5 transition-colors hover:bg-[var(--color-bg-3)]"
        style={{
          padding: "12px 10px",
          borderTop: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          textDecoration: "none",
          color: "inherit",
          borderRadius: "0",
        }}
        onClick={() => setMobileOpen(false)}
        title={t("settings")}
      >
        <span
          className="grid place-items-center flex-shrink-0"
          style={{
            width: "30px",
            height: "30px",
            borderRadius: "50%",
            background: "var(--color-ochre)",
            color: "var(--color-ink)",
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontWeight: 500,
            fontSize: "12px",
          }}
        >
          {userInitials}
        </span>
        <div className="min-w-0 flex-1">
          <strong
            className="block truncate"
            style={{ fontSize: "13px", fontWeight: 600, letterSpacing: "-0.01em" }}
          >
            {user?.name ?? "—"}
          </strong>
          <small
            className="font-mono block"
            style={{
              fontSize: "10px",
              color: "var(--color-muted)",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            {t(`role.${user?.role ?? "TENANT"}`)}
          </small>
        </div>
        <span style={{ color: "var(--color-muted)", fontSize: "14px" }}>›</span>
      </Link>
    </>
  );

  return (
    <>
      {/* Mobile hamburger trigger. 44×44 floor on phone; shrinks at sm:
          (still a comfortable 40×40 with the padding). */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-2 z-50 inline-flex h-11 w-11 items-center justify-center rounded-lg text-bg lg:hidden sm:left-4 sm:top-3"
        style={{ background: "var(--color-ink)" }}
        aria-label="Menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
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
          padding: "20px 14px",
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-md text-muted hover:bg-bg-3 transition-colors"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
        {sidebarBody}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex-col"
        style={{
          width: "244px",
          background: "var(--color-bg-2)",
          borderRight: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          padding: "20px 14px",
        }}
      >
        {sidebarBody}
      </aside>

      {/* Upgrade modal */}
      {upgradeModal && (
        <UpgradeModal
          isOpen={true}
          onClose={() => setUpgradeModal(null)}
          featureName={upgradeModal.featureName}
          requiredPlan={upgradeModal.requiredPlan}
          currentPlan={planSlug}
        />
      )}
    </>
  );
}
