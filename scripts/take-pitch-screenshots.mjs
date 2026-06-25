/**
 * Pitch deck screenshot capture — sources from the demo seed (Petőfi 23.)
 * plus the contractor portal (Lift-Profi Zrt.).
 *
 * Prerequisites:
 *   1. `npm run seed:demo` — Petőfi 23. building + tickets + votes + meetings
 *   2. `npm run seed:contractors` — contractor org auth tree
 *   3. `npm run seed:marketplace-mock` — marketplace listings + bids
 *   4. `npm run dev` running on http://localhost:3000
 *
 * Then: `node scripts/take-pitch-screenshots.mjs`
 *
 * Output: public/screenshots/pitch/*.png
 */

import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR_PUBLIC = "/Users/siposzoltan/projects/condo-manager/public/screenshots/pitch";
const OUTPUT_DIR_DECK = "/Users/siposzoltan/projects/condo-manager/docs/pitch/public/screenshots/pitch";
const LOCALE = "hu";

const MANAGER = {
  email: "kepviselo@petofi23.local",
  password: "password123",
};

const CONTRACTOR = {
  email: "elevator@contractor.local",
  password: "password123",
};

// Taller-than-16:9 viewport so more of the page fits "above the fold".
// Captions in the deck describe only what's visible, so we want as much as
// possible visible.
const DESKTOP_VIEWPORT = { width: 1440, height: 1100 };
const MOBILE_VIEWPORT = { width: 390, height: 900 }; // iPhone 14 Pro, taller crop

