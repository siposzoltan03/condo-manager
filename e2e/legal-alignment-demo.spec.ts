import { test, expect } from "@playwright/test";

/**
 * Visual demo of the legal-alignment features. Run with:
 *
 *   node node_modules/@playwright/test/cli.js test \
 *     e2e/legal-alignment-demo.spec.ts \
 *     --project=chromium --workers=1 --headed
 *
 * Add `--slow-mo=600` if you want the steps even more leisurely.
 *
 * Walks through three behaviours in one browser session:
 *   1. TENANT sidebar omits Finance (Tht. § 16, § 38).
 *   2. TENANT direct-URL navigation to /finance redirects to /dashboard.
 *   3. ADMIN attempting to assign a contractor without a Data Processing
 *      Agreement gets a visible toast error (GDPR Art. 28).
 */

test.describe.configure({ mode: "serial" });

test("legal-alignment walkthrough", async ({ page }) => {
  // Slow each step down so a human observer can follow along.
  const pause = (ms: number) => page.waitForTimeout(ms);

  // ── 1. Log in as TENANT ──────────────────────────────────────────────
  await page.goto("/hu/login");
  await page.locator("input[type='email']").fill("tenant1@condo.local");
  await page.locator("input[type='password']").fill("password123");
  await pause(600);
  await page.locator("button[type='submit']").click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  await pause(1500);

  // ── 2. Sidebar: Finance is NOT in the nav for TENANT ─────────────────
  const financeLink = page.locator("a[href*='/finance']");
  await expect(financeLink).toHaveCount(0);
  await pause(1500);

  // ── 3. Direct-URL: TENANT visiting /hu/finance is redirected ─────────
  await page.goto("/hu/finance");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await pause(1500);

  // ── 4. Log out via the topbar control, then log in as ADMIN ──────────
  await page.context().clearCookies();
  await page.goto("/hu/login");
  await page.locator("input[type='email']").fill("admin@condo.local");
  await page.locator("input[type='password']").fill("password123");
  await pause(600);
  await page.locator("button[type='submit']").click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  await pause(1000);

  // ── 5. Create a fresh ticket via API so the assign panel is in its
  //       clean "unassigned" state, then navigate to it. ───────────────
  const createRes = await page.request.post("/api/maintenance/tickets", {
    data: {
      title: "Demo — szellőző akadozik",
      description: "Demo ticket a DPA-gate bemutatóhoz.",
      category: "OTHER",
      urgency: "MEDIUM",
    },
  });
  expect(createRes.ok()).toBeTruthy();
  const ticket = (await createRes.json()) as { id: string };
  await page.goto(`/hu/maintenance/${ticket.id}`);
  await pause(1500);

  // ── 6. Attempt to assign a contractor; expect the DPA toast ──────────
  // The assign panel exposes a select + a confirm button. We pick the
  // first contractor option and submit; the API replies 422 DPA_MISSING
  // and the panel surfaces the error message as a toast.
  const select = page.locator("select").first();
  await select.waitFor({ state: "visible", timeout: 10_000 });
  const optionValues = await select
    .locator("option")
    .evaluateAll((opts) =>
      (opts as HTMLOptionElement[])
        .map((o) => o.value)
        .filter((v) => v.length > 0),
    );
  expect(optionValues.length, "seed needs at least one contractor").toBeGreaterThan(0);
  await select.selectOption(optionValues[0]);
  await pause(700);

  // The submit button reads "Kijelölés" (assign) when no contractor is
  // attached, or "Csere" (change) when one already is. Either is fine —
  // both routes hit /assign and trigger the DPA gate.
  const assignButton = page
    .locator("button")
    .filter({ hasText: /^(Kijelölés|Csere|Assign|Change)$/ })
    .first();
  await assignButton.click();

  // Toast contains the DPA error message from /assign.
  await expect(
    page.locator("text=/Data Processing Agreement|adatfeldolgoz/i"),
  ).toBeVisible({ timeout: 10_000 });
  await pause(2500);
});
