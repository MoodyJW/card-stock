import { test, expect, Page } from '@playwright/test';

test.describe('Inventory — Soft Delete & Undo', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    let shopSlug: string;

    async function loginAndCreateShop(page: Page) {
        await page.goto('/auth/login');
        await page.evaluate(() => localStorage.clear());
        await page.locator('input[type="email"]').fill('test@test.com');
        await page.locator('input[type="password"]').fill('password123');
        await page.locator('button[type="submit"]').click();
        await expect(page).toHaveURL(/\/shop\/select/);

        await page.locator('a[href="/shop/create"]').click();
        const ts = Date.now();
        shopSlug = `inv-del-${ts}`;
        await page.locator('input[formControlName="name"]').fill(`Delete Test ${ts}`);
        await page.locator('input[formControlName="slug"]').fill(shopSlug);
        await page.locator('button[type="submit"]').click();
        await expect(page).toHaveURL(new RegExp(`/shop/${shopSlug}/dashboard`));
    }

    async function navigateToInventory(page: Page) {
        await page.locator('a[href*="/inventory"]').click();
        await expect(page).toHaveURL(new RegExp(`/shop/${shopSlug}/inventory`));
    }

    async function addCard(page: Page, name: string) {
        await page.locator('button:has-text("Add Card")').first().click();
        const dialog = page.locator('mat-dialog-container');
        await dialog.waitFor({ state: 'visible' });
        await dialog.locator('input[formControlName="card_name"]').fill(name);
        await dialog.locator('button[type="submit"]').click();
        await dialog.waitFor({ state: 'hidden' });
    }

    test.beforeEach(async ({ page }) => {
        await loginAndCreateShop(page);
        await navigateToInventory(page);
    });

    test('should delete a card and show undo toast', async ({ page }) => {
        await addCard(page, 'Rayquaza VMAX');
        const row = page.locator('tr.mat-mdc-row', { hasText: 'Rayquaza VMAX' });
        await expect(row).toBeVisible();

        // Delete via action menu
        await row.locator('button[mat-icon-button]').click();
        await page.getByRole('menuitem', { name: 'Delete' }).click();

        // Card should disappear
        await expect(row).not.toBeVisible();

        // Undo snackbar should appear (filter to avoid overlap with "Card added" toast)
        const snackbar = page.locator('mat-snack-bar-container', { hasText: 'Card deleted' });
        await expect(snackbar).toBeVisible();
        await expect(snackbar).toContainText('Undo');
    });

    test('should restore a card when clicking Undo', async ({ page }) => {
        await addCard(page, 'Umbreon VMAX');
        const row = page.locator('tr.mat-mdc-row', { hasText: 'Umbreon VMAX' });
        await expect(row).toBeVisible();

        // Delete
        await row.locator('button[mat-icon-button]').click();
        await page.getByRole('menuitem', { name: 'Delete' }).click();
        await expect(row).not.toBeVisible();

        // Click Undo on the delete snackbar
        const snackbar = page.locator('mat-snack-bar-container', { hasText: 'Card deleted' });
        await snackbar.locator('button', { hasText: 'Undo' }).click();

        // Card should reappear
        await expect(page.locator('tr.mat-mdc-row', { hasText: 'Umbreon VMAX' })).toBeVisible();

        // Restoration toast
        await expect(page.locator('mat-snack-bar-container', { hasText: 'Card restored' })).toBeVisible();
    });

    test('should persist deletion after page reload', async ({ page }) => {
        await addCard(page, 'Sylveon VMAX');
        await expect(page.locator('tr.mat-mdc-row', { hasText: 'Sylveon VMAX' })).toBeVisible();

        // Delete
        const row = page.locator('tr.mat-mdc-row', { hasText: 'Sylveon VMAX' });
        await row.locator('button[mat-icon-button]').click();
        await page.getByRole('menuitem', { name: 'Delete' }).click();
        await expect(row).not.toBeVisible();

        // Reload the page (card is already soft-deleted in DB)
        await page.reload();

        // Card should NOT reappear — empty state or no matching row
        await expect(page.locator('tr.mat-mdc-row', { hasText: 'Sylveon VMAX' })).not.toBeVisible();
    });
});
