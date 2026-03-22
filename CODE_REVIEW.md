# Phase 6 Plan Audit

**Reviewing:** `PHASE_6_PLAN.md` against `IMPLEMENTATION_PLAN.md`, existing schema, and current codebase state (post Phase 5.4).

---

## Critical: Stale File References

The plan references files that no longer exist after the Phase 5.4 `AppLayoutComponent` refactor. An agent following these instructions will fail.

### 1. Ticket 2, Task 2 — Wrong file for enabling inventory nav link

**Plan says:** "Enable the inventory nav link in `shop-layout.component.html`"

`shop-layout.component.html` was deleted in Phase 5.4. The nav now lives in two places:
- **Desktop sidebar:** `src/app/layouts/app-layout/app-layout.component.html` (lines 67-70, currently `class="disabled"`)
- **Mobile bottom nav:** `src/app/features/shop/bottom-nav/bottom-nav.component.ts` (lines 17-21, currently disabled placeholder)

**Fix:** Replace Task 2 with:
> Enable the inventory nav link in **both** navigation components:
> - `src/app/layouts/app-layout/app-layout.component.html` — Remove `class="disabled"` from the Inventory `<a>` tag and add `[routerLink]="basePath + '/inventory'"` and `routerLinkActive="active"`
> - `src/app/features/shop/bottom-nav/bottom-nav.component.ts` — Change the disabled Inventory `<a>` to an active link with `[routerLink]="basePath() + '/inventory'"` and `routerLinkActive="active"`, remove `class="disabled"`

### 2. "Modified Files" summary section — Wrong file listed

**Plan says:** `src/app/features/shop/shop-layout/shop-layout.component.html (Ticket 2 — enable inventory link)`

**Fix:** Replace with:
```
src/app/layouts/app-layout/app-layout.component.html          (Ticket 2 — enable inventory link)
src/app/features/shop/bottom-nav/bottom-nav.component.ts       (Ticket 2 — enable inventory link)
```

### 3. Mobile overflow menu also needs inventory link

The mobile overflow menu in `app-layout.component.html` (lines 11-25) has Dashboard, Team, and Shop Settings links — but no Inventory link. When enabling inventory, it should also be added to this menu.

**Fix:** Add to Ticket 2 tasks:
> Add an Inventory `<button mat-menu-item>` to the mobile overflow menu in `app-layout.component.html`, between Dashboard and Team, with icon `inventory_2`.

---

## High: Security Gap — Soft Delete Permissions

### 4. Members can soft-delete cards, contradicting the permission matrix

The `IMPLEMENTATION_PLAN.md` permission matrix states: **"Delete cards: Owner YES, Admin YES, Member NO"**. The RLS policy enforcing this is `"Admins delete" ON inventory FOR DELETE USING (is_org_admin_or_owner(organization_id))`.

However, Ticket 7's soft delete uses an UPDATE (`deleted_at = now()`), not a DELETE. The RLS policy `"Members update" ON inventory FOR UPDATE` allows **all members** to update rows, including setting `deleted_at`. This means any member can soft-delete cards — violating the permission matrix.

**Fix options (pick one):**
- **Option A (Recommended):** Create a `soft_delete_card` SECURITY DEFINER RPC that checks `is_org_admin_or_owner()` before setting `deleted_at`. Call this from the service instead of a direct UPDATE. This matches the project's pattern of RPCs for sensitive operations.
- **Option B:** Add a column-level constraint or trigger that prevents `deleted_at` from being set unless the user is admin/owner. More complex.

The plan should add a new migration to Ticket 7 for whichever approach is chosen, and update the "No New Migrations Needed" claim at the bottom.

---

## Medium: Missing Model Definitions

### 5. `Transaction` model not defined

Ticket 6 (Mark as Sold) says the dialog "Returns: the created `Transaction` or `undefined`" and the `mark_card_sold` RPC returns a `transactions` row. But Ticket 1's model file only defines `InventoryItem`, `CreateInventoryItem`, `InventoryFilters`, and `MarkSoldParams` — no `Transaction` interface.

**Fix:** Add to Ticket 1, Task 1 (inventory.model.ts):
```typescript
export interface Transaction {
  id: string;
  organization_id: string;
  inventory_id: string;
  sold_price: number;
  sold_at: string;
  sold_by?: string;
  buyer_email?: string;
  buyer_notes?: string;
  created_at: string;
}
```

