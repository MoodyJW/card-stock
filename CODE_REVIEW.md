# Phase 6, Ticket 1 Code Review — Inventory Models & Service

**Reviewing:** New files on `feat/phase-6.1-inventory-service` implementing Phase 6 Ticket 1 (Inventory Models & Service).

---

## Medium

### 1. `addCard` and `updateCard` don't refresh `getDistinctSetNames()` after success

**Files:** `src/app/core/services/inventory.service.ts:93-148` (addCard), `150-179` (updateCard)

The plan states: "`_distinctSetNames` — populated by `getDistinctSetNames()`, called on shop change **and after add/edit operations**." Currently it's only called in the constructor effect (line 49). If a user adds a card with a new `set_name`, the filter dropdown won't include that set name until they switch shops.

**Fix:** Call `getDistinctSetNames()` after successful add/edit:

```typescript
// In addCard, after replacing the optimistic item (line 145):
this.getDistinctSetNames();
return { data: data as InventoryItem, error: null };

// In updateCard, after replacing with server response (line 177):
if (updates.set_name !== undefined) {
  this.getDistinctSetNames();
}
return { data: data as InventoryItem, error: null };
```

### 2. Missing unit test: "effect clears items when shop changes"

**File:** `src/app/core/services/inventory.service.spec.ts`

The plan explicitly lists this test: "Test: effect clears items when shop changes." The spec doesn't verify that changing the `currentShopId` signal triggers the effect to clear `_items`, reset `_page`/`_filters`, and reload.

**Fix:** Add a test:
```typescript
describe('shop context effect', () => {
  it('should clear items and reload when shop changes', async () => {
    // Load initial data
    const mockData = [{ id: '1', card_name: 'Charizard' }];
    createQueryChain({ data: mockData, count: 1 });
    (supabaseMock['client'] as Record<string, unknown>)['from'] = vi.fn().mockReturnValue(queryChain);
    await service.loadInventory();
    expect(service.items().length).toBe(1);

    // Change shop — need to use a writable signal in the mock
    // The effect should clear items and trigger a reload
    // (Implementation depends on how the mock signal is set up)
  });
});
```

Note: This test is harder to write with the current mock setup since `shopContextMock.currentShopId` is a readonly signal. The mock would need to use a `WritableSignal` to trigger the effect. Consider using `const shopId = signal('org-1')` and setting `shopContextMock.currentShopId = shopId` so the test can call `shopId.set('org-2')` and then `TestBed.flushEffects()`.

---

## Low

### 3. Search filter doesn't escape LIKE wildcard characters

**File:** `src/app/core/services/inventory.service.ts:76`

```typescript
if (filters.search) query = query.ilike('card_name', `%${filters.search}%`);
```

The characters `%` and `_` are LIKE wildcards. If a user searches for a literal `_` or `%` in a card name, they'll get unexpected matches. This is very unlikely to be a real-world problem for Pokemon card names, but worth noting.

---

## Acceptance Criteria

| Criteria | Status |
|----------|--------|
| Service reacts to shop context changes (clears + reloads) | PASS — effect implemented |
| All CRUD operations work with optimistic updates | PASS — addCard, updateCard, softDeleteCard |
| Pagination via `.range()` with total count | PASS — uses `{ count: 'exact' }` and `.range()` |
| Filters applied to Supabase query correctly | PASS — status, condition, set_name, search |
| Service methods return `{ data, error }` — components handle toasts | PASS — no toast calls in service |

## Summary

| # | Severity | Issue |
|---|----------|-------|
| 1 | Medium | `addCard`/`updateCard` don't call `getDistinctSetNames()` — plan requires it |
| 2 | Medium | Missing "effect clears items when shop changes" test — plan requires it |
| 3 | Low | Search filter doesn't escape LIKE wildcards (`%`, `_`) |

Models match the plan exactly. Service architecture, signals, methods, and query building all match. No regressions (all new files).
