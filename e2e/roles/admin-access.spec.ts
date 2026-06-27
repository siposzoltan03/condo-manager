import { test, expect } from "@playwright/test";
import { authFile } from "../auth";

/**
 * Authorization boundary for the SUPER_ADMIN feature console, driven through
 * the real app per role. The page (src/app/[locale]/admin/feature-management)
 * server-guards on hasMinimumRole(role, "SUPER_ADMIN"): non-superadmins (incl.
 * ADMIN) get an "Access Denied" box; superadmin gets the 3-tab console.
 *
 * Read-only: navigation + tab switching only (tabs are client-side state, no
 * persistence), so this is safe against the shared dev DB.
 */

const FEATURE_MGMT = "/hu/admin/feature-management";

// Every non-superadmin role must be denied (ADMIN is NOT a platform superadmin).
for (const role of ["admin", "board", "owner", "tenant"] as const) {
  test.describe(`${role} is denied the feature console`, () => {
    test.use({ storageState: authFile(role) });

    test(`${role} → Access Denied, no console tabs`, async ({ page }) => {
      await page.goto(FEATURE_MGMT);
      await expect(page.getByText("Access Denied")).toBeVisible();
      await expect(page.getByRole("tab")).toHaveCount(0);
    });
  });
}

test.describe("superadmin can use the feature console", () => {
  test.use({ storageState: authFile("superadmin") });

  test("opens the console (no Access Denied)", async ({ page }) => {
    await page.goto(FEATURE_MGMT);
    await expect(page.getByText("Access Denied")).toHaveCount(0);
  });

  test("renders the 3 tabs and they switch", async ({ page }) => {
    await page.goto(FEATURE_MGMT);
    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(3);

    const n = await tabs.count();
    for (let i = 0; i < n; i++) {
      await tabs.nth(i).click();
      await expect(tabs.nth(i)).toHaveAttribute("aria-selected", "true");
    }
  });
});
