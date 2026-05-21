import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Phase 2 — Tht. § 27(3), § 51/A audit committee + external auditor.
 *
 * GET returns current + historical auditor memberships for a building.
 * Allowed for BOARD_MEMBER, AUDITOR, ADMIN (and SUPER_ADMIN platform-side).
 *
 * POST / PATCH are intentionally not implemented in this commit. Adding
 * an auditor requires UI work + owner-validation (committee members
 * must be tulajdonostárs per § 27(3)), which lives in the building-
 * officers settings page (separate plan item).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: buildingId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the caller has a role in this building that permits reading
  // the auditor list. SUPER_ADMIN sees every building; BOARD_MEMBER,
  // AUDITOR, ADMIN need to belong to the building.
  const isSuperAdmin = user.role === "SUPER_ADMIN";
  if (!isSuperAdmin) {
    const membership = await prisma.userBuilding.findUnique({
      where: {
        userId_buildingId: { userId: user.id, buildingId },
      },
      select: { role: true },
    });
    const allowed =
      membership?.role === "BOARD_MEMBER" ||
      membership?.role === "AUDITOR" ||
      membership?.role === "ADMIN";
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const rows = await prisma.auditorMembership.findMany({
    where: { buildingId },
    orderBy: [{ endedAt: "asc" }, { startedAt: "desc" }],
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({
    buildingId,
    auditors: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      user: r.user,
    })),
  });
}
