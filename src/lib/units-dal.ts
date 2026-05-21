import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";

// ─── Types ────────────────────────────────────────────────────────────────

export type OccupancyKind =
  | "owner_occupied"
  | "tenant_occupied"
  | "sublet"
  | "vacant";

export interface UnitMapCell {
  id: string;
  number: string;
  /** Stairwell ("A", "B"...) or null. */
  stairwell: string | null;
  floor: number;
  positionOnFloor: number | null;
  size: number;
  ownershipShare: number;
  occupancy: OccupancyKind;
  hasOverdue: boolean;
  primaryName: string | null;
  primaryInitials: string | null;
  /** Number of people associated with the unit (any relationship). */
  occupantCount: number;
}

export interface UnitsKpis {
  total: number;
  ownerOccupied: number;
  tenantOccupied: number;
  vacant: number;
  totalAreaM2: number;
}

export interface UnitsFloorMap {
  /** "A" / "B" / null (single-stairwell). */
  stairwell: string | null;
  /** Floors descending (top-to-bottom in the visual). */
  floors: {
    floor: number;
    units: UnitMapCell[];
  }[];
}

export interface UnitsOverviewData {
  isBoardPlus: boolean;
  building: { id: string; name: string; address: string; city: string };
  kpis: UnitsKpis;
  /** All map cells (used for both map + table views). */
  units: UnitMapCell[];
  /** Grouped for the floor map. */
  floorMap: UnitsFloorMap[];
  /** Counts per sub-tab. */
  tabCounts: {
    map: number;
    owners: number;
    tenants: number;
    vacant: number;
    commons: number;
  };
}

export interface UnitDetailData {
  id: string;
  number: string;
  stairwell: string | null;
  floor: number;
  positionOnFloor: number | null;
  size: number;
  ownershipShare: number;
  occupancy: OccupancyKind;
  building: {
    id: string;
    name: string;
    address: string;
    city: string;
    zipCode: string;
  };
  occupants: {
    id: string;
    name: string;
    initials: string;
    relationship: "OWNER" | "TENANT";
    isPrimaryContact: boolean;
    /** First registration date with this unit. */
    sinceISO: string;
  }[];
  /** Last 6 months of charges (most-recent first). */
  charges: {
    month: string;
    amount: number;
    status: "PAID" | "UNPAID" | "OVERDUE";
    paidAtISO: string | null;
  }[];
  /** Active monthly charge amount (most recent UNPAID or latest charge). */
  monthlyAmountFt: number | null;
  totalCommonCostFt: number;
  paidCommonCostFt: number;
  /** Open maintenance ticket count. */
  openTicketCount: number;
  /** Recent activity events for the unit (last 8). */
  events: {
    at: string;
    kind: "payment" | "ticket" | "vote";
    headline: string;
    sub: string | null;
  }[];
  isBoardPlus: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function occupancyOf(
  unitUsers: {
    relationship: "OWNER" | "TENANT";
    isPrimaryContact: boolean;
  }[],
): OccupancyKind {
  if (unitUsers.length === 0) return "vacant";
  const hasOwner = unitUsers.some((u) => u.relationship === "OWNER");
  const hasTenant = unitUsers.some((u) => u.relationship === "TENANT");
  if (hasOwner && hasTenant) return "sublet";
  if (hasTenant) return "tenant_occupied";
  return "owner_occupied";
}

// ─── Main loader ──────────────────────────────────────────────────────────

export const getUnitsOverview = cache(
  async (): Promise<UnitsOverviewData> => {
    const { buildingId, role } = await requireBuildingContext();
    const isBoardPlus = hasMinimumRole(role, "BOARD_MEMBER");

    const building = await prisma.building.findUnique({
      where: { id: buildingId },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
      },
    });
    if (!building) {
      throw new Error(
        "Active building no longer exists. Please log out and log back in.",
      );
    }

    const units = await prisma.unit.findMany({
      where: { buildingId },
      include: {
        unitUsers: {
          select: {
            relationship: true,
            isPrimaryContact: true,
            user: { select: { id: true, name: true } },
          },
        },
        monthlyCharges: {
          select: { status: true, month: true, amount: true },
          orderBy: { month: "desc" },
          take: 6,
        },
      },
      orderBy: [
        { stairwell: "asc" },
        { floor: "asc" },
        { positionOnFloor: "asc" },
        { number: "asc" },
      ],
    });

    const cells: UnitMapCell[] = units.map((u) => {
      const occupancy = occupancyOf(u.unitUsers);
      const primary =
        u.unitUsers.find((uu) => uu.isPrimaryContact)?.user ??
        u.unitUsers[0]?.user ??
        null;
      const hasOverdue = u.monthlyCharges.some(
        (c) => c.status === "OVERDUE" || c.status === "UNPAID",
      );
      return {
        id: u.id,
        number: u.number,
        stairwell: u.stairwell,
        floor: u.floor,
        positionOnFloor: u.positionOnFloor,
        size: Number(u.size),
        ownershipShare: Number(u.ownershipShare),
        occupancy,
        hasOverdue,
        primaryName: primary?.name ?? null,
        primaryInitials: primary ? initialsOf(primary.name) : null,
        occupantCount: u.unitUsers.length,
      };
    });

    // ── KPIs ──────────────────────────────────────────────────────────────
    const kpis: UnitsKpis = {
      total: cells.length,
      ownerOccupied: cells.filter((c) => c.occupancy === "owner_occupied")
        .length,
      tenantOccupied: cells.filter(
        (c) => c.occupancy === "tenant_occupied" || c.occupancy === "sublet",
      ).length,
      vacant: cells.filter((c) => c.occupancy === "vacant").length,
      totalAreaM2: cells.reduce((sum, c) => sum + c.size, 0),
    };

    // ── Floor map (group by stairwell, floors descending) ────────────────
    const stairwellMap = new Map<string | null, Map<number, UnitMapCell[]>>();
    for (const c of cells) {
      if (!stairwellMap.has(c.stairwell)) {
        stairwellMap.set(c.stairwell, new Map());
      }
      const floors = stairwellMap.get(c.stairwell)!;
      if (!floors.has(c.floor)) floors.set(c.floor, []);
      floors.get(c.floor)!.push(c);
    }

    const floorMap: UnitsFloorMap[] = Array.from(stairwellMap.entries())
      .sort(([a], [b]) => {
        if (a == null && b == null) return 0;
        if (a == null) return 1;
        if (b == null) return -1;
        return a.localeCompare(b);
      })
      .map(([stairwell, floors]) => ({
        stairwell,
        floors: Array.from(floors.entries())
          .sort(([a], [b]) => b - a) // floors descending (top first)
          .map(([floor, units]) => ({
            floor,
            units: units.sort(
              (a, b) =>
                (a.positionOnFloor ?? 99) - (b.positionOnFloor ?? 99),
            ),
          })),
      }));

    return {
      isBoardPlus,
      building,
      kpis,
      units: cells,
      floorMap,
      tabCounts: {
        map: cells.length,
        owners: cells.filter((c) => c.occupancy === "owner_occupied").length,
        tenants: cells.filter(
          (c) => c.occupancy === "tenant_occupied" || c.occupancy === "sublet",
        ).length,
        vacant: cells.filter((c) => c.occupancy === "vacant").length,
        commons: 0,
      },
    };
  },
);

