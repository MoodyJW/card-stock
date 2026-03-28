import { test, expect, Page } from '@playwright/test';

test.describe('Inventory — Mark as Sold', () => {
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
        shopSlug = `inv-sell-${ts}`;
        await page.locator('input[formControlName="name"]').fill(`Sell Test ${ts}`);
        await page.locator('input[formControlName="slug"]').fill(shopSlug);
        await page.locator('button[type="submit"]').click();
        await expect(page).toHaveURL(new RegExp(`/shop/${shopSlug}/dashboard`));
    }

    async function navigateToInventory(page: Page) {
        await page.locator('a[href*="/inventory"]').click();
        await expect(page).toHaveURL(new RegExp(`/shop/${shopSlug}/inventory`));
    }

    async function addCard(page: Page, name: string, opts?: {
        setName?: string; sellingPrice?: string;
    }) {
        await page.locator('button:has-text("Add Card")').first().click();
        const dialog = page.locator('mat-dialog-container');
        await dialog.waitFor({ state: 'visible' });

        await dialog.locator('input[formControlName="card_name"]').fill(name);
        if (opts?.setName) {
            await dialog.locator('input[formControlName="set_name"]').fill(opts.setName);
        }
        if (opts?.sellingPrice) {
            await dialog.locator('input[formControlName="selling_price"]').fill(opts.sellingPrice);
        }

        await dialog.locator('button[type="submit"]').click();
        await dialog.waitFor({ state: 'hidden' });
    }

    test.beforeEach(async ({ page }) => {
        await loginAndCreateShop(page);
        await navigateToInventory(page);
    });

    test('should mark a card as sold via the action menu', async ({ page }) => {
        await addCard(page, 'Espeon VMAX', { setName: 'Evolving Skies', sellingPrice: '75' });

        const row = page.locator('tr.mat-mdc-row', { hasText: 'Espeon VMAX' });
        await expect(row).toBeVisible();

        // Open action menu → Mark as Sold
        await row.locator('button[mat-icon-button]').click();
        await page.getByRole('menuitem', { name: 'Mark as Sold' }).click();

        // Fill the sell dialog
        const dialog = page.locator('mat-dialog-container');
        await dialog.waitFor({ state: 'visible' });
        await expect(dialog).toContainText('Mark as Sold');
        await expect(dialog).toContainText('Espeon VMAX');

        // Sold price should be pre-filled from selling price
        const soldPriceInput = dialog.locator('input[formControlName="sold_price"]');
        await expect(soldPriceInput).toHaveValue('75');

        await dialog.locator('button:has-text("Confirm Sale")').click();
        await dialog.waitFor({ state: 'hidden' });

        // Verify status changed to Sold
        await expect(row.locator('[data-status="sold"]')).toBeVisible();
    });

    test('should hide sell and reserve buttons for sold cards', async ({ page }) => {
        await addCard(page, 'Alakazam EX', { sellingPrice: '30' });

        const row = page.locator('tr.mat-mdc-row', { hasText: 'Alakazam EX' });

        // Sell the card
        await row.locator('button[mat-icon-button]').click();
        await page.getByRole('menuitem', { name: 'Mark as Sold' }).click();

        const dialog = page.locator('mat-dialog-container');
        await dialog.waitFor({ state: 'visible' });
        await dialog.locator('button:has-text("Confirm Sale")').click();
        await dialog.waitFor({ state: 'hidden' });
        await expect(row.locator('[data-status="sold"]')).toBeVisible();

        // Re-open action menu and check available items
        await row.locator('button[mat-icon-button]').click();
        const menu = page.locator('.mat-mdc-menu-panel');
        await expect(menu).toBeVisible();

        // Edit and Delete should still be visible
        await expect(menu.locator('button:has-text("Edit")')).toBeVisible();
        await expect(menu.locator('button:has-text("Delete")')).toBeVisible();

        // Sell and Reserve should NOT be visible
        await expect(menu.locator('button:has-text("Mark as Sold")')).not.toBeVisible();
        await expect(menu.locator('button:has-text("Reserve")')).not.toBeVisible();
    });
});
