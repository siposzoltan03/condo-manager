"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Building2, Menu, X, Globe } from "lucide-react";
import Link from "next/link";

export function PublicNav() {
  const t = useTranslations();
  const { isAuthenticated } = useAuth();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  function switchLocale() {
    const newLocale = locale === "hu" ? "en" : "hu";
    const segments = pathname.split("/");
    if (segments.length > 1 && ["hu", "en"].includes(segments[1])) {
      segments[1] = newLocale;
    }
    router.push(segments.join("/") || "/");
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Building2 className="h-7 w-7 text-[#002045]" />
          <span className="text-xl font-extrabold tracking-tight text-[#002045]">
            {t("common.appName")}
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-6 md:flex">
          <a
            href="/#features"
            className="text-sm font-medium text-slate-600 transition hover:text-[#002045]"
          >
            {t("nav.features")}
          </a>
          <Link
            href="/pricing"
            className="text-sm font-medium text-slate-600 transition hover:text-[#002045]"
          >
            {t("nav.pricing")}
          </Link>

          <button
            onClick={switchLocale}
            className="flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-[#002045]"
            title={locale === "hu" ? "Switch to English" : "Váltás magyarra"}
          >
            <Globe className="h-4 w-4" />
            {locale === "hu" ? "English" : "Magyar"}
          </button>

          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-[#002045] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#003060]"
            >
              {t("landing.goToDashboard")}
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-semibold text-[#002045] transition hover:text-[#003060]"
              >
                {t("common.login")}
              </Link>
              <Link
                href="/pricing"
                className="rounded-lg bg-[#002045] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#003060]"
              >
                {t("landing.startFreeTrial")}
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 md:hidden"
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-slate-200 bg-white px-4 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-3">
            <a
              href="/#features"
              className="text-sm font-medium text-slate-600"
              onClick={() => setMenuOpen(false)}
            >
              {t("nav.features")}
            </a>
            <Link
              href="/pricing"
              className="text-sm font-medium text-slate-600"
              onClick={() => setMenuOpen(false)}
            >
              {t("nav.pricing")}
            </Link>
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="rounded-lg bg-[#002045] px-4 py-2 text-center text-sm font-semibold text-white"
              >
                {t("landing.goToDashboard")}
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-semibold text-[#002045]"
                >
                  {t("common.login")}
                </Link>
                <Link
                  href="/pricing"
                  className="rounded-lg bg-[#002045] px-4 py-2 text-center text-sm font-semibold text-white"
                >
                  {t("landing.startFreeTrial")}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
