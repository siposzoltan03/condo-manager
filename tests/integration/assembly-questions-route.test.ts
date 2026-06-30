import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { BuildingRole, MeetingLiveStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { makeBuilding, makeUser } from "../fixtures";

/**
 * Live Q&A: any member may submit a question / raise a hand while the
 * assembly is LIVE; the presenter (board) marks items addressed.
 */
const { ctxMock } = vi.hoisted(() => ({ ctxMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireBuildingContext: ctxMock, getCurrentUser: vi.fn(), auth: vi.fn() }));

const { POST } = await import("@/app/api/voting/meetings/[id]/questions/route");
const { PATCH } = await import("@/app/api/voting/meetings/[id]/questions/[qid]/route");

beforeEach(() => ctxMock.mockReset());

function asActor(buildingId: string, userId: string, role: BuildingRole, isChair = false) {
  ctxMock.mockResolvedValue({ userId, buildingId, role, isChair, isProfessional: false, ownsAnyUnit: false, isAuditor: false });
}

async function makeMeeting(buildingId: string, createdById: string, liveStatus: MeetingLiveStatus = "LIVE") {
  return prisma.meeting.create({
    data: { title: "Q2", date: new Date(), time: "18:00", buildingId, createdById, liveStatus, currentAgendaIndex: 1 },
  });
}

function postReq(id: string, body: unknown) {
  return [
    new NextRequest(`http://test/api/voting/meetings/${id}/questions`, { method: "POST", body: JSON.stringify(body) }),
    { params: Promise.resolve({ id }) },
  ] as const;
}

describe("assembly Q&A", () => {
  it("an owner raises a hand and asks a question while LIVE", async () => {
    const { building } = await makeBuilding();
    const u = await makeUser({ buildingId: building.id, role: "OWNER" });
    const m = await makeMeeting(building.id, u.id);
    asActor(building.id, u.id, "OWNER");

    expect((await POST(...postReq(m.id, { type: "HAND" }))).status).toBe(200);
    expect((await POST(...postReq(m.id, { type: "QUESTION", body: "Mikor kezdődik?" }))).status).toBe(200);
    expect((await POST(...postReq(m.id, { type: "QUESTION" }))).status).toBe(400); // no body

    const qs = await prisma.meetingQuestion.findMany({ where: { meetingId: m.id }, orderBy: { createdAt: "asc" } });
    expect(qs.map((q) => q.type)).toEqual(["HAND", "QUESTION"]);
    expect(qs[0].agendaIndex).toBe(1);
    expect(qs[1].body).toBe("Mikor kezdődik?");
  });

  it("rejects submissions when the assembly is not LIVE", async () => {
    const { building } = await makeBuilding();
    const u = await makeUser({ buildingId: building.id, role: "OWNER" });
    const m = await makeMeeting(building.id, u.id, "SCHEDULED");
    asActor(building.id, u.id, "OWNER");
    expect((await POST(...postReq(m.id, { type: "HAND" }))).status).toBe(400);
  });

  it("only the board may mark an item addressed", async () => {
    const { building } = await makeBuilding();
    const owner = await makeUser({ buildingId: building.id, role: "OWNER" });
    const m = await makeMeeting(building.id, owner.id);
    const q = await prisma.meetingQuestion.create({
      data: { meetingId: m.id, userId: owner.id, type: "HAND", agendaIndex: 0 },
    });
    const patchReq = () =>
      [
        new NextRequest(`http://test/x`, { method: "PATCH", body: "{}" }),
        { params: Promise.resolve({ id: m.id, qid: q.id }) },
      ] as const;

    asActor(building.id, owner.id, "OWNER");
    expect((await PATCH(...patchReq())).status).toBe(403);

    asActor(building.id, owner.id, "BOARD_MEMBER", true);
    expect((await PATCH(...patchReq())).status).toBe(200);
    expect((await prisma.meetingQuestion.findUnique({ where: { id: q.id } }))?.status).toBe("ADDRESSED");
  });
});
