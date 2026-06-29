import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getComplaints } from "@/lib/dal";
import { getUnitsOverview } from "@/lib/units-dal";
import { allows } from "@/lib/authz";
import { requireBuildingContext } from "@/lib/auth";
import { ComplaintsShell } from "@/components/complaints/complaints-shell";
import { ComplaintsExplorer } from "@/components/complaints/complaints-explorer";
import { ComplaintsHeaderActions } from "@/components/complaints/complaints-header-actions";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "complaints.shell" });
  return { title: t("title") };
}

export default async function ComplaintsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [data, units, ctx] = await Promise.all([
    getComplaints(),
    getUnitsOverview(),
    requireBuildingContext(),
  ]);
  const isBoardPlus = allows(ctx, "view.boardContext");

  const activeCount = data.complaints.filter(
    (c) => c.status !== "RESOLVED" && c.status !== "ESCALATED",
  ).length;
  const closedCount = data.complaints.length - activeCount;

  const unitOptions = units.units
    .map((u) => ({
      id: u.id,
      number: u.number,
      stairwell: u.stairwell,
      floor: u.floor,
    }))
    .sort((a, b) => {
      const sa = a.stairwell ?? "";
      const sb = b.stairwell ?? "";
      if (sa !== sb) return sa.localeCompare(sb);
      if (a.floor !== b.floor) return a.floor - b.floor;
      return a.number.localeCompare(b.number);
    });

  return (
    <ComplaintsShell
      locale={locale}
      activeCount={activeCount}
      closedCount={closedCount}
      headerActions={
        <ComplaintsHeaderActions
          isBoardPlus={isBoardPlus}
          locale={locale}
          categories={data.categories}
          units={unitOptions}
        />
      }
    >
      <ComplaintsExplorer
        locale={locale}
        isBoardPlus={isBoardPlus}
        initialComplaints={data.complaints}
        categories={data.categories}
      />
    </ComplaintsShell>
  );
}
