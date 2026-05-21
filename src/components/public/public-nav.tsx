"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, Globe } from "lucide-react";
import Link from "next/link";

export function PublicNav() {
  const t = useTranslations();
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
    <nav
      className="sticky top-0 z-50 border-b border-ink/8"
      style={{ background: "color-mix(in srgb, var(--color-bg) 92%, transparent)", backdropFilter: "blur(8px)" }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="inline-flex items-center gap-2">
          <span
            className="w-8 h-8 rounded-md grid place-items-center font-display"
            style={{ background: "var(--color-ink)", color: "var(--color-bg)", fontWeight: 600 }}
          >
            K
          </span>
          <span className="font-display text-lg text-ink" style={{ fontWeight: 600, letterSpacing: "-0.015em" }}>
            Közös
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-6 md:flex">
          <Link
            href="/#features"
            className="font-mono text-xs uppercase tracking-wider text-muted hover:text-ink transition-colors"
          >
            {t("nav.features")}
          </Link>
          <Link
            href="/pricing"
            className="font-mono text-xs uppercase tracking-wider text-muted hover:text-ink transition-colors"
          >
            {t("nav.pricing")}
          </Link>

          <button
            onClick={switchLocale}
            className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-muted hover:text-ink transition-colors"
            title={locale === "hu" ? "Switch to English" : "Váltás magyarra"}
          >
            <Globe className="h-3.5 w-3.5" />
            {locale === "hu" ? "EN" : "HU"}
          </button>

          <Link
            href="/login"
            className="font-mono text-xs uppercase tracking-wider text-ink-soft hover:text-ink transition-colors"
          >
            {t("common.login")}
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-bg hover:opacity-90 transition-opacity"
          >
            {t("landing.startFreeTrial")}
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded-md p-2 text-ink-soft hover:bg-bg-3 transition-colors md:hidden"
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-ink/8 bg-bg px-6 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-3">
            <Link
              href="/#features"
              className="font-mono text-xs uppercase tracking-wider text-ink-soft"
              onClick={() => setMenuOpen(false)}
            >
              {t("nav.features")}
            </Link>
            <Link
              href="/pricing"
              className="font-mono text-xs uppercase tracking-wider text-ink-soft"
              onClick={() => setMenuOpen(false)}
            >
              {t("nav.pricing")}
            </Link>
            <Link href="/login" className="font-mono text-xs uppercase tracking-wider text-ink">
              {t("common.login")}
            </Link>
            <Link
              href="/pricing"
              className="rounded-lg bg-ink px-4 py-2 text-center font-mono text-[11px] uppercase tracking-wider text-bg"
            >
              {t("landing.startFreeTrial")}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
