import { describe, it, expect, vi } from "vitest";

// maintenance-dal.ts pulls in @/lib/auth → next-auth, which trips
// vitest's ESM loader. Mock @/lib/auth wholesale (same pattern as the
// other route tests).
vi.mock("@/lib/auth", () => ({
  requireBuildingContext: vi.fn(),
  auth: vi.fn(),
  getSession: vi.fn(),
  getCurrentUser: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import {
  makeBuilding,
  makeMaintenanceTicket,
  makePublication,
  makeUser,
} from "../fixtures";
import { findTicketForBidReview } from "@/lib/maintenance-dal";

describe("findTicketForBidReview", () => {
  it("returns the ticket with publication when buildingId matches", async () => {
    const { building } = await makeBuilding();
    const reporter = await makeUser({ buildingId: building.id });
    const ticket = await makeMaintenanceTicket({
      buildingId: building.id,
      reporterId: reporter.id,
      title: "Leaky tap",
    });
    await makePublication({ ticketId: ticket.id, buildingId: building.id });

    const out = await findTicketForBidReview({
      id: ticket.id,
      buildingId: building.id,
    });
    expect(out).not.toBeNull();
    expect(out!.title).toBe("Leaky tap");
    expect(out!.publication).not.toBeNull();
  });

  it("returns null for cross-tenant access", async () => {
    const { building, otherBuilding } = await makeBuilding();
    const reporter = await makeUser({ buildingId: building.id });
    const ticket = await makeMaintenanceTicket({
      buildingId: building.id,
      reporterId: reporter.id,
    });

    const out = await findTicketForBidReview({
      id: ticket.id,
      buildingId: otherBuilding.id,
    });
    expect(out).toBeNull();

    // Sanity: the ticket exists, the function just refused to return it.
    const exists = await prisma.maintenanceTicket.findUnique({
      where: { id: ticket.id },
    });
    expect(exists).not.toBeNull();
  });
});
