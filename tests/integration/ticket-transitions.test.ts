import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { isValidTransition } from "@/lib/maintenance/tickets";
import {
  makeBuilding,
  makeContractorOrg,
  makeMaintenanceTicket,
  makePublication,
  makeBid,
} from "../fixtures";

// Mock the contractor session — tests inject a per-test session via this fn.
const { requireContractorMock } = vi.hoisted(() => ({
  requireContractorMock: vi.fn(),
}));

vi.mock("@/lib/contractor/session", () => ({
  requireContractor: requireContractorMock,
  requireContractorOwner: requireContractorMock,
}));

// Quiet notify — we don't need to assert its full behavior here (priority #6
// covers the notify routing). We just need it to not throw.
vi.mock("@/lib/notifications", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/notifications")
  >("@/lib/notifications");
  return { ...actual, notify: vi.fn().mockResolvedValue(undefined) };
});

const { POST } = await import("@/app/api/contractor/projects/[bidId]/status/route");

beforeEach(() => {
  requireContractorMock.mockReset();
});

describe("isValidTransition", () => {
  it("allows forward moves along the linear status order", () => {
    expect(isValidTransition("SUBMITTED", "ACKNOWLEDGED")).toBe(true);
    expect(isValidTransition("ASSIGNED", "IN_PROGRESS")).toBe(true);
    expect(isValidTransition("IN_PROGRESS", "COMPLETED")).toBe(true);
    expect(isValidTransition("COMPLETED", "VERIFIED")).toBe(true);
    // Skipping forward is also allowed (kanban drag may bypass a column).
    expect(isValidTransition("SUBMITTED", "COMPLETED")).toBe(true);
  });

  it("rejects backward and reflexive moves", () => {
    expect(isValidTransition("IN_PROGRESS", "ASSIGNED")).toBe(false);
    expect(isValidTransition("COMPLETED", "IN_PROGRESS")).toBe(false);
    expect(isValidTransition("VERIFIED", "SUBMITTED")).toBe(false);
    expect(isValidTransition("ASSIGNED", "ASSIGNED")).toBe(false);
  });

  it("rejects unknown statuses on either side", () => {
    expect(isValidTransition("FOO", "BAR")).toBe(false);
    expect(isValidTransition("SUBMITTED", "BAR")).toBe(false);
    expect(isValidTransition("FOO", "COMPLETED")).toBe(false);
  });
});

describe("POST /api/contractor/projects/[bidId]/status", () => {
  async function seedWonProject() {
    const { building } = await makeBuilding();
    const ticket = await makeMaintenanceTicket({
      buildingId: building.id,
      status: "ASSIGNED",
    });
    const pub = await makePublication({
      ticketId: ticket.id,
      buildingId: building.id,
      status: "AWARDED",
    });
    const { org, otherOrg } = await makeContractorOrg();
    const bid = await makeBid({
      publicationId: pub.id,
      bidderOrgId: org.id,
      status: "WON",
    });
    return { ticket, pub, org, otherOrg, bid };
  }

  it("advances ticket ASSIGNED → IN_PROGRESS when the bid's owner calls in", async () => {
    const { bid, ticket, org } = await seedWonProject();
    requireContractorMock.mockResolvedValue({
      userId: "user_x",
      orgId: org.id,
      role: "OWNER",
      orgStatus: "ACTIVE",
      orgPlan: "FREE",
      orgName: "Test Org",
    });

    const req = new Request(
      `http://test.local/api/contractor/projects/${bid.id}/status`,
      {
        method: "POST",
        body: JSON.stringify({ next: "IN_PROGRESS" }),
        headers: { "content-type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ bidId: bid.id }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      ticketStatus: "IN_PROGRESS",
      previous: "ASSIGNED",
    });

    const after = await prisma.maintenanceTicket.findUnique({
      where: { id: ticket.id },
    });
    expect(after!.status).toBe("IN_PROGRESS");
  });

  it("returns 404 when a different contractor org tries to update someone else's bid", async () => {
    const { bid, ticket, otherOrg } = await seedWonProject();
    requireContractorMock.mockResolvedValue({
      userId: "user_other",
      orgId: otherOrg.id, // wrong org
      role: "OWNER",
      orgStatus: "ACTIVE",
      orgPlan: "FREE",
      orgName: "Other Org",
    });

    const req = new Request(
      `http://test.local/api/contractor/projects/${bid.id}/status`,
      {
        method: "POST",
        body: JSON.stringify({ next: "IN_PROGRESS" }),
        headers: { "content-type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ bidId: bid.id }) });

    expect(res.status).toBe(404);

    // Ticket must not have advanced.
    const after = await prisma.maintenanceTicket.findUnique({
      where: { id: ticket.id },
    });
    expect(after!.status).toBe("ASSIGNED");
  });
});
