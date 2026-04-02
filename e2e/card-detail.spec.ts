import { test, expect, Page } from '@playwright/test';
import * as path from 'path';

test.describe('Card Detail Page Lightbox and Navigation', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    let shopSlug: string;

    async function loginAndCreateShop(page: Page) {
        await page.goto('/auth/login');
        await page.evaluate(() => localStorage.clear());
        await page.locator('input[type="email"]').fill('test@test.com');
        await page.locator('input[type="password"]').fill('password123');
        await page.locator('button[type="submit"]').click();
        await page.locator('a[href="/shop/create"]').click();
        const ts = Date.now();
        shopSlug = `detail-shop-${ts}`;
        await page.locator('input[formControlName="name"]').fill(`Detail Shop ${ts}`);
        await page.locator('input[formControlName="slug"]').fill(shopSlug);
        await page.locator('button[type="submit"]').click();
        await expect(page).toHaveURL(new RegExp(`/shop/${shopSlug}/dashboard`));
    }

    test.beforeEach(async ({ page }) => {
        await loginAndCreateShop(page);
        await page.goto(`/shop/${shopSlug}/inventory`);
    });

    test('should navigate to details, open lightbox, and successfully close', async ({ page }) => {
        await page.locator('button:has-text("Add Card")').first().click();
        const dialog = page.locator('mat-dialog-container');
        await expect(dialog).toBeVisible();
        await dialog.locator('input[formControlName="card_name"]').fill('Details Test Card');
        await dialog.locator('mat-select[formControlName="condition"]').click();
        await page.locator('mat-option', { hasText: 'Near Mint' }).click();

        await dialog.locator('app-image-upload-slot input[type="file"]').first().setInputFiles(path.join(__dirname, 'fixtures', 'card-front.jpg'));
        await expect(dialog.locator('img.preview-image').first()).toBeVisible();

        await dialog.locator('button[type="submit"]').click();

        await expect(dialog).toBeHidden();
        await expect(page.locator('mat-snack-bar-container', { hasText: 'Card added successfully' })).toBeVisible();

        // 1. Enter details page safely (click the unclickable cell to trigger navigation)
        const row = page.locator('tr.mat-mdc-row', { hasText: 'Details Test Card' });
        await row.locator('td.mat-column-card_name').click();
        await expect(page.locator('h1.detail-title')).toHaveText('Details Test Card');

        // 2. Open Lightbox
        const thumbnail = page.locator('.gallery-thumb').first();
        // Hover and click image to trigger lightbox
        await thumbnail.click();

        const lightbox = page.locator('mat-dialog-container'); 
        // Dialog wrapper
        await expect(lightbox).toBeVisible();
        await expect(lightbox.locator('.lightbox-image, img')).toBeVisible();

        // 3. Close Lightbox using Escape Key Native
        await page.keyboard.press('Escape');
        await expect(lightbox).toBeHidden();

        // 4. Return safely to table
        await page.locator('button[aria-label="Back to inventory"]').click();
        await expect(page.locator('table.mat-mdc-table')).toBeVisible();
    });
});
