import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { auth, requireBuildingContext } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────

export type RoleKey =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "BOARD_MEMBER"
  | "OWNER"
  | "TENANT";

export interface ProfileUser {
  id: string;
  name: string;
  initials: string;
  email: string;
  emailVerifiedAt: string | null;
  secondaryEmail: string | null;
  secondaryEmailVerifiedAt: string | null;
  phone: string | null;
  birthDate: string | null;
  permanentAddress: string | null;
  mailingAddress: string | null;
  language: string;
  /** Days since the user joined this building (tenure). */
  tenureDays: number;
  /** Joined date for this user (createdAt of the UserBuilding). */
  memberSinceISO: string;
}

export interface ProfileUnitCard {
  id: string;
  number: string;
  stairwell: string | null;
  floor: number;
  size: number;
  ownershipShare: number;
  monthlyChargeFt: number | null;
  occupantCount: number;
  /** TENANT name when not owner-occupied; otherwise null. */
  tenantName: string | null;
  /** "primary" = same address as user, "investment" = let out, "secondary" = otherwise. */
  kind: "primary" | "investment" | "secondary";
  isPrimary: boolean;
  /** OWNER / TENANT relationship the user holds on this unit. */
  relationship: "OWNER" | "TENANT";
}

/** Notification preferences shape: per-event-type, per-channel. */
export type NotificationChannel = "push" | "email" | "sms" | "digest";
export type NotificationEventKey =
  | "announcements"
  | "voting"
  | "finance"
  | "maintenance"
  | "comments"
  | "marketing";

export type NotificationMatrix = Record<
  NotificationEventKey,
  Record<NotificationChannel, boolean>
>;

export interface ProfileBoardPermission {
  id: string;
  key: string;
  labelKey: string;
  descriptionKey: string | null;
  granted: boolean;
}

export interface ProfileSession {
  id: string;
  device: string;
  detail: string;
  location: string;
  ipMasked: string;
  isCurrent: boolean;
  lastActiveISO: string;
}

export interface ProfileResignation {
  id: string;
  status: "PENDING" | "ACKNOWLEDGED" | "WITHDRAWN";
  meetingDate: string | null;
  submittedAt: string;
}

export interface ProfileHealth {
  pct: number;
  checks: {
    key:
      | "kyc_verified"
      | "two_factor"
      | "primary_email"
      | "secondary_email"
      | "phone"
      | "avatar"
      | "address";
    state: "ok" | "warn" | "todo";
  }[];
}

