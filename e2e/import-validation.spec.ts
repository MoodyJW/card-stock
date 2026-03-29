import { test, expect, Page } from '@playwright/test';
import * as path from 'path';

test.describe('Import Wizard - Validation & Errors', () => {
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
        shopSlug = `inv-err-${ts}`;
        await page.locator('input[formControlName="name"]').fill(`Import Err ${ts}`);
        await page.locator('input[formControlName="slug"]').fill(shopSlug);
        await page.locator('button[type="submit"]').click();
        await expect(page).toHaveURL(new RegExp(`/shop/${shopSlug}/dashboard`));
    }

    test.beforeEach(async ({ page }) => {
        await loginAndCreateShop(page);
    });

    test('should handle validation errors, skip rows, and import remainder', async ({ page }) => {
        await page.getByRole('link', { name: 'Import' }).click();

        const fileInput = page.locator('input[type="file"]');
        const mixedPath = path.join(__dirname, 'fixtures', 'mixed-import.xlsx');
        await fileInput.setInputFiles(mixedPath);

        await page.locator('button:has-text("Review & Import")').click();

        await expect(page.locator('.summary-stat.ready')).toContainText('Ready: 8');
        await expect(page.locator('.summary-stat.ready')).toContainText('Ready: 8');
        await expect(page.locator('.summary-stat.errors')).toContainText('Errors: 2');
        
        const firstErrorRow = page.locator('tr.row-error').first();
        await firstErrorRow.locator('button mat-icon:has-text("block")').click();

        await expect(page.locator('.summary-stat.skipped')).toContainText('Skipped: 1');
        
        await page.locator('button', { hasText: /Import \d+ Cards/ }).click();

        await expect(page.locator('h2:has-text("Import Complete")')).toBeVisible();
        await expect(page.locator('.result-number.success')).toHaveText('8');

        await page.locator('button:has-text("Go to Inventory")').click();
        await expect(page.locator('tr.mat-mdc-row')).toHaveCount(8);
        await expect(page.locator('tr.mat-mdc-row', { hasText: 'Edge Case' })).toBeVisible();
    });
});
