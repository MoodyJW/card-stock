import { test, expect, Page } from '@playwright/test';

test.describe('Inventory Filters', () => {
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
        shopSlug = `inv-filter-${ts}`;
        await page.locator('input[formControlName="name"]').fill(`Filter Test ${ts}`);
        await page.locator('input[formControlName="slug"]').fill(shopSlug);
        await page.locator('button[type="submit"]').click();
        await expect(page).toHaveURL(new RegExp(`/shop/${shopSlug}/dashboard`));
    }

    async function navigateToInventory(page: Page) {
        await page.locator('a[href*="/inventory"]').click();
        await expect(page).toHaveURL(new RegExp(`/shop/${shopSlug}/inventory`));
    }

    async function addCard(page: Page, name: string, opts?: {
        setName?: string; cardNumber?: string; condition?: string;
        purchasePrice?: string; sellingPrice?: string;
    }) {
        await page.locator('button:has-text("Add Card")').first().click();
        const dialog = page.locator('mat-dialog-container');
        await dialog.waitFor({ state: 'visible' });

        await dialog.locator('input[formControlName="card_name"]').fill(name);
        if (opts?.setName) {
            await dialog.locator('input[formControlName="set_name"]').fill(opts.setName);
        }
        if (opts?.cardNumber) {
            await dialog.locator('input[formControlName="card_number"]').fill(opts.cardNumber);
        }
        if (opts?.condition) {
            await dialog.locator('mat-select[formControlName="condition"]').click();
            await page.locator('mat-option', { hasText: opts.condition }).click();
        }
        if (opts?.purchasePrice) {
            await dialog.locator('input[formControlName="purchase_price"]').fill(opts.purchasePrice);
        }
        if (opts?.sellingPrice) {
            await dialog.locator('input[formControlName="selling_price"]').fill(opts.sellingPrice);
        }

        await dialog.locator('button[type="submit"]').click();
        await dialog.waitFor({ state: 'hidden' });
    }

    // Single combined test to avoid re-creating 3 cards per filter scenario
    test('should filter by search, condition, set, and combinations', async ({ page }) => {
        test.setTimeout(60_000);

        await loginAndCreateShop(page);
        await navigateToInventory(page);

        // Add 3 cards with distinct properties
        await addCard(page, 'Charizard VMAX', { condition: 'Near Mint', setName: 'Evolving Skies' });
        await addCard(page, 'Pikachu V', { condition: 'Lightly Played', setName: 'Brilliant Stars' });
        await addCard(page, 'Mewtwo EX', { condition: 'Near Mint', setName: 'Brilliant Stars' });
        await expect(page.locator('tr.mat-mdc-row')).toHaveCount(3);

        // --- Search by name ---
        const searchInput = page.locator('input[formControlName="search"]');
        await searchInput.fill('Charizard');
        await expect(page.locator('tr.mat-mdc-row')).toHaveCount(1);
        await expect(page.locator('tr.mat-mdc-row')).toContainText('Charizard VMAX');
        await searchInput.clear();
        await expect(page.locator('tr.mat-mdc-row')).toHaveCount(3);

        // --- Filter by condition ---
        await page.locator('mat-select[formControlName="condition"]').click({ force: true });
        await page.locator('mat-option', { hasText: 'Near Mint' }).click();
        await expect(page.locator('tr.mat-mdc-row')).toHaveCount(2);
        // Reset condition
        await page.locator('mat-select[formControlName="condition"]').click({ force: true });
        await page.locator('mat-option', { hasText: 'All Conditions' }).click();
        await expect(page.locator('tr.mat-mdc-row')).toHaveCount(3);

        // --- Filter by set ---
        await page.locator('mat-select[formControlName="set_name"]').click({ force: true });
        await page.locator('mat-option', { hasText: 'Brilliant Stars' }).click();
        await expect(page.locator('tr.mat-mdc-row')).toHaveCount(2);
        // Reset set
        await page.locator('mat-select[formControlName="set_name"]').click({ force: true });
        await page.locator('mat-option', { hasText: 'All Sets' }).click();
        await expect(page.locator('tr.mat-mdc-row')).toHaveCount(3);

        // --- Combine filters (AND) ---
        // Select set first, wait for table to update (ensures dropdown closed)
        await page.locator('mat-select[formControlName="set_name"]').click({ force: true });
        await page.locator('mat-option', { hasText: 'Brilliant Stars' }).click();
        await expect(page.locator('tr.mat-mdc-row')).toHaveCount(2);
        // Then add condition filter
        await page.locator('mat-select[formControlName="condition"]').click({ force: true });
        await page.locator('mat-option', { hasText: 'Near Mint' }).click();
        await expect(page.locator('tr.mat-mdc-row')).toHaveCount(1);
        await expect(page.locator('tr.mat-mdc-row')).toContainText('Mewtwo EX');

        // --- Clear all filters ---
        await page.locator('button:has(mat-icon:has-text("filter_list_off"))').click();
        await expect(page.locator('tr.mat-mdc-row')).toHaveCount(3);
    });
});
