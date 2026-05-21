import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = "/Users/siposzoltan/projects/condo-manager/public/screenshots";
const LOCALE = "hu";

// Board admin works for everything: resident view, board workspace, all modules.
const CREDENTIALS = { email: "board@condo.local", password: "password123" };

async function main() {
  // Resolve a real meeting id so we can deep-link to /voting/meetings/[id].
  const prisma = new PrismaClient();
  const meeting = await prisma.meeting.findFirst({
    where: { buildingId: "seed_building_1" },
    orderBy: { date: "desc" },
    select: { id: true },
  });
  await prisma.$disconnect();

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: LOCALE === "hu" ? "hu-HU" : "en-US",
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  console.log("Logging in…");
  await page.goto(`${BASE_URL}/${LOCALE}/login`);
  await page.waitForLoadState("networkidle");
  await page.fill('#email', CREDENTIALS.email);
  await page.fill('#password', CREDENTIALS.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  console.log("  signed in →", page.url());

  const targets = [
    { name: "dashboard", path: `/${LOCALE}/dashboard` },
    { name: "announcements", path: `/${LOCALE}/communication` },
    { name: "forum", path: `/${LOCALE}/communication?channel=forum` },
    { name: "messages", path: `/${LOCALE}/communication?channel=messages` },
    // Resident view; board admin can still see this tab.
    { name: "finance-self", path: `/${LOCALE}/finance?tab=sajat` },
    // Board workspace — the deep-dive's "Finance" screenshot points here.
    { name: "finance", path: `/${LOCALE}/finance?tab=epulet` },
    { name: "maintenance", path: `/${LOCALE}/maintenance` },
    { name: "complaints", path: `/${LOCALE}/complaints` },
    { name: "documents", path: `/${LOCALE}/documents` },
    { name: "voting", path: `/${LOCALE}/voting` },
    ...(meeting
      ? [{ name: "meeting-detail", path: `/${LOCALE}/voting/meetings/${meeting.id}` }]
      : []),
  ];

  for (const t of targets) {
    process.stdout.write(`  ${t.name.padEnd(18, " ")} ${t.path} … `);
    try {
      // domcontentloaded is more forgiving than networkidle when pages
      // keep an open SSE stream (communication module, notifications).
      await page.goto(`${BASE_URL}${t.path}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3500);
      await page.screenshot({
        path: `${OUTPUT_DIR}/${t.name}.png`,
        fullPage: false,
      });
      console.log("ok");
    } catch (err) {
      console.log("FAIL:", err.message);
    }
  }

  await browser.close();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
