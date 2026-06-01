import { expect, test } from '@playwright/test';

test('renders auth shell on desktop', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Canvas' })).toBeVisible();
  await expect(page.locator('.segmented button.selected')).toHaveText('Đăng nhập');
});

test('auth shell fits mobile viewport', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.segmented button.selected')).toBeVisible();
  await expect(page.locator('.auth-panel')).toBeVisible();
});
