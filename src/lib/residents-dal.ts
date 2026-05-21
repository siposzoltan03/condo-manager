import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { requireBuildingContext } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import { mayExposeContactData } from "@/lib/tenant-consent";

// ─── Types ────────────────────────────────────────────────────────────────

export type ResidentGroup = "board" | "owners" | "tenants" | "partners";

export type BuildingRoleKey =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "BOARD_MEMBER"
  | "AUDITOR"
  | "OWNER"
  | "TENANT";

export interface ResidentCard {
  /** ID is User.id for residents and Contractor.id for partners. */
  id: string;
  kind: "resident" | "partner";
  name: string;
  initials: string;
  /** Mono meta line under the name (e.g. "TULAJDONOS · 2.4"). */
  metaLine: string;
  group: ResidentGroup;
  role: BuildingRoleKey | null;
  /** "OWNER" / "TENANT" or null. */
  unitRelationship: "OWNER" | "TENANT" | null;
  /** Primary unit number for the address row, or "—". */
  unitNumber: string | null;
  unitStairwell: string | null;
  unitFloor: number | null;
  unitSize: number | null;
  /** Tags rendered as small pills. */
  tags: { kind: "default" | "owe" | "board"; text: string }[];
  /** Footer line: monthly common cost, or last activity, etc. */
  footerLabel: string;
  footerValue: string;
  hasOverdue: boolean;
}

export interface ResidentsRoleDistribution {
  total: number;
  /** Stack-bar segments (in order). */
  segments: {
    group: ResidentGroup | "family";
    count: number;
    pct: number;
    label: string;
    color: string;
  }[];
  incoming: number;
  outgoing: number;
}

export interface ResidentsOverviewData {
  isBoardPlus: boolean;
  isAdmin: boolean;
  totalCount: number;
  /** Counts per sub-tab. */
  tabCounts: {
    all: number;
    owners: number;
    tenants: number;
    board: number;
    partners: number;
  };
  /** Stack-bar role distribution. */
  distribution: ResidentsRoleDistribution;
  /** Grouped cards for the directory. */
  groups: {
    key: ResidentGroup;
    title: string;
    subtitle: string;
    cards: ResidentCard[];
  }[];
}

