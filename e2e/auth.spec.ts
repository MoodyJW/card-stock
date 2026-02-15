import { test, expect } from '@playwright/test';

test.describe('Auth Flow', () => {
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

        await expect(page.locator('.auth-error')).toBeVisible();
        await expect(page.locator('.auth-error')).toContainText('Invalid login credentials');
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

        await expect(page.locator('.confirmation h2')).toContainText('Check your email');
        await expect(page.locator('.confirmation-icon')).toBeVisible();
        await expect(page.locator('.confirmation')).toContainText(email);
    });

    test('should navigate from register to login', async ({ page }) => {
        await page.goto('/auth/register');
        await page.locator('a[href="/auth/login"]').click();
        await expect(page).toHaveURL(/\/auth\/login/);
    });
});

test.describe('Forgot Password Flow', () => {
    test('should navigate to forgot password from login', async ({ page }) => {
        await page.goto('/auth/login');
        await page.locator('a[href="/auth/forgot-password"]').click();
        await expect(page).toHaveURL(/\/auth\/forgot-password/);
        await expect(page.locator('h2')).toContainText('Reset your password');
    });

    test('should show validation error for empty email', async ({ page }) => {
        await page.goto('/auth/forgot-password');
        await page.locator('button[type="submit"]').click();

        const emailError = page.locator('mat-form-field', { has: page.locator('input[type="email"]') }).locator('mat-error');
        await expect(emailError).toContainText('Email is required');
    });

    test('should show validation error for invalid email', async ({ page }) => {
        await page.goto('/auth/forgot-password');
        await page.locator('input[type="email"]').fill('not-an-email');
        await page.locator('input[type="email"]').blur();

        const emailError = page.locator('mat-form-field', { has: page.locator('input[type="email"]') }).locator('mat-error');
        await expect(emailError).toContainText('Enter a valid email');
    });

    test('should show check email screen after submitting', async ({ page }) => {
        await page.goto('/auth/forgot-password');
        await page.locator('input[type="email"]').fill('test@example.com');
        await page.locator('button[type="submit"]').click();

        await expect(page.locator('.confirmation h2')).toContainText('Check your email');
        await expect(page.locator('.confirmation-icon')).toBeVisible();
        await expect(page.locator('.confirmation')).toContainText('test@example.com');
    });

    test('should navigate back to login from forgot password', async ({ page }) => {
        await page.goto('/auth/forgot-password');
        await page.locator('a[href="/auth/login"]').click();
        await expect(page).toHaveURL(/\/auth\/login/);
    });
});
