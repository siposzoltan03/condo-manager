import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { DomainShell, type DomainShellTab } from "@/components/shared/domain-shell";

interface Props {
  locale: string;
  active: "overview" | "ledger" | "units" | "budget" | "invoices";
  counts?: Partial<Record<"ledger" | "units", number>>;
  ledeKey?: string;
  headerActions?: React.ReactNode;
  titleKey?: string;
  titleSuffix?: string;
  children: React.ReactNode;
}

export async function FinanceShell({
  locale,
  active,
  counts,
  ledeKey = "finance.shell.lede",
  headerActions,
  titleKey = "finance.shell.title",
  titleSuffix,
  children,
}: Props) {
  const t = await getTranslations({ locale });

  const tabs: DomainShellTab[] = [
    { key: "overview", href: `/${locale}/finance`, label: t("finance.shell.tab.overview") },
    {
      key: "ledger",
      href: `/${locale}/finance/ledger`,
      label: t("finance.shell.tab.ledger"),
      count: counts?.ledger ?? null,
    },
    {
      key: "units",
      href: `/${locale}/finance/units`,
      label: t("finance.shell.tab.units"),
      count: counts?.units ?? null,
    },
    { key: "budget", href: `/${locale}/finance/budget`, label: t("finance.shell.tab.budget") },
    { key: "invoices", href: `/${locale}/finance/invoices`, label: t("finance.shell.tab.invoices") },
  ];

  return (
    <DomainShell
      active={active}
      tabs={tabs}
      title={t(titleKey)}
      titleSuffix={titleSuffix}
      lede={t(ledeKey)}
      headerActions={headerActions}
      locale={locale}
    >
      {children}
    </DomainShell>
  );
}

// ─── Shared button helpers ────────────────────────────────────────────────

export function FinanceButton({
  href,
  variant = "ghost",
  icon,
  children,
}: {
  href?: string;
  variant?: "ghost" | "primary" | "danger" | "good";
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const styles = {
    ghost: {
      background: "var(--color-card)",
      color: "var(--color-ink)",
      border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
    },
    primary: {
      background: "var(--color-ink)",
      color: "var(--color-bg)",
      border: "1px solid var(--color-ink)",
    },
    danger: {
      background: "var(--color-card)",
      color: "var(--color-danger)",
      border: "1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)",
    },
    good: {
      background: "var(--color-card)",
      color: "var(--color-good)",
      border: "1px solid color-mix(in srgb, var(--color-good) 50%, transparent)",
    },
  }[variant];

  const inner = (
    <>
      {icon}
      {children}
    </>
  );

  const props = {
    className:
      "inline-flex items-center gap-2 transition-opacity hover:opacity-90",
    style: {
      padding: "9px 14px",
      borderRadius: "8px",
      fontSize: "13px",
      fontWeight: 600,
      ...styles,
    },
  };

  return href ? (
    <Link href={href} {...props}>
      {inner}
    </Link>
  ) : (
    <button type="button" {...props}>
      {inner}
    </button>
  );
}
