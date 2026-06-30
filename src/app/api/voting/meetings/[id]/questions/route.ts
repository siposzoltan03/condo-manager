import { NextRequest, NextResponse } from "next/server";
import { requireBuildingContext } from "@/lib/auth";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { prisma } from "@/lib/prisma";
import { publishToMeeting } from "@/lib/assembly-bus";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST a live Q&A item during an assembly — a typed question or a raise-hand
 * request. Any building member; only while the session is LIVE.
 */
export async function POST(request: NextRequest, ctx: RouteContext) {
  let actor;
  try {
    actor = await requireBuildingContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await requireFeature(actor.buildingId, "voting");
  } catch (err) {
    if (err instanceof FeatureGateError) {
      return NextResponse.json({ error: err.message, upgrade: true }, { status: 403 });
    }
    throw err;
  }

  const { id } = await ctx.params;
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    select: { buildingId: true, liveStatus: true, currentAgendaIndex: true },
  });
  if (!meeting || meeting.buildingId !== actor.buildingId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (meeting.liveStatus !== "LIVE") {
    return NextResponse.json({ error: "Assembly is not live" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const type = body?.type === "HAND" ? "HAND" : "QUESTION";
  const text = typeof body?.body === "string" ? body.body.trim().slice(0, 800) : "";
  if (type === "QUESTION" && !text) {
    return NextResponse.json({ error: "Question text required" }, { status: 400 });
  }

  await prisma.meetingQuestion.create({
    data: {
      meetingId: id,
      userId: actor.userId,
      type,
      body: type === "QUESTION" ? text : null,
      agendaIndex: meeting.currentAgendaIndex,
    },
  });
  publishToMeeting(id, { type: "session:question", meetingId: id });
  return NextResponse.json({ ok: true });
}
