import { NextRequest, NextResponse } from "next/server";
import type { MeetingFormat, MeetingVoteMode } from "@prisma/client";
import { requireBuildingContext } from "@/lib/auth";
import { allows } from "@/lib/authz";
import { requireFeature, FeatureGateError } from "@/lib/feature-gate";
import { prisma } from "@/lib/prisma";
import { publishToMeeting } from "@/lib/assembly-bus";
import { getMeetingDetail } from "@/lib/dal";
import { buildMinutesDraft } from "@/lib/voting/minutes-draft";
import { meetingMinutesUpdated } from "@/lib/voting/events";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Presenter (közös képviselő) controls for a live assembly. Board-gated
 * (vote.start — representative authority, Tht. §43). Actions:
 *   start     { format, voteMode }  — go LIVE
 *   point     { index }             — move to an agenda point
 *   openVote  { voteId }            — surface a vote on the companions
 *   end                             — berekesztés (→ CLOSED)
 * Closing a vote goes through PATCH /votes/[id] (auto-award + broadcast).
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
  if (!allows(actor, "vote.start")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    select: { id: true, buildingId: true, agenda: true, liveStatus: true },
  });
  if (!meeting || meeting.buildingId !== actor.buildingId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body?.action as string;

  switch (action) {
    case "start": {
      const format: MeetingFormat = ["IN_PERSON", "HYBRID", "ONLINE"].includes(
        body.format,
      )
        ? body.format
        : "HYBRID";
      // Online has no show-of-hands — force device voting.
      let voteMode: MeetingVoteMode = body.voteMode === "HANDS" ? "HANDS" : "DEVICE";
      if (format === "ONLINE") voteMode = "DEVICE";
      await prisma.meeting.update({
        where: { id },
        data: {
          liveStatus: "LIVE",
          format,
          voteMode,
          startedAt: new Date(),
          currentAgendaIndex: 0,
          currentVoteId: null,
        },
      });
      publishToMeeting(id, { type: "session:started", meetingId: id });
      return NextResponse.json({ ok: true });
    }

    case "point": {
      const agenda = Array.isArray(meeting.agenda) ? meeting.agenda : [];
      const index = Number(body.index);
      if (!Number.isInteger(index) || index < 0 || index >= agenda.length) {
        return NextResponse.json({ error: "Invalid agenda index" }, { status: 400 });
      }
      await prisma.meeting.update({ where: { id }, data: { currentAgendaIndex: index } });
      publishToMeeting(id, { type: "session:point", meetingId: id, index });
      return NextResponse.json({ ok: true });
    }

    case "openVote": {
      const voteId = typeof body.voteId === "string" ? body.voteId : "";
      const vote = await prisma.vote.findUnique({
        where: { id: voteId },
        select: { id: true, meetingId: true, status: true },
      });
      if (!vote || vote.meetingId !== id) {
        return NextResponse.json({ error: "Vote not in this meeting" }, { status: 404 });
      }
      await prisma.meeting.update({ where: { id }, data: { currentVoteId: voteId } });
      publishToMeeting(id, { type: "session:voteOpened", meetingId: id, voteId });
      return NextResponse.json({ ok: true });
    }

    case "end": {
      await prisma.meeting.update({
        where: { id },
        data: { liveStatus: "CLOSED", endedAt: new Date(), currentVoteId: null },
      });

      // Auto-generate a jegyzőkönyv draft from the session record (closed-vote
      // resolutions + Q&A log + quorum). Best-effort: never let a draft failure
      // block the adjournment, and never clobber minutes already written.
      try {
        const detail = await getMeetingDetail(id);
        if (!detail.minutes?.trim()) {
          await prisma.meeting.update({
            where: { id },
            data: {
              minutes: buildMinutesDraft(detail),
              minutesUpdatedById: actor.userId,
              minutesUpdatedAt: new Date(),
            },
          });
          await meetingMinutesUpdated({
            meetingId: id,
            updatedByUserId: actor.userId,
            buildingId: actor.buildingId,
          });
        }
      } catch (err) {
        console.error("Auto-minutes draft failed for meeting", id, err);
      }

      publishToMeeting(id, { type: "session:ended", meetingId: id });
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
