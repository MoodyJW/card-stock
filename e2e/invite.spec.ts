import { test, expect } from '@playwright/test';

test.describe('Invite System', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test.beforeEach(async ({ page }) => {
        await page.goto('/auth/login');
        await page.evaluate(() => localStorage.clear());

        // Log in
        await page.locator('input[type="email"]').fill('test@test.com');
        await page.locator('input[type="password"]').fill('password123');
        await page.locator('button[type="submit"]').click();

        // Create a new shop for this test to ensure isolation
        await expect(page).toHaveURL(/\/shop\/select/);
        await page.locator('a[href="/shop/create"]').click();

        const shopName = `Invite Test Shop ${Date.now()}`;
        const shopSlug = `invite-test-${Date.now()}`;

        await page.locator('input[formControlName="name"]').fill(shopName);
        await page.locator('input[formControlName="slug"]').fill(shopSlug);
        await page.locator('button[type="submit"]').click();

        // Should be redirected to dashboard
        await expect(page).toHaveURL(new RegExp(`/shop/${shopSlug}/dashboard`));

        // Navigate to Team Page
        await page.locator('a[href*="/team"]').click();
    });

    test('should display team members list', async ({ page }) => {
        await expect(page.locator('h1')).toContainText('Team Management');
        // Owner should be listed
        await expect(page.locator('mat-list-item')).toContainText('Test User');
    });

    test('should send and revoke an invite', async ({ page }) => {
        const inviteEmail = `invite-${Date.now()}@test.com`;

        // Send Invite
        await page.locator('input[placeholder="colleague@example.com"]').fill(inviteEmail);
        await page.locator('mat-select[formControlName="role"]').click();
        await page.locator('mat-option:has-text("Member")').click();
        await page.locator('button:has-text("Send Invite")').click();

        // Verify success toast and Invite in Pending List
        await expect(page.locator('mat-snack-bar-container')).toBeVisible();
        const inviteItem = page.locator('mat-list-item', { hasText: inviteEmail });
        await expect(inviteItem).toBeVisible();

        // Handle Revoke Confirm Dialog
        page.on('dialog', dialog => dialog.accept());

        // Revoke Invite
        await inviteItem.locator('button[matTooltip="Revoke Invite"]').click();

        // Verify Removal
        await expect(inviteItem).not.toBeVisible();
    });
});
