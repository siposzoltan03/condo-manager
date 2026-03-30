"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/use-auth";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import {
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Mail,
  Wallet,
  Wrench,
  FileWarning,
  Vote,
  FileText,
  Users,
  Building2,
  Settings,
  X,
  Menu,
} from "lucide-react";
import { useState } from "react";
import { BuildingSwitcher } from "@/components/layout/building-switcher";
import { UpgradeModal } from "@/components/shared/upgrade-modal";

interface NavItem {
  key: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  minimumRole: string;
  featureSlug?: string;
  requiredPlan?: string;
  subItems?: { key: string; href: string; minimumRole: string }[];
}

const navItems: NavItem[] = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard, minimumRole: "TENANT" },
  { key: "announcements", href: "/announcements", icon: Megaphone, minimumRole: "TENANT" },
  { key: "forum", href: "/forum", icon: MessageSquare, minimumRole: "TENANT", featureSlug: "forum", requiredPlan: "pro" },
  { key: "messages", href: "/messages", icon: Mail, minimumRole: "TENANT" },
  { key: "finance", href: "/finance", icon: Wallet, minimumRole: "TENANT", featureSlug: "finance", requiredPlan: "pro", subItems: [
    { key: "buildingFinance", href: "/finance/building", minimumRole: "BOARD_MEMBER" },
  ] },
  { key: "maintenance", href: "/maintenance", icon: Wrench, minimumRole: "TENANT", featureSlug: "maintenance", requiredPlan: "pro", subItems: [
    { key: "maintenanceContractors", href: "/maintenance/contractors", minimumRole: "BOARD_MEMBER" },
    { key: "maintenanceScheduled", href: "/maintenance/scheduled", minimumRole: "BOARD_MEMBER" },
  ] },
  { key: "complaints", href: "/complaints", icon: FileWarning, minimumRole: "TENANT" },
  { key: "voting", href: "/voting", icon: Vote, minimumRole: "TENANT", featureSlug: "voting", requiredPlan: "pro" },
  { key: "documents", href: "/documents", icon: FileText, minimumRole: "TENANT" },
  { key: "users", href: "/users", icon: Users, minimumRole: "ADMIN" },
  { key: "buildings", href: "/admin/buildings", icon: Building2, minimumRole: "SUPER_ADMIN" },
  { key: "settings", href: "/settings", icon: Settings, minimumRole: "TENANT", subItems: [
    { key: "settingsInvitations", href: "/settings/invitations", minimumRole: "ADMIN" },
    { key: "settingsBilling", href: "/settings/billing", minimumRole: "ADMIN" },
  ] },
];

/** Badge label for the minimum plan */
const PLAN_BADGE: Record<string, string> = {
  pro: "PRO",
  enterprise: "ENT",
};

export function Sidebar() {
  const t = useTranslations("nav");
  const tNav = useTranslations("nav");
  const pathname = usePathname();
  const { hasRole } = useAuth();
  const { hasFeature, planSlug, isLegacy } = usePlanFeatures();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState<{
    featureName: string;
    requiredPlan: string;
  } | null>(null);

  const filteredItems = navItems.filter((item) => hasRole(item.minimumRole));

  /** Locales supported by the application. */
  const SUPPORTED_LOCALES = new Set(["hu", "en"]);

  function isActive(href: string): boolean {
    // Strip locale prefix only when the second segment is a known locale.
    // e.g. /hu/dashboard -> /dashboard, but /other-path stays as-is.
    const pathSegments = pathname.split("/");
    const pathWithoutLocale =
      pathSegments.length > 1 && SUPPORTED_LOCALES.has(pathSegments[1])
        ? "/" + pathSegments.slice(2).join("/")
        : pathname;
    return pathWithoutLocale === href || pathWithoutLocale.startsWith(href + "/");
  }

  function isFeatureAvailable(item: NavItem): boolean {
    if (!item.featureSlug) return true;
    if (isLegacy) return true;
    return hasFeature(item.featureSlug);
  }

  const navContent = (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {filteredItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        const available = isFeatureAvailable(item);
        const visibleSubItems = item.subItems?.filter((sub) => hasRole(sub.minimumRole)) ?? [];
        const badgeText = item.requiredPlan ? PLAN_BADGE[item.requiredPlan] : null;

        if (!available) {
          // Gated item — render as disabled with badge
          return (
            <div key={item.key}>
              <button
                type="button"
                onClick={() =>
                  setUpgradeModal({
                    featureName: tNav(item.key),
                    requiredPlan: item.requiredPlan ?? "pro",
                  })
                }
                className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-slate-500 cursor-not-allowed"
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{t(item.key)}</span>
                {badgeText && (
                  <span className="ml-auto text-[10px] font-bold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
                    {badgeText}
                  </span>
                )}
              </button>
            </div>
          );
        }

        return (
          <div key={item.key}>
            <Link
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-700 hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{t(item.key)}</span>
            </Link>
            {active && visibleSubItems.length > 0 && (
              <div className="ml-8 mt-1 flex flex-col gap-0.5">
                {visibleSubItems.map((sub) => {
                  const subActive = isActive(sub.href);
                  return (
                    <Link
                      key={sub.key}
                      href={sub.href}
                      onClick={() => setMobileOpen(false)}
                      className={`rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                        subActive
                          ? "bg-blue-500/30 text-white"
                          : "text-slate-400 hover:bg-slate-700 hover:text-white"
                      }`}
                    >
                      {t(sub.key)}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 rounded-lg bg-slate-800 p-2 text-white shadow-lg lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-800 transition-transform duration-300 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <BuildingSwitcher />
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="shrink-0 rounded-lg p-1 mr-3 text-slate-400 hover:text-white"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {navContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:flex lg:w-64 lg:flex-col lg:bg-slate-800">
        <BuildingSwitcher />
        {navContent}
      </aside>

      {/* Upgrade Modal */}
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
