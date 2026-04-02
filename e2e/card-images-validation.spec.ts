import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Image Validation Flow', () => {
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
        shopSlug = `img-val-${ts}`;
        await page.locator('input[formControlName="name"]').fill(`Val Shop ${ts}`);
        await page.locator('input[formControlName="slug"]').fill(shopSlug);
        await page.locator('button[type="submit"]').click();
        await expect(page).toHaveURL(new RegExp(`/shop/${shopSlug}/dashboard`));
    }

    test.beforeEach(async ({ page }) => {
        await loginAndCreateShop(page);
        await page.goto(`/shop/${shopSlug}/inventory`);
    });

    test('should reject non-image file types', async ({ page }) => {
        await page.locator('button:has-text("Add Card")').first().click();
        const dialog = page.locator('mat-dialog-container');
        await expect(dialog).toBeVisible();
        
        // Dynamically create a fake pdf to bypass actual upload but trigger local checking
        const pdfFile = path.join(__dirname, 'fixtures', 'test.pdf');
        fs.writeFileSync(pdfFile, 'dummy pdf content');

        const frontInput = dialog.locator('app-image-upload-slot input[type="file"]').first();
        await frontInput.setInputFiles(pdfFile);

        await expect(page.locator('mat-snack-bar-container', { hasText: 'Only image files are allowed.' })).toBeVisible();

        // Cleanup
        fs.unlinkSync(pdfFile);
    });

    test('should reject oversized images without crashing', async ({ page }) => {
        await page.locator('button:has-text("Add Card")').first().click();
        const dialog = page.locator('mat-dialog-container');
        await expect(dialog).toBeVisible();
        
        // Generate an 11MB file directly into temp fixtures so we trigger the 10MB file limit check locally
        const largeFile = path.join(__dirname, 'fixtures', 'oversize.jpg');
        const buffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
        fs.writeFileSync(largeFile, buffer);

        const frontInput = dialog.locator('app-image-upload-slot input[type="file"]').first();
        await frontInput.setInputFiles(largeFile);

        await expect(page.locator('mat-snack-bar-container', { hasText: 'Image is too large. Maximum size is 10MB.' })).toBeVisible();

        // Cleanup
        fs.unlinkSync(largeFile);
    });
});
