"use client";

import { signOut } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/hooks/use-auth";
import { LogOut } from "lucide-react";
import { NotificationBell } from "./notification-bell";
import { LanguageSwitcher } from "./language-switcher";

const roleBadgeColors: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-700",
  ADMIN: "bg-red-100 text-red-700",
  BOARD_MEMBER: "bg-amber-100 text-amber-700",
  RESIDENT: "bg-blue-100 text-blue-700",
  TENANT: "bg-green-100 text-green-700",
};

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  BOARD_MEMBER: "Board",
  RESIDENT: "Resident",
  TENANT: "Tenant",
};

export function TopBar() {
  const t = useTranslations("common");
  const locale = useLocale();
  const { user } = useAuth();

  const role = user?.role ?? "";
  const badgeColor = roleBadgeColors[role] ?? "bg-slate-100 text-slate-700";
  const roleLabel = roleLabels[role] ?? role;

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 lg:pl-72">
      {/* Left spacer for mobile hamburger */}
      <div className="lg:hidden w-10" />

      <div className="hidden lg:block" />

      {/* Right section */}
      <div className="flex items-center gap-3">
        <LanguageSwitcher />
        <NotificationBell />

        {/* User info */}
        <div className="flex items-center gap-3 border-l border-slate-200 pl-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
            {user?.name
              ?.split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase() ?? "?"}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-slate-900">{user?.name}</p>
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badgeColor}`}
            >
              {roleLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: `/${locale}/login` })}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            title={t("logout")}
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
