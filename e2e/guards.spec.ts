import { test, expect } from '@playwright/test';

test.describe('Route Protection and Guards', () => {

  test('unauthenticated users should be redirected to login from protected routes', async ({ page }) => {
    // Attempt to access a protected route without logging in
    await page.goto('/shop/select');
    
    // Should be redirected to login
    await expect(page).toHaveURL(/\/auth\/login/);
    
    // Attempt another protected route
    await page.goto('/account/profile');
    
    // Should be redirected to login
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('authenticated users without a shop trying to access nonexistent shop redirects to select', async ({ page }) => {
    // Log in
    await page.goto('/auth/login');
    await page.locator('input[type="email"]').fill('test@test.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/shop\/select/);

    // Attempt to access a nonexistent shop dashboard
    await page.goto('/shop/nonexistent/dashboard');

    // Should be redirected to shop selector because no valid shop is set in context
    await expect(page).toHaveURL(/\/shop\/select/);
  });

  test('authenticated users with valid shop navigate successfully', async ({ page }) => {
    // Log in
    await page.goto('/auth/login');
    await page.locator('input[type="email"]').fill('test@test.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/shop\/select/);

    // Wait for the shop list or empty state to render (hide spinner)
    await page.waitForSelector('mat-card.shop-card, mat-card.empty-state-card');

    // Create a shop if none exists to ensure we can navigate into a shop
    const headings = await page.locator('h3, h2').allTextContents();
    let shopSlug = 'guards-test-shop';
    if (headings.some(h => h.includes('No stores found'))) {
      await page.goto('/shop/create');
      await page.locator('input[formControlName="name"]').fill('Guards Test Shop');
      await page.locator('input[formControlName="slug"]').fill(shopSlug);
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(new RegExp(`/shop/${shopSlug}/dashboard`));
    } else {
      // Find an existing shop slug from the link
      const slugElement = page.locator('mat-card.shop-card .shop-slug').first();
      const slugText = await slugElement.textContent();
      if (slugText) {
        // cardstock.app/{slug}
        shopSlug = slugText.trim().split('/')[1];
      }
    }

    // Attempt to access the shop directly via URL
    await page.goto(`/shop/${shopSlug}/dashboard`);

    // Should successfully load the dashboard, guard allows it
    await expect(page).toHaveURL(new RegExp(`/shop/${shopSlug}/dashboard`));
    await expect(page.locator('mat-sidenav')).toBeVisible();
  });
});