### 6. `MarkSoldParams` field names don't match RPC parameter names

The `MarkSoldParams` interface uses `inventory_id`, `sold_price`, `buyer_email`, `buyer_notes`. The RPC expects `p_inventory_id`, `p_sold_price`, `p_buyer_email`, `p_buyer_notes`. The service method needs to map between these.

**Fix:** Add a note to Ticket 1's `markAsSold` method description:
```typescript
async markAsSold(params: MarkSoldParams) {
  const { data, error } = await this.supabase.rpc('mark_card_sold', {
    p_inventory_id: params.inventory_id,
    p_sold_price: params.sold_price,
    p_buyer_email: params.buyer_email ?? null,
    p_buyer_notes: params.buyer_notes ?? null,
  });
  // ...
}
```

---

## Medium: Ambiguities That Will Trip Up Agents

### 7. `getDistinctSetNames()` vs computed — conflicting approaches for filter dropdown

Ticket 1 defines both:
- A computed `_setNames` derived from `items()` (line 122) — only has set names from the current page
- A method `getDistinctSetNames()` (line 147) — fetches all set names for the org

The computed is wrong for a filter dropdown — it only reflects the current page. An agent implementing this will be confused about which to use.

**Fix:** Remove the `_setNames` computed from the plan. Replace with a signal `_distinctSetNames = signal<string[]>([])` populated by `getDistinctSetNames()`, called on shop change and after add/edit operations. The `getDistinctSetNames` query should be:
```typescript
const { data } = await this.supabase.client
  .from('inventory')
  .select('set_name')
  .eq('organization_id', orgId)
  .is('deleted_at', null)
  .not('set_name', 'is', null)
  .order('set_name');
// Deduplicate client-side, or use a Supabase distinct RPC
```

### 8. Server-side vs client-side sorting — unclear

Ticket 2 says "Use `mat-sort` for client-side column sorting (data already loaded for the page)." This means sorting only reorders the current page (e.g., 25 items), not the full dataset. If a user sorts by price ascending, they won't see the cheapest cards across ALL pages — just the cheapest on the current page.

**Fix:** Clarify in Ticket 2 that column sorting should be **server-side** — `mat-sort` emits sort changes, the component passes the active sort column + direction to `InventoryService`, and the service rebuilds the Supabase query with the appropriate `.order()`. Add to the service:
```typescript
_sortColumn = signal<string>('created_at');
_sortDirection = signal<'asc' | 'desc'>('desc');

setSort(column: string, direction: 'asc' | 'desc') {
  this._sortColumn.set(column);
  this._sortDirection.set(direction);
  this.loadInventory();
}
```
And update the query builder to use these signals.

### 9. Where do add/edit operations live — service or component?

Ticket 1 acceptance criteria says "All methods return errors via NotificationService (toast)." But `NotificationService` is not listed in the service's injections, and the existing codebase pattern (e.g., `ProfileComponent`) has components calling the service and handling errors/toasts themselves.

**Fix:** Pick one pattern and state it explicitly. Recommendation: **components handle toasts** (consistent with existing code). The service methods should return `{ data, error }` or throw, and the dialog components call `notification.success/error()`. Remove "All methods return errors via NotificationService" from Ticket 1's acceptance criteria and add it to Tickets 4/6/7 instead.

### 10. Empty strings vs null for optional fields in card form

Ticket 4 uses `FormBuilder.nonNullable.group()`. Non-nullable form builder means empty text inputs return `''` (empty string), not `null`. But the DB columns are nullable and expect `null` for absent values, not empty strings.

**Fix:** Add a note to Ticket 4's submit handling:
> Before sending to the service, strip empty strings to `null` for optional fields:
> ```typescript
> const formValue = this.form.getRawValue();
> const cleaned = Object.fromEntries(
>   Object.entries(formValue).map(([k, v]) => [k, v === '' ? null : v])
> );
> ```

---

## Low: Minor Gaps and Improvements

### 11. Dialog responsiveness not wired up

Ticket 4 acceptance criteria says dialogs should use `maxWidth: '100vw'`, `width: '100%'` on mobile. But the dialog opening code uses a fixed `width: '600px'`. The plan doesn't explain how to make this responsive.

