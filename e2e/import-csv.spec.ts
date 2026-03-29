import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('Import Wizard - CSV', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    let shopSlug: string;

    test.beforeEach(async ({ page }) => {
        await page.goto('/auth/login');
        await page.evaluate(() => localStorage.clear());
        await page.locator('input[type="email"]').fill('test@test.com');
        await page.locator('input[type="password"]').fill('password123');
        await page.locator('button[type="submit"]').click();
        await expect(page).toHaveURL(/\/shop\/select/, { timeout: 10000 });

        await page.locator('a[href="/shop/create"]').click();
        const ts = Date.now();
        shopSlug = `csv-${ts}`;
        await page.locator('input[formControlName="name"]').fill(`CSV ${ts}`);
        await page.locator('input[formControlName="slug"]').fill(shopSlug);
        await page.locator('button[type="submit"]').click();
        await expect(page).toHaveURL(new RegExp(`/shop/${shopSlug}/dashboard`));
    });

    test('should import basic csv file successfully', async ({ page }) => {
        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
        page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));

        await page.getByRole('link', { name: 'Import' }).click();

        const fileInput = page.locator('input[type="file"]');
        const csvPath = path.join(__dirname, 'fixtures', 'simple-import.csv');
        await fileInput.setInputFiles(csvPath);

        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'e2e/fixtures/csv-step2.png' });
        const text = await page.locator('app-import-wizard').innerText().catch(() => 'err');
        console.log('Step 2 text:', text);

        const errText = await page.locator('.error-text').allInnerTexts();
        console.log('CSV Errors:', errText);
        
        await page.locator('button:has-text("Review & Import")').click();
        
        await page.waitForTimeout(2000);
        const reviewHtml = await page.locator('app-import-wizard-review').innerHTML().catch(() => 'no html');
        console.log('=============== REVIEW HTML ===============');
        console.log(reviewHtml);
        console.log('===========================================');
        
        await expect(page.locator('.summary-stat.ready')).toContainText('Ready: 3');
        await page.locator('button', { hasText: /Import \d+ Cards/ }).click();
        await expect(page.locator('h2:has-text("Import Complete")')).toBeVisible();
        await page.locator('button:has-text("Go to Inventory")').click();
        await expect(page.locator('tr.mat-mdc-row')).toHaveCount(3);
    });
});
