import { test, expect } from "@playwright/test";

/**
 * Plan ref: docs/plans/2026-04-27-roles-legal-alignment.md cross-cutting tests.
 *
 * Covers the legal-alignment guard rails that need browser-level verification:
 *   1. TENANT cannot view /finance even via direct URL (Tht. § 16, § 38).
 *   2. TENANT does not see the Finance link in the sidebar (sidebar truth
 *      table — one canonical row; full matrix is unit-tested in
 *      tests/lib/capabilities.test.ts).
 *   3. Ticket assignment is rejected with 422 DPA_MISSING for a contractor
 *      that has no Data Processing Agreement on file (GDPR Art. 28).
 *
 * Seed assumptions (prisma/seed.ts):
 *   - admin@condo.local / password123 — ADMIN of building1
 *   - tenant1@condo.local / password123 — TENANT in building1
 *   - All seeded contractors have NO DPA document attached (the DPA field
 *     was introduced in Phase 5; seed migration intentionally leaves it
 *     null so this gate gets exercised).
 */

async function loginAs(
  page: import("@playwright/test").Page,
  email: string,
) {
  await page.goto("/hu/login");
  await page.locator("input[type='email']").waitFor({ state: "visible" });
  await page.locator("input[type='email']").fill(email);
  await page.locator("input[type='password']").fill("password123");
  await page.locator("button[type='submit']").click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
}

test.describe("Legal alignment — role-gated surfaces", () => {
  test("TENANT direct URL to /finance redirects to /dashboard", async ({
    page,
  }) => {
    await loginAs(page, "tenant1@condo.local");
    await page.goto("/hu/finance");
    // Either redirected to dashboard or kept off the finance shell.
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page).not.toHaveURL(/\/finance/);
  });

  test("TENANT sidebar omits the Finance link", async ({ page }) => {
    await loginAs(page, "tenant1@condo.local");
    // The dashboard renders the sidebar. Finance is OWNER-only per the
    // capability matrix; the link must not be in the DOM at all.
    const financeLink = page.locator("a[href*='/finance']");
    await expect(financeLink).toHaveCount(0);
  });
});

test.describe("Legal alignment — DPA gate (GDPR Art. 28)", () => {
  test("assigning a contractor without a DPA returns 422 DPA_MISSING", async ({
    page,
  }) => {
    await loginAs(page, "admin@condo.local");

    // Use `page.request` so the API calls inherit the session cookie set
    // by the login flow above. The top-level `request` fixture runs in a
    // separate context with no cookies.
    const contractorsRes = await page.request.get("/api/maintenance/contractors");
    expect(contractorsRes.ok()).toBeTruthy();
    const contractorsJson = await contractorsRes.json();
    const contractors: Array<{ id: string }> = Array.isArray(contractorsJson)
      ? contractorsJson
      : (contractorsJson.contractors ?? []);
    expect(contractors.length, "seed must include at least one contractor").toBeGreaterThan(0);
    const contractorId = contractors[0].id;

    const ticketsRes = await page.request.get("/api/maintenance/tickets");
    expect(ticketsRes.ok()).toBeTruthy();
    const ticketsJson = await ticketsRes.json();
    const tickets: Array<{ id: string; status: string }> = Array.isArray(ticketsJson)
      ? ticketsJson
      : (ticketsJson.tickets ?? []);
    // Need a ticket that can still be assigned (not COMPLETED / VERIFIED).
    const open = tickets.find(
      (t) => t.status !== "COMPLETED" && t.status !== "VERIFIED",
    );
    expect(open, "seed must include an open maintenance ticket").toBeTruthy();

    const assignRes = await page.request.post(
      `/api/maintenance/tickets/${open!.id}/assign`,
      { data: { contractorId } },
    );
    expect(assignRes.status()).toBe(422);
    const body = await assignRes.json();
    expect(body.code).toBe("DPA_MISSING");
  });
});
