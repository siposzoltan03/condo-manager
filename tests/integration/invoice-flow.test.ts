import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  makeBuilding,
  makeContractorOrg,
  makeContractorUser,
  makeMaintenanceTicket,
  makePublication,
  makeBid,
  makeUser,
} from "../fixtures";

// Per-test session injection points.
const { requireContractorMock, requireBuildingContextMock } = vi.hoisted(() => ({
  requireContractorMock: vi.fn(),
  requireBuildingContextMock: vi.fn(),
}));

vi.mock("@/lib/contractor/session", () => ({
  requireContractor: requireContractorMock,
  requireContractorOwner: requireContractorMock,
}));

// We mock @/lib/auth wholesale rather than importActual — its real init
// drags in next-auth which fails to resolve under vitest's ESM loader. The
// route only uses requireBuildingContext; the other exports aren't reached.
vi.mock("@/lib/auth", () => ({
  requireBuildingContext: requireBuildingContextMock,
  auth: vi.fn(),
  getSession: vi.fn(),
  getCurrentUser: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// Lightweight storage stub — returns a deterministic key so we can assert
// the invoice row links to it. No real disk I/O.
vi.mock("@/lib/storage", () => ({
  MAX_UPLOAD_BYTES: 10 * 1024 * 1024, // 10 MB
  getStorage: () => ({
    put: vi.fn().mockResolvedValue({ key: "stored/invoice-key" }),
    remove: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/lib/notifications", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/notifications")
  >("@/lib/notifications");
  return { ...actual, notify: vi.fn().mockResolvedValue(undefined) };
});

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

const { POST: uploadInvoice } = await import(
  "@/app/api/contractor/projects/[bidId]/invoice/route"
);
const { POST: markInvoicePaid } = await import(
  "@/app/api/maintenance/tickets/[id]/marketplace-invoice/paid/route"
);

beforeEach(() => {
  requireContractorMock.mockReset();
  requireBuildingContextMock.mockReset();
});

async function seedWonProject(
  ticketStatus: "ASSIGNED" | "IN_PROGRESS" | "COMPLETED",
) {
  const { building } = await makeBuilding();
  const boardUser = await makeUser({
    buildingId: building.id,
    role: "BOARD_MEMBER",
  });
  const ticket = await makeMaintenanceTicket({
    buildingId: building.id,
    status: ticketStatus,
  });
  const pub = await makePublication({
    ticketId: ticket.id,
    buildingId: building.id,
    publishedById: boardUser.id,
    status: "AWARDED",
  });
  const { org } = await makeContractorOrg();
  const contractorUser = await makeContractorUser({ orgId: org.id });
  const bid = await makeBid({
    publicationId: pub.id,
    bidderOrgId: org.id,
    status: "WON",
  });
  await prisma.marketplacePublication.update({
    where: { id: pub.id },
    data: { awardedBidId: bid.id, awardedAt: new Date() },
  });
  return { building, ticket, pub, org, bid, boardUser, contractorUser };
}

function asMultipart(fields: Record<string, string>, file?: File) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  if (file) form.set("file", file);
  return form;
}

function multipartRequest(bidId: string, body: FormData) {
  return new Request(`http://test.local/api/contractor/projects/${bidId}/invoice`, {
    method: "POST",
    body,
  });
}

const validInvoiceFields = {
  invoiceNumber: "INV-2026-001",
  grossAmount: "150000",
  issuedAt: "2026-05-10",
  dueAt: "2026-05-24",
};

describe("Invoice upload — contractor", () => {
  it("refuses upload when the project is not COMPLETED", async () => {
    const { bid, org, contractorUser } = await seedWonProject("ASSIGNED");
    requireContractorMock.mockResolvedValue({
      userId: contractorUser.id,
      orgId: org.id,
      role: "OWNER",
      orgStatus: "ACTIVE",
      orgPlan: "FREE",
      orgName: org.name,
    });
    const form = asMultipart(validInvoiceFields);
    const res = await uploadInvoice(
      multipartRequest(bid.id, form) as never,
      { params: Promise.resolve({ bidId: bid.id }) },
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.reason).toBe("NOT_COMPLETED");

    const invoice = await prisma.marketplaceInvoice.findUnique({
      where: { bidId: bid.id },
    });
    expect(invoice).toBeNull();
  });

  it("rejects non-PDF file with 415", async () => {
    const { bid, org, contractorUser } = await seedWonProject("COMPLETED");
    requireContractorMock.mockResolvedValue({
      userId: contractorUser.id,
      orgId: org.id,
      role: "OWNER",
      orgStatus: "ACTIVE",
      orgPlan: "FREE",
      orgName: org.name,
    });

    const notPdf = new File(["not really a pdf"], "evil.txt", {
      type: "text/plain",
    });
    const form = asMultipart(validInvoiceFields, notPdf);

    const res = await uploadInvoice(
      multipartRequest(bid.id, form) as never,
      { params: Promise.resolve({ bidId: bid.id }) },
    );
    expect(res.status).toBe(415);
    const body = await res.json();
    expect(body.reason).toBe("FILE_TYPE");
  });

  it("refuses to overwrite an invoice already marked PAID", async () => {
    const { bid, org, contractorUser } = await seedWonProject("COMPLETED");
    // Seed a PAID invoice — represents the state after the board has
    // already marked it paid. Re-upload by the contractor must be rejected.
    await prisma.marketplaceInvoice.create({
      data: {
        bidId: bid.id,
        invoiceNumber: "INV-PAID-001",
        grossAmount: 150000,
        issuedAt: new Date("2026-05-10"),
        dueAt: new Date("2026-05-24"),
        status: "PAID",
        paidAt: new Date(),
      },
    });

    requireContractorMock.mockResolvedValue({
      userId: contractorUser.id,
      orgId: org.id,
      role: "OWNER",
      orgStatus: "ACTIVE",
      orgPlan: "FREE",
      orgName: org.name,
    });

    const form = asMultipart({
      ...validInvoiceFields,
      invoiceNumber: "INV-2026-002",
    });
    const res = await uploadInvoice(
      multipartRequest(bid.id, form) as never,
      { params: Promise.resolve({ bidId: bid.id }) },
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.reason).toBe("ALREADY_PAID");

    // PAID row preserved unchanged.
    const after = await prisma.marketplaceInvoice.findUnique({
      where: { bidId: bid.id },
    });
    expect(after!.invoiceNumber).toBe("INV-PAID-001");
  });
});

describe("Invoice mark-paid — board", () => {
  it("transitions ticket COMPLETED → VERIFIED and invoice → PAID in one go", async () => {
    const { ticket, bid, building, boardUser } = await seedWonProject("COMPLETED");
    const invoice = await prisma.marketplaceInvoice.create({
      data: {
        bidId: bid.id,
        invoiceNumber: "INV-2026-010",
        grossAmount: 200000,
        issuedAt: new Date("2026-05-10"),
        dueAt: new Date("2026-05-24"),
        status: "PENDING",
      },
    });

    requireBuildingContextMock.mockResolvedValue({
      userId: boardUser.id,
      buildingId: building.id,
      role: "BOARD_MEMBER",
    });

    const res = await markInvoicePaid(
      new Request("http://test.local/x", { method: "POST" }),
      { params: Promise.resolve({ id: ticket.id }) },
    );
    expect(res.status).toBe(200);

    const afterInvoice = await prisma.marketplaceInvoice.findUnique({
      where: { id: invoice.id },
    });
    expect(afterInvoice!.status).toBe("PAID");
    expect(afterInvoice!.paidAt).not.toBeNull();
    expect(afterInvoice!.paidById).toBe(boardUser.id);

    const afterTicket = await prisma.maintenanceTicket.findUnique({
      where: { id: ticket.id },
    });
    expect(afterTicket!.status).toBe("VERIFIED");
  });
});
