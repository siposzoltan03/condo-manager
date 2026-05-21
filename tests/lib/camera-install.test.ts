import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkCameraInstallEligibility } from "@/lib/camera-install";

vi.mock("@/lib/voting/quorum", () => ({
  calculateVoteResult: vi.fn(),
}));
import { calculateVoteResult } from "@/lib/voting/quorum";

type FakeVote = {
  id: string;
  buildingId: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
  majorityType: "SIMPLE_MAJORITY" | "TWO_THIRDS" | "FOUR_FIFTHS" | "UNANIMOUS" | "PLURALITY";
};
type FakeDoc = {
  id: string;
  category: { buildingId: string };
};

function fakePrisma(vote: FakeVote | null, doc: FakeDoc | null) {
  return {
    vote: {
      findUnique: async () => vote,
    },
    document: {
      findUnique: async () => doc,
    },
  } as unknown as Parameters<typeof checkCameraInstallEligibility>[0];
}

const BUILDING = "b1";
const OK_VOTE: FakeVote = {
  id: "v1",
  buildingId: BUILDING,
  status: "CLOSED",
  majorityType: "TWO_THIRDS",
};
const OK_DOC: FakeDoc = { id: "d1", category: { buildingId: BUILDING } };
const ARGS = {
  buildingId: BUILDING,
  voteId: "v1",
  privacyNoticeDocumentId: "d1",
};

beforeEach(() => {
  vi.mocked(calculateVoteResult).mockReset();
});

describe("checkCameraInstallEligibility", () => {
  it("passes when vote + document are valid", async () => {
    vi.mocked(calculateVoteResult).mockResolvedValue({
      options: [],
      totalWeight: 1,
      effectiveWeight: 1,
      majorityType: "TWO_THIRDS",
      passed: true,
      winningOptionId: "o1",
    });
    const r = await checkCameraInstallEligibility(fakePrisma(OK_VOTE, OK_DOC), ARGS);
    expect(r.ok).toBe(true);
  });

  it("fails VOTE_NOT_FOUND when vote is missing", async () => {
    const r = await checkCameraInstallEligibility(fakePrisma(null, OK_DOC), ARGS);
    expect(r).toMatchObject({ ok: false, code: "VOTE_NOT_FOUND" });
  });

  it("fails VOTE_WRONG_BUILDING when vote belongs to another building", async () => {
    const r = await checkCameraInstallEligibility(
      fakePrisma({ ...OK_VOTE, buildingId: "b2" }, OK_DOC),
      ARGS,
    );
    expect(r).toMatchObject({ ok: false, code: "VOTE_WRONG_BUILDING" });
  });

  it("fails VOTE_NOT_CLOSED when vote is still open", async () => {
    const r = await checkCameraInstallEligibility(
      fakePrisma({ ...OK_VOTE, status: "OPEN" }, OK_DOC),
      ARGS,
    );
    expect(r).toMatchObject({ ok: false, code: "VOTE_NOT_CLOSED" });
  });

  it("fails VOTE_WRONG_MAJORITY for SIMPLE_MAJORITY votes", async () => {
    const r = await checkCameraInstallEligibility(
      fakePrisma({ ...OK_VOTE, majorityType: "SIMPLE_MAJORITY" }, OK_DOC),
      ARGS,
    );
    expect(r).toMatchObject({ ok: false, code: "VOTE_WRONG_MAJORITY" });
  });

  it("fails VOTE_NOT_PASSED when tally did not cross 2/3", async () => {
    vi.mocked(calculateVoteResult).mockResolvedValue({
      options: [],
      totalWeight: 1,
      effectiveWeight: 1,
      majorityType: "TWO_THIRDS",
      passed: false,
      winningOptionId: null,
    });
    const r = await checkCameraInstallEligibility(fakePrisma(OK_VOTE, OK_DOC), ARGS);
    expect(r).toMatchObject({ ok: false, code: "VOTE_NOT_PASSED" });
  });

  it("fails PRIVACY_NOTICE_NOT_FOUND when document is missing", async () => {
    vi.mocked(calculateVoteResult).mockResolvedValue({
      options: [],
      totalWeight: 1,
      effectiveWeight: 1,
      majorityType: "TWO_THIRDS",
      passed: true,
      winningOptionId: "o1",
    });
    const r = await checkCameraInstallEligibility(fakePrisma(OK_VOTE, null), ARGS);
    expect(r).toMatchObject({ ok: false, code: "PRIVACY_NOTICE_NOT_FOUND" });
  });

  it("fails PRIVACY_NOTICE_WRONG_BUILDING when document belongs elsewhere", async () => {
    vi.mocked(calculateVoteResult).mockResolvedValue({
      options: [],
      totalWeight: 1,
      effectiveWeight: 1,
      majorityType: "TWO_THIRDS",
      passed: true,
      winningOptionId: "o1",
    });
    const r = await checkCameraInstallEligibility(
      fakePrisma(OK_VOTE, { id: "d1", category: { buildingId: "b2" } }),
      ARGS,
    );
    expect(r).toMatchObject({ ok: false, code: "PRIVACY_NOTICE_WRONG_BUILDING" });
  });
});
