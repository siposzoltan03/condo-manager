import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeContractorOrg, makeContractorUser } from "../fixtures";

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

const { evaluateReadiness, tryActivate } = await import(
  "@/lib/contractor/activation"
);

async function seedReadyOrg() {
  // Default contractor org is ACTIVE — override to PENDING for the
  // activation flow under test.
  const { org } = await makeContractorOrg({
    status: "PENDING_VERIFICATION",
    specialties: ["plumbing"],
  });
  await prisma.contractorOrg.update({
    where: { id: org.id },
    data: {
      navConfirmedAt: new Date(),
      dpaSignedAt: new Date(),
      regions: ["01"],
    },
  });
  await prisma.contractorDocument.create({
    data: {
      orgId: org.id,
      kind: "insurance",
      fileName: "ins.pdf",
      storageKey: "k-ins",
    },
  });
  await prisma.contractorDocument.create({
    data: {
      orgId: org.id,
      kind: "license",
      fileName: "lic.pdf",
      storageKey: "k-lic",
    },
  });
  await makeContractorUser({ orgId: org.id, email: "owner@test.local" });
  return org;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("evaluateReadiness", () => {
  it("returns ready=true when every precondition is met", async () => {
    const org = await seedReadyOrg();
    const r = await evaluateReadiness(org.id);
    expect(r.ready).toBe(true);
    expect(Object.values(r.missing).every((v) => v === false)).toBe(true);
  });

  it("flags every missing piece on a fresh PENDING org", async () => {
    const { org } = await makeContractorOrg({
      status: "PENDING_VERIFICATION",
      specialties: [],
    });
    const r = await evaluateReadiness(org.id);
    expect(r.ready).toBe(false);
    expect(r.missing.nav).toBe(true);
    expect(r.missing.dpa).toBe(true);
    expect(r.missing.insuranceDoc).toBe(true);
    expect(r.missing.licenseDoc).toBe(true);
    expect(r.missing.specialty).toBe(true);
    expect(r.missing.region).toBe(true);
  });
});

describe("tryActivate", () => {
  it("flips a ready PENDING org to ACTIVE", async () => {
    const org = await seedReadyOrg();
    const result = await tryActivate(org.id, "http://test/login", "hu");
    expect(result.activated).toBe(true);

    const after = await prisma.contractorOrg.findUnique({
      where: { id: org.id },
    });
    expect(after!.status).toBe("ACTIVE");
  });

  it("is idempotent on an already-ACTIVE org", async () => {
    const org = await seedReadyOrg();
    await prisma.contractorOrg.update({
      where: { id: org.id },
      data: { status: "ACTIVE" },
    });

    const result = await tryActivate(org.id, "http://test/login");
    expect(result.activated).toBe(true);

    const after = await prisma.contractorOrg.findUnique({
      where: { id: org.id },
    });
    expect(after!.status).toBe("ACTIVE");
  });

  it("refuses to activate when a precondition is missing — returns the first missing key", async () => {
    const { org } = await makeContractorOrg({
      status: "PENDING_VERIFICATION",
      specialties: [],
    });
    const result = await tryActivate(org.id, "http://test/login");
    expect(result.activated).toBe(false);
    expect(result.reason).toBeTruthy();

    const after = await prisma.contractorOrg.findUnique({
      where: { id: org.id },
    });
    expect(after!.status).toBe("PENDING_VERIFICATION");
  });
});
