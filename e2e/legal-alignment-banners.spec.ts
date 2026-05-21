import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * Banner-visibility e2e from docs/plans/2026-04-27-roles-legal-alignment.md:
 *
 *   - Audit-committee banner appears when `requiresAuditCommittee && !hasActiveCommittee` (Tht. § 27(3)).
 *   - Officer-registry banner appears when `representativeRegisteredAt === null`
 *     and the deadline is within 60 days (Tht. § 55/A-D).
 *
 * Both banners ride on the BoardDashboard, so we sign in as the seeded
 * admin@condo.local. The tests directly mutate building1's compliance
 * fields with Prisma before each assertion and restore them after, so
 * the dev DB returns to its baseline. We run serial because the two
 * tests both mutate the same row.
 */

const BUILDING_ID = "seed_building_1";
const prisma = new PrismaClient();

type ComplianceSnapshot = {
  representativeRegisteredAt: Date | null;
  representativeRegistryDeadline: Date;
  requiresAuditCommittee: boolean;
};

let snapshot: ComplianceSnapshot;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const row = await prisma.building.findUniqueOrThrow({
    where: { id: BUILDING_ID },
    select: {
      representativeRegisteredAt: true,
      representativeRegistryDeadline: true,
      requiresAuditCommittee: true,
    },
  });
  snapshot = row;
});

test.afterAll(async () => {
  await prisma.building.update({
    where: { id: BUILDING_ID },
    data: snapshot,
  });
  await prisma.$disconnect();
});

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/hu/login");
  await page.locator("input[type='email']").fill("admin@condo.local");
  await page.locator("input[type='password']").fill("password123");
  await page.locator("button[type='submit']").click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
}

test("officer-registry banner appears when deadline is within 60 days and unregistered", async ({
  page,
}) => {
  // Set deadline to 30 days from now and clear the registration timestamp.
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 30);
  await prisma.building.update({
    where: { id: BUILDING_ID },
    data: {
      representativeRegisteredAt: null,
      representativeRegistryDeadline: deadline,
    },
  });

  await loginAsAdmin(page);
  await page.goto("/hu/dashboard");

  // The Hungarian title for the "due-soon" branch.
  const dueSoonTitle = page.locator(
    "text=A közös képviselő regisztrációs határideje közeledik",
  );
  await expect(dueSoonTitle).toBeVisible({ timeout: 10_000 });
});

test("audit-committee banner appears when requiresAuditCommittee and no active committee", async ({
  page,
}) => {
  // Trigger the audit-committee mandate flag.
  await prisma.building.update({
    where: { id: BUILDING_ID },
    data: { requiresAuditCommittee: true },
  });
  // Defensive: make sure no committee rows exist for this building so
  // hasActiveAuditCommittee() returns false. Seed doesn't create any, but
  // a developer's local DB might.
  await prisma.auditorMembership.deleteMany({
    where: { buildingId: BUILDING_ID, endedAt: null },
  });

  await loginAsAdmin(page);
  await page.goto("/hu/dashboard");

  const committeeTitle = page.locator(
    "text=Számvizsgáló bizottság kötelező",
  );
  await expect(committeeTitle).toBeVisible({ timeout: 10_000 });
});