for (const dir of [OUTPUT_DIR_PUBLIC, OUTPUT_DIR_DECK]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function login(page, base, email, password) {
  await page.goto(`${base}/${LOCALE}/login`);
  await page.waitForLoadState("networkidle");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
}

async function loginContractor(page, base, email, password) {
  await page.goto(`${base}/${LOCALE}/contractor/login`);
  await page.waitForLoadState("networkidle");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
}

async function shot(page, name, target, opts = {}) {
  process.stdout.write(`  ${name.padEnd(28, " ")} ${target} … `);
  try {
    if (target) {
      await page.goto(`${BASE_URL}${target}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3500);
    }
    if (typeof opts.scrollY === "number") {
      await page.evaluate((y) => window.scrollTo(0, y), opts.scrollY);
      await page.waitForTimeout(500);
    }
    const publicPath = path.join(OUTPUT_DIR_PUBLIC, `${name}.png`);
    await page.screenshot({ path: publicPath, fullPage: false });
    fs.copyFileSync(publicPath, path.join(OUTPUT_DIR_DECK, `${name}.png`));
    console.log("ok");
  } catch (err) {
    console.log("FAIL:", err.message);
  }
}

async function main() {
  // ─── Resolve dynamic ids from the demo building ────────────────────────
  const prisma = new PrismaClient();
  const upcomingMeeting = await prisma.meeting.findFirst({
    where: { buildingId: "demo_petofi_23", date: { gte: new Date() } },
    orderBy: { date: "asc" },
    select: { id: true },
  });
  const pastMeeting = await prisma.meeting.findFirst({
    where: { buildingId: "demo_petofi_23", date: { lt: new Date() } },
    orderBy: { date: "desc" },
    select: { id: true },
  });
  const criticalTicket = await prisma.maintenanceTicket.findFirst({
    where: { buildingId: "demo_petofi_23", urgency: "CRITICAL" },
    select: { id: true },
  });

  // Channels for the demo building — used to pick announcement vs. topic views
  const announceChannel = await prisma.channel.findFirst({
    where: { buildingId: "demo_petofi_23", kind: "ANNOUNCEMENT" },
    select: { id: true },
  });
  const topicChannel = await prisma.channel.findFirst({
    where: { buildingId: "demo_petofi_23", kind: "TOPIC" },
    select: { id: true },
  });

  // For contractor side — find an OPEN publication
  const openPub = await prisma.marketplacePublication.findFirst({
    where: { status: "OPEN" },
    orderBy: { publishedAt: "desc" },
    select: { id: true },
  });
  await prisma.$disconnect();

  if (!upcomingMeeting || !pastMeeting || !criticalTicket) {
    throw new Error("Demo seed data missing — run `npm run seed:demo` first.");
  }

  const browser = await chromium.launch();

  // ─── Manager (közös képviselő) — desktop ───────────────────────────────
  console.log("Manager — desktop captures");
  const ctx = await browser.newContext({
    viewport: DESKTOP_VIEWPORT,
    locale: "hu-HU",
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await login(page, BASE_URL, MANAGER.email, MANAGER.password);
  console.log("  signed in →", page.url());

  await shot(page, "01-dashboard", `/${LOCALE}/dashboard`);
  await shot(page, "02-meeting-upcoming", `/${LOCALE}/voting/meetings/${upcomingMeeting.id}`);
  // Same page, scrolled to the votes section (DRAFT votes).
  await shot(page, "02b-meeting-votes", null, { scrollY: 620 });
  await shot(page, "03-meeting-past", `/${LOCALE}/voting/meetings/${pastMeeting.id}`);
  // Same page, scrolled to the signed minutes / chair-signatures area.
  await shot(page, "03b-meeting-minutes", null, { scrollY: 700 });
  // Switch to the JEGYZŐKÖNYV tab to capture the actual signed minutes text.
  await page.evaluate(() => {
    const tabs = [...document.querySelectorAll("button, a, [role='tab']")];
    const tab = tabs.find((el) => /^\s*jegyzőkönyv\s*$/i.test(el.textContent || ""));
    if (tab) tab.click();
  });
  await page.waitForTimeout(1500);
  await shot(page, "03c-meeting-jkv-tab", null, { scrollY: 0 });
  await shot(page, "04-voting-list", `/${LOCALE}/voting`);
  await shot(page, "05-finance-building", `/${LOCALE}/finance?tab=epulet`);
  await shot(page, "06-finance-self", `/${LOCALE}/finance?tab=sajat`);
  await shot(page, "07-maintenance-list", `/${LOCALE}/maintenance`);
  await shot(page, "08-maintenance-critical", `/${LOCALE}/maintenance/${criticalTicket.id}`);
  await shot(page, "09-documents", `/${LOCALE}/documents`);
  await shot(
    page,
    "10-announcements",
    announceChannel
      ? `/${LOCALE}/communication?channel=${announceChannel.id}`
      : `/${LOCALE}/communication`,
  );
  await shot(
    page,
    "11-forum",
    topicChannel
      ? `/${LOCALE}/communication?channel=${topicChannel.id}`
      : `/${LOCALE}/communication`,
  );
  await shot(page, "12-complaints", `/${LOCALE}/complaints`);

  await ctx.close();

  // ─── Manager — mobile (resident-perspective views) ─────────────────────
  console.log("Resident perspective — mobile captures");
  const mctx = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    locale: "hu-HU",
    deviceScaleFactor: 3,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    isMobile: true,
    hasTouch: true,
  });
  const mpage = await mctx.newPage();
  await login(mpage, BASE_URL, MANAGER.email, MANAGER.password);

  await shot(mpage, "13-mobile-dashboard", `/${LOCALE}/dashboard`);
  await shot(mpage, "14-mobile-voting", `/${LOCALE}/voting`);
  await shot(mpage, "15-mobile-meeting", `/${LOCALE}/voting/meetings/${upcomingMeeting.id}`);

  await mctx.close();

  // ─── Contractor portal ─────────────────────────────────────────────────
  console.log("Contractor portal — desktop captures");
  const cctx = await browser.newContext({
    viewport: DESKTOP_VIEWPORT,
    locale: "hu-HU",
    deviceScaleFactor: 2,
  });
  const cpage = await cctx.newPage();
  await loginContractor(cpage, BASE_URL, CONTRACTOR.email, CONTRACTOR.password);
  console.log("  signed in →", cpage.url());

  // /contractor redirects to /marketplace; use /leads for the dashboard slot.
  await shot(cpage, "16-contractor-dashboard", `/${LOCALE}/contractor/leads`);
  await shot(cpage, "17-contractor-marketplace", `/${LOCALE}/contractor/marketplace`);
  if (openPub) {
    await shot(
      cpage,
      "18-contractor-listing",
      `/${LOCALE}/contractor/marketplace/${openPub.id}`,
    );
  }
  await shot(cpage, "19-contractor-projects", `/${LOCALE}/contractor/projects`);

  await cctx.close();

  await browser.close();
  console.log("\nDone. Screenshots in:");
  console.log("  ", OUTPUT_DIR_PUBLIC);
  console.log("  ", OUTPUT_DIR_DECK);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
