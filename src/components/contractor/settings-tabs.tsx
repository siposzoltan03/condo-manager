"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export type SettingsTabKey = "profile" | "billing" | "documents";

/**
 * Horizontal sub-nav for the settings tree. Mirrors the design's
 * `.settings-tabs` strip. The active key is set explicitly by each
 * page so server-rendered cache is correct.
 */
export function SettingsTabs({
  locale,
  active,
}: {
  locale: string;
  active: SettingsTabKey;
}) {
  const t = useTranslations("marketplace");
  const tabs: Array<{ key: SettingsTabKey; href: string; label: string }> = [
    {
      key: "profile",
      href: `/${locale}/contractor/settings`,
      label: t("settingsTabProfile"),
    },
    {
      key: "billing",
      href: `/${locale}/contractor/billing`,
      label: t("settingsTabBilling"),
    },
    {
      key: "documents",
      href: `/${locale}/contractor/settings/documents`,
      label: t("settingsTabDocuments"),
    },
  ];
  return (
    <div
      className="flex items-center gap-1 flex-wrap"
      style={{
        marginBottom: "24px",
        borderBottom:
          "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        paddingBottom: "10px",
      }}
    >
      {tabs.map((tb) => {
        const isOn = tb.key === active;
        return (
          <Link
            key={tb.key}
            href={tb.href}
            className="font-mono"
            style={{
              padding: "7px 13px",
              borderRadius: "7px",
              fontSize: "12px",
              letterSpacing: "0.04em",
              background: isOn ? "var(--color-ink)" : "transparent",
              color: isOn ? "var(--color-bg)" : "var(--color-ink-soft)",
              fontWeight: isOn ? 600 : 500,
              textDecoration: "none",
            }}
          >
            {tb.label}
          </Link>
        );
      })}
    </div>
  );
}
