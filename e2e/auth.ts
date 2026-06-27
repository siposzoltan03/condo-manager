import { type Page, expect } from "@playwright/test";

/**
 * Seeded condo accounts (all password123) keyed by the role we exercise in
 * E2E. See docs/test-accounts.md / prisma/seed.ts.
 *   superadmin → platform admin (both buildings)
 *   admin      → building-1 ADMIN
 *   board      → building-1 BOARD_MEMBER (chair)
 *   owner      → building-1 OWNER (resident1)
 *   tenant     → building-1 TENANT
 *
 * Cross-building negative cases (a building-2 user can't reach building-1 data)
 * are covered at the integration level by tests/integration/isolation-condo.ts
 * (building-switch membership enforcement), so the E2E set stays building-1.
 */
export const CONDO_USERS = {
  superadmin: "superadmin@condo.local",
  admin: "admin@condo.local",
  board: "board@condo.local",
  owner: "resident1@condo.local",
  tenant: "tenant1@condo.local",
} as const;

export type CondoRole = keyof typeof CONDO_USERS;

export const PASSWORD = "password123";

/** storageState path for a role's saved session. */
export function authFile(role: string): string {
  return `e2e/.auth/${role}.json`;
}

/** Log in via the condo login form and wait for the dashboard. */
export async function loginCondo(page: Page, email: string): Promise<void> {
  await page.goto("/hu/login");
  await page.locator("input[type='email']").waitFor({ state: "visible" });
  await page.locator("input[type='email']").fill(email);
  await page.locator("input[type='password']").fill(PASSWORD);
  await page.locator("input[type='password']").press("Enter");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });
}
