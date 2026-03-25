"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { Globe } from "lucide-react";

export function LoginLanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function switchLocale(newLocale: string) {
    const segments = pathname.split("/");
    segments[1] = newLocale;
    router.push(segments.join("/"));
  }

  return (
    <div className="flex items-center gap-2 text-sm" style={{ color: "#515f74" }}>
      <Globe className="h-4 w-4" />
      <button
        type="button"
        onClick={() => switchLocale("en")}
        className={`hover:underline ${locale === "en" ? "font-bold" : ""}`}
        style={locale === "en" ? { color: "#002045" } : undefined}
      >
        English
      </button>
      <span>/</span>
      <button
        type="button"
        onClick={() => switchLocale("hu")}
        className={`hover:underline ${locale === "hu" ? "font-bold" : ""}`}
        style={locale === "hu" ? { color: "#002045" } : undefined}
      >
        Magyar
      </button>
    </div>
  );
}
