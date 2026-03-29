import { test, expect, Page } from '@playwright/test';
import * as path from 'path';

test.describe('Import Wizard - Happy Path', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    let shopSlug: string;

    async function loginAndCreateShop(page: Page) {
        await page.goto('/auth/login');
        await page.evaluate(() => localStorage.clear());
        await page.locator('input[type="email"]').fill('test@test.com');
        await page.locator('input[type="password"]').fill('password123');
        await page.locator('button[type="submit"]').click();
        await expect(page).toHaveURL(/\/shop\/select/, { timeout: 10000 });

        await page.locator('a[href="/shop/create"]').click();
        const ts = Date.now();
        shopSlug = `import-${ts}`;
        await page.locator('input[formControlName="name"]').fill(`Import Test ${ts}`);
        await page.locator('input[formControlName="slug"]').fill(shopSlug);
        await page.locator('button[type="submit"]').click();
        await expect(page).toHaveURL(new RegExp(`/shop/${shopSlug}/dashboard`));
    }

    test.beforeEach(async ({ page }) => {
        await loginAndCreateShop(page);
    });

    test('should complete the import wizard with valid excel file', async ({ page }) => {
        await page.getByRole('link', { name: 'Import' }).click();
        await expect(page).toHaveURL(new RegExp(`/shop/${shopSlug}/import`));

        const fileInput = page.locator('input[type="file"]');
        const validPath = path.join(__dirname, 'fixtures', 'valid-import.xlsx');
        await fileInput.setInputFiles(validPath);

        await expect(page.locator('tr:has-text("Card Name") >> mat-select')).toContainText('Card Name');
        await expect(page.locator('tr:has-text("Set Name") >> mat-select')).toContainText('Set Name');
        await page.locator('button:has-text("Review & Import")').click();

        await expect(page.locator('app-import-wizard-review')).toContainText('Ready: 5');
        await expect(page.locator('app-import-wizard-review')).toContainText('Errors: 0');
        
        await page.locator('button', { hasText: /Import \d+ Cards/ }).click();

        await expect(page.locator('h2:has-text("Import Complete")')).toBeVisible();
        await expect(page.locator('.result-number').first()).toHaveText('5');
        
        await page.locator('button:has-text("Go to Inventory")').click();

        await expect(page).toHaveURL(new RegExp(`/shop/${shopSlug}/inventory`));
        await expect(page.locator('tr.mat-mdc-row')).toHaveCount(5);
        await expect(page.locator('tr.mat-mdc-row', { hasText: 'Pikachu' })).toBeVisible();
        await expect(page.locator('tr.mat-mdc-row', { hasText: 'Charizard' })).toBeVisible();
    });
});
