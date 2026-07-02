import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeBuilding, makeUser } from "../fixtures";

/**
 * A live assembly may only be started in ONLINE/HYBRID or device-voting mode if
 * the building's SZMSZ authorises remote voting (Building.remoteVotingAuthorized).
 * In-person + show-of-hands is always allowed.
 */
const { ctxMock } = vi.hoisted(() => ({ ctxMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireBuildingContext: ctxMock, getCurrentUser: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/authz", () => ({ allows: vi.fn(() => true), requireCapability: vi.fn() }));
vi.mock("@/lib/feature-gate", () => ({
  requireFeature: vi.fn().mockResolvedValue(undefined),
  FeatureGateError: class extends Error {},
}));
vi.mock("@/lib/assembly-bus", () => ({ publishToMeeting: vi.fn() }));

const { POST } = await import("@/app/api/voting/meetings/[id]/live/route");

beforeEach(() => ctxMock.mockReset());

async function makeMeeting(buildingId: string, remoteVotingAuthorized: boolean) {
  await prisma.building.update({ where: { id: buildingId }, data: { remoteVotingAuthorized } });
  const admin = await makeUser({ buildingId, role: "ADMIN" });
  const meeting = await prisma.meeting.create({
    data: { title: "Közgyűlés", date: new Date(), time: "18:00", buildingId, createdById: admin.id },
  });
  return { admin, meeting };
}

function startReq(format: string, voteMode?: string) {
  return new Request("http://localhost/api/voting/meetings/x/live", {
    method: "POST",
    body: JSON.stringify({ action: "start", format, voteMode }),
  }) as unknown as import("next/server").NextRequest;
}

describe("live start — SZMSZ remote-voting gate", () => {
  it("refuses ONLINE when not authorised (403)", async () => {
    const { building } = await makeBuilding();
    const { meeting } = await makeMeeting(building.id, false);
    ctxMock.mockResolvedValue({ userId: "u", buildingId: building.id, role: "ADMIN" });

    const res = await POST(startReq("ONLINE"), { params: Promise.resolve({ id: meeting.id }) });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("REMOTE_VOTING_NOT_AUTHORIZED");
    const after = await prisma.meeting.findUnique({ where: { id: meeting.id } });
    expect(after!.liveStatus).not.toBe("LIVE");
  });

  it("refuses HYBRID and device voting when not authorised (403)", async () => {
    const { building } = await makeBuilding();
    const { meeting } = await makeMeeting(building.id, false);
    ctxMock.mockResolvedValue({ userId: "u", buildingId: building.id, role: "ADMIN" });

    const hybrid = await POST(startReq("HYBRID", "HANDS"), { params: Promise.resolve({ id: meeting.id }) });
    expect(hybrid.status).toBe(403);
    const deviceInPerson = await POST(startReq("IN_PERSON", "DEVICE"), { params: Promise.resolve({ id: meeting.id }) });
    expect(deviceInPerson.status).toBe(403);
  });

  it("allows IN_PERSON + show-of-hands even when not authorised", async () => {
    const { building } = await makeBuilding();
    const { meeting } = await makeMeeting(building.id, false);
    ctxMock.mockResolvedValue({ userId: "u", buildingId: building.id, role: "ADMIN" });

    const res = await POST(startReq("IN_PERSON", "HANDS"), { params: Promise.resolve({ id: meeting.id }) });
    expect(res.status).toBe(200);
    const after = await prisma.meeting.findUnique({ where: { id: meeting.id } });
    expect(after!.liveStatus).toBe("LIVE");
  });

  it("allows ONLINE once authorised", async () => {
    const { building } = await makeBuilding();
    const { meeting } = await makeMeeting(building.id, true);
    ctxMock.mockResolvedValue({ userId: "u", buildingId: building.id, role: "ADMIN" });

    const res = await POST(startReq("ONLINE"), { params: Promise.resolve({ id: meeting.id }) });
    expect(res.status).toBe(200);
    const after = await prisma.meeting.findUnique({ where: { id: meeting.id } });
    expect(after!.liveStatus).toBe("LIVE");
    expect(after!.format).toBe("ONLINE");
  });
});
