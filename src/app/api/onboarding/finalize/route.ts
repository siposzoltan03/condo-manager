import { NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireCapability } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/onboarding/finalize — mark the active building's onboarding as
 * complete. Non-gating: it records the milestone (and dismisses the setup
 * nudges) but never blocks use of the app.
 */
export async function POST() {
  try {
    const ctx = await requireBuildingContext();
    try {
      requireCapability(ctx, "board.manage");
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.building.update({
      where: { id: ctx.buildingId },
      data: { onboardingCompletedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to finalize onboarding:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
