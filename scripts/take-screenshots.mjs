import { chromium } from "@playwright/test";

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = "/Users/siposzoltan/projects/condo-manager/public/screenshots";

const CREDENTIALS = { email: "superadmin@condo.local", password: "password123" };

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
  });
  const page = await context.newPage();

  // Login first
  console.log("Logging in...");
  await page.goto(`${BASE_URL}/en/login`);
  await page.waitForLoadState("networkidle");
  await page.fill('input[name="email"]', CREDENTIALS.email);
  await page.fill('input[name="password"]', CREDENTIALS.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  console.log("Current URL:", page.url());

  const pages = [
    { name: "dashboard", path: "/en/dashboard" },
    { name: "announcements", path: "/en/announcements" },
    { name: "finance", path: "/en/finance" },
    { name: "maintenance", path: "/en/maintenance" },
    { name: "voting", path: "/en/voting" },
    { name: "documents", path: "/en/documents" },
    { name: "forum", path: "/en/forum" },
    { name: "messages", path: "/en/messages" },
    { name: "complaints", path: "/en/complaints" },
  ];

  for (const p of pages) {
    console.log(`Screenshotting ${p.name}...`);
    await page.goto(`${BASE_URL}${p.path}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: `${OUTPUT_DIR}/${p.name}.png`,
      fullPage: false,
    });
    console.log(`  Saved ${p.name}.png`);
  }

  await browser.close();
  console.log("Done!");
}

main().catch(console.error);
