import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Export Functionality', () => {
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
        shopSlug = `export-${ts}`;
        await page.locator('input[formControlName="name"]').fill(`Export ${ts}`);
        await page.locator('input[formControlName="slug"]').fill(shopSlug);
        await page.locator('button[type="submit"]').click();
        await expect(page).toHaveURL(new RegExp(`/shop/${shopSlug}/dashboard`));
    }

    test.beforeEach(async ({ page }) => {
        await loginAndCreateShop(page);
    });

    test('should download CSV and XLSX files', async ({ page }) => {
        await page.getByRole('link', { name: 'Import' }).click();
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'valid-import.xlsx'));
        await page.locator('button:has-text("Review & Import")').click();
        await expect(page.locator('.summary-stat.ready')).toContainText('Ready: 5');
        await page.locator('button', { hasText: /Import \d+ Cards/ }).click();
        await expect(page.locator('h2:has-text("Import Complete")')).toBeVisible();
        
        await page.locator('button:has-text("Go to Inventory")').click();
        await expect(page.locator('tr.mat-mdc-row')).toHaveCount(5);

        await page.locator('button[matTooltip="Export"]').click();
        
        const csvDownloadPromise = page.waitForEvent('download');
        await page.locator('button:has-text("Export as CSV")').click();
        const csvDownload = await csvDownloadPromise;
        
        const csvPath = await csvDownload.path();
        expect(csvPath).toBeTruthy();
        
        const csvContent = fs.readFileSync(csvPath!, 'utf8');
        expect(csvContent).toContain('Pikachu');
        expect(csvContent).toContain('Charizard');
        
        const searchInput = page.locator('input[formControlName="search"]');
        if (await searchInput.isVisible()) {
            await searchInput.fill('Charizard');
            await page.waitForTimeout(500); // Wait for debounce / api
            await expect(page.locator('tr.mat-mdc-row')).toHaveCount(1);
        } else {
            const expandButton = page.locator('button', { has: page.locator('mat-icon:text-is("filter_list")') }).first();
            if (await expandButton.isVisible() && await expandButton.isEnabled()) {
                await expandButton.click();
            }
            await page.locator('input[formControlName="search"]').fill('Charizard');
            await page.waitForTimeout(500);
            await expect(page.locator('tr.mat-mdc-row')).toHaveCount(1);
        }

        await page.locator('button[matTooltip="Export"]').click();
        
        const xlsxDownloadPromise = page.waitForEvent('download');
        await page.locator('button:has-text("Export as Excel")').click();
        const xlsxDownload = await xlsxDownloadPromise;
        
        expect(xlsxDownload.suggestedFilename()).toMatch(/\.xlsx$/);
    });
});
