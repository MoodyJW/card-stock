# Phase 5: Main Layout, Navigation & Error Handling

> Broken into PR-sized work items. Each section is an independent, mergeable unit.
> Depends on: Phase 4 (Shop Creation & Membership) complete.

---

## Architecture Decisions (applies to all tickets)

- **Mobile-first**: Bottom tab bar on mobile (`< 768px`), sidebar on desktop
- **Toast notifications**: Replace all inline error/success messages with `MatSnackBar`
- **Shop guard**: New `shopGuard` on `:slug` routes ensures a valid shop is selected
- **Profile scope**: Display name, avatar, change password, change email, delete account
- **Breakpoints**: `< 768px` = mobile, `768–1199px` = tablet, `>= 1200px` = desktop

---

## Ticket 1: Toast Notification Service

**Branch:** `feat/phase-5.1-toast-service`

### Summary
Create a centralized notification service wrapping `MatSnackBar`. Then migrate all existing inline error/success patterns to use it.

### Tasks

1. **Create `NotificationService`** in `src/app/core/services/notification.service.ts`
   - Injectable, `providedIn: 'root'`
   - Wraps `MatSnackBar` with convenience methods:
     ```typescript
     success(message: string, duration?: number): void
     error(message: string, duration?: number): void
     info(message: string, duration?: number): void
     ```
   - Default durations: success = 3000ms, error = 5000ms, info = 3000ms
   - Uses `panelClass` for styling variants: `snackbar-success`, `snackbar-error`, `snackbar-info`
   - Action button: "Dismiss" on errors, none on success/info

2. **Add global snackbar styles** in `src/styles.scss`
   - `.snackbar-success` — primary color background
   - `.snackbar-error` — error color background
   - `.snackbar-info` — surface-container background
   - Ensure readability on dark gradient theme (white text)

3. **Create `GlobalErrorHandler`** in `src/app/core/services/global-error-handler.ts`
   - Implements Angular `ErrorHandler` interface
   - Catches unhandled errors and displays them via `NotificationService.error()`
   - Logs to `console.error` (Sentry placeholder for Phase 6+)
   - Register in `app.config.ts` via `{ provide: ErrorHandler, useClass: GlobalErrorHandler }`

4. **Migrate existing inline errors** — replace `error()` signal + `<mat-error>` pattern in:
   - `create-shop.component.ts/html` — form-level error banner → toast
   - `team.component.ts/html` — error/success signals → toast
   - `shop-settings.component.ts/html` — error banner → toast
   - `accept-invite.component.ts/html` — error state → toast
   - `login.component.ts/html` — auth error → toast
   - `register.component.ts/html` — auth error → toast
   - `forgot-password.component.ts/html` — if applicable
   - **Keep** `<mat-error>` inside `<mat-form-field>` for field-level validation (required, pattern, etc.) — those are not toasts

5. **Unit tests**
   - `notification.service.spec.ts` — verify each method calls `MatSnackBar.open()` with correct config
   - `global-error-handler.spec.ts` — verify it catches errors and calls notification service

### Acceptance Criteria
- All async/network errors surface as snackbar toasts
- All success messages (invite sent, shop created, etc.) surface as toasts
- Field-level `<mat-error>` validation inside form fields is preserved
- Inline error banners/signals removed from migrated components
- `GlobalErrorHandler` is registered and catches unhandled promise rejections

---

## Ticket 2: Shop Guard & Route Protection

**Branch:** `feat/phase-5.2-shop-guard`

### Summary
Add a `shopGuard` that ensures a shop is selected before rendering `:slug` child routes. Redirects to `/shop/select` if no valid shop is in context.

### Tasks

