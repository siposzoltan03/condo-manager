import { test, expect } from "@playwright/test";

test.describe("Authentication flow", () => {
  test("should log in, see dashboard, and navigate to announcements", async ({
    page,
  }) => {
    // Navigate to login page
    await page.goto("/hu/login");
    await expect(page.locator("input[type='email']")).toBeVisible();

    // Fill in credentials
    await page.fill("input[type='email']", "admin@condo.local");
    await page.fill("input[type='password']", "Admin123!");

    // Submit login form
    await page.click("button[type='submit']");

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
    await expect(
      page.locator("text=Welcome back").or(page.locator("text=Üdvözöljük"))
    ).toBeVisible({ timeout: 10_000 });

    // Navigate to announcements
    await page.click("a[href*='/announcements']");
    await expect(page).toHaveURL(/\/announcements/);
    await expect(
      page
        .locator("text=Announcements")
        .or(page.locator("text=Hirdetmények"))
    ).toBeVisible();
  });

  test("should reject invalid credentials", async ({ page }) => {
    await page.goto("/hu/login");

    await page.fill("input[type='email']", "wrong@email.com");
    await page.fill("input[type='password']", "wrongpassword");
    await page.click("button[type='submit']");

    // Should stay on login page with error
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page
        .locator("text=Invalid email or password")
        .or(page.locator("text=Hibás e-mail cím vagy jelszó"))
    ).toBeVisible({ timeout: 5_000 });
  });
});