// ─── Detail loader ────────────────────────────────────────────────────────

export const getUnitDetail = cache(
  async (unitId: string): Promise<UnitDetailData | null> => {
    const { buildingId, role } = await requireBuildingContext();
    const isBoardPlus = hasMinimumRole(role, "BOARD_MEMBER");

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        building: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            zipCode: true,
          },
        },
        unitUsers: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: [{ isPrimaryContact: "desc" }, { createdAt: "asc" }],
        },
        monthlyCharges: {
          orderBy: { month: "desc" },
          take: 6,
        },
        ballots: {
          select: { vote: { select: { title: true, updatedAt: true } } },
          orderBy: { createdAt: "desc" },
          take: 4,
        },
      },
    });

    if (!unit || unit.buildingId !== buildingId) return null;

    const occupancy = occupancyOf(
      unit.unitUsers.map((uu) => ({
        relationship: uu.relationship as "OWNER" | "TENANT",
        isPrimaryContact: uu.isPrimaryContact,
      })),
    );

    const charges = unit.monthlyCharges.map((c) => ({
      month: c.month,
      amount: Number(c.amount),
      status: c.status as "PAID" | "UNPAID" | "OVERDUE",
      paidAtISO: c.paidAt?.toISOString() ?? null,
    }));

    const monthlyAmountFt = charges[0]?.amount ?? null;
    const totalCommonCostFt = charges.reduce((s, c) => s + c.amount, 0);
    const paidCommonCostFt = charges
      .filter((c) => c.status === "PAID")
      .reduce((s, c) => s + c.amount, 0);

    const openTicketCount = await prisma.maintenanceTicket.count({
      where: {
        buildingId,
        location: { contains: unit.number },
        status: { in: ["SUBMITTED", "ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS"] },
      },
    });

    // Build event timeline
    const events: UnitDetailData["events"] = [];
    for (const c of charges.slice(0, 4)) {
      if (c.status === "PAID" && c.paidAtISO) {
        events.push({
          at: c.paidAtISO,
          kind: "payment",
          headline: `${c.month} közös költség befizetve`,
          sub: `${c.amount.toLocaleString("hu-HU")} Ft`,
        });
      }
    }
    for (const b of unit.ballots.slice(0, 3)) {
      events.push({
        at: b.vote.updatedAt.toISOString(),
        kind: "vote",
        headline: `Szavazat leadva: ${b.vote.title}`,
        sub: null,
      });
    }
    events.sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );

    return {
      id: unit.id,
      number: unit.number,
      stairwell: unit.stairwell,
      floor: unit.floor,
      positionOnFloor: unit.positionOnFloor,
      size: Number(unit.size),
      ownershipShare: Number(unit.ownershipShare),
      occupancy,
      building: unit.building,
      occupants: unit.unitUsers.map((uu) => ({
        id: uu.user.id,
        name: uu.user.name,
        initials: initialsOf(uu.user.name),
        relationship: uu.relationship as "OWNER" | "TENANT",
        isPrimaryContact: uu.isPrimaryContact,
        sinceISO: uu.createdAt.toISOString(),
      })),
      charges,
      monthlyAmountFt,
      totalCommonCostFt,
      paidCommonCostFt,
      openTicketCount,
      events: events.slice(0, 8),
      isBoardPlus,
    };
  },
);