export interface ResidentProfileData {
  id: string;
  kind: "resident" | "partner";
  name: string;
  initials: string;
  email: string | null;
  phone: string | null;
  language: string;
  /** Building role for this user — used by admin tools to gate actions. */
  role: BuildingRoleKey | null;
  /** "ELNÖK · KÉPVISELŐ" badge labels. Empty if none. */
  roleBadges: string[];
  isCurrentUser: boolean;
  unitNumber: string | null;
  unitStairwell: string | null;
  unitFloor: number | null;
  unitSize: number | null;
  /** Members of the same unit (excluding self). */
  household: {
    id: string;
    name: string;
    initials: string;
    relationship: "OWNER" | "TENANT";
    role: BuildingRoleKey | null;
  }[];
  /** 12-month participation. */
  votingCount: number;
  votingPossible: number;
  meetingsAttended: number;
  meetingsPossible: number;
  outstandingFt: number;
  /** Recent activity — last 8 events. */
  events: {
    at: string;
    kind: "ballot" | "comment" | "ticket" | "payment";
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

const ROLE_LABELS_HU: Record<BuildingRoleKey, string> = {
  SUPER_ADMIN: "Adminisztrátor",
  ADMIN: "Adminisztrátor",
  BOARD_MEMBER: "Képviselő",
  AUDITOR: "Számvizsgáló",
  OWNER: "Tulajdonos",
  TENANT: "Bérlő",
};

// ─── Main loader ──────────────────────────────────────────────────────────

export const getResidentsOverview = cache(
  async (): Promise<ResidentsOverviewData> => {
    const { userId, buildingId, role } = await requireBuildingContext();
    const isBoardPlus = hasMinimumRole(role, "BOARD_MEMBER");
    const isAdmin = hasMinimumRole(role, "ADMIN");

    const [members, contractors] = await Promise.all([
      prisma.userBuilding.findMany({
        where: { buildingId, isActive: true },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              unitUsers: {
                where: { unit: { buildingId } },
                include: {
                  unit: {
                    select: {
                      id: true,
                      number: true,
                      stairwell: true,
                      floor: true,
                      size: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ role: "asc" }, { user: { name: "asc" } }],
      }),
      prisma.contractor.findMany({
        include: {
          tickets: {
            where: { buildingId },
            select: { status: true },
          },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    // Compute charge balances per unit for "hátralék" tags.
    const unitIds = members.flatMap((m) =>
      m.user.unitUsers.map((u) => u.unitId),
    );
    const overdueByUnit = new Map<string, boolean>();
    if (unitIds.length > 0) {
      const overdueCharges = await prisma.monthlyCharge.findMany({
        where: {
          unitId: { in: unitIds },
          status: { in: ["UNPAID", "OVERDUE"] },
        },
        select: { unitId: true },
      });
      for (const c of overdueCharges) overdueByUnit.set(c.unitId, true);
    }

    // ── Map UserBuilding rows to ResidentCard objects ─────────────────────
    const residentCards: ResidentCard[] = members.map((mb) => {
      const u = mb.user;
      const primary = u.unitUsers[0];
      const unit = primary?.unit ?? null;
      const relationship: "OWNER" | "TENANT" | null =
        primary
          ? (primary.relationship as "OWNER" | "TENANT")
          : null;
      // Phase 5 — Tht. § 22(2). For TENANT rows without recorded consent,
      // the directory must not surface the email. We still render the
      // card with name and unit (the bare-minimum § 22(2) allows).
      const exposeContact = primary
        ? mayExposeContactData(primary)
        : true;

      let group: ResidentGroup;
      if (mb.role === "BOARD_MEMBER" || mb.role === "ADMIN" || mb.role === "SUPER_ADMIN") {
        group = "board";
      } else if (relationship === "TENANT" || mb.role === "TENANT") {
        group = "tenants";
      } else {
        group = "owners";
      }

      const tags: ResidentCard["tags"] = [];
      if (group === "board") {
        tags.push({ kind: "board", text: ROLE_LABELS_HU[mb.role] });
      }
      if (relationship) {
        tags.push({
          kind: "default",
          text: relationship === "OWNER" ? "Tulaj." : "Bérlő",
        });
      }
      const hasOverdue = unit ? overdueByUnit.has(unit.id) : false;
      if (hasOverdue) {
        tags.push({ kind: "owe", text: "Hátralék" });
      }

      const unitAddr = unit
        ? `${unit.stairwell ?? ""}${unit.stairwell ? " · " : ""}${unit.number} · ${Math.round(Number(unit.size))} m²`
        : "—";

      return {
        id: u.id,
        kind: "resident" as const,
        name: u.name,
        initials: initialsOf(u.name),
        metaLine:
          group === "board"
            ? ROLE_LABELS_HU[mb.role].toUpperCase() +
              (relationship ? ` · ${unit?.number ?? ""}` : "")
            : (
                relationship === "TENANT"
                  ? `BÉRLŐ${unit ? ` · ${unit.number}` : ""}`
                  : `TULAJDONOS${unit ? ` · ${unit.number}` : ""}`
              ),
        group,
        role: mb.role as BuildingRoleKey,
        unitRelationship: relationship,
        unitNumber: unit?.number ?? null,
        unitStairwell: unit?.stairwell ?? null,
        unitFloor: unit?.floor ?? null,
        unitSize: unit ? Number(unit.size) : null,
        tags,
        footerLabel: "ELÉRHETŐSÉG",
        footerValue: exposeContact ? u.email : "—",
        hasOverdue,
      };
    });

    // Override metaLine to be a sub-line meta block (mirrors the design)
    for (const c of residentCards) {
      if (c.unitNumber) {
        c.metaLine = `📍 ${c.unitStairwell ?? ""}${c.unitStairwell ? " · " : ""}${c.unitNumber}${c.unitSize ? ` · ${Math.round(c.unitSize)} M²` : ""}`;
      }
    }
    void unitIds; // suppress unused

    // ── Contractor partners as cards ─────────────────────────────────────
    const partnerCards: ResidentCard[] = contractors.map((c) => {
      const openCount = c.tickets.length;
      return {
        id: c.id,
        kind: "partner" as const,
        name: c.name,
        initials: initialsOf(c.name),
        metaLine: c.specialty.toUpperCase(),
        group: "partners" as const,
        role: null,
        unitRelationship: null,
        unitNumber: null,
        unitStairwell: null,
        unitFloor: null,
        unitSize: null,
        tags: [
          { kind: "default", text: "Partner" },
          ...(openCount > 0
            ? [{ kind: "default" as const, text: `${openCount} feladat` }]
            : []),
        ],
        footerLabel: "KAPCSOLAT",
        footerValue: c.contactInfo,
        hasOverdue: false,
      };
    });

    // ── Group the cards ──────────────────────────────────────────────────
    const board = residentCards.filter((c) => c.group === "board");
    const owners = residentCards.filter((c) => c.group === "owners");
    const tenants = residentCards.filter((c) => c.group === "tenants");

    // Mark current user
    void userId; // (currently used downstream only)

    const ownerCount = owners.length;
    const tenantCount = tenants.length;
    const boardCount = board.length;
    const partnerCount = partnerCards.length;
    const total = ownerCount + tenantCount + boardCount;

    const distribution: ResidentsRoleDistribution = {
      total,
      segments: [
        {
          group: "owners",
          count: ownerCount,
          pct: total > 0 ? Math.round((ownerCount / total) * 100) : 0,
          label: "Tulajdonos",
          color: "var(--color-moss)",
        },
        {
          group: "tenants",
          count: tenantCount,
          pct: total > 0 ? Math.round((tenantCount / total) * 100) : 0,
          label: "Bérlő",
          color: "var(--color-ochre)",
        },
        {
          group: "board",
          count: boardCount,
          pct: total > 0 ? Math.round((boardCount / total) * 100) : 0,
          label: "Képviselő",
          color: "#3a5a78",
        },
      ],
      incoming: 0,
      outgoing: 0,
    };

    return {
      isBoardPlus,
      isAdmin,
      totalCount: total + partnerCount,
      tabCounts: {
        all: total,
        owners: ownerCount,
        tenants: tenantCount,
        board: boardCount,
        partners: partnerCount,
      },
      distribution,
      groups: [
        {
          key: "board",
          title: "Képviselőtestület",
          subtitle: `· ${boardCount} TAG`,
          cards: board,
        },
        {
          key: "owners",
          title: "Tulajdonosok",
          subtitle: `· ${ownerCount} · A–Z SZERINT`,
          cards: owners,
        },
        {
          key: "tenants",
          title: "Bérlők",
          subtitle: `· ${tenantCount} · AKTUÁLIS SZERZŐDÉSEK`,
          cards: tenants,
        },
        {
          key: "partners",
          title: "Külső partnerek & szolgáltatók",
          subtitle: `· ${partnerCount} KAPCSOLAT`,
          cards: partnerCards,
        },
      ],
    };
  },
);

// ─── Profile loader ───────────────────────────────────────────────────────

export const getResidentProfile = cache(
  async (residentId: string): Promise<ResidentProfileData | null> => {
    const { userId, buildingId, role } = await requireBuildingContext();
    const isBoardPlus = hasMinimumRole(role, "BOARD_MEMBER");

    const ub = await prisma.userBuilding.findFirst({
      where: { userId: residentId, buildingId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            language: true,
            unitUsers: {
              where: { unit: { buildingId } },
              include: {
                unit: {
                  select: {
                    id: true,
                    number: true,
                    stairwell: true,
                    floor: true,
                    size: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!ub) return null;

    const u = ub.user;
    const primary = u.unitUsers[0];
    const unit = primary?.unit ?? null;

    // Household: other UnitUsers on the same unit.
    const household: ResidentProfileData["household"] = [];
    if (unit) {
      const others = await prisma.unitUser.findMany({
        where: {
          unitId: unit.id,
          userId: { not: residentId },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              userBuildings: {
                where: { buildingId },
                select: { role: true },
              },
            },
          },
        },
      });
      for (const o of others) {
        household.push({
          id: o.user.id,
          name: o.user.name,
          initials: initialsOf(o.user.name),
          relationship: o.relationship as "OWNER" | "TENANT",
          role: (o.user.userBuildings[0]?.role as BuildingRoleKey) ?? null,
        });
      }
    }

    // Voting participation: count user's ballots over the past 12 months.
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);

    const [ballots, votesPossible, meetingsAttended, allMeetings, overdueCharges] =
      await Promise.all([
        prisma.ballot.count({
          where: {
            userId: residentId,
            vote: { buildingId, createdAt: { gte: yearAgo } },
          },
        }),
        prisma.vote.count({
          where: {
            buildingId,
            createdAt: { gte: yearAgo },
            status: { in: ["OPEN", "CLOSED"] },
          },
        }),
        prisma.meetingRsvp.count({
          where: {
            userId: residentId,
            status: "ATTENDING",
            meeting: { buildingId, date: { gte: yearAgo } },
          },
        }),
        prisma.meeting.count({
          where: { buildingId, date: { gte: yearAgo } },
        }),
        unit
          ? prisma.monthlyCharge.findMany({
              where: {
                unitId: unit.id,
                status: { in: ["UNPAID", "OVERDUE"] },
              },
              select: { amount: true },
            })
          : Promise.resolve([]),
      ]);

    const outstandingFt = overdueCharges.reduce(
      (sum, c) => sum + Number(c.amount),
      0,
    );

    // Activity timeline: recent ballots + comments.
    const [recentBallots, recentComments] = await Promise.all([
      prisma.ballot.findMany({
        where: {
          userId: residentId,
          vote: { buildingId },
        },
        include: { vote: { select: { title: true, updatedAt: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.ticketComment.findMany({
        where: {
          authorId: residentId,
          ticket: { buildingId },
        },
        include: {
          ticket: { select: { trackingNumber: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    const events: ResidentProfileData["events"] = [];
    for (const b of recentBallots) {
      events.push({
        at: b.createdAt.toISOString(),
        kind: "ballot",
        headline: `Szavazat leadva: ${b.vote.title}`,
        sub: null,
      });
    }
    for (const c of recentComments) {
      events.push({
        at: c.createdAt.toISOString(),
        kind: "comment",
        headline: `Megjegyzés a(z) ${c.ticket.trackingNumber} jegyhez`,
        sub: c.body.length > 80 ? c.body.slice(0, 80) + "…" : c.body,
      });
    }
    events.sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );

    // Phase 5 — Tht. § 22(2). Same redaction rule as the directory.
    const exposeContact = primary ? mayExposeContactData(primary) : true;

    return {
      id: u.id,
      kind: "resident",
      name: u.name,
      initials: initialsOf(u.name),
      email: exposeContact ? u.email : null,
      phone: null, // not stored on User
      language: u.language,
      role: ub.role as BuildingRoleKey,
      roleBadges: [
        ROLE_LABELS_HU[ub.role as BuildingRoleKey],
        ...(primary?.relationship === "OWNER"
          ? ["Tulajdonos"]
          : primary?.relationship === "TENANT"
            ? ["Bérlő"]
            : []),
      ],
      isCurrentUser: u.id === userId,
      unitNumber: unit?.number ?? null,
      unitStairwell: unit?.stairwell ?? null,
      unitFloor: unit?.floor ?? null,
      unitSize: unit ? Number(unit.size) : null,
      household,
      votingCount: ballots,
      votingPossible: votesPossible,
      meetingsAttended,
      meetingsPossible: allMeetings,
      outstandingFt,
      events: events.slice(0, 8),
      isBoardPlus,
    };
  },
);

// ─── Board permissions for the per-resident editor ────────────────────────

export interface ResidentPermissionRow {
  id: string;
  key: string;
  labelKey: string;
  descriptionKey: string | null;
  granted: boolean;
}

export interface ResidentPermissionsData {
  /** UserBuilding id for the (resident, active building) pair. */
  userBuildingId: string;
  residentName: string;
  /** Whether the target user is currently a board member (admin+). */
  isBoard: boolean;
  permissions: ResidentPermissionRow[];
}

export const getResidentPermissions = cache(
  async (residentId: string): Promise<ResidentPermissionsData | null> => {
    const { buildingId } = await requireBuildingContext();

    const ub = await prisma.userBuilding.findUnique({
      where: {
        userId_buildingId: { userId: residentId, buildingId },
      },
      include: {
        user: { select: { name: true } },
        permissions: { select: { permissionId: true } },
      },
    });
    if (!ub) return null;

    const grantedSet = new Set(ub.permissions.map((p) => p.permissionId));
    const catalog = await prisma.boardPermission.findMany({
      orderBy: { sortOrder: "asc" },
    });
    const permissions: ResidentPermissionRow[] = catalog.map((p) => ({
      id: p.id,
      key: p.key,
      labelKey: p.labelKey,
      descriptionKey: p.descriptionKey,
      granted: grantedSet.has(p.id),
    }));

    return {
      userBuildingId: ub.id,
      residentName: ub.user.name,
      isBoard:
        ub.role === "BOARD_MEMBER" ||
        ub.role === "ADMIN" ||
        ub.role === "SUPER_ADMIN",
      permissions,
    };
  },
);

