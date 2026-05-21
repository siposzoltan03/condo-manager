import { setRequestLocale } from "next-intl/server";
import { hasMinimumRole } from "@/lib/rbac";
import { getDashboardContext } from "@/lib/dal";
import {
  getBoardDashboard,
  getBuildingName,
  getFollowups,
  getMemberDashboard,
} from "@/lib/dashboard-dal";
import { BoardDashboard } from "@/components/dashboard/board-dashboard";
import { MemberDashboard } from "@/components/dashboard/member-dashboard";
import { requireBuildingContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRegistryStatus } from "@/lib/officer-registry";
import { hasActiveAuditCommittee } from "@/lib/audit-committee";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function DashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getDashboardContext();
  const isBoardPlus = hasMinimumRole(ctx.role, "BOARD_MEMBER");

  if (isBoardPlus) {
    const { buildingId } = await requireBuildingContext();
    // Phase 4 + Phase 2 compliance state for the banners. Lives in the
    // building row (thresholds, registry deadline) + AuditorMembership.
    const compliance = await prisma.building.findUnique({
      where: { id: buildingId },
      select: {
        name: true,
        requiresAuditCommittee: true,
        representativeRegisteredAt: true,
        representativeRegistryDeadline: true,
      },
    });
    const [data, followups, hasCommittee] = await Promise.all([
      getBoardDashboard(),
      getFollowups(),
      hasActiveAuditCommittee(prisma, buildingId),
    ]);
    const registryStatus = compliance
      ? getRegistryStatus({
          representativeRegisteredAt: compliance.representativeRegisteredAt,
          representativeRegistryDeadline: compliance.representativeRegistryDeadline,
        })
      : null;
    return (
      <BoardDashboard
        locale={locale}
        userName={ctx.userName}
        data={data}
        followups={followups}
        activeBuildingName={compliance?.name ?? (await getBuildingName(buildingId))?.name ?? ""}
        compliance={{
          registryStatus,
          requiresAuditCommittee: compliance?.requiresAuditCommittee ?? false,
          hasActiveCommittee: hasCommittee,
        }}
      />
    );
  }

  // OWNER / TENANT — Tiles dashboard with role-conditional panels.
  const memberData = await getMemberDashboard();
  return (
    <MemberDashboard
      locale={locale}
      userName={ctx.userName}
      data={memberData}
    />
  );
}
