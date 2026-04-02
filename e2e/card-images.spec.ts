import { test, expect, Page } from '@playwright/test';
import * as path from 'path';

test.describe('Image Upload Flow', () => {
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
        shopSlug = `img-flow-${ts}`;
        await page.locator('input[formControlName="name"]').fill(`Image Shop ${ts}`);
        await page.locator('input[formControlName="slug"]').fill(shopSlug);
        await page.locator('button[type="submit"]').click();
        await expect(page).toHaveURL(new RegExp(`/shop/${shopSlug}/dashboard`));
    }

    test.beforeEach(async ({ page }) => {
        await loginAndCreateShop(page);
        await page.goto(`/shop/${shopSlug}/inventory`);
    });

    test('should upload images from dialog and detail views safely', async ({ page }) => {
        // 1. Add Card Dialog
        await page.locator('button:has-text("Add Card")').first().click();
        const dialog = page.locator('mat-dialog-container');
        await expect(dialog).toBeVisible();

        await dialog.locator('input[formControlName="card_name"]').fill('Image Upload Test Card');
        await dialog.locator('mat-select[formControlName="condition"]').click();
        await page.locator('mat-option', { hasText: 'Near Mint' }).click();
        
        // Find the first upload slot (Front) and upload
        const frontInput = dialog.locator('input[type="file"]').first();
        await frontInput.setInputFiles(path.join(__dirname, 'fixtures', 'card-front.jpg'));

        // Wait for preview to appear natively
        await expect(dialog.locator('img.preview-image').first()).toBeVisible();

        // Save card
        await dialog.locator('button[type="submit"]').click();
        await expect(dialog).toBeHidden();
        await expect(page.locator('mat-snack-bar-container')).toContainText('Card added successfully');

        // 2. Verify Table Thumbnail
        const row = page.locator('tr.mat-mdc-row', { hasText: 'Image Upload Test Card' });
        await expect(row).toBeVisible();
        
        // Try finding the image thumbnail mapped in the cell
        const thumb = row.locator('td.mat-column-image img');
        await expect(thumb).toBeVisible();

        // 3. Navigate to Card Detail
        // Clicking the row specifically triggers navigateToCard
        await row.locator('td.mat-column-card_name').click();
        
        // Wait for detail view
        await expect(page).toHaveURL(new RegExp(`/shop/${shopSlug}/inventory/.*`));
        await expect(page.locator('h1.detail-title')).toHaveText('Image Upload Test Card');

        // 4. Verify Gallery in detail component
        // There should be 1 image thumbnail existing
        await expect(page.locator('.gallery-thumb').first()).toBeVisible();

        // 5. Upload second image from gallery
        const backInput = page.locator('app-image-upload-slot input[type="file"]').first();
        await backInput.setInputFiles(path.join(__dirname, 'fixtures', 'card-back.jpg'));

        // Wait for success toast and second image to appear
        await expect(page.locator('mat-snack-bar-container', { hasText: 'Image uploaded' })).toBeVisible();
        
        // Verify both images are now in the gallery layout
        await expect(page.locator('.gallery-thumb')).toHaveCount(2);
    });
});
