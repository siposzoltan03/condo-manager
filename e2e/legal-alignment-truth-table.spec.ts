import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * Plan ref: docs/plans/2026-04-27-roles-legal-alignment.md
 *   - "Sidebar truth table" contract (Phase 3 Step 6)
 *   - "Announcement compose flow records at least one PHYSICAL_BOARD
 *      delivery row" (cross-cutting tests bullet)
 *
 * Covers the legally-discriminating rows of the truth table — Finance,
 * Voting, Units — for OWNER, TENANT, and the chair (BOARD_MEMBER +
 * isChair). The all-roles-see-it rows (Dashboard, Forum, Messages,
 * Settings) are not asserted: the page would not render at all if those
 * broke. Finance is already covered separately in legal-alignment.spec.ts
 * and exercised redundantly here for completeness.
 *
 * Seed assumptions (prisma/seed.ts):
 *   - board@condo.local → BOARD_MEMBER with isChair=true in building1
 *   - resident1@condo.local → OWNER in building1
 *   - tenant1@condo.local → TENANT in building1
 *
 * The PHYSICAL_BOARD assertion uses Prisma directly against the dev DB
 * to inspect AnnouncementDelivery rows after a POST.
 */

const prisma = new PrismaClient();

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function loginAs(
  page: import("@playwright/test").Page,
  email: string,
) {
  await page.context().clearCookies();
  await page.goto("/hu/login");
  await page.locator("input[type='email']").fill(email);
  await page.locator("input[type='password']").fill("password123");
  await page.locator("button[type='submit']").click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
}

test.describe("Sidebar truth table — OWNER", () => {
  test("OWNER sees Finance, Voting; does NOT see Units", async ({ page }) => {
    await loginAs(page, "resident1@condo.local");
    // The sidebar renders twice (mobile drawer + desktop aside); both
    // live in the DOM regardless of viewport. Assert "present" via
    // first(), "absent" via count === 0.
    const sidebar = page.locator("aside");
    await expect(sidebar.locator("a[href='/finance']").first()).toBeAttached();
    await expect(sidebar.locator("a[href='/voting']").first()).toBeAttached();
    await expect(sidebar.locator("a[href='/units']")).toHaveCount(0);
  });
});

test.describe("Sidebar truth table — TENANT", () => {
  test("TENANT does NOT see Finance, Voting, or Units", async ({ page }) => {
    await loginAs(page, "tenant1@condo.local");
    const sidebar = page.locator("aside");
    await expect(sidebar.locator("a[href='/finance']")).toHaveCount(0);
    await expect(sidebar.locator("a[href='/voting']")).toHaveCount(0);
    await expect(sidebar.locator("a[href='/units']")).toHaveCount(0);
  });

  test("TENANT direct-URL to /voting is redirected to /dashboard", async ({
    page,
  }) => {
    await loginAs(page, "tenant1@condo.local");
    await page.goto("/hu/voting");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });

  test("TENANT direct-URL to /units is redirected to /dashboard", async ({
    page,
  }) => {
    await loginAs(page, "tenant1@condo.local");
    await page.goto("/hu/units");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });
});

test.describe("Sidebar truth table — BOARD_MEMBER chair", () => {
  test("Chair sees Finance, Voting, and Units", async ({ page }) => {
    await loginAs(page, "board@condo.local");
    const sidebar = page.locator("aside");
    await expect(sidebar.locator("a[href='/finance']").first()).toBeAttached();
    await expect(sidebar.locator("a[href='/voting']").first()).toBeAttached();
    await expect(sidebar.locator("a[href='/units']").first()).toBeAttached();
  });
});

test.describe("Announcement delivery — PHYSICAL_BOARD row creation", () => {
  test("ADMIN posting an ANNOUNCEMENT writes a PHYSICAL_BOARD delivery", async ({
    page,
  }) => {
    await loginAs(page, "admin@condo.local");

    // Look up the building's ANNOUNCEMENT channel. Seed creates these
    // per building (see prisma/seed.ts channel setup).
    const channel = await prisma.channel.findFirst({
      where: { buildingId: "seed_building_1", kind: "ANNOUNCEMENT" },
      select: { id: true },
    });
    expect(channel, "seed must include an ANNOUNCEMENT channel").not.toBeNull();

    const postRes = await page.request.post(
      `/api/channels/${channel!.id}/messages`,
      {
        data: {
          kind: "POST",
          title: "E2E demo announcement",
          body: "PHYSICAL_BOARD delivery proof test.",
        },
      },
    );
    expect(postRes.status()).toBe(201);
    const { id: messageId } = (await postRes.json()) as { id: string };

    const physicalRowCount = await prisma.announcementDelivery.count({
      where: { messageId, channel: "PHYSICAL_BOARD" },
    });
    expect(physicalRowCount).toBeGreaterThanOrEqual(1);

    // Cleanup so the dev DB doesn't accumulate demo messages.
    await prisma.announcementDelivery.deleteMany({ where: { messageId } });
    await prisma.channelMessage.delete({ where: { id: messageId } });
  });
});
