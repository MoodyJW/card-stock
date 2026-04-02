import { test, expect, Page } from '@playwright/test';
import * as path from 'path';

test.describe('Image Management Flow', () => {
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
        shopSlug = `img-mgmt-${ts}`;
        await page.locator('input[formControlName="name"]').fill(`Mgmt Shop ${ts}`);
        await page.locator('input[formControlName="slug"]').fill(shopSlug);
        await page.locator('button[type="submit"]').click();
        await expect(page).toHaveURL(new RegExp(`/shop/${shopSlug}/dashboard`));
    }

    test.beforeEach(async ({ page }) => {
        await loginAndCreateShop(page);
        await page.goto(`/shop/${shopSlug}/inventory`);
    });

    test('should manage images: delete, set primary, and enforce 2-image limit', async ({ page }) => {
        // Step 1. Add Card with 2 images safely
        await page.locator('button:has-text("Add Card")').first().click();
        const dialog = page.locator('mat-dialog-container');
        
        await dialog.locator('input[formControlName="card_name"]').fill('Image Mgmt Card');
        await dialog.locator('mat-select[formControlName="condition"]').click();
        await page.getByRole('option', { name: 'Mint', exact: true }).click();

        // 2 slots should exist
        const frontInput = dialog.locator('app-image-upload-slot input[type="file"]').nth(0);
        await frontInput.setInputFiles(path.join(__dirname, 'fixtures', 'card-front.jpg'));
        const backInput = dialog.locator('app-image-upload-slot input[type="file"]').nth(1);
        await backInput.setInputFiles(path.join(__dirname, 'fixtures', 'card-back.jpg'));

        await expect(dialog.locator('img.preview-image')).toHaveCount(2);
        
        await dialog.locator('button[type="submit"]').click();
        await expect(dialog).toBeHidden();
        
        // Step 2. Navigate to Details
        const row = page.locator('tr.mat-mdc-row', { hasText: 'Image Mgmt Card' });
        await row.locator('td.mat-column-card_name').click();

        await expect(page.locator('.gallery-thumb')).toHaveCount(2);
        
        // "Add slot" container shouldn't exist because we have 2 images
        await expect(page.locator('app-image-upload-slot')).toBeHidden();

        // Step 3. Delete the SECOND image
        const secondCardItem = page.locator('.gallery-thumb').nth(1);
        
        // We simulate hover, Playwright needs explicit hover sometimes on cards for action buttons
        await secondCardItem.hover();
        
        // Setup dialog listener for the native window.confirm that delete image emits.
        page.on('dialog', dialog => dialog.accept());
        
        await secondCardItem.locator('button.delete-action').click();

        // One image should be left immediately
        await expect(page.locator('.gallery-thumb')).toHaveCount(1);
        
        // "Add slot" container should now be visible again!
        await expect(page.locator('app-image-upload-slot')).toBeVisible();

        // Step 4. Ensure remaining image has primary badge
        const firstCardItem = page.locator('.gallery-thumb').nth(0);
        await expect(firstCardItem.locator('.primary-badge')).toBeVisible();

        // Try setting to primary again? It should just remain primary. The button is naturally disabled if it exists
        // Wait, if it's already primary the button sets it to primary again and skips. Let's add a second image back,
        // make it primary, and check.
        await page.locator('app-image-upload-slot input[type="file"]').setInputFiles(path.join(__dirname, 'fixtures', 'card-back.jpg'));
        await expect(page.locator('.gallery-thumb')).toHaveCount(2);

        // Click set primary on the SECOND image
        const newSecondImage = page.locator('.gallery-thumb').nth(1);
        await newSecondImage.hover();
        // primary button uses icon star_border usually, but has matTooltip="Set as Primary"
        await newSecondImage.locator('button', { has: page.locator('mat-icon', { hasText: 'star_border' }) }).click();

        // verify success — after reload, primary image moves to position 0 (sorted is_primary DESC)
        await expect(page.locator('mat-snack-bar-container', { hasText: 'Primary image updated' })).toBeVisible();
        await expect(page.locator('.gallery-thumb .primary-badge')).toBeVisible();
    });
});
