import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  makeBuilding,
  makeMaintenanceTicket,
  makeUser,
} from "../fixtures";

const { requireBuildingContextMock } = vi.hoisted(() => ({
  requireBuildingContextMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireBuildingContext: requireBuildingContextMock,
  auth: vi.fn(),
  getSession: vi.fn(),
  getCurrentUser: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// Feature gate is a separate concern — assume the plan has "maintenance"
// enabled. The route does this check; mocking it lets us focus on the
// route's other responsibilities.
vi.mock("@/lib/feature-gate", () => ({
  requireFeature: vi.fn().mockResolvedValue(undefined),
  FeatureGateError: class FeatureGateError extends Error {},
}));

vi.mock("@/lib/queue", () => ({
  notificationsQueue: { add: vi.fn().mockResolvedValue(undefined) },
  scheduledQueue: { add: vi.fn().mockResolvedValue(undefined) },
}));

const { GET, PATCH } = await import(
  "@/app/api/maintenance/tickets/[id]/route"
);

function asContext(opts: {
  userId: string;
  buildingId: string;
  role?: "RESIDENT" | "BOARD_MEMBER" | "ADMIN";
}) {
  return {
    userId: opts.userId,
    buildingId: opts.buildingId,
    role: opts.role ?? "BOARD_MEMBER",
  };
}

beforeEach(() => {
  requireBuildingContextMock.mockReset();
});

async function seedTicket(buildingId: string, reporterId: string) {
  return makeMaintenanceTicket({
    buildingId,
    reporterId,
    status: "SUBMITTED",
  });
}

describe("GET /api/maintenance/tickets/[id]", () => {
  it("returns the ticket for a BOARD_MEMBER in the right building", async () => {
    const { building } = await makeBuilding();
    const reporter = await makeUser({ buildingId: building.id });
    const boardUser = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    const ticket = await seedTicket(building.id, reporter.id);

    requireBuildingContextMock.mockResolvedValue(
      asContext({ userId: boardUser.id, buildingId: building.id }),
    );

    const res = await GET(
      new Request("http://test") as never,
      { params: Promise.resolve({ id: ticket.id }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(ticket.id);
    expect(body.reporter.id).toBe(reporter.id);
  });

  it("non-board users only see their own tickets", async () => {
    const { building } = await makeBuilding();
    const reporter = await makeUser({ buildingId: building.id });
    const otherResident = await makeUser({ buildingId: building.id });
    const ticket = await seedTicket(building.id, reporter.id);

    requireBuildingContextMock.mockResolvedValue(
      asContext({
        userId: otherResident.id,
        buildingId: building.id,
        role: "RESIDENT",
      }),
    );

    const res = await GET(
      new Request("http://test") as never,
      { params: Promise.resolve({ id: ticket.id }) },
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 for cross-tenant access", async () => {
    const { building, otherBuilding } = await makeBuilding();
    const reporter = await makeUser({ buildingId: building.id });
    const otherBoardUser = await makeUser({
      buildingId: otherBuilding.id,
      role: "BOARD_MEMBER",
    });
    const ticket = await seedTicket(building.id, reporter.id);

    requireBuildingContextMock.mockResolvedValue(
      asContext({
        userId: otherBoardUser.id,
        buildingId: otherBuilding.id,
      }),
    );

    const res = await GET(
      new Request("http://test") as never,
      { params: Promise.resolve({ id: ticket.id }) },
    );
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/maintenance/tickets/[id]", () => {
  it("updates status, creates audit log, and notifies reporter", async () => {
    const { building } = await makeBuilding();
    const reporter = await makeUser({ buildingId: building.id });
    const boardUser = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    const ticket = await seedTicket(building.id, reporter.id);

    requireBuildingContextMock.mockResolvedValue(
      asContext({ userId: boardUser.id, buildingId: building.id }),
    );

    const req = new Request("http://test", {
      method: "PATCH",
      body: JSON.stringify({ status: "ACKNOWLEDGED" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req as never, {
      params: Promise.resolve({ id: ticket.id }),
    });
    expect(res.status).toBe(200);

    const after = await prisma.maintenanceTicket.findUnique({
      where: { id: ticket.id },
    });
    expect(after!.status).toBe("ACKNOWLEDGED");

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: "MaintenanceTicket", entityId: ticket.id },
    });
    expect(audit).not.toBeNull();
    expect(audit!.userId).toBe(boardUser.id);

    const notif = await prisma.notification.findFirst({
      where: { userId: reporter.id, type: "MAINTENANCE_STATUS" },
    });
    expect(notif).not.toBeNull();
  });

  it("rejects invalid backward status transitions with 400", async () => {
    const { building } = await makeBuilding();
    const reporter = await makeUser({ buildingId: building.id });
    const boardUser = await makeUser({
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });
    // Ticket is COMPLETED — going back to ASSIGNED is invalid.
    const ticket = await makeMaintenanceTicket({
      buildingId: building.id,
      reporterId: reporter.id,
      status: "COMPLETED",
    });

    requireBuildingContextMock.mockResolvedValue(
      asContext({ userId: boardUser.id, buildingId: building.id }),
    );

    const req = new Request("http://test", {
      method: "PATCH",
      body: JSON.stringify({ status: "ASSIGNED" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req as never, {
      params: Promise.resolve({ id: ticket.id }),
    });
    expect(res.status).toBe(400);

    const after = await prisma.maintenanceTicket.findUnique({
      where: { id: ticket.id },
    });
    expect(after!.status).toBe("COMPLETED"); // unchanged
  });

  it("returns 404 when a board user in the other building patches", async () => {
    const { building, otherBuilding } = await makeBuilding();
    const reporter = await makeUser({ buildingId: building.id });
    const otherBoardUser = await makeUser({
      buildingId: otherBuilding.id,
      role: "BOARD_MEMBER",
    });
    const ticket = await seedTicket(building.id, reporter.id);

    requireBuildingContextMock.mockResolvedValue(
      asContext({
        userId: otherBoardUser.id,
        buildingId: otherBuilding.id,
      }),
    );

    const req = new Request("http://test", {
      method: "PATCH",
      body: JSON.stringify({ status: "ACKNOWLEDGED" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req as never, {
      params: Promise.resolve({ id: ticket.id }),
    });
    expect(res.status).toBe(404);

    const after = await prisma.maintenanceTicket.findUnique({
      where: { id: ticket.id },
    });
    expect(after!.status).toBe("SUBMITTED"); // unchanged
  });
});
