import { test, expect } from '@playwright/test';

test.describe('Profile Settings', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test.beforeEach(async ({ page }) => {
        // Login flow
        await page.goto('/auth/login');
        await page.locator('input[type="email"]').fill('test@test.com');
        await page.locator('input[type="password"]').fill('password123');
        await page.locator('button[type="submit"]').click();

        // Expect to be on shop select or dashboard
        await expect(page).toHaveURL(/\/(shop|account)/);

        // Navigate to Profile directly
        await page.goto('/account/profile');
    });

    test('should display profile form', async ({ page }) => {
        await expect(page.locator('h1')).toHaveText('Account Settings');
        await expect(page.locator('input[formControlName="display_name"]')).toBeVisible();
        await expect(page.locator('input[formControlName="email"]')).toBeVisible();
    });

    test('should update display name', async ({ page }) => {
        const newName = `User ${Date.now()}`;
        await page.locator('input[formControlName="display_name"]').fill(newName);
        await page.locator('button:has-text("Save Profile")').click();

        // Verify toast (increased timeout to 15s for slow CI/local setups)
        await expect(page.locator('mat-snack-bar-container, .mat-mdc-snack-bar-container')).toContainText('Profile updated successfully', { timeout: 15000 });
    });

    test('should validate password mismatch', async ({ page }) => {
        await page.locator('input[formControlName="password"]').fill('newpassword123');
        await page.locator('input[formControlName="confirmPassword"]').fill('mismatch123');
        await page.locator('input[formControlName="confirmPassword"]').blur();

        // Button should be disabled or show error
        await expect(page.locator('mat-error')).toContainText('Passwords do not match');
        await expect(page.locator('button:has-text("Change Password")')).toBeDisabled();
    });

    test('should handle delete account cancellation', async ({ page }) => {
        page.on('dialog', dialog => {
            expect(dialog.message()).toContain('Type "DELETE"');
            dialog.dismiss();
        });

        await page.locator('button:has-text("Delete Account")').click();
        await expect(page).toHaveURL(/\/account\/profile/);
    });
});
