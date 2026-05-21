"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";

const SUPPORTED_LOCALES = ["en", "hu"];

export function LoginLanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function switchLocale(newLocale: string) {
    const segments = pathname.split("/");
    if (segments.length > 1 && SUPPORTED_LOCALES.includes(segments[1])) {
      segments[1] = newLocale;
    } else {
      segments.splice(1, 0, newLocale);
    }
    router.push(segments.join("/"));
  }

  return (
    <div
      className="inline-flex items-center gap-2 font-mono"
      style={{
        fontSize: "11px",
        color: "var(--color-muted)",
        letterSpacing: "0.04em",
      }}
    >
      <button
        type="button"
        onClick={() => switchLocale("hu")}
        className="hover:text-[var(--color-ink)] transition-colors"
        style={{
          color: locale === "hu" ? "var(--color-ink)" : undefined,
          fontWeight: locale === "hu" ? 600 : 400,
        }}
      >
        HU
      </button>
      <span>·</span>
      <button
        type="button"
        onClick={() => switchLocale("en")}
        className="hover:text-[var(--color-ink)] transition-colors"
        style={{
          color: locale === "en" ? "var(--color-ink)" : undefined,
          fontWeight: locale === "en" ? 600 : 400,
        }}
      >
        EN
      </button>
    </div>
  );
}
