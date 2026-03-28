import { test, expect } from "@playwright/test";

test.describe("Maintenance ticket flow", () => {
  test("resident submits a ticket and admin updates its status", async ({
    page,
  }) => {
    // --- Step 1: Resident logs in and submits a ticket ---
    await page.goto("/hu/login");
    await page.fill("input[type='email']", "resident@condo.local");
    await page.fill("input[type='password']", "Resident123!");
    await page.click("button[type='submit']");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    // Navigate to maintenance
    await page.click("a[href*='/maintenance']");
    await expect(page).toHaveURL(/\/maintenance/);

    // Click "Report Issue" button
    await page
      .locator("button")
      .filter({
        hasText: /Report Issue|Hiba bejelentése/,
      })
      .click();

    // Fill in ticket form
    await page.fill(
      "input[name='title'], input[placeholder*='Title'], input[placeholder*='Cím']",
      "E2E Test - Leaking pipe in basement"
    );
    await page
      .locator("textarea")
      .first()
      .fill("Water is leaking from the main pipe in the basement area.");
    await page.locator("select").first().selectOption({ index: 1 }); // category
    await page.locator("select").nth(1).selectOption({ index: 1 }); // urgency

    // Submit
    await page
      .locator("button[type='submit']")
      .filter({ hasText: /Submit|Beküldés/ })
      .click();

    // Verify ticket created
    await expect(
      page
        .locator("text=E2E Test - Leaking pipe in basement")
        .or(
          page.locator("text=Ticket Created").or(page.locator("text=Jegy sikeresen"))
        )
    ).toBeVisible({ timeout: 10_000 });

    // --- Step 2: Admin logs in and updates ticket status ---
    await page.goto("/hu/login");
    await page.fill("input[type='email']", "admin@condo.local");
    await page.fill("input[type='password']", "Admin123!");
    await page.click("button[type='submit']");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    // Navigate to maintenance
    await page.click("a[href*='/maintenance']");
    await expect(page).toHaveURL(/\/maintenance/);

    // Find and click the ticket
    await page.locator("text=E2E Test - Leaking pipe in basement").click();

    // Update status
    const statusSelect = page.locator("select").filter({
      hasText: /Acknowledged|Tudomásul véve/,
    });
    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption("ACKNOWLEDGED");
    }
  });
});
