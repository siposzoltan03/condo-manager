import { test as setup } from "@playwright/test";
import { existsSync, mkdirSync } from "fs";
import { CONDO_USERS, loginCondo, authFile } from "./auth";

/**
 * Logs in once per seeded role and saves each session's storageState to
 * e2e/.auth/{role}.json, so the role specs skip per-test login (per-test login
 * trips the /api/auth/check-2fa rate limiter). admin's session is also written
 * to baseline-admin.json, which the responsive-baseline specs depend on.
 *
 * All logins run sequentially inside a single setup test (fresh context each)
 * to stay well under the login rate limiter. Wired as the `setup` project in
 * playwright.config.ts.
 */
setup("authenticate all roles", async ({ browser }) => {
  if (!existsSync("e2e/.auth")) mkdirSync("e2e/.auth", { recursive: true });

  for (const [role, email] of Object.entries(CONDO_USERS)) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginCondo(page, email);
    await context.storageState({ path: authFile(role) });
    if (role === "admin") {
      // Back-compat: responsive-baseline specs read this exact path.
      await context.storageState({ path: "e2e/.auth/baseline-admin.json" });
    }
    await context.close();
  }
});