1. **Create `shopGuard`** in `src/app/core/guards/shop.guard.ts`
   - Functional guard (`CanActivateFn`)
   - Injects `ShopContextService`
   - Checks `shopContext.currentShop()` is not null
   - If shops haven't loaded yet (`shopContext.loading()` is true), wait for loading to complete (use `toObservable()` + `filter` + `first` pattern, same as `authGuard`)
   - After loading, if `currentShop()` is null, attempt `selectShopBySlug()` using the `:slug` route param
   - If still null (slug doesn't match any user shop), redirect to `/shop/select`
   - Return `true` if a shop is selected

2. **Apply guard** in `src/app/features/shop/shop.routes.ts`
   - Add `canActivate: [shopGuard]` to the `:slug` route (the parent of dashboard/team/settings children)

3. **Unit tests** — `shop.guard.spec.ts`
   - Test: redirects when no shop and slug doesn't match
   - Test: allows navigation when shop is already selected
   - Test: waits for loading, then resolves slug
   - Test: allows navigation when slug matches a loaded shop

### Acceptance Criteria
- Direct navigation to `/shop/nonexistent-slug/dashboard` redirects to `/shop/select`
- Direct navigation to `/shop/valid-slug/dashboard` works (guard resolves the slug)
- Guard waits for shops to load before making a decision
- No flash of empty content before redirect

---

## Ticket 3: Responsive Shop Layout — Desktop Sidebar + Mobile Bottom Nav

**Branch:** `feat/phase-5.3-responsive-layout`

### Summary
Refactor `ShopLayoutComponent` to be mobile-first: bottom tab bar on small screens, sidebar on desktop. The toolbar adapts to show different controls per breakpoint.

### Tasks

1. **Add `BreakpointObserver` to `ShopLayoutComponent`**
   - Inject `BreakpointObserver` from `@angular/cdk/layout`
   - Create a signal `isMobile` that tracks `(max-width: 767px)`
   - Conditionally render sidebar vs bottom nav based on this signal

2. **Desktop layout (>= 768px)** — keep existing behavior:
   - `mat-sidenav` in `mode="side"`, `opened`
   - Toolbar with shop name + user menu (Ticket 5 adds the user menu)
   - Sidebar nav items: Dashboard, Inventory (disabled), Team, Settings, Switch Store

3. **Mobile layout (< 768px)** — new:
   - Hide the `mat-sidenav` entirely
   - Show a `mat-toolbar` at the top (shop name, hamburger for overflow menu)
   - Show bottom tab bar with 4 primary tabs:
     - Dashboard (`dashboard` icon)
     - Inventory (`inventory_2` icon) — disabled placeholder
     - Team (`group` icon)
     - Settings (`settings` icon)
   - Bottom bar implemented as a `<nav>` with `mat-icon-button` items and `routerLink`
   - Use `routerLinkActive` for active tab highlighting
   - Apply `.safe-bottom` padding from existing `_utilities.scss` for notch devices

4. **Bottom nav component** — `src/app/features/shop/bottom-nav/bottom-nav.component.ts`
   - Standalone component: `selector: 'app-bottom-nav'`
   - Inputs: none (reads slug from `ShopContextService`)
   - Template: 4 icon buttons with labels, `routerLink` relative to current shop slug
   - SCSS: fixed bottom, glass background matching theme, safe-area padding
   - Active state: primary color icon + label, inactive = muted

5. **Update `shop-layout.component.html`**
   - Wrap sidenav in `@if (!isMobile())`
   - Add `<app-bottom-nav />` in `@if (isMobile())`
   - Add `.has-bottom-bar` class to content area on mobile for padding

6. **Update `shop-layout.component.scss`**
   - Mobile: remove sidenav width, full-width content
   - Desktop: keep current 250px sidebar
   - Content area bottom padding on mobile (clear the bottom nav)

7. **Unit tests**
   - `shop-layout.component.spec.ts` — mock `BreakpointObserver`, verify sidenav renders on desktop
   - `bottom-nav.component.spec.ts` — verify 4 nav items render, active state works

8. **E2E test** — `e2e/responsive-nav.spec.ts`
   - Test at desktop viewport: sidebar visible, bottom nav hidden
   - Test at mobile viewport (375px): sidebar hidden, bottom nav visible
   - Test navigation via bottom nav tabs

### Acceptance Criteria
- Desktop (>= 768px): sidebar visible, no bottom bar
- Mobile (< 768px): bottom tab bar visible, no sidebar
- Active route highlighted in both nav modes
- Bottom nav clears safe area on notch devices
- Smooth transition when resizing (no layout jank)
- Inventory tab is visually disabled in both modes

---

## Ticket 4: Profile & Account Settings Page

**Branch:** `feat/phase-5.4-profile-settings`

### Summary
Add a profile/account settings page where users can update their display name, avatar, password, email, and delete their account.

### Tasks

1. **Create route** — add to `shop.routes.ts` or as a top-level `/account` route
   - Recommendation: `/account/profile` as a sibling to `/shop` (not nested under a shop, since profile is user-global)
   - Add `canActivate: [authGuard]`
   - New route file: `src/app/features/account/account.routes.ts`

2. **Create `AccountLayoutComponent`** — `src/app/features/account/account-layout/`
   - Simple centered layout (similar to auth-layout but with a back button to `/shop/select`)
   - Material card container
   - Header: "Account Settings"

3. **Create `ProfileComponent`** — `src/app/features/account/profile/profile.component.ts`
   - Sections (each in its own `mat-card`):

   **a) Display Name & Avatar**
   - Form with `display_name` text input (current value pre-filled)
   - Avatar: URL input for now (image upload is Phase 8)
   - "Save" button → updates `profiles` table via `supabase.client.from('profiles').update()`
   - Success toast on save

   **b) Change Email**
   - Form with new email input
   - Calls `supabase.auth.updateUser({ email: newEmail })`
   - Shows info toast: "Check your new email for a confirmation link"
   - Supabase sends verification email automatically

   **c) Change Password**
   - Form: current password (not needed by Supabase, but good UX to confirm identity), new password, confirm password
   - Password match validation (reuse pattern from register component)
   - Calls existing `supabase.updatePassword(newPassword)`
   - Success toast on change

   **d) Danger Zone — Delete Account**
   - `mat-card` with error border (same pattern as shop-settings danger zone)
   - "Delete Account" button
   - Confirmation: `prompt('Type "DELETE" to confirm')`
   - Calls a new RPC `delete_account` (see below) or `supabase.auth.admin.deleteUser()` if service-role is available
   - On success: sign out, redirect to `/auth/login`

