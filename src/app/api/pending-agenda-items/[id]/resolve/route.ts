import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { allows } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

interface ResolveBody {
  note?: string;
  /** Pass true to re-open a previously resolved item. */
  reopen?: boolean;
}

/**
 * Mark a pending-agenda item resolved (or re-opened).
 *
 * Resolving captures `resolvedAt` + `resolvedById` + optional `resolutionNote`.
 * Re-opening clears those fields. Either way, the underlying source
 * (Complaint or BoardResignation) status is *not* changed — that's a
 * separate concern owned by the source's own workflow.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireBuildingContext();
    const { userId, buildingId } = ctx;
    if (!allows(ctx, "vote.start")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const item = await prisma.pendingAgendaItem.findUnique({
      where: { id },
      select: { id: true, buildingId: true, resolvedAt: true },
    });
    if (!item || item.buildingId !== buildingId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as ResolveBody;

    if (body.reopen) {
      if (!item.resolvedAt) {
        return NextResponse.json(
          { error: "Item is not resolved" },
          { status: 400 },
        );
      }
      await prisma.pendingAgendaItem.update({
        where: { id },
        data: {
          resolvedAt: null,
          resolvedById: null,
          resolutionNote: null,
        },
      });
      return NextResponse.json({ ok: true, action: "reopened" });
    }

    if (item.resolvedAt) {
      return NextResponse.json(
        { error: "Item already resolved" },
        { status: 409 },
      );
    }

    await prisma.pendingAgendaItem.update({
      where: { id },
      data: {
        resolvedAt: new Date(),
        resolvedById: userId,
        resolutionNote: body.note?.trim() || null,
      },
    });

    return NextResponse.json({ ok: true, action: "resolved" });
  } catch (error) {
    console.error("Failed to resolve pending-agenda item:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