export interface ProfileOverviewData {
  user: ProfileUser;
  buildingId: string;
  buildingName: string;
  role: RoleKey;
  /** Mandate dates for board members (stub: derived from membership). */
  mandateStartISO: string | null;
  mandateEndISO: string | null;
  /** Active resignation if one is pending. */
  pendingResignation: ProfileResignation | null;
  /** True when the user has confirmed 2FA enrollment. */
  twoFactorEnabled: boolean;
  units: ProfileUnitCard[];
  permissions: ProfileBoardPermission[];
  notifications: NotificationMatrix;
  /** Quiet hours preferences ("HH:mm"–"HH:mm") if set. */
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  health: ProfileHealth;
  /** Stub session list — Phase 2 will populate from a real Session model. */
  sessions: ProfileSession[];
  /** Counts for the right rail. */
  buildingBoardSize: number;
  buildingUnitCount: number;
  buildingResidentCount: number;
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

const DEFAULT_NOTIFICATION_MATRIX: NotificationMatrix = {
  announcements: { push: true, email: true, sms: false, digest: true },
  voting: { push: true, email: true, sms: true, digest: false },
  finance: { push: true, email: true, sms: false, digest: true },
  maintenance: { push: true, email: true, sms: false, digest: false },
  comments: { push: true, email: false, sms: false, digest: false },
  marketing: { push: false, email: false, sms: false, digest: true },
};

function readMatrix(prefs: unknown): NotificationMatrix {
  if (!prefs || typeof prefs !== "object") return DEFAULT_NOTIFICATION_MATRIX;
  const stored = (prefs as { matrix?: unknown }).matrix;
  if (!stored || typeof stored !== "object") return DEFAULT_NOTIFICATION_MATRIX;
  // Merge stored over defaults so new event keys appear with safe defaults.
  const out: NotificationMatrix = {
    announcements: { ...DEFAULT_NOTIFICATION_MATRIX.announcements },
    voting: { ...DEFAULT_NOTIFICATION_MATRIX.voting },
    finance: { ...DEFAULT_NOTIFICATION_MATRIX.finance },
    maintenance: { ...DEFAULT_NOTIFICATION_MATRIX.maintenance },
    comments: { ...DEFAULT_NOTIFICATION_MATRIX.comments },
    marketing: { ...DEFAULT_NOTIFICATION_MATRIX.marketing },
  };
  for (const ev of Object.keys(out) as NotificationEventKey[]) {
    const row = (stored as Record<string, unknown>)[ev];
    if (row && typeof row === "object") {
      for (const ch of ["push", "email", "sms", "digest"] as NotificationChannel[]) {
        const val = (row as Record<string, unknown>)[ch];
        if (typeof val === "boolean") out[ev][ch] = val;
      }
    }
  }
  return out;
}

function readQuietHours(prefs: unknown): { start: string | null; end: string | null } {
  if (!prefs || typeof prefs !== "object") return { start: null, end: null };
  const qh = (prefs as { quietHours?: { start?: unknown; end?: unknown } }).quietHours;
  if (!qh) return { start: null, end: null };
  return {
    start: typeof qh.start === "string" ? qh.start : null,
    end: typeof qh.end === "string" ? qh.end : null,
  };
}

// ─── Main loader ──────────────────────────────────────────────────────────

export const getProfileOverview = cache(
  async (): Promise<ProfileOverviewData> => {
    const { userId, buildingId } = await requireBuildingContext();
    const now = new Date();

    const [user, building, ub, units, allPerms, boardCount, unitCount, residentCount] =
      await Promise.all([
        prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: {
            id: true,
            name: true,
            email: true,
            emailVerifiedAt: true,
            secondaryEmail: true,
            secondaryEmailVerifiedAt: true,
            phone: true,
            birthDate: true,
            permanentAddress: true,
            mailingAddress: true,
            language: true,
            notificationPreferences: true,
            totpEnrolledAt: true,
            createdAt: true,
          },
        }),
        prisma.building.findUniqueOrThrow({
          where: { id: buildingId },
          select: { id: true, name: true, address: true, zipCode: true, city: true },
        }),
        prisma.userBuilding.findUnique({
          where: { userId_buildingId: { userId, buildingId } },
          include: {
            permissions: { include: { permission: true } },
            resignations: {
              where: { status: "PENDING" },
              include: {
                pendingAgenda: {
                  include: {
                    attachedMeeting: { select: { date: true } },
                  },
                },
              },
              orderBy: { submittedAt: "desc" },
              take: 1,
            },
          },
        }),
        prisma.unitUser.findMany({
          where: { userId, unit: { buildingId } },
          include: {
            unit: {
              include: {
                _count: { select: { unitUsers: true } },
                unitUsers: {
                  where: { relationship: "TENANT" },
                  include: { user: { select: { name: true } } },
                  take: 1,
                },
                monthlyCharges: {
                  orderBy: { month: "desc" },
                  take: 1,
                  select: { amount: true },
                },
              },
            },
          },
          orderBy: { isPrimaryContact: "desc" },
        }),
        prisma.boardPermission.findMany({
          orderBy: { sortOrder: "asc" },
        }),
        prisma.userBuilding.count({
          where: { buildingId, isActive: true, role: { in: ["BOARD_MEMBER", "ADMIN", "SUPER_ADMIN"] } },
        }),
        prisma.unit.count({ where: { buildingId } }),
        prisma.userBuilding.count({
          where: { buildingId, isActive: true, role: { in: ["OWNER", "TENANT", "BOARD_MEMBER"] } },
        }),
      ]);

    const role = (ub?.role ?? "OWNER") as RoleKey;
    const memberSince = ub?.createdAt ?? user.createdAt;
    const tenureDays = Math.floor(
      (now.getTime() - memberSince.getTime()) / 86_400_000,
    );

    const grantedPermIds = new Set(
      (ub?.permissions ?? []).map((p) => p.permissionId),
    );
    const permissions: ProfileBoardPermission[] = allPerms.map((p) => ({
      id: p.id,
      key: p.key,
      labelKey: p.labelKey,
      descriptionKey: p.descriptionKey,
      granted: grantedPermIds.has(p.id),
    }));

    // Map unit relationships to cards.
    const unitCards: ProfileUnitCard[] = units.map((uu, idx) => {
      const u = uu.unit;
      const tenantUser = u.unitUsers[0]?.user ?? null;
      const isOwnerOccupied = uu.relationship === "OWNER" && !tenantUser;
      const kind: ProfileUnitCard["kind"] = isOwnerOccupied
        ? "primary"
        : tenantUser
          ? "investment"
          : "secondary";
      return {
        id: u.id,
        number: u.number,
        stairwell: u.stairwell,
        floor: u.floor,
        size: Number(u.size),
        ownershipShare: Number(u.ownershipShare),
        monthlyChargeFt: u.monthlyCharges[0]
          ? Number(u.monthlyCharges[0].amount)
          : null,
        occupantCount: u._count.unitUsers,
        tenantName: tenantUser?.name ?? null,
        kind,
        isPrimary: idx === 0,
        relationship: uu.relationship as "OWNER" | "TENANT",
      };
    });

