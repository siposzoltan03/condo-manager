import { NextResponse } from "next/server";
import { requireSuperAdmin, adminErrorResponse } from "@/lib/admin-feature-guard";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/impersonation/members?buildingId=… — the building's active members
 * for the "view as user" picker. SUPER_ADMIN only.
 */
export async function GET(request: Request) {
  try {
    await requireSuperAdmin();
    const buildingId = new URL(request.url).searchParams.get("buildingId");
    if (!buildingId) {
      return NextResponse.json({ error: "buildingId required" }, { status: 400 });
    }

    const members = await prisma.userBuilding.findMany({
      where: { buildingId, isActive: true },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: [{ role: "asc" }, { user: { name: "asc" } }],
    });

    return NextResponse.json(
      members.map((m) => ({
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        isChair: m.isChair,
      })),
    );
  } catch (error) {
    return adminErrorResponse(error);
  }
}
