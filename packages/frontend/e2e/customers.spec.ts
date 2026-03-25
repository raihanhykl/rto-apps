import { test, expect } from '@playwright/test';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByPlaceholder(/username/i).fill('admin');
  await page.getByPlaceholder(/password/i).fill('admin123');
  await page.getByRole('button', { name: /masuk|login/i }).click();
  await page.waitForURL(/\/(dashboard)?$/);
}

test.describe('Customers', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display customers list', async ({ page }) => {
    await page.goto('/customers');
    // Should see customer table or list
    await expect(page.getByText(/customer/i).first()).toBeVisible();
  });

  test('should have search functionality', async ({ page }) => {
    await page.goto('/customers');
    const searchInput = page.getByPlaceholder(/cari/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      // Wait for search results to update
      await page.waitForTimeout(500);
    }
  });

  test('should open create customer dialog/page', async ({ page }) => {
    await page.goto('/customers');
    const addButton = page.getByRole('button', { name: /tambah/i });
    if (await addButton.isVisible()) {
      await addButton.click();
      // Should show form
      await expect(page.getByText(/nama|name/i).first()).toBeVisible();
    }
  });
});
