import { test, expect } from '@playwright/test';

// Helper: login before each test
async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByPlaceholder(/username/i).fill('admin');
  await page.getByPlaceholder(/password/i).fill('admin123');
  await page.getByRole('button', { name: /masuk|login/i }).click();
  await page.waitForURL(/\/(dashboard)?$/);
}

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display dashboard stats', async ({ page }) => {
    await page.goto('/');
    // Should see some stats cards
    await expect(page.getByText(/customer|kontrak|pembayaran/i).first()).toBeVisible();
  });

  test('should navigate to customers page', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('link', { name: /customer/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/customers/);
  });

  test('should navigate to contracts page', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('link', { name: /kontrak|contract/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/contracts/);
  });
});
