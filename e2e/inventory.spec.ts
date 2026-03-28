import { test, expect, Page } from '@playwright/test';

test.describe('Inventory CRUD', () => {
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
        shopSlug = `inv-crud-${ts}`;
        await page.locator('input[formControlName="name"]').fill(`CRUD Test ${ts}`);
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

    test.beforeEach(async ({ page }) => {
        await loginAndCreateShop(page);
        await navigateToInventory(page);
    });

    test('should show empty state when no cards exist', async ({ page }) => {
        const emptyCard = page.locator('.empty-state-card');
        await expect(emptyCard).toBeVisible();
        await expect(emptyCard).toContainText('No cards in inventory yet');
        await expect(page.locator('.add-card-btn')).toBeVisible();
    });

    test('should add a card and display it in the table', async ({ page }) => {
        await addCard(page, 'Charizard VMAX', {
            setName: 'Evolving Skies',
            cardNumber: '203/203',
            sellingPrice: '250',
            purchasePrice: '100',
        });

        // Verify card appears in table
        const row = page.locator('tr.mat-mdc-row', { hasText: 'Charizard VMAX' });
        await expect(row).toBeVisible();
        await expect(row).toContainText('Evolving Skies');
        await expect(row).toContainText('203/203');
        await expect(row).toContainText('$250.00');

        // Verify empty state is gone
        await expect(page.locator('.empty-state-card')).not.toBeVisible();
    });

    test('should edit a card and reflect changes in the table', async ({ page }) => {
        await addCard(page, 'Pikachu V', { sellingPrice: '10' });

        // Open action menu and click Edit
        const row = page.locator('tr.mat-mdc-row', { hasText: 'Pikachu V' });
        await row.locator('button[mat-icon-button]').click();
        await page.getByRole('menuitem', { name: 'Edit' }).click();

        // Edit card name and price
        const dialog = page.locator('mat-dialog-container');
        await dialog.waitFor({ state: 'visible' });
        const nameInput = dialog.locator('input[formControlName="card_name"]');
        await nameInput.clear();
        await nameInput.fill('Pikachu VMAX');
        const priceInput = dialog.locator('input[formControlName="selling_price"]');
        await priceInput.clear();
        await priceInput.fill('25');

        await dialog.locator('button[type="submit"]').click();
        await dialog.waitFor({ state: 'hidden' });

        // Verify updated values
        const updatedRow = page.locator('tr.mat-mdc-row', { hasText: 'Pikachu VMAX' });
        await expect(updatedRow).toBeVisible();
        await expect(updatedRow).toContainText('$25.00');
        // Only one row (card was updated, not duplicated)
        await expect(page.locator('tr.mat-mdc-row')).toHaveCount(1);
    });

    test('should toggle between table and grid views', async ({ page }) => {
        await addCard(page, 'Mewtwo EX', { setName: 'Scarlet & Violet' });

        // Switch to grid view
        await page.locator('mat-button-toggle[value="grid"]').click();
        await expect(page.locator('.card-tile .card-name')).toContainText('Mewtwo EX');

        // Switch back to table view
        await page.locator('mat-button-toggle[value="table"]').click();
        await expect(page.locator('tr.mat-mdc-row', { hasText: 'Mewtwo EX' })).toBeVisible();
    });

    test('should reserve and unreserve a card', async ({ page }) => {
        await addCard(page, 'Mew VMAX');

        const row = page.locator('tr.mat-mdc-row', { hasText: 'Mew VMAX' });

        // Reserve
        await row.locator('button[mat-icon-button]').click();
        await page.getByRole('menuitem', { name: 'Reserve' }).click();
        await expect(row.locator('[data-status="reserved"]')).toBeVisible();

        // Unreserve
        await row.locator('button[mat-icon-button]').click();
        await page.getByRole('menuitem', { name: 'Unreserve' }).click();
        await expect(row.locator('[data-status="available"]')).toBeVisible();
    });
});
