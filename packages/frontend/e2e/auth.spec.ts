import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should show login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('RTO Management System')).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder(/username/i).fill('admin');
    await page.getByPlaceholder(/password/i).fill('admin123');
    await page.getByRole('button', { name: /masuk|login/i }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/(dashboard)?$/, { timeout: 15000 });
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder(/username/i).fill('admin');
    await page.getByPlaceholder(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /masuk|login/i }).click();

    // Should show error
    await expect(page.getByText(/salah|invalid|gagal/i)).toBeVisible({ timeout: 10000 });
  });
});
