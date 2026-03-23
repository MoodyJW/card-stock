import { test, expect } from '@playwright/test';

test.describe('Navigation Flow', () => {

  test.beforeEach(async ({ page }) => {
    // Log in before each test
    await page.goto('/auth/login');
    await page.locator('input[type="email"]').fill('test@test.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button[type="submit"]').click();
    // Wait for the shop list or empty state to render (hide spinner)
    await page.waitForSelector('mat-card.shop-card, mat-card.empty-state-card');

    // Create a shop if none exists to ensure we can navigate into a shop
    const headings = await page.locator('h3, h2').allTextContents();
    if (headings.some(h => h.includes('No stores found'))) {
      await page.goto('/shop/create');
      await page.locator('input[formControlName="name"]').fill('Navigation Test Shop');
      await page.locator('input[formControlName="slug"]').fill('nav-test-shop');
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(/\/shop\/nav-test-shop\/dashboard/);
      await page.goto('/shop/select');
    }
  });

  test('should navigate through main shop features via sidebar', async ({ page }) => {
    // 1. Authenticated user lands on /shop/select
    await expect(page).toHaveURL(/\/shop\/select/);

    // 2. Select a shop -> lands on dashboard
    const shopLink = page.locator('mat-card.shop-card').first();
    await shopLink.click();
    await expect(page).toHaveURL(/\/shop\/[a-zA-Z0-9-]+\/dashboard/);

    // 3. Navigate via sidebar (assuming viewport > 768px for sidebar navigation)
    // Wait for sidenav to render
    const sidenav = page.locator('mat-sidenav');
    await expect(sidenav).toBeVisible();

    // Verify Dashboard is active
    let activeLink = page.locator('mat-nav-list a.active');
    await expect(activeLink).toContainText('Dashboard');

    // Click Team Management
    await page.locator('mat-nav-list a').filter({ hasText: 'Team Management' }).click();
    await expect(page).toHaveURL(/\/shop\/[a-zA-Z0-9-]+\/team/);
    activeLink = page.locator('mat-nav-list a.active');
    await expect(activeLink).toContainText('Team Management');

    // Click Shop Settings
    await page.locator('mat-nav-list a').filter({ hasText: 'Shop Settings' }).click();
    await expect(page).toHaveURL(/\/shop\/[a-zA-Z0-9-]+\/settings/);
    activeLink = page.locator('mat-nav-list a.active');
    await expect(activeLink).toContainText('Shop Settings');

    // Click Switch Store
    await page.locator('mat-nav-list a').filter({ hasText: 'Switch Store' }).click();
    await expect(page).toHaveURL(/\/shop\/select/);
  });

  test('should navigate to account settings and back', async ({ page }) => {
    // Start on shop select
    await expect(page).toHaveURL(/\/shop\/select/);

    // Open user menu from toolbar
    await page.locator('button.user-menu-button').click();
    
    // Check menu renders and click Account Settings
    const accountBtn = page.locator('button[mat-menu-item]').filter({ hasText: 'Account Settings' });
    await expect(accountBtn).toBeVisible();
    await accountBtn.click();

    // Verify navigation to profile
    await expect(page).toHaveURL(/\/account\/profile/);
    await expect(page.locator('h1, h2, mat-card-title').filter({ hasText: 'Account Settings' })).toBeVisible();

    // Navigate back to shop select via header or browser back, we can just use the back button defined in layout
    await page.locator('header.account-header a[mat-icon-button]').click();
    
    // Verify back to shop select
    await expect(page).toHaveURL(/\/shop\/select/);
  });
});
