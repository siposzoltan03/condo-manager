import { test as setup, expect } from "@playwright/test";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";

const AUTH_FILE = "e2e/.auth/baseline-admin.json";

/**
 * Logs in once as admin@condo.local and saves the session storageState
 * so the responsive-baseline tests can skip per-test login. Without this,
 * 30 sequential logins hit the `/api/auth/check-2fa` rate limiter.
 *
 * Wired as a `setup` project in playwright.config.ts; the responsive
 * viewport projects depend on it.
 */
setup("authenticate as admin", async ({ page }) => {
  if (!existsSync(dirname(AUTH_FILE))) {
    mkdirSync(dirname(AUTH_FILE), { recursive: true });
  }
  await page.goto("/hu/login");
  await page.locator("input[type='email']").waitFor({ state: "visible" });
  await page.locator("input[type='email']").fill("admin@condo.local");
  await page.locator("input[type='password']").fill("password123");
  await page.locator("input[type='password']").press("Enter");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });
  await page.context().storageState({ path: AUTH_FILE });
});
