import { getTranslations } from "next-intl/server";
import { DomainShell, type DomainShellTab } from "@/components/shared/domain-shell";

interface Props {
  locale: string;
  active: "active" | "meetings" | "history" | "proxy";
  counts?: Partial<Record<"active" | "meetings" | "history", number>>;
  titleKey?: string;
  titleSuffix?: string;
  ledeKey?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

export async function VotingShell({
  locale,
  active,
  counts,
  titleKey = "voting.shell.title",
  titleSuffix,
  ledeKey = "voting.shell.lede",
  headerActions,
  children,
}: Props) {
  const t = await getTranslations({ locale });

  const tabs: DomainShellTab[] = [
    {
      key: "active",
      href: `/${locale}/voting`,
      label: t("voting.shell.tab.active"),
      count: counts?.active ?? null,
    },
    {
      key: "meetings",
      href: `/${locale}/voting/meetings`,
      label: t("voting.shell.tab.meetings"),
      count: counts?.meetings ?? null,
    },
    {
      key: "history",
      href: `/${locale}/voting/history`,
      label: t("voting.shell.tab.history"),
      count: counts?.history ?? null,
    },
    {
      key: "proxy",
      href: `/${locale}/voting/proxy`,
      label: t("voting.shell.tab.proxy"),
    },
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
