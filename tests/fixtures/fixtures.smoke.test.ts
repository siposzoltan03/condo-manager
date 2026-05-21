import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeBuilding, makeContractorOrg, makeUser } from "./index";

describe("test harness smoke", () => {
  it("truncates the DB between tests (1/2)", async () => {
    await makeBuilding();
    const count = await prisma.building.count();
    expect(count).toBe(2);
  });

  it("truncates the DB between tests (2/2)", async () => {
    const count = await prisma.building.count();
    expect(count).toBe(0);
  });

  it("paired-tenant buildings are distinct rows", async () => {
    const { building, otherBuilding } = await makeBuilding();
    expect(building.id).not.toBe(otherBuilding.id);
    expect(await prisma.building.count()).toBe(2);
  });

  it("paired-tenant contractor orgs are distinct rows", async () => {
    const { org, otherOrg } = await makeContractorOrg();
    expect(org.id).not.toBe(otherOrg.id);
    expect(org.taxId).not.toBe(otherOrg.taxId);
  });

  it("makeUser attaches user to the given building only", async () => {
    const { building, otherBuilding } = await makeBuilding();
    const user = await makeUser({ buildingId: building.id });

    const inPrimary = await prisma.userBuilding.findFirst({
      where: { userId: user.id, buildingId: building.id },
    });
    const inOther = await prisma.userBuilding.findFirst({
      where: { userId: user.id, buildingId: otherBuilding.id },
    });

    expect(inPrimary).not.toBeNull();
    expect(inOther).toBeNull();
  });
});
