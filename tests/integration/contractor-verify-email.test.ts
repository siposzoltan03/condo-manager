import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeContractorOrg, makeContractorUser } from "../fixtures";

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

const { signVerificationToken } = await import("@/lib/contractor/verification");
const { GET } = await import("@/app/api/contractor/auth/verify-email/route");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/contractor/auth/verify-email", () => {
  it("marks emailVerifiedAt and redirects with verified=ok", async () => {
    const { org } = await makeContractorOrg();
    const user = await makeContractorUser({ orgId: org.id });
    const token = signVerificationToken(user.id);

    const req = new NextRequest(
      `http://test/api/contractor/auth/verify-email?token=${encodeURIComponent(token)}`,
    );
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("verified=ok");

    const after = await prisma.contractorUser.findUnique({
      where: { id: user.id },
    });
    expect(after!.emailVerifiedAt).not.toBeNull();
  });

  it("invalid token redirects without flipping any user", async () => {
    const { org } = await makeContractorOrg();
    const user = await makeContractorUser({ orgId: org.id });

    const req = new NextRequest(
      "http://test/api/contractor/auth/verify-email?token=not-a-real-token",
    );
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).not.toContain("verified=ok");

    const after = await prisma.contractorUser.findUnique({
      where: { id: user.id },
    });
    expect(after!.emailVerifiedAt).toBeNull();
  });

  it("replaying a valid token after first verification is harmless", async () => {
    const { org } = await makeContractorOrg();
    const user = await makeContractorUser({ orgId: org.id });
    const token = signVerificationToken(user.id);

    const url = `http://test/api/contractor/auth/verify-email?token=${encodeURIComponent(token)}`;
    const first = await GET(new NextRequest(url));
    expect(first.headers.get("location")).toContain("verified=ok");

    const firstVerifiedAt = (
      await prisma.contractorUser.findUnique({ where: { id: user.id } })
    )!.emailVerifiedAt!;

    // Replay: route should not overwrite emailVerifiedAt.
    const second = await GET(new NextRequest(url));
    expect(second.headers.get("location")).toContain("verified=ok");

    const after = await prisma.contractorUser.findUnique({
      where: { id: user.id },
    });
    expect(after!.emailVerifiedAt!.toISOString()).toBe(
      firstVerifiedAt.toISOString(),
    );
  });
});
