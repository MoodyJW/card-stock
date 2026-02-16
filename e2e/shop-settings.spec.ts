import { test, expect } from '@playwright/test';

test.describe('Shop Settings Flow', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test.beforeEach(async ({ page }) => {
        await page.goto('/auth/login');
        await page.evaluate(() => localStorage.clear());

        // Log in
        await page.locator('input[type="email"]').fill('test@test.com');
        await page.locator('input[type="password"]').fill('password123');
        await page.locator('button[type="submit"]').click();

        // Create a new shop for this test
        await expect(page).toHaveURL(/\/shop\/select/);
        await page.locator('a[href="/shop/create"]').click();

        const shopName = `Settings Test Shop ${Date.now()}`;
        const shopSlug = `settings-test-${Date.now()}`;

        await page.locator('input[formControlName="name"]').fill(shopName);
        await page.locator('input[formControlName="slug"]').fill(shopSlug);
        await page.locator('button[type="submit"]').click();

        // Should be redirected to dashboard
        await expect(page).toHaveURL(new RegExp(`/shop/${shopSlug}/dashboard`));

        // Navigate to Settings Page using text selector which is more robust
        await page.click('text=Shop Settings');
    });

    test('should display settings page', async ({ page }) => {
        await expect(page.locator('h1')).toContainText('Shop Settings');
        await expect(page.locator('.danger-title')).toContainText('Danger Zone');
    });

    test('should allow owner to delete shop', async ({ page }) => {
        // Handle Delete Prompt
        page.on('dialog', async dialog => {
            if (dialog.message().includes('Type "DELETE"')) {
                await dialog.accept('DELETE');
            } else {
                await dialog.accept();
            }
        });

        await page.locator('button:has-text("Delete Shop")').click();

        // Should be redirected to Shop Select
        await expect(page).toHaveURL(/\/shop\/select/);
    });

    test('should prevent sole owner from leaving shop', async ({ page }) => {
        // Handle Leave Confirm Dialog
        page.on('dialog', dialog => dialog.accept());

        await page.locator('button:has-text("Leave Shop")').click();

        // Should NOT be redirected, should show error
        await expect(page).toHaveURL(new RegExp(/.*\/settings/));
        await expect(page.locator('.error-banner')).toBeVisible();
        await expect(page.locator('.error-banner')).toContainText('Cannot leave: you are the only owner');
    });
});
