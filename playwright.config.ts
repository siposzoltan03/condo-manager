import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  /** All baseline snapshots land here, keyed by viewport project name.
   *  Plan ref: docs/plans/2026-05-18-mobile-responsive.md §0.4. */
  snapshotPathTemplate:
    "{testDir}/__snapshots__/{testFileDir}/{testFileName}/{arg}-{projectName}{ext}",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    /** Existing e2e suite (auth, voting, maintenance) runs at desktop
     *  Chrome — the original CI behaviour. */
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: ["**/responsive-baseline.spec.ts", "**/roles/**"],
    },
    /** Phase E lock-in: same e2e suite (excluding the snapshot baseline)
     *  also runs at iPhone-SE viewport (375 × 667) with touch. This is
     *  how mobile regressions get caught in CI without writing duplicate
     *  specs — golden-path flows like login + RSVP + ticket-submit must
     *  pass at phone too. */
    {
      name: "chromium-phone",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 667 },
        hasTouch: true,
      },
      testIgnore: ["**/responsive-baseline.spec.ts", "**/roles/**"],
    },
    /** Per-role authorization specs (e2e/roles/) — each spec picks its own
     *  storageState fixture; depends on `setup` to create them. Desktop only. */
    {
      name: "roles",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /roles\/.*\.spec\.ts/,
      dependencies: ["setup"],
    },
    /** Setup project — logs in once and saves the session storageState
     *  to e2e/.auth/baseline-admin.json so the responsive-baseline tests
     *  can skip per-test login (which trips the auth rate limiter). */
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    /** Responsive baseline runs at three viewports. Plan §0.4 calls these
     *  the three "core widths"; intermediate widths fall out automatically. */
    {
      name: "mobile-375",
      use: { viewport: { width: 375, height: 667 }, hasTouch: true },
      testMatch: /responsive-baseline\.spec\.ts/,
      dependencies: ["setup"],
    },
    {
      name: "tablet-768",
      use: { viewport: { width: 768, height: 1024 }, hasTouch: true },
      testMatch: /responsive-baseline\.spec\.ts/,
      dependencies: ["setup"],
    },
    {
      name: "desktop-1440",
      use: { viewport: { width: 1440, height: 900 } },
      testMatch: /responsive-baseline\.spec\.ts/,
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
