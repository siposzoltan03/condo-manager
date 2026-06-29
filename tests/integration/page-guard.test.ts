import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The page-facing guards translate the shared (API+page) auth/feature/role
 * helpers' throws into Next's unauthorized() (401) / forbidden() (403)
 * control-flow signals, which render the dedicated pages. Next tags those
 * with digest "NEXT_HTTP_ERROR_FALLBACK;401" / ";403". In the real app (with
 * experimental.authInterrupts enabled) that digest renders the dedicated page;
 * under vitest the config isn't loaded, so the same functions throw a guard
 * error naming themselves ("unauthorized()" / "forbidden()") — either way the
 * assertion confirms the right interrupt was invoked.
 */

const { requireBuildingContextMock, requireFeatureMock } = vi.hoisted(() => ({
  requireBuildingContextMock: vi.fn(),
  requireFeatureMock: vi.fn(),
}));

class FakeFeatureGateError extends Error {}

vi.mock("@/lib/auth", () => ({
  requireBuildingContext: requireBuildingContextMock,
}));
vi.mock("@/lib/feature-gate", () => ({
  requireFeature: requireFeatureMock,
  FeatureGateError: FakeFeatureGateError,
}));

const { requirePageContext, requirePageFeature, requirePageRole } =
  await import("@/lib/page-guard");

beforeEach(() => {
  requireBuildingContextMock.mockReset();
  requireFeatureMock.mockReset();
});

/** Returns the interrupt signal: Next's digest (real app) or the function's
 *  guard message (vitest, where authInterrupts config isn't loaded). */
async function signalOf(fn: () => unknown | Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "(no throw)";
  } catch (e) {
    return (e as { digest?: string }).digest ?? (e as Error).message;
  }
}

describe("requirePageContext", () => {
  it("returns the context when authenticated", async () => {
    requireBuildingContextMock.mockResolvedValue({ userId: "u1", buildingId: "b1", role: "OWNER" });
    expect(await requirePageContext()).toMatchObject({ userId: "u1" });
  });

  it("renders 401 when the session is missing", async () => {
    requireBuildingContextMock.mockRejectedValue(new Error("Unauthorized"));
    expect(await signalOf(requirePageContext)).toMatch(/401|unauthorized/i);
  });

  it("rethrows unrelated errors unchanged", async () => {
    requireBuildingContextMock.mockRejectedValue(new Error("DB down"));
    expect(await signalOf(requirePageContext)).toBe("DB down");
  });
});

describe("requirePageFeature", () => {
  it("passes when the feature is enabled", async () => {
    requireFeatureMock.mockResolvedValue(undefined);
    expect(await signalOf(() => requirePageFeature("b1", "voting"))).toBe("(no throw)");
  });

  it("renders 403 when the feature is gated", async () => {
    requireFeatureMock.mockRejectedValue(new FakeFeatureGateError("upgrade"));
    expect(await signalOf(() => requirePageFeature("b1", "voting"))).toMatch(/403|forbidden/i);
  });
});

describe("requirePageRole", () => {
  it("renders 403 when the role is too low", async () => {
    expect(await signalOf(() => requirePageRole("TENANT", "BOARD_MEMBER"))).toMatch(/403|forbidden/i);
  });

  it("passes when the role is sufficient", async () => {
    expect(await signalOf(() => requirePageRole("ADMIN", "BOARD_MEMBER"))).toBe("(no throw)");
  });
});
