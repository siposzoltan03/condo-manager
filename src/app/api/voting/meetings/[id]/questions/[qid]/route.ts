import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { allows } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { publishToMeeting } from "@/lib/assembly-bus";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; qid: string }> };

/**
 * Presenter moderates a Q&A item — mark it addressed (felolvasva / szót adva).
 * Board-gated (vote.start).
 */
export async function PATCH(request: NextRequest, ctx: RouteContext) {
  let actor;
  try {
    actor = await requireBuildingContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!allows(actor, "vote.start")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, qid } = await ctx.params;
  const q = await prisma.meetingQuestion.findUnique({
    where: { id: qid },
    select: { meetingId: true, meeting: { select: { buildingId: true } } },
  });
  if (!q || q.meetingId !== id || q.meeting.buildingId !== actor.buildingId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.meetingQuestion.update({
    where: { id: qid },
    data: { status: "ADDRESSED" },
  });
  publishToMeeting(id, { type: "session:question", meetingId: id });
  return NextResponse.json({ ok: true });
}
