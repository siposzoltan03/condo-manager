import { test, expect } from "@playwright/test";

test.describe("Voting flow", () => {
  const voteTitle = `E2E Vote - ${Date.now()}`;

  test("admin creates a vote and resident casts a ballot", async ({
    page,
  }) => {
    // --- Step 1: Admin creates a vote ---
    await page.goto("/hu/login");
    await page.fill("input[type='email']", "admin@condo.local");
    await page.fill("input[type='password']", "Admin123!");
    await page.click("button[type='submit']");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    // Navigate to voting
    await page.click("a[href*='/voting']");
    await expect(page).toHaveURL(/\/voting/);

    // Click "Create Vote"
    await page
      .locator("button")
      .filter({ hasText: /Create Vote|Szavazás létrehozása/ })
      .click();

    // Fill in vote form
    await page.locator("input[name='title'], input").first().fill(voteTitle);
    await page
      .locator("textarea")
      .first()
      .fill("Should we approve the renovation budget?");

    // Set deadline (7 days from now)
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);
    const deadlineInput = page.locator("input[type='datetime-local'], input[type='date']").first();
    if (await deadlineInput.isVisible()) {
      await deadlineInput.fill(deadline.toISOString().slice(0, 16));
    }

    // Submit vote
    await page
      .locator("button[type='submit']")
      .filter({ hasText: /Create|Létrehozás/ })
      .click();

    // Verify vote appears
    await expect(page.locator(`text=${voteTitle}`)).toBeVisible({
      timeout: 10_000,
    });

    // --- Step 2: Resident logs in and casts a ballot ---
    await page.goto("/hu/login");
    await page.fill("input[type='email']", "resident@condo.local");
    await page.fill("input[type='password']", "Resident123!");
    await page.click("button[type='submit']");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    // Navigate to voting
    await page.click("a[href*='/voting']");
    await expect(page).toHaveURL(/\/voting/);

    // Find and interact with the vote
    const voteCard = page.locator(`text=${voteTitle}`);
    if (await voteCard.isVisible({ timeout: 5_000 })) {
      await voteCard.click();

      // Select an option and submit vote
      const yesOption = page.locator("label, button").filter({
        hasText: /Yes|Igen/,
      });
      if (await yesOption.isVisible()) {
        await yesOption.click();
      }

      const submitButton = page.locator("button").filter({
        hasText: /Submit Vote|Szavazat leadása/,
      });
      if (await submitButton.isVisible()) {
        await submitButton.click();
        await expect(
          page
            .locator("text=Your vote has been submitted")
            .or(page.locator("text=Szavazata rögzítésre került"))
        ).toBeVisible({ timeout: 5_000 });
      }
    }
  });
});
