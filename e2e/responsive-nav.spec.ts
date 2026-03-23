import { test, expect } from '@playwright/test';

test.describe('Responsive Navigation Flow', () => {

  test.beforeEach(async ({ page }) => {
    // Log in before each test
    await page.goto('/auth/login');
    await page.locator('input[type="email"]').fill('test@test.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button[type="submit"]').click();
    // Wait for the shop list or empty state to render (hide spinner)
    await page.waitForSelector('mat-card.shop-card, mat-card.empty-state-card');

    // Create a shop if none exists to ensure we can navigate into a shop for testing nav
    const headings = await page.locator('h3, h2').allTextContents();
    if (headings.some(h => h.includes('No stores found'))) {
      await page.goto('/shop/create');
      await page.locator('input[formControlName="name"]').fill('Responsive Test Shop');
      await page.locator('input[formControlName="slug"]').fill('resp-test-shop');
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(/\/shop\/resp-test-shop\/dashboard/);
      await page.goto('/shop/select');
    }
  });

  test('should display sidebar and hide bottom nav on desktop (1280x720)', async ({ page }) => {
    // Set viewport to desktop size
    await page.setViewportSize({ width: 1280, height: 720 });

    // Navigate to a shop dashbaord
    const shopLink = page.locator('mat-card.shop-card').first();
    await shopLink.click();
    await expect(page).toHaveURL(/\/shop\/[a-zA-Z0-9-]+\/dashboard/);

    // Sidebar should be visible
    const sidenav = page.locator('mat-sidenav');
    await expect(sidenav).toBeVisible();

    // Bottom nav should be hidden
    const bottomNav = page.locator('app-bottom-nav nav');
    await expect(bottomNav).toBeHidden();
  });

  test('should hide sidebar and display bottom nav on mobile (375x667)', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });

    // Navigate to a shop dashbaord
    const shopLink = page.locator('mat-card.shop-card').first();
    await shopLink.click();
    await expect(page).toHaveURL(/\/shop\/[a-zA-Z0-9-]+\/dashboard/);

    // Sidebar should be hidden
    const sidenav = page.locator('mat-sidenav');
    await expect(sidenav).toBeHidden();

    // Bottom nav should be visible
    const bottomNav = page.locator('app-bottom-nav nav');
    await expect(bottomNav).toBeVisible();

    // Bottom nav items should allow navigation
    const teamTab = bottomNav.locator('a, button').filter({ hasText: 'Team' });
    await teamTab.click();
    await expect(page).toHaveURL(/\/shop\/[a-zA-Z0-9-]+\/team/);
    await expect(teamTab).toHaveClass(/active/);

    const settingsTab = bottomNav.locator('a, button').filter({ hasText: 'Settings' });
    await settingsTab.click();
    await expect(page).toHaveURL(/\/shop\/[a-zA-Z0-9-]+\/settings/);
    await expect(settingsTab).toHaveClass(/active/);
    
    const dashboardTab = bottomNav.locator('a, button').filter({ hasText: 'Dashboard' });
    await dashboardTab.click();
    await expect(page).toHaveURL(/\/shop\/[a-zA-Z0-9-]+\/dashboard/);
    await expect(dashboardTab).toHaveClass(/active/);

    // Mobile toolbar has a hamburger menu instead of full links
    const menuBtn = page.locator('mat-toolbar button[mat-icon-button]').last(); 
    await menuBtn.click();
    
    // The menu should render a panel
    const menuPanel = page.locator('.mat-mdc-menu-panel');
    await expect(menuPanel).toBeVisible();
  });
});
