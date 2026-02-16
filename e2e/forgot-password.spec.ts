import { test, expect } from '@playwright/test';

test.describe('Forgot Password Flow', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test.beforeEach(async ({ page }) => {
        await page.goto('/auth/login');
        await page.evaluate(() => localStorage.clear());
    });

    test('should navigate to forgot password page', async ({ page }) => {
        await page.click('text=Forgot password?');
        await expect(page).toHaveURL(/\/auth\/forgot-password/);
        await expect(page.locator('h2')).toContainText('Reset your password');
    });

    test('should show validation error for invalid email', async ({ page }) => {
        await page.goto('/auth/forgot-password');
        await page.locator('input[type="email"]').fill('invalid-email');
        await page.locator('button[type="submit"]').click();

        const emailError = page.locator('mat-form-field').locator('mat-error');
        await expect(emailError).toContainText('Enter a valid email');
    });

    test('should show confirmation matching register flow', async ({ page }) => {
        await page.goto('/auth/forgot-password');
        const email = 'test@test.com'; // Use seeded user
        await page.locator('input[type="email"]').fill(email);
        await page.locator('button[type="submit"]').click();

        // Should show confirmation
        await expect(page.locator('.confirmation h2')).toContainText('Check your email');
        await expect(page.locator('.confirmation')).toContainText(email);
    });

    test('should allow navigation back to login', async ({ page }) => {
        await page.goto('/auth/forgot-password');
        await page.click('text=Back to log in');
        await expect(page).toHaveURL(/\/auth\/login/);
    });
});
