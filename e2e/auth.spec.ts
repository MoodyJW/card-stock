import { test, expect } from '@playwright/test';

test.describe('Auth Flow', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test.beforeEach(async ({ page }) => {
        // Ensure clean state for every test
        await page.goto('/auth/login');
        await page.evaluate(() => localStorage.clear());
    });

    test('should redirect to login when visiting home unauthenticated', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveURL(/\/auth\/login/);
        await expect(page.locator('h2')).toContainText('Welcome back');
    });

    test('should show validation error on invalid login', async ({ page }) => {
        await page.goto('/auth/login');

        await page.locator('input[type="email"]').fill('invalid-email');
        await page.locator('input[type="password"]').fill('short');
        await page.locator('input[type="email"]').blur();

        const emailError = page.locator('mat-form-field', { has: page.locator('input[type="email"]') }).locator('mat-error');
        await expect(emailError).toContainText('Enter a valid email');
    });

    test('should navigate to register page', async ({ page }) => {
        await page.goto('/auth/login');
        await page.locator('a[href="/auth/register"]').click();
        await expect(page).toHaveURL(/\/auth\/register/);
        await expect(page.locator('h2')).toContainText('Create your account');
    });

    test('should show error message for non-existent user', async ({ page }) => {
        await page.goto('/auth/login');
        await page.locator('input[type="email"]').fill('nobody@nowhere.com');
        await page.locator('input[type="password"]').fill('password123');
        await page.locator('button[type="submit"]').click();

        const snackbar = page.locator('mat-snack-bar-container');
        await expect(snackbar).toBeVisible();
        await expect(snackbar).toContainText('Invalid login credentials');
    });

    test('should show register form with all fields', async ({ page }) => {
        await page.goto('/auth/register');
        await expect(page.locator('h2')).toContainText('Create your account');
        await expect(page.locator('input[formControlName="email"]')).toBeVisible();
        await expect(page.locator('input[formControlName="password"]')).toBeVisible();
        await expect(page.locator('input[formControlName="confirmPassword"]')).toBeVisible();
    });

    test('should show validation errors on invalid registration', async ({ page }) => {
        await page.goto('/auth/register');

        await page.locator('button[type="submit"]').click();

        const emailError = page.locator('mat-form-field', { has: page.locator('input[formControlName="email"]') }).locator('mat-error');
        await expect(emailError).toContainText('Email is required');

        const passwordError = page.locator('mat-form-field', { has: page.locator('input[formControlName="password"]') }).locator('mat-error');
        await expect(passwordError).toContainText('Password is required');
    });

    test('should show password mismatch error', async ({ page }) => {
        await page.goto('/auth/register');

        await page.locator('input[formControlName="email"]').fill('valid@email.com');
        await page.locator('input[formControlName="password"]').fill('password123');
        await page.locator('input[formControlName="confirmPassword"]').fill('different123');

        await page.locator('input[formControlName="confirmPassword"]').blur();
        await page.locator('button[type="submit"]').click();

        const confirmError = page.locator('mat-form-field', { has: page.locator('input[formControlName="confirmPassword"]') }).locator('mat-error');
        await expect(confirmError).toContainText('Passwords do not match');
    });

    test('should show check email screen after successful registration', async ({ page }) => {
        await page.goto('/auth/register');
        const email = `test-${Date.now()}@example.com`;
        await page.locator('input[formControlName="email"]').fill(email);
        await page.locator('input[formControlName="password"]').fill('testpassword123');
        await page.locator('input[formControlName="confirmPassword"]').fill('testpassword123');
        await page.locator('button[type="submit"]').click();

        // signUp calls Supabase which sends a confirmation email — allow extra time
        // Increased timeout to 30s to account for potential Supabase delays
        // Race condition check: either success or error
        const success = page.locator('.confirmation h2');
        const snackbar = page.locator('mat-snack-bar-container');

        await Promise.race([
            success.waitFor({ state: 'visible', timeout: 30000 }),
            snackbar.waitFor({ state: 'visible', timeout: 30000 })
        ]);

        if (await snackbar.isVisible()) {
            const errorText = await snackbar.textContent();
            throw new Error(`Registration failed with error: ${errorText}`);
        }

        await expect(success).toContainText('Check your email');
        await expect(page.locator('.confirmation-icon')).toBeVisible();
        await expect(page.locator('.confirmation')).toContainText(email);
    });

    test('should navigate from register to login', async ({ page }) => {
        await page.goto('/auth/register');
        await page.locator('a[href="/auth/login"]').click();
        await expect(page).toHaveURL(/\/auth\/login/);
    });

    test('should sign out via user menu', async ({ page }) => {
        await page.goto('/auth/login');
        await page.locator('input[type="email"]').fill('test@test.com');
        await page.locator('input[type="password"]').fill('password123');
        await page.locator('button[type="submit"]').click();
        
        // Wait for redirect to select store
        await expect(page).toHaveURL(/\/shop\/select/);
        
        // Click User Menu avatar
        const userMenuButton = page.locator('app-user-menu button').first();
        await expect(userMenuButton).toBeVisible();
        await userMenuButton.click();
        
        // Click Sign Out
        const signOutItem = page.locator('button[mat-menu-item]', { hasText: 'Sign Out' });
        await expect(signOutItem).toBeVisible();
        await signOutItem.click();
        
        // Verify sign out success redirect and toast
        await expect(page).toHaveURL(/\/auth\/login/);
        const snackbar = page.locator('mat-snack-bar-container');
        await expect(snackbar).toContainText('You have been signed out');
    });
});
