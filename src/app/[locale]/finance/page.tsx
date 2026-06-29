import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { allows, allowsAny } from "@/lib/authz";
import {
  getDashboardContext,
  getFinanceOverview,
  getBuildingFinance,
} from "@/lib/dal";
import { FinanceOverview as ResidentFinanceOverview } from "@/components/finance/finance-overview";
import { BuildingFinanceOverview } from "@/components/finance/building-finance-overview";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
};

type TabKey = "sajat" | "epulet";

export default async function FinancePage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { tab } = await searchParams;
  setRequestLocale(locale);

  const ctx = await getDashboardContext();

  // Reachable via EITHER right: an owner sees their own-unit finance, a board
  // member / admin / auditor sees building finance (Tht. § 16, § 38). TENANT
  // (and SUPER_ADMIN, under strict can()) have neither → redirect.
  if (!allowsAny(ctx, "view.own.unit.finance", "view.building.finance")) {
    redirect(`/${locale}/dashboard`);
  }

  const isBoardPlus = allows(ctx, "view.building.finance");

  // Default tab depends on the role: residents see only "Saját"; board+
  // lands on "Épület" since that's the workspace they spend most time in.
  const activeTab: TabKey =
    !isBoardPlus
      ? "sajat"
      : tab === "sajat"
        ? "sajat"
        : "epulet";

  const t = await getTranslations({ locale, namespace: "finance" });

  // Fetch only the data the active tab needs. The "Saját" branch
  // gracefully handles users without a unit (board admins without
  // ownership) by returning empty arrays.
  const residentData =
    activeTab === "sajat" ? await getFinanceOverview() : null;
  const buildingData =
    activeTab === "epulet" && isBoardPlus
      ? await getBuildingFinance()
      : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div>
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
          {t("title")}
        </span>
        <h1 className="mt-1 font-display text-3xl text-ink leading-tight">
          {activeTab === "epulet" ? t("buildingTitle") : t("title")}
        </h1>
      </div>

      {isBoardPlus && (
        <nav
          aria-label="Finance tabs"
          className="flex gap-6 border-b border-ink/10"
        >
          <FinanceTab
            href={`/${locale}/finance?tab=sajat`}
            label={t("tabSelf")}
            active={activeTab === "sajat"}
          />
          <FinanceTab
            href={`/${locale}/finance?tab=epulet`}
            label={t("tabBuilding")}
            active={activeTab === "epulet"}
          />
        </nav>
      )}

      {activeTab === "sajat" && residentData && (
        <ResidentFinanceOverview initialData={residentData} />
      )}
      {activeTab === "epulet" && buildingData && (
        <BuildingFinanceOverview initialData={buildingData} />
      )}
    </div>
  );
}

function FinanceTab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center pb-3 font-mono text-xs uppercase tracking-wider transition-colors sm:min-h-0 ${
        active
          ? "border-b-2 border-ink text-ink"
          : "text-muted hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}
