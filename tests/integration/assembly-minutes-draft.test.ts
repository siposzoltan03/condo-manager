import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { BuildingRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { makeBuilding, makeUser } from "../fixtures";

/**
 * Adjourning a live assembly (the `end` action) auto-generates a jegyzőkönyv
 * draft from the session record: closed-vote resolutions + the Q&A log. The
 * draft never clobbers minutes that were already written.
 */
const { ctxMock } = vi.hoisted(() => ({ ctxMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireBuildingContext: ctxMock, getCurrentUser: vi.fn(), auth: vi.fn() }));

const { POST } = await import("@/app/api/voting/meetings/[id]/live/route");

beforeEach(() => ctxMock.mockReset());

function asActor(buildingId: string, userId: string, role: BuildingRole, isChair = false) {
  ctxMock.mockResolvedValue({ userId, buildingId, role, isChair, isProfessional: false, ownsAnyUnit: false, isAuditor: false });
}

function endReq(id: string) {
  return [
    new NextRequest(`http://test/api/voting/meetings/${id}/live`, { method: "POST", body: JSON.stringify({ action: "end" }) }),
    { params: Promise.resolve({ id }) },
  ] as const;
}

/** A LIVE meeting with one CLOSED, passing YES/NO vote and one question. */
async function makeSession(buildingId: string, createdById: string) {
  const unit = await prisma.unit.create({
    data: { number: "1", floor: 1, ownershipShare: "0.5000", size: "60.00", buildingId },
  });
  const meeting = await prisma.meeting.create({
    data: {
      title: "Q2 Közgyűlés", date: new Date(), time: "18:00", buildingId, createdById,
      agenda: ["Megnyitó", "Tetőfelújítás elfogadása"], liveStatus: "LIVE", format: "HYBRID",
    },
  });
  const vote = await prisma.vote.create({
    data: {
      title: "Tetőfelújítás elfogadása", voteType: "YES_NO", status: "CLOSED",
      majorityType: "SIMPLE_MAJORITY", quorumRequired: "0.5000", deadline: new Date(),
      buildingId, meetingId: meeting.id, createdById,
      options: { create: [{ label: "Igen", sortOrder: 0 }, { label: "Nem", sortOrder: 1 }] },
    },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });
  await prisma.ballot.create({
    data: { voteId: vote.id, optionId: vote.options[0].id, unitId: unit.id, userId: createdById, weight: "0.5000" },
  });
  await prisma.meetingQuestion.create({
    data: { meetingId: meeting.id, userId: createdById, type: "QUESTION", body: "Mennyi a tartalék?", agendaIndex: 1, status: "ADDRESSED" },
  });
  return meeting;
}

describe("auto-minutes on adjournment", () => {
  it("writes a draft from the closed-vote result and the Q&A log", async () => {
    const { building } = await makeBuilding();
    const u = await makeUser({ buildingId: building.id, role: "BOARD_MEMBER" });
    const m = await makeSession(building.id, u.id);
    asActor(building.id, u.id, "BOARD_MEMBER", true);

    const res = await POST(...endReq(m.id));
    expect(res.status).toBe(200);

    const after = await prisma.meeting.findUnique({ where: { id: m.id } });
    expect(after?.liveStatus).toBe("CLOSED");
    expect(after?.minutesUpdatedById).toBe(u.id);
    const md = after?.minutes ?? "";
    expect(md).toContain("# Jegyzőkönyv");
    expect(md).toContain("Tetőfelújítás elfogadása");
    expect(md).toContain("ELFOGADTA"); // passing vote
    expect(md).toContain("Mennyi a tartalék?"); // question log
  });

  it("does not overwrite minutes that already exist", async () => {
    const { building } = await makeBuilding();
    const u = await makeUser({ buildingId: building.id, role: "ADMIN" });
    const m = await makeSession(building.id, u.id);
    await prisma.meeting.update({ where: { id: m.id }, data: { minutes: "Kézzel írt jegyzőkönyv." } });
    asActor(building.id, u.id, "ADMIN");

    expect((await POST(...endReq(m.id))).status).toBe(200);
    expect((await prisma.meeting.findUnique({ where: { id: m.id } }))?.minutes).toBe("Kézzel írt jegyzőkönyv.");
  });
});
