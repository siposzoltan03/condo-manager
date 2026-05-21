import { getTranslations } from "next-intl/server";
import { DomainShell, type DomainShellTab } from "@/components/shared/domain-shell";

interface Props {
  locale: string;
  active: "overview" | "contractors" | "scheduled";
  counts?: Partial<Record<"overview" | "contractors" | "scheduled", number>>;
  titleKey?: string;
  titleSuffix?: string;
  ledeKey?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

export async function MaintenanceShell({
  locale,
  active,
  counts,
  titleKey = "maintenance.shell.title",
  titleSuffix,
  ledeKey = "maintenance.shell.lede",
  headerActions,
  children,
}: Props) {
  const t = await getTranslations({ locale });

  const tabs: DomainShellTab[] = [
    {
      key: "overview",
      href: `/${locale}/maintenance`,
      label: t("maintenance.shell.tab.overview"),
      count: counts?.overview ?? null,
    },
    {
      key: "contractors",
      href: `/${locale}/maintenance/contractors`,
      label: t("maintenance.shell.tab.contractors"),
      count: counts?.contractors ?? null,
    },
    {
      key: "scheduled",
      href: `/${locale}/maintenance/scheduled`,
      label: t("maintenance.shell.tab.scheduled"),
      count: counts?.scheduled ?? null,
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
