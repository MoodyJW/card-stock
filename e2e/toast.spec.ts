import { test, expect } from '@playwright/test';

test.describe('Toast Notifications', () => {

  test.beforeEach(async ({ page }) => {
    // Log in before each test
    await page.goto('/auth/login');
    await page.locator('input[type="email"]').fill('test@test.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button[type="submit"]').click();
    // Wait for the shop list or empty state to render (hide spinner)
    await page.waitForSelector('mat-card.shop-card, mat-card.empty-state-card');

    // Create a shop if none exists to ensure we have a working environment
    const headings = await page.locator('h3, h2').allTextContents();
    if (headings.some(h => h.includes('No stores found'))) {
      await page.goto('/shop/create');
      await page.locator('input[formControlName="name"]').fill('Toast Test Shop');
      await page.locator('input[formControlName="slug"]').fill('toast-test-shop');
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(/\/shop\/toast-test-shop\/dashboard/);
      await page.goto('/shop/select');
    }
  });

  test('should show success toast when updating profile display name', async ({ page }) => {
    // Navigate to profile directly
    await page.goto('/account/profile');
    
    // Update display name
    const nameInput = page.locator('input[formControlName="display_name"]');
    const originalName = await nameInput.inputValue();
    await nameInput.fill(originalName + ' Updated');
    await page.locator('button[type="submit"]').filter({ hasText: 'Save Profile' }).click();

    // Verify any snackbar appears so we know whether it succeeded or failed
    const snackbar = page.locator('mat-snack-bar-container').first();
    await expect(snackbar).toHaveText(/success|updated/i);
    await expect(snackbar).toBeHidden({ timeout: 5000 });

    // Cleanup - revert name change
    await nameInput.fill(originalName);
    await page.locator('button[type="submit"]').first().click();
  });

  test('should show error toast when trying to create a shop with a duplicate slug', async ({ page }) => {
    // Navigate to create shop
    await page.goto('/shop/create');
    
    // Try to create a shop with the same slug 'toast-test-shop' assuming it already exists
    // (If it was created in beforeEach, it definitely exists)
    // We can also create a new one first and try duplicating it, to be perfectly safe.
    const uniqueSlug = `dup-target-${Date.now()}`;
    await page.locator('input[formControlName="name"]').fill('Duplicate Target');
    await page.locator('input[formControlName="slug"]').fill(uniqueSlug);
    await page.locator('button[type="submit"]').click();
    
    // Verify creation success
    await expect(page).toHaveURL(new RegExp(`/shop/${uniqueSlug}/dashboard`));
    
    // Now try creating again with the exact same slug
    await page.goto('/shop/create');
    await page.locator('input[formControlName="name"]').fill('Duplicate Attempt');
    await page.locator('input[formControlName="slug"]').fill(uniqueSlug);
    await page.locator('button[type="submit"]').click();

    // Verify error snackbar appears
    const errorSnackbar = page.locator('mat-snack-bar-container').first();
    await expect(errorSnackbar).toBeVisible();
    await expect(errorSnackbar).toHaveText(/duplicate|already exists|failed|different url/i);
  });

  test('should show info toast and auto-dismiss when signing out', async ({ page }) => {
    // Open user menu
    await page.locator('button.user-menu-button').click();
    
    // Click Sign Out
    const signOutBtn = page.locator('button[mat-menu-item]').filter({ hasText: 'Sign Out' });
    await expect(signOutBtn).toBeVisible();
    await signOutBtn.click();

    // Verify info toast appears
    const infoSnackbar = page.locator('mat-snack-bar-container').first();
    await expect(infoSnackbar).toHaveText(/signed out/i);

    // Wait and verify auto-dismiss (default duration is 3000ms for info)
    await expect(infoSnackbar).toBeHidden({ timeout: 5000 });
  });

});
