import { test, expect, type Page } from "@playwright/test";

/**
 * Visual regression baseline at three viewports (375 / 768 / 1440).
 * Plan ref: docs/plans/2026-05-18-mobile-responsive.md §0.4.
 *
 * **First run** generates the baseline PNGs under
 * `e2e/__snapshots__/responsive-baseline.spec.ts/{name}-{project}.png`.
 * Commit those PNGs as the locked-in starting point. Subsequent runs
 * fail if the captured screenshot diffs beyond the threshold — which is
 * the signal that a Phase A/B/C refactor changed something visually.
 *
 * **The baselines are not expected to look good.** They characterize
 * current behaviour at narrow widths. Most pages will look broken at
 * 375 px until the relevant per-domain phase ships.
 *
 * Run only this spec:
 *   npx playwright test responsive-baseline
 *
 * Update baselines after intentional changes:
 *   npx playwright test responsive-baseline --update-snapshots
 */

const SCREENSHOT_OPTIONS = {
  fullPage: true,
  /** Generous threshold — the baseline screens are deliberately fragile
   *  to surface unintended drift, not to pixel-lock the design. */
  maxDiffPixelRatio: 0.02,
  /** Mask any element that's inherently non-deterministic (timestamps,
   *  randomised IDs in the seeded data). Keep this list small. */
  animations: "disabled" as const,
} as const;

const AUTH_FILE = "e2e/.auth/baseline-admin.json";

async function login(page: Page) {
  await page.goto("/hu/login");
  await page.locator("input[type='email']").waitFor({ state: "visible" });
  await page.locator("input[type='email']").fill("admin@condo.local");
  await page.locator("input[type='password']").fill("password123");
  await page.locator("input[type='password']").press("Enter");
  // Generous timeout: Next.js dev-server first-hit compile of `/dashboard`
  // can take 20–30 s on a cold cache.
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });
}

/** The 10 critical pages we lock as the baseline. Drawn from the surfaces
 *  listed in plan §5 Phase B/C/D — i.e. the surfaces residents, board,
 *  contractor, and admin actually touch. */
const PAGES: Array<{ name: string; path: string }> = [
  { name: "dashboard", path: "/hu/dashboard" },
  { name: "voting-list", path: "/hu/voting" },
  { name: "communication", path: "/hu/communication" },
  { name: "complaints", path: "/hu/complaints" },
  { name: "maintenance", path: "/hu/maintenance" },
  { name: "finance", path: "/hu/finance" },
  { name: "units", path: "/hu/units" },
  { name: "residents", path: "/hu/residents" },
  { name: "documents", path: "/hu/documents" },
  { name: "settings", path: "/hu/settings" },
];

// Storage state is created by the `setup` project (e2e/auth.setup.ts)
// which Playwright runs before any of the viewport projects per the
// `dependencies` config in playwright.config.ts. With the session cached
// here, individual tests skip login entirely and can run in parallel
// without tripping the auth rate limiter.
test.use({ storageState: AUTH_FILE });

test.describe("Responsive baseline", () => {

  for (const { name, path } of PAGES) {
    test(name, async ({ page }) => {
      // Generous goto timeout — Next.js dev-server first-compile of a
      // route can take 30 s+. Production build would be faster but the
      // baseline runs against `npm run dev`.
      await page.goto(path, { timeout: 60_000 });
      // Settle: wait for `load` (DOM ready) + a short tail for client
      // islands. `networkidle` is unreliable because communication holds
      // an SSE connection open indefinitely.
      await page.waitForLoadState("load", { timeout: 60_000 });
      await page.waitForTimeout(800);
      await expect(page).toHaveScreenshot(`${name}.png`, SCREENSHOT_OPTIONS);
    });
  }
});
