import { test, expect } from '@playwright/test';

// Helper: login before each test
async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByPlaceholder(/username/i).fill('admin');
  await page.getByPlaceholder(/password/i).fill('admin123');
  await page.getByRole('button', { name: /masuk|login/i }).click();
  await expect(page).toHaveURL(/\/(dashboard)?$/, { timeout: 15000 });
}

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display dashboard stats', async ({ page }) => {
    // Already on dashboard from login, wait for stats to load in main content area
    await expect(
      page
        .locator('main')
        .getByText(/customer/i)
        .first(),
    ).toBeVisible({
      timeout: 10000,
    });
  });

  test('should navigate to customers page', async ({ page }) => {
    await page
      .getByRole('link', { name: /customer/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/customers/);
  });

  test('should navigate to contracts page', async ({ page }) => {
    await page
      .getByRole('link', { name: /kontrak|contract/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/contracts/);
  });
});
