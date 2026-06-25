import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  rateLimitMutationOrRespond: vi.fn().mockResolvedValue(null),
}));

const { POST } = await import("@/app/api/contractor/auth/check-tax-id/route");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/contractor/auth/check-tax-id", () => {
  it("returns ok=true for a well-formed unused tax id", async () => {
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ taxId: "12345678-1-42" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.normalized).toBeTruthy();
  });

  it("returns ok=false reason=TAKEN when the tax id already has an org", async () => {
    await prisma.contractorOrg.create({
      data: { name: "Existing", taxId: "12345678-1-42" },
    });

    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ taxId: "12345678-1-42" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("TAKEN");
  });
});