4. **Create `delete_account` RPC** (new migration)
   - `SECURITY DEFINER` function
   - Validates `auth.uid()` is the caller
   - Checks if user is sole owner of any org — if so, block deletion with clear error message
   - Deletes memberships, then profile, then calls `auth.users` delete (or marks for deletion)
   - Alternative: soft-delete the profile and let a background job clean up

5. **Add "Account" link to navigation**
   - Desktop sidebar: add account/profile link above "Switch Store" (with `mat-divider` separator)
   - Mobile bottom nav: add to overflow/hamburger menu (not a primary tab)
   - Toolbar: user avatar/icon button that links to `/account/profile`

6. **Update `app.routes.ts`**
   ```typescript
   {
     path: 'account',
     canActivate: [authGuard],
     loadChildren: () => import('./features/account/account.routes'),
   }
   ```

7. **Unit tests**
   - `profile.component.spec.ts` — form rendering, validation, mock service calls
   - Test display name save
   - Test password change validation (mismatch)

8. **E2E test** — `e2e/profile.spec.ts`
   - Navigate to profile page
   - Update display name, verify success toast
   - Verify password change form validation

### Files Created
```
src/app/features/account/
  account.routes.ts
  account-layout/
    account-layout.component.ts
    account-layout.component.html
    account-layout.component.scss
  profile/
    profile.component.ts
    profile.component.html
    profile.component.scss
    profile.component.spec.ts
supabase/migrations/YYYYMMDD_delete_account_rpc.sql
```

### Acceptance Criteria
- User can view and update display name
- User can update avatar URL
- User can change password (with confirmation)
- User can change email (triggers verification)
- User can delete account (with confirmation, blocks if sole owner)
- All actions show toast feedback
- Page accessible from both desktop sidebar and mobile menu

---

## Ticket 5: Logout & User Menu in Toolbar

**Branch:** `feat/phase-5.5-logout-user-menu`

### Summary
Add a user menu (avatar/icon button) to the toolbar with profile link and logout. Replace any remaining navigation to profile/logout scattered across components.

### Tasks

1. **Create `UserMenuComponent`** — `src/app/shared/components/user-menu/`
   - Standalone component
   - Displays user avatar (or default `account_circle` icon) as a `mat-icon-button`
   - On click: opens `mat-menu` with:
     - User display name + email (header, non-clickable)
     - "Account Settings" → `/account/profile`
     - `mat-divider`
     - "Sign Out" → calls `SupabaseService.signOut()`, navigates to `/auth/login`
   - Injects `SupabaseService` for user data and sign-out

2. **Add `UserMenuComponent` to `ShopLayoutComponent`**
   - Place in the toolbar, right-aligned (after spacer, before/after shop name)
   - Desktop: show in toolbar
   - Mobile: show in toolbar (same position)

3. **Add to `ShopSelectorComponent`** toolbar/header area
   - Users on the select page should also be able to log out

4. **Add to `CreateShopComponent`** — optional, but consistent
   - Or at minimum ensure there's a way to log out from any authenticated page

5. **Handle sign-out flow**
   - Clear `ShopContextService` state (already happens via the `effect()` that watches `user()`)
   - Clear `localStorage.removeItem('last_active_shop')`
   - Navigate to `/auth/login`
   - Show info toast: "You have been signed out"

6. **Unit tests** — `user-menu.component.spec.ts`
   - Verify menu items render
   - Verify sign-out calls `SupabaseService.signOut()`
   - Verify navigation to `/auth/login` after sign-out

7. **E2E test** — add to existing `e2e/auth.spec.ts` or new `e2e/logout.spec.ts`
   - Log in → verify user menu visible → click sign out → verify redirect to login
   - Verify user menu shows on shop selector page

### Files Created
```
src/app/shared/components/user-menu/
  user-menu.component.ts
  user-menu.component.html
  user-menu.component.scss
  user-menu.component.spec.ts
```

