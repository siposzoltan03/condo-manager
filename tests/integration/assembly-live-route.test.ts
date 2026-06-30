import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { BuildingRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { makeBuilding, makeUser } from "../fixtures";

/**
 * Presenter controls for live assembly mode. Board-gated (vote.start =
 * chair/admin). start goes LIVE (+ online forces device voting); point moves
 * the agenda index; end closes the session.
 */
const { ctxMock } = vi.hoisted(() => ({ ctxMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  requireBuildingContext: ctxMock,
  getCurrentUser: vi.fn(),
  auth: vi.fn(),
}));

const { POST } = await import("@/app/api/voting/meetings/[id]/live/route");

beforeEach(() => ctxMock.mockReset());

function asActor(buildingId: string, userId: string, role: BuildingRole, isChair = false) {
  ctxMock.mockResolvedValue({
    userId, buildingId, role, isChair,
    isProfessional: false, ownsAnyUnit: false, isAuditor: false,
  });
}

function req(id: string, body: unknown) {
  return [
    new NextRequest(`http://test/api/voting/meetings/${id}/live`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  ] as const;
}

async function makeMeeting(buildingId: string, createdById: string) {
  return prisma.meeting.create({
    data: {
      title: "Q2", date: new Date(), time: "18:00", buildingId, createdById,
      agenda: ["Megnyitó", "Beszámoló", "Egyebek"],
    },
  });
}

describe("POST /api/voting/meetings/[id]/live", () => {
  it("rejects a non-board owner with 403", async () => {
    const { building } = await makeBuilding();
    const u = await makeUser({ buildingId: building.id, role: "OWNER" });
    const m = await makeMeeting(building.id, u.id);
    asActor(building.id, u.id, "OWNER");
    const res = await POST(...req(m.id, { action: "start", format: "HYBRID" }));
    expect(res.status).toBe(403);
  });

  it("starts the session; ONLINE forces device voting", async () => {
    const { building } = await makeBuilding();
    const u = await makeUser({ buildingId: building.id, role: "BOARD_MEMBER" });
    const m = await makeMeeting(building.id, u.id);
    asActor(building.id, u.id, "BOARD_MEMBER", true);

    const res = await POST(...req(m.id, { action: "start", format: "ONLINE", voteMode: "HANDS" }));
    expect(res.status).toBe(200);
    const after = await prisma.meeting.findUnique({ where: { id: m.id } });
    expect(after?.liveStatus).toBe("LIVE");
    expect(after?.format).toBe("ONLINE");
    expect(after?.voteMode).toBe("DEVICE"); // online → device only
    expect(after?.startedAt).not.toBeNull();
  });

  it("moves the agenda point and ends the session", async () => {
    const { building } = await makeBuilding();
    const u = await makeUser({ buildingId: building.id, role: "ADMIN" });
    const m = await makeMeeting(building.id, u.id);
    asActor(building.id, u.id, "ADMIN");

    await POST(...req(m.id, { action: "start", format: "HYBRID", voteMode: "DEVICE" }));
    const pt = await POST(...req(m.id, { action: "point", index: 2 }));
    expect(pt.status).toBe(200);
    expect((await prisma.meeting.findUnique({ where: { id: m.id } }))?.currentAgendaIndex).toBe(2);

    const bad = await POST(...req(m.id, { action: "point", index: 9 }));
    expect(bad.status).toBe(400);

    await POST(...req(m.id, { action: "end" }));
    expect((await prisma.meeting.findUnique({ where: { id: m.id } }))?.liveStatus).toBe("CLOSED");
  });
});