**Fix:** Add a note that the component opening the dialog should check `isMobile` (from `BreakpointObserver` or injected from AppLayoutComponent) and pass different dialog config:
```typescript
const config = this.isMobile
  ? { maxWidth: '100vw', width: '100%', height: '100%' }
  : { width: '600px', maxHeight: '90vh' };
```
Or rely on the existing global CSS override in `_utilities.scss` for mobile dialogs (lines 136-141).

### 12. Ticket 7 undo — vague sort restoration

The undo code says `[...items, item].sort(/* original order */)`. This is vague — "original order" depends on the current sort state.

**Fix:** Simplify to just re-calling `loadInventory()` after undo instead of trying to re-insert at the right position:
```typescript
if (undone) {
  this.loadInventory(); // Re-fetch to restore correct order
  this.notification.info('Card restored');
}
```

### 13. Ticket 7 — undo window doesn't commit on navigate-away

If the user deletes a card and navigates away within 5 seconds, the soft delete is never committed to the DB. The card reappears on reload.

**Fix:** Add a note to Ticket 7 that the `softDeleteCard` method should use a deferred commit pattern — start a timeout that commits after 5 seconds regardless of toast interaction, and cancel only if undo is clicked. This way navigation away doesn't prevent the commit.

### 14. Ticket 2 — bottom-nav spec will break when enabling inventory link

`bottom-nav.component.spec.ts:30-34` has a test asserting the Inventory item is disabled. When Ticket 2 enables it, this test needs to be updated to check for an active link instead.

**Fix:** Add to Ticket 2 tasks:
> Update `bottom-nav.component.spec.ts` — change the "should have Inventory item disabled" test to verify Inventory is now an active nav link with `routerLink`.

### 15. Dependency graph — Tickets 3/4/5 parallelization note is slightly misleading

The plan says Tickets 3, 4, 5 can be worked in parallel after Ticket 2. However, Ticket 4 (dialog) is opened FROM the list (Ticket 2), so the wiring code in the list component will have merge conflicts if Tickets 3, 4, and 5 all modify `InventoryListComponent` simultaneously. An agent working on Ticket 4 will also need to modify the list template.

**Fix:** Add a note that while the component files are independent, the wiring into `InventoryListComponent` should be done sequentially or carefully coordinated. Consider having Ticket 2 include placeholder methods like `openAddDialog()` and `openEditDialog()` that are no-ops until Ticket 4 fills them in.

---

## Summary Table

| # | Severity | Location | Issue |
|---|----------|----------|-------|
| 1 | Critical | Ticket 2, Task 2 | References deleted `shop-layout.component.html` — should be `app-layout.component.html` + `bottom-nav.component.ts` |
| 2 | Critical | Modified Files summary | Same stale file reference |
| 3 | Critical | Ticket 2 | Mobile overflow menu also needs inventory link added |
| 4 | High | Ticket 7 | Members can soft-delete via UPDATE, bypassing admin-only DELETE RLS — needs RPC or constraint |
| 5 | Medium | Ticket 1 models | `Transaction` interface missing |
| 6 | Medium | Ticket 1 | `MarkSoldParams` field names don't match RPC `p_` prefixed params |
| 7 | Medium | Ticket 1 | Conflicting approaches for set names (computed vs `getDistinctSetNames`) |
| 8 | Medium | Ticket 2 | Client-side sort only reorders current page — should be server-side |
| 9 | Medium | Ticket 1 | Unclear whether service or components handle error toasts |
| 10 | Medium | Ticket 4 | Empty strings vs null for optional form fields |
| 11 | Low | Ticket 4 | Dialog responsiveness not wired up in code example |
| 12 | Low | Ticket 7 | Vague sort restoration on undo — should just re-fetch |
| 13 | Low | Ticket 7 | Undo window doesn't commit on navigate-away |
| 14 | Low | Ticket 2 | bottom-nav spec test needs updating when inventory enabled |
| 15 | Low | Dependency graph | Parallel ticket caveat — all modify InventoryListComponent |

---

## What's Good

- Inventory table fields accurately match the DB schema
- `mark_card_sold` RPC usage matches the actual migration
- Optimistic update pattern matches `IMPLEMENTATION_PLAN.md`
- Reactive `effect()` pattern for shop context is consistent with `ShopContextService`
- Pagination via `.range()` is the correct Supabase approach
- "No New Migrations Needed" claim is correct (except for the soft-delete permission fix)
- Filter architecture (server-side via Supabase query building) is solid
- E2E test plan is comprehensive and well-structured
- Ticket decomposition into PR-sized units is clean