### Acceptance Criteria
- User avatar/icon visible in toolbar on all authenticated pages
- Menu shows display name, email, account link, sign-out
- Sign-out clears all state and redirects to login
- Toast confirms sign-out
- Works on both mobile and desktop

---

## Ticket 6: E2E Navigation & Responsive Tests

**Branch:** `feat/phase-5.6-navigation-e2e`

### Summary
Comprehensive E2E tests covering the full Phase 5 navigation experience: responsive breakpoints, route guards, toast notifications, and logout flow.

### Tasks

1. **`e2e/navigation.spec.ts`** — Core navigation flows
   - Authenticated user lands on `/shop/select`
   - Select a shop → lands on dashboard
   - Navigate via sidebar: Dashboard → Team → Settings → Switch Store
   - Verify active route highlighting
   - Navigate to account settings and back

2. **`e2e/responsive-nav.spec.ts`** — Breakpoint behavior
   - Desktop (1280px): sidebar visible, bottom nav hidden
   - Mobile (375px): sidebar hidden, bottom nav visible
   - Navigate via bottom tab bar on mobile
   - Verify hamburger overflow menu on mobile (if applicable)

3. **`e2e/guards.spec.ts`** — Route protection
   - Unauthenticated: `/shop/select` redirects to `/auth/login`
   - Authenticated, no shop: `/shop/nonexistent/dashboard` redirects to `/shop/select`
   - Authenticated, valid shop: `/shop/valid-slug/dashboard` renders dashboard

4. **`e2e/toast.spec.ts`** — Notification behavior
   - Trigger an error (e.g., create shop with duplicate slug) → verify snackbar appears
   - Trigger success (e.g., send invite) → verify snackbar appears
   - Verify snackbar auto-dismisses

### Acceptance Criteria
- All navigation paths covered
- Responsive behavior verified at multiple viewports
- Guard redirects verified
- Toast notifications verified visually

---

## Dependency Graph & Suggested Merge Order

```
Ticket 1: Toast Service          (no deps, foundational)
    ↓
Ticket 2: Shop Guard             (no deps, can parallel with 1)
    ↓
Ticket 3: Responsive Layout      (depends on nothing, but benefits from 1 for error toasts)
    ↓
Ticket 4: Profile & Account      (depends on 1 for toasts)
    ↓
Ticket 5: Logout & User Menu     (depends on 3 for layout slots, 4 for account link)
    ↓
Ticket 6: E2E Tests              (depends on all above)
```

**Recommended order:** 1 → 2 → 3 → 4 → 5 → 6

Tickets 1 and 2 can be worked in parallel since they don't touch the same files.

---

## Files Changed Across All Tickets (Summary)

### New Files
```
src/app/core/services/notification.service.ts         (Ticket 1)
src/app/core/services/notification.service.spec.ts    (Ticket 1)
src/app/core/services/global-error-handler.ts         (Ticket 1)
src/app/core/services/global-error-handler.spec.ts    (Ticket 1)
src/app/core/guards/shop.guard.ts                     (Ticket 2)
src/app/core/guards/shop.guard.spec.ts                (Ticket 2)
src/app/features/shop/bottom-nav/                     (Ticket 3)
src/app/features/account/                             (Ticket 4)
src/app/shared/components/user-menu/                  (Ticket 5)
supabase/migrations/YYYYMMDD_delete_account_rpc.sql   (Ticket 4)
e2e/navigation.spec.ts                                (Ticket 6)
e2e/responsive-nav.spec.ts                            (Ticket 6)
e2e/guards.spec.ts                                    (Ticket 6)
e2e/toast.spec.ts                                     (Ticket 6)
```

### Modified Files
```
src/styles.scss                                       (Ticket 1 — snackbar styles)
src/app/app.config.ts                                 (Ticket 1 — ErrorHandler provider)
src/app/app.routes.ts                                 (Ticket 4 — /account route)
src/app/features/shop/shop.routes.ts                  (Ticket 2 — shopGuard)
src/app/features/shop/shop-layout/                    (Tickets 3, 5 — responsive + user menu)
src/app/features/shop/create-shop/                    (Ticket 1 — migrate to toasts)
src/app/features/shop/team/                           (Ticket 1 — migrate to toasts)
src/app/features/shop/shop-settings/                  (Ticket 1 — migrate to toasts)
src/app/features/shop/accept-invite/                  (Ticket 1 — migrate to toasts)
src/app/features/shop/shop-selector/                  (Ticket 5 — user menu)
src/app/features/auth/login/                          (Ticket 1 — migrate to toasts)
src/app/features/auth/register/                       (Ticket 1 — migrate to toasts)
```
