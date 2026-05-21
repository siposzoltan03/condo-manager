import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeContractorOrg } from "../fixtures";

/**
 * Phase C strict coverage prerequisite (refactor plan §3 Phase C):
 * before reshaping each contractor surface, lock in the cross-tenant
 * property with the paired-tenant fixture pattern. These tests must
 * keep passing through the Phase C DAL refactor.
 */

const { requireContractorMock, requireContractorOwnerMock } = vi.hoisted(() => ({
  requireContractorMock: vi.fn(),
  requireContractorOwnerMock: vi.fn(),
}));

vi.mock("@/lib/contractor/session", () => ({
  requireContractor: requireContractorMock,
  requireContractorOwner: requireContractorOwnerMock,
}));

vi.mock("@/lib/storage", () => ({
  MAX_UPLOAD_BYTES: 10 * 1024 * 1024,
  getStorage: () => ({
    put: vi.fn().mockResolvedValue({ key: "stored/key" }),
    remove: vi.fn().mockResolvedValue(undefined),
  }),
}));

const { GET: listDocs } = await import(
  "@/app/api/contractor/onboarding/documents/route"
);
const { DELETE: deleteDoc } = await import(
  "@/app/api/contractor/onboarding/documents/[id]/route"
);
const { PATCH: patchOnboarding } = await import(
  "@/app/api/contractor/onboarding/route"
);

function asContractorOwner(orgId: string) {
  return {
    userId: `user-${orgId}`,
    orgId,
    role: "OWNER",
    orgStatus: "ACTIVE",
    orgPlan: "FREE",
    orgName: "Test Org",
  };
}

beforeEach(() => {
  requireContractorMock.mockReset();
  requireContractorOwnerMock.mockReset();
});

describe("Contractor cross-tenant isolation", () => {
  it("documents GET returns only the session org's documents", async () => {
    const { org, otherOrg } = await makeContractorOrg();
    const ownDoc = await prisma.contractorDocument.create({
      data: {
        orgId: org.id,
        kind: "insurance",
        fileName: "own.pdf",
        storageKey: "k-own",
      },
    });
    await prisma.contractorDocument.create({
      data: {
        orgId: otherOrg.id,
        kind: "insurance",
        fileName: "other.pdf",
        storageKey: "k-other",
      },
    });

    requireContractorOwnerMock.mockResolvedValue(asContractorOwner(org.id));
    const res = await listDocs();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.documents).toHaveLength(1);
    expect(body.documents[0].id).toBe(ownDoc.id);
  });

  it("documents DELETE returns 404 when the doc belongs to a different org — and the doc survives", async () => {
    const { org, otherOrg } = await makeContractorOrg();
    const otherOrgDoc = await prisma.contractorDocument.create({
      data: {
        orgId: otherOrg.id,
        kind: "insurance",
        fileName: "victim.pdf",
        storageKey: "k-victim",
      },
    });

    // Attacker: belongs to `org`, tries to delete `otherOrg`'s doc.
    requireContractorOwnerMock.mockResolvedValue(asContractorOwner(org.id));
    const res = await deleteDoc(new Request("http://test"), {
      params: Promise.resolve({ id: otherOrgDoc.id }),
    });
    expect(res.status).toBe(404);

    const stillThere = await prisma.contractorDocument.findUnique({
      where: { id: otherOrgDoc.id },
    });
    expect(stillThere).not.toBeNull();
    expect(stillThere!.orgId).toBe(otherOrg.id);
  });

  it("onboarding PATCH only updates the session org — other orgs untouched", async () => {
    const { org, otherOrg } = await makeContractorOrg();

    // Snapshot otherOrg's profile before.
    const otherBefore = await prisma.contractorOrg.findUnique({
      where: { id: otherOrg.id },
      select: { name: true, description: true, websiteUrl: true },
    });

    // Session belongs to `org` — payload is a profile update.
    requireContractorOwnerMock.mockResolvedValue(asContractorOwner(org.id));
    const req = new Request("http://test/api/contractor/onboarding", {
      method: "PATCH",
      body: JSON.stringify({
        action: "profile",
        name: "Renamed",
        description: "New description",
        websiteUrl: "https://example.com",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await patchOnboarding(req as never);
    expect(res.status).toBe(200);

    const orgAfter = await prisma.contractorOrg.findUnique({
      where: { id: org.id },
      select: { name: true, description: true, websiteUrl: true },
    });
    const otherAfter = await prisma.contractorOrg.findUnique({
      where: { id: otherOrg.id },
      select: { name: true, description: true, websiteUrl: true },
    });

    expect(orgAfter!.name).toBe("Renamed");
    expect(orgAfter!.description).toBe("New description");
    expect(orgAfter!.websiteUrl).toBe("https://example.com");

    // The other org is untouched.
    expect(otherAfter).toEqual(otherBefore);
  });
});