    // Health checks
    const checks: ProfileHealth["checks"] = [
      { key: "kyc_verified", state: "todo" }, // Phase 2c
      { key: "two_factor", state: user.totpEnrolledAt ? "ok" : "warn" },
      { key: "primary_email", state: user.emailVerifiedAt ? "ok" : "warn" },
      {
        key: "secondary_email",
        state: !user.secondaryEmail
          ? "todo"
          : user.secondaryEmailVerifiedAt
            ? "ok"
            : "warn",
      },
      { key: "phone", state: user.phone ? "ok" : "todo" },
      { key: "avatar", state: "todo" },
      { key: "address", state: user.permanentAddress ? "ok" : "todo" },
    ];
    const okCount = checks.filter((c) => c.state === "ok").length;
    const pct = Math.round((okCount / checks.length) * 100);

    // Resignation
    const pendingRes = ub?.resignations[0];
    const pendingResignation: ProfileResignation | null = pendingRes
      ? {
          id: pendingRes.id,
          status: pendingRes.status,
          meetingDate:
            pendingRes.pendingAgenda?.attachedMeeting?.date.toISOString() ??
            null,
          submittedAt: pendingRes.submittedAt.toISOString(),
        }
      : null;

    // Mandate stub: anchored to UserBuilding.createdAt + 3 years.
    const mandateStart = ub?.createdAt ?? null;
    const mandateEnd = mandateStart
      ? new Date(mandateStart.getTime() + 3 * 365 * 86_400_000)
      : null;

    void building; // currently unused; reserved for hero address line
    const quietHours = readQuietHours(user.notificationPreferences);

    return {
      user: {
        id: user.id,
        name: user.name,
        initials: initialsOf(user.name),
        email: user.email,
        emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
        secondaryEmail: user.secondaryEmail,
        secondaryEmailVerifiedAt:
          user.secondaryEmailVerifiedAt?.toISOString() ?? null,
        phone: user.phone,
        birthDate: user.birthDate?.toISOString() ?? null,
        permanentAddress: user.permanentAddress,
        mailingAddress: user.mailingAddress,
        language: user.language,
        tenureDays,
        memberSinceISO: memberSince.toISOString(),
      },
      buildingId: building.id,
      buildingName: building.name,
      role,
      mandateStartISO: mandateStart?.toISOString() ?? null,
      mandateEndISO: mandateEnd?.toISOString() ?? null,
      pendingResignation,
      twoFactorEnabled: !!user.totpEnrolledAt,
      units: unitCards,
      permissions,
      notifications: readMatrix(user.notificationPreferences),
      quietHoursStart: quietHours.start,
      quietHoursEnd: quietHours.end,
      health: { pct, checks },
      sessions: await loadSessions(userId),
      buildingBoardSize: boardCount,
      buildingUnitCount: unitCount,
      buildingResidentCount: residentCount,
    };
  },
);

/** Load active sessions for the current user, marking which is "current". */
async function loadSessions(userId: string): Promise<ProfileSession[]> {
  const session = await auth();
  const currentTokenId = session?.user?.tokenId ?? null;

  const rows = await prisma.userSession.findMany({
    where: { userId, revokedAt: null },
    orderBy: { lastActiveAt: "desc" },
    take: 20,
  });

  return rows.map((row) => ({
    id: row.id,
    device: row.deviceLabel ?? "Web böngésző",
    detail: row.userAgent
      ? row.userAgent.length > 80
        ? row.userAgent.slice(0, 80) + "…"
        : row.userAgent
      : "—",
    location: row.city
      ? row.country
        ? `${row.city}, ${row.country}`
        : row.city
      : row.country ?? "—",
    ipMasked: row.ipMasked ?? "—",
    isCurrent: !!currentTokenId && row.tokenId === currentTokenId,
    lastActiveISO: row.lastActiveAt.toISOString(),
  }));
}

// ────────────────────────────────────────────────────────────────────────
// /api/settings route — user-scoped DAL functions
// ────────────────────────────────────────────────────────────────────────

/**
 * The current user's profile settings (no PII the user shouldn't see).
 */
export async function getUserSettings(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      language: true,
      notificationPreferences: true,
    },
  });
}

/**
 * Unit number for a user in a specific building (when they're attached
 * to one via `UnitUser`). Used by the settings page to display "Unit
 * 1.A" alongside the profile.
 */
export async function getUserUnitInBuilding(userId: string, buildingId: string) {
  const unitUser = await prisma.unitUser.findFirst({
    where: { userId, unit: { buildingId } },
    include: { unit: { select: { number: true } } },
  });
  return unitUser ? { number: unitUser.unit.number } : null;
}

/**
 * Password hash for verification on a password-change request.
 */
export async function getUserPasswordHash(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
}

/**
 * Apply a settings update. Returns the same shape `getUserSettings`
 * returns so the route can echo the result back to the client.
 */
export async function updateUserSettings(
  userId: string,
  data: import("@prisma/client").Prisma.UserUpdateInput,
) {
  return prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      language: true,
      notificationPreferences: true,
    },
  });
}

/**
 * Find a condo-side User by email. Used by contractor signup for the
 * cross-tree collision check — peeks across domain boundaries because
 * the same email can't exist on both sides.
 */
export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
}
