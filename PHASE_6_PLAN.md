# Phase 6: Inventory CRUD

> Broken into PR-sized work items. Each section is an independent, mergeable unit.
> Depends on: Phase 5 complete (toast service, responsive layout, shop guard).

---

## Architecture Decisions (applies to all tickets)

- **One row per physical card** — no quantity field; duplicates are separate rows
- **Soft delete** — inventory uses `deleted_at`, never hard-deleted by the app
- **Optimistic updates** — add/edit show instantly, roll back on error (per IMPLEMENTATION_PLAN.md pattern)
- **Reactive to shop context** — `InventoryService` reacts to `ShopContextService` via `effect()`
- **Display modes** — data table (default) + card grid with toggle
- **Add/Edit** — `MatDialog` overlay, not a separate route
- **Mark as Sold** — calls `mark_card_sold` RPC, dialog captures price + optional buyer info
- **Filters** — status, condition, set name dropdowns + card name text search
- **Pagination** — server-side via Supabase `.range()`, default 25 per page

### Inventory Table Fields (from schema)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `card_name` | text | Yes | Primary identifier |
| `set_name` | text | No | e.g. "Scarlet & Violet" |
| `set_code` | text | No | e.g. "SV1" |
| `card_number` | text | No | e.g. "025/198" |
| `rarity` | text | No | e.g. "Ultra Rare" |
| `language` | text | No | Default: "English" |
| `is_foil` | boolean | No | Default: false |
| `condition` | condition_enum | Yes | Default: "near_mint" |
| `grading_company` | grading_company_enum | No | PSA, CGC, BGS, SGC, ACE |
| `grade` | decimal(3,1) | No | e.g. 9.5 (only if grading_company set) |
| `purchase_price` | decimal(10,2) | No | What the shop paid |
| `selling_price` | decimal(10,2) | No | Listed price |
| `status` | inventory_status_enum | Yes | available / reserved / sold |
| `notes` | text | No | Free-form notes |

---

## Ticket 1: Inventory Models & Service

**Branch:** `feat/phase-6.1-inventory-service`

### Summary
Create the TypeScript models and the reactive `InventoryService` that manages inventory state, talks to Supabase, and reacts to shop context changes.

### Tasks

1. **Create inventory models** in `src/app/core/models/inventory.model.ts`
   ```typescript
   export type Condition = 'mint' | 'near_mint' | 'lightly_played' |
     'moderately_played' | 'heavily_played' | 'damaged';
   export type GradingCompany = 'psa' | 'cgc' | 'bgs' | 'sgc' | 'ace';
   export type InventoryStatus = 'available' | 'reserved' | 'sold';

   export interface InventoryItem {
     id: string;
     organization_id: string;
     card_name: string;
     set_name?: string;
     set_code?: string;
     card_number?: string;
     rarity?: string;
     language: string;
     is_foil: boolean;
     condition: Condition;
     grading_company?: GradingCompany;
     grade?: number;
     purchase_price?: number;
     selling_price?: number;
     status: InventoryStatus;
     notes?: string;
     created_at: string;
     created_by?: string;
     updated_at: string;
     updated_by?: string;
     deleted_at?: string;
   }

   export interface CreateInventoryItem {
     card_name: string;
     set_name?: string;
     set_code?: string;
     card_number?: string;
     rarity?: string;
     language?: string;
     is_foil?: boolean;
     condition?: Condition;
     grading_company?: GradingCompany;
     grade?: number;
     purchase_price?: number;
     selling_price?: number;
     notes?: string;
   }

   export interface InventoryFilters {
     search?: string;
     status?: InventoryStatus | null;
     condition?: Condition | null;
     set_name?: string | null;
   }

   export interface MarkSoldParams {
     inventory_id: string;
     sold_price: number;
     buyer_email?: string;
     buyer_notes?: string;
   }
   ```

2. **Create `InventoryService`** in `src/app/core/services/inventory.service.ts`
   - Injectable, `providedIn: 'root'`
   - Signals:
     - `_items = signal<InventoryItem[]>([])`
     - `_loading = signal(false)`
     - `_totalCount = signal(0)`
     - `_filters = signal<InventoryFilters>({})`
     - `_page = signal(0)`
     - `_pageSize = signal(25)`
   - Public readonly versions of all signals
   - Computed: `_setNames = computed(() => [...new Set(items().map(i => i.set_name).filter(Boolean))])` for filter dropdowns (or fetch distinctly)

   **Constructor effect** — react to shop context:
   ```typescript
   effect(() => {
     const orgId = this.shopContext.currentShopId();
     if (orgId) {
       untracked(() => {
         this._items.set([]);
         this._page.set(0);
         this._filters.set({});
         this.loadInventory();
       });
     }
   });
   ```

   **Methods:**
   - `async loadInventory()` — builds Supabase query with current filters, pagination, ordering. Uses `.range(from, to)` for server-side pagination. Excludes `deleted_at IS NOT NULL`.
   - `async addCard(card: CreateInventoryItem)` — inserts into `inventory` table, sets `created_by`, `organization_id` from context. Optimistic: prepend to `_items`, replace on success, remove on error.
   - `async updateCard(id: string, updates: Partial<CreateInventoryItem>)` — updates row, sets `updated_by`. Optimistic: update in `_items`, revert on error.
   - `async softDeleteCard(id: string)` — sets `deleted_at = now()`. Optimistic: remove from `_items`, re-add on error.
   - `async markAsSold(params: MarkSoldParams)` — calls `mark_card_sold` RPC. On success: update item status in `_items` to 'sold'.
   - `setFilters(filters: InventoryFilters)` — updates `_filters`, resets `_page` to 0, calls `loadInventory()`.
   - `setPage(page: number)` — updates `_page`, calls `loadInventory()`.
   - `async getDistinctSetNames()` — fetches unique set names for the current org (for filter dropdown).

   **Query building** (inside `loadInventory`):
   ```typescript
   let query = this.supabase.client
     .from('inventory')
     .select('*', { count: 'exact' })
     .eq('organization_id', orgId)
     .is('deleted_at', null)
     .order('created_at', { ascending: false });

   if (filters.status) query = query.eq('status', filters.status);
   if (filters.condition) query = query.eq('condition', filters.condition);
   if (filters.set_name) query = query.eq('set_name', filters.set_name);
   if (filters.search) query = query.ilike('card_name', `%${filters.search}%`);

   const from = page * pageSize;
   query = query.range(from, from + pageSize - 1);
   ```

3. **Unit tests** — `inventory.service.spec.ts`
   - Mock `SupabaseService` and `ShopContextService`
   - Test: `loadInventory` builds correct query with filters
   - Test: `addCard` optimistically prepends item
   - Test: `addCard` rolls back on error
   - Test: `softDeleteCard` removes item from signal
   - Test: `markAsSold` calls RPC with correct params
   - Test: `setFilters` resets page and reloads
   - Test: effect clears items when shop changes

### Acceptance Criteria
- Service reacts to shop context changes (clears + reloads)
- All CRUD operations work with optimistic updates
- Pagination via `.range()` with total count
- Filters applied to Supabase query correctly
- All methods return errors via `NotificationService` (toast)

---

## Ticket 2: Inventory List — Data Table View

**Branch:** `feat/phase-6.2-inventory-table`

### Summary
Build the inventory list page with a Material data table, column sorting, pagination, and status badges. This is the default view.

### Tasks

1. **Create route** — add `inventory` child route in `shop.routes.ts`
   ```typescript
   {
     path: 'inventory',
     loadComponent: () => import('./inventory/inventory-list/inventory-list.component')
       .then(m => m.InventoryListComponent)
   }
   ```

2. **Enable the inventory nav link** in `shop-layout.component.html`
   - Remove the `class="disabled"` and restore `routerLink="./inventory"`

3. **Create `InventoryListComponent`** — `src/app/features/shop/inventory/inventory-list/`
   - Injects `InventoryService`
   - Signals from service: `items`, `loading`, `totalCount`, `page`, `pageSize`, `filters`
   - Local signal: `displayMode = signal<'table' | 'grid'>('table')`
   - Template structure:
     ```html
     <!-- Header: title + view toggle + add button -->
     <!-- Filter bar (Ticket 3) -->
     <!-- Table or Grid based on displayMode -->
     <!-- Paginator -->
     ```

4. **Build the data table** using `mat-table`
   - Columns:
     | Column | Field | Sortable | Notes |
     |--------|-------|----------|-------|
     | Card Name | `card_name` | Yes | Primary, bold text |
     | Set | `set_name` | Yes | With `set_code` as subtitle |
     | # | `card_number` | No | Short column |
     | Condition | `condition` | Yes | Chip/badge with color |
     | Grade | `grade` | Yes | Show as "PSA 9.5" format |
     | Purchase | `purchase_price` | Yes | Currency pipe |
     | Price | `selling_price` | Yes | Currency pipe |
     | Status | `status` | Yes | Color-coded chip |
     | Actions | — | No | Icon buttons: edit, sell, delete |

   - Use `mat-sort` for client-side column sorting (data already loaded for the page)
   - Rows clickable → open edit dialog (Ticket 4)
   - Status chips:
     - `available` → primary color
     - `reserved` → warn/amber
     - `sold` → muted/grey

5. **Condition display pipe** — `src/app/shared/pipes/condition-label.pipe.ts`
   - Transforms `near_mint` → "Near Mint", `lightly_played` → "Lightly Played", etc.
   - Standalone pipe

6. **Paginator** — `mat-paginator`
   - Page sizes: `[10, 25, 50, 100]`
   - Default: 25
   - Connected to `InventoryService.setPage()` and `InventoryService._pageSize`
   - Shows total count from service

7. **Empty state** — when `items().length === 0 && !loading()`
   - Material card with icon, message: "No cards in inventory yet"
   - "Add Your First Card" button → opens add dialog (Ticket 4)

8. **View toggle button** in the header
   - `mat-button-toggle-group` with table/grid icons
   - Bound to `displayMode` signal
   - Grid view is a placeholder in this ticket (built in Ticket 5)

9. **Unit tests** — `inventory-list.component.spec.ts`
   - Mock `InventoryService`
   - Test: table renders with mock data
   - Test: empty state shows when no items
   - Test: paginator emits page change
   - Test: sort header emits sort change

10. **SCSS** — `inventory-list.component.scss`
    - Responsive table (horizontal scroll on mobile)
    - Status chip colors using `--mat-sys-*` tokens
    - Condition badge colors
    - Sticky header on scroll
    - Action buttons compact on mobile

### Files Created
```
src/app/features/shop/inventory/
  inventory-list/
    inventory-list.component.ts
    inventory-list.component.html
    inventory-list.component.scss
    inventory-list.component.spec.ts
src/app/shared/pipes/
  condition-label.pipe.ts
  condition-label.pipe.spec.ts
```

### Acceptance Criteria
- Table displays all inventory fields with proper formatting
- Columns sortable via `mat-sort`
- Pagination works with server-side `.range()`
- Empty state shown when no inventory
- Status and condition shown as colored badges/chips
- Currency values formatted correctly
- View toggle visible (grid placeholder for Ticket 5)
- Inventory nav link enabled in sidebar + bottom nav

---

## Ticket 3: Filter Bar

**Branch:** `feat/phase-6.3-inventory-filters`

### Summary
Add a filter bar above the inventory table with text search, status filter, condition filter, and set name filter.

### Tasks

1. **Create `InventoryFilterBarComponent`** — `src/app/features/shop/inventory/filter-bar/`
   - Standalone component
   - Inputs: `setNames: string[]` (for the set dropdown options)
   - Outputs: `filtersChanged: EventEmitter<InventoryFilters>`
   - Template:
     ```html
     <div class="filter-bar">
       <!-- Search input with debounce -->
       <mat-form-field appearance="outline" class="search-field">
         <mat-label>Search cards</mat-label>
         <input matInput [formControl]="searchControl" />
         <mat-icon matPrefix>search</mat-icon>
       </mat-form-field>

       <!-- Status filter -->
       <mat-form-field appearance="outline">
         <mat-label>Status</mat-label>
         <mat-select [formControl]="statusControl">
           <mat-option [value]="null">All</mat-option>
           <mat-option value="available">Available</mat-option>
           <mat-option value="reserved">Reserved</mat-option>
           <mat-option value="sold">Sold</mat-option>
         </mat-select>
       </mat-form-field>

       <!-- Condition filter -->
       <mat-form-field appearance="outline">
         <mat-label>Condition</mat-label>
         <mat-select [formControl]="conditionControl">
           <mat-option [value]="null">All</mat-option>
           <!-- All condition_enum values -->
         </mat-select>
       </mat-form-field>

       <!-- Set name filter -->
       <mat-form-field appearance="outline">
         <mat-label>Set</mat-label>
         <mat-select [formControl]="setControl">
           <mat-option [value]="null">All Sets</mat-option>
           @for (set of setNames; track set) {
             <mat-option [value]="set">{{ set }}</mat-option>
           }
         </mat-select>
       </mat-form-field>

       <!-- Clear filters -->
       <button mat-icon-button (click)="clearFilters()" matTooltip="Clear filters">
         <mat-icon>clear</mat-icon>
       </button>
     </div>
     ```

2. **Search debounce** — use `searchControl.valueChanges.pipe(debounceTime(300))` to avoid excessive queries

3. **Emit combined filters** — whenever any control changes, emit the full `InventoryFilters` object

4. **Wire into `InventoryListComponent`**
   - Pass `setNames` from service
   - On `filtersChanged`, call `inventoryService.setFilters()`

5. **Responsive layout**
   - Desktop: horizontal row of filters
   - Mobile: stack vertically or show as expandable panel with a "Filters" button + `mat-expansion-panel`

6. **Active filter count badge** (mobile)
   - Show a badge on the "Filters" button indicating how many filters are active

7. **Unit tests** — `filter-bar.component.spec.ts`
   - Test: search emits after debounce
   - Test: selecting status emits filter change
   - Test: clear resets all controls

### Files Created
```
src/app/features/shop/inventory/filter-bar/
  filter-bar.component.ts
  filter-bar.component.html
  filter-bar.component.scss
  filter-bar.component.spec.ts
```

### Acceptance Criteria
- Text search debounced at 300ms
- All filter dropdowns populate correctly
- Filters combine (AND logic)
- Clear button resets all filters and reloads
- Responsive: stacked on mobile or behind expandable panel
- Filter changes reset pagination to page 0

---

## Ticket 4: Add / Edit Card Dialog

**Branch:** `feat/phase-6.4-card-dialog`

### Summary
Build a `MatDialog` form for adding and editing inventory cards. Handles all fields from the inventory schema with smart defaults and conditional sections.

### Tasks

1. **Create `CardFormDialogComponent`** — `src/app/features/shop/inventory/card-form-dialog/`
   - Opened via `MatDialog.open()` from `InventoryListComponent`
   - Input data: `{ mode: 'add' | 'edit', card?: InventoryItem }`
   - Returns: the created/updated `InventoryItem` or `undefined` if cancelled

2. **Form structure** using `FormBuilder.nonNullable.group()`:

   **Section 1: Card Identity**
   - `card_name` — required, text input
   - `set_name` — optional, text input with autocomplete (from known set names)
   - `set_code` — optional, text input
   - `card_number` — optional, text input
   - `rarity` — optional, text input
   - `language` — optional, select (English, Japanese, Korean, Chinese, French, German, Italian, Spanish, Portuguese)
   - `is_foil` — checkbox / slide toggle

   **Section 2: Condition & Grading**
   - `condition` — required, select (all condition_enum values displayed with labels)
   - `grading_company` — optional, select (PSA, CGC, BGS, SGC, ACE)
   - `grade` — optional, number input (0.0–10.0, step 0.5). Only enabled/shown when `grading_company` is set.

   **Section 3: Pricing**
   - `purchase_price` — optional, number input with `$` prefix
   - `selling_price` — optional, number input with `$` prefix

   **Section 4: Notes**
   - `notes` — optional, textarea (max 500 chars, show char count)

3. **Edit mode** — pre-populate form with existing card data. Title: "Edit Card". Submit button: "Save Changes".

4. **Add mode** — empty form with defaults (condition: near_mint, language: English). Title: "Add Card". Submit button: "Add Card".

5. **Conditional grading section**
   - When `grading_company` is selected, show and enable the `grade` input
   - When `grading_company` is cleared, hide `grade` and reset its value
   - Use `@if (form.controls.grading_company.value)` in template

6. **Submit handling**
   - Add mode: call `inventoryService.addCard()`, close dialog on success, toast on error
   - Edit mode: call `inventoryService.updateCard()`, close dialog on success, toast on error
   - Show spinner on submit button while loading
   - Disable form while submitting

7. **Opening the dialog** from `InventoryListComponent`:
   ```typescript
   openAddDialog() {
     const ref = this.dialog.open(CardFormDialogComponent, {
       data: { mode: 'add' },
       width: '600px',
       maxHeight: '90vh'
     });
   }

   openEditDialog(card: InventoryItem) {
     const ref = this.dialog.open(CardFormDialogComponent, {
       data: { mode: 'edit', card },
       width: '600px',
       maxHeight: '90vh'
     });
   }
   ```

8. **Add Card FAB** on the inventory list page
   - Desktop: "Add Card" button in the header bar
   - Mobile: Floating Action Button (FAB) at bottom-right (above bottom nav)
   - Both open the add dialog

9. **Unit tests** — `card-form-dialog.component.spec.ts`
   - Test: add mode renders with empty form and defaults
   - Test: edit mode pre-fills form values
   - Test: grade field hidden when no grading company
   - Test: grade field shown when grading company selected
   - Test: form validation (card_name required)
   - Test: submit calls `addCard` in add mode
   - Test: submit calls `updateCard` in edit mode

### Files Created
```
src/app/features/shop/inventory/card-form-dialog/
  card-form-dialog.component.ts
  card-form-dialog.component.html
  card-form-dialog.component.scss
  card-form-dialog.component.spec.ts
```

### Acceptance Criteria
- Dialog opens for add and edit modes with correct title/button labels
- All inventory fields represented with appropriate input types
- Grading section conditionally shown/hidden
- Form validates required fields (card_name, condition)
- Successful add/edit shows toast and closes dialog
- Error shows toast and keeps dialog open
- Mobile: dialog uses `maxWidth: '100vw'`, `width: '100%'` on small screens

---

## Ticket 5: Card Grid View

**Branch:** `feat/phase-6.5-card-grid`

### Summary
Build an alternative grid/card view for the inventory list. Users toggle between table and grid views.

### Tasks

1. **Create `InventoryGridComponent`** — `src/app/features/shop/inventory/inventory-grid/`
   - Standalone component
   - Input: `items: InventoryItem[]`
   - Output: `cardClicked: EventEmitter<InventoryItem>`
   - Template: responsive CSS grid of `mat-card` tiles

2. **Card tile design**
   - Card name as title (bold)
   - Set name + card number as subtitle
   - Status chip (top-right corner, absolute positioned)
   - Condition badge
   - Price: selling price prominent, purchase price small/muted
   - Foil indicator (sparkle icon or "FOIL" badge if `is_foil`)
   - Graded indicator: "PSA 9.5" badge if graded
   - Click → emits `cardClicked` → parent opens edit dialog

3. **Responsive grid**
   - Mobile (< 768px): 2 columns
   - Tablet (768–1199px): 3 columns
   - Desktop (>= 1200px): 4 columns
   - Gap: 1rem
   - Cards use glassmorphism from global theme

4. **Wire into `InventoryListComponent`**
   - Show grid when `displayMode() === 'grid'`
   - Pass `items()` and handle `cardClicked`

5. **Unit tests** — `inventory-grid.component.spec.ts`
   - Test: renders correct number of cards
   - Test: displays card name, set, price
   - Test: shows foil indicator when `is_foil`
   - Test: emits card on click

### Files Created
```
src/app/features/shop/inventory/inventory-grid/
  inventory-grid.component.ts
  inventory-grid.component.html
  inventory-grid.component.scss
  inventory-grid.component.spec.ts
```

### Acceptance Criteria
- Grid renders all cards with key info visible
- Responsive columns at all breakpoints
- Status and condition displayed as visual badges
- Foil and graded cards visually distinct
- Click opens edit dialog
- Smooth toggle between table and grid (no layout jank)

---

## Ticket 6: Mark as Sold Dialog

**Branch:** `feat/phase-6.6-mark-sold`

### Summary
Build a dialog for marking a card as sold. Captures sold price (required), buyer email (optional), and buyer notes (optional). Calls the `mark_card_sold` RPC.

### Tasks

1. **Create `MarkSoldDialogComponent`** — `src/app/features/shop/inventory/mark-sold-dialog/`
   - Opened via `MatDialog.open()` from table/grid action button
   - Input data: `{ card: InventoryItem }`
   - Returns: the created `Transaction` or `undefined`

2. **Form fields:**
   - Card info summary (read-only): card name, set, current selling price (for reference)
   - `sold_price` — required, number input with `$` prefix. Default: card's `selling_price` if set.
   - `buyer_email` — optional, email input
   - `buyer_notes` — optional, textarea

3. **Submit** — calls `inventoryService.markAsSold()`:
   - On success: toast "Card marked as sold", close dialog
   - On error: toast error, keep dialog open
   - Loading spinner on button

4. **Confirmation text** — "This will mark the card as sold and create a transaction record. This action cannot be undone."

5. **Wire into list/grid**
   - Table: "Sell" icon button in actions column (only shown for `available` cards)
   - Grid: "Sell" button on card tile (only for `available`)
   - Both open the dialog

6. **Post-sale UI update**
   - Card stays in the list but status changes to "sold"
   - Sold cards show greyed out or with a sold overlay
   - Sell button hidden for non-available cards

7. **Unit tests** — `mark-sold-dialog.component.spec.ts`
   - Test: pre-fills sold_price from selling_price
   - Test: sold_price is required
   - Test: submit calls RPC with correct params
   - Test: buyer_email validates as email format

### Files Created
```
src/app/features/shop/inventory/mark-sold-dialog/
  mark-sold-dialog.component.ts
  mark-sold-dialog.component.html
  mark-sold-dialog.component.scss
  mark-sold-dialog.component.spec.ts
```

### Acceptance Criteria
- Dialog shows card summary for context
- Sold price defaults to selling price
- Buyer info fields are optional
- RPC called correctly, transaction created
- Card status updates to "sold" in the list after closing dialog
- Toast confirms sale
- Sell button only visible on available cards

---

## Ticket 7: Soft Delete & Undo

**Branch:** `feat/phase-6.7-soft-delete`

### Summary
Implement card deletion with soft delete and a brief undo window via toast.

### Tasks

1. **Delete action** in table and grid
   - Table: trash icon in actions column
   - Grid: overflow menu or swipe action
   - Confirmation: none (undo via toast instead — faster workflow)

2. **Optimistic soft delete**
   - Immediately remove card from `_items` signal
   - Show toast: "Card deleted" with "Undo" action button (5 second duration)
   - If undo clicked: re-add card to `_items`, cancel the Supabase update
   - If toast dismissed: commit the `deleted_at = now()` update to Supabase

3. **Implementation pattern:**
   ```typescript
   async softDeleteCard(id: string) {
     const item = this._items().find(i => i.id === id);
     if (!item) return;

     // Optimistic remove
     this._items.update(items => items.filter(i => i.id !== id));

     const snackRef = this.notification.showWithAction('Card deleted', 'Undo', 5000);

     const undone = await firstValueFrom(
       snackRef.onAction().pipe(
         map(() => true),
         timeout(5500),
         catchError(() => of(false))
       )
     );

     if (undone) {
       // Restore
       this._items.update(items => [...items, item].sort(/* original order */));
       this.notification.info('Card restored');
     } else {
       // Commit to DB
       const { error } = await this.supabase.client
         .from('inventory')
         .update({ deleted_at: new Date().toISOString() })
         .eq('id', id);
       if (error) {
         // Rollback on DB error
         this._items.update(items => [...items, item]);
         this.notification.error('Failed to delete card');
       }
     }
   }
   ```

4. **Add `showWithAction` method to `NotificationService`**
   - Returns the `MatSnackBarRef` so callers can listen to `onAction()`
   - Used for undo pattern

5. **Unit tests**
   - Test: card removed from signal immediately
   - Test: undo restores card
   - Test: timeout commits delete to Supabase
   - Test: DB error rolls back deletion

### Files Modified
```
src/app/core/services/inventory.service.ts   (add softDeleteCard logic)
src/app/core/services/notification.service.ts (add showWithAction)
```

### Acceptance Criteria
- Card disappears immediately from list on delete
- Toast with "Undo" button appears for 5 seconds
- Clicking "Undo" restores the card
- Letting toast dismiss commits the soft delete to Supabase
- DB errors restore the card and show error toast
- Deleted cards never appear in queries (filtered by `deleted_at IS NULL`)

---

## Ticket 8: E2E Inventory Tests

**Branch:** `feat/phase-6.8-inventory-e2e`

### Summary
End-to-end Playwright tests covering the full inventory CRUD lifecycle.

### Tasks

1. **`e2e/inventory.spec.ts`** — Core CRUD flow
   - Log in, create/select shop
   - Navigate to inventory (empty state)
   - Add a card via dialog → verify it appears in table
   - Edit the card → verify changes reflected
   - Toggle to grid view → verify card visible
   - Toggle back to table → verify card visible

2. **`e2e/inventory-filters.spec.ts`** — Filter behavior
   - Add multiple cards with different conditions/sets/statuses
   - Filter by status → verify filtered results
   - Filter by condition → verify filtered results
   - Search by card name → verify results
   - Clear filters → verify all cards shown
   - Combine filters → verify AND logic

3. **`e2e/inventory-sell.spec.ts`** — Mark as sold flow
   - Add a card
   - Click sell → fill dialog → confirm
   - Verify card shows "sold" status
   - Verify sell button no longer shown for sold card

4. **`e2e/inventory-delete.spec.ts`** — Soft delete + undo
   - Add a card
   - Delete it → verify removed from list
   - (Optional) Verify undo restores — may be flaky with toast timing
   - Add and delete another → let toast expire → verify card stays gone on reload

### Files Created
```
e2e/inventory.spec.ts
e2e/inventory-filters.spec.ts
e2e/inventory-sell.spec.ts
e2e/inventory-delete.spec.ts
```

### Acceptance Criteria
- All critical CRUD paths covered
- Tests isolated (each creates its own shop/cards)
- Filters tested in combination
- Sell flow verified end-to-end
- Tests pass reliably (no flaky timing issues)

---

## Dependency Graph & Suggested Merge Order

```
Ticket 1: Inventory Service       (foundational — models + service)
    ↓
Ticket 2: Data Table View         (depends on 1 — the list page)
    ↓
Ticket 3: Filter Bar              (depends on 2 — plugs into list)
    ↓
Ticket 4: Add/Edit Dialog         (depends on 2 — opened from list)
    ↓
Ticket 5: Card Grid View          (depends on 2 — alternative view)
    ↓
Ticket 6: Mark as Sold Dialog     (depends on 2, 4 pattern — dialog + RPC)
    ↓
Ticket 7: Soft Delete & Undo      (depends on 1 — service method + toast enhancement)
    ↓
Ticket 8: E2E Tests               (depends on all above)
```

**Recommended order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

Tickets 3, 4, and 5 can be worked in parallel after Ticket 2 since they plug into the list independently.

---

## Files Changed Across All Tickets (Summary)

### New Files
```
src/app/core/models/inventory.model.ts                          (Ticket 1)
src/app/core/services/inventory.service.ts                      (Ticket 1)
src/app/core/services/inventory.service.spec.ts                 (Ticket 1)
src/app/features/shop/inventory/
  inventory-list/                                                (Ticket 2)
  filter-bar/                                                    (Ticket 3)
  card-form-dialog/                                              (Ticket 4)
  inventory-grid/                                                (Ticket 5)
  mark-sold-dialog/                                              (Ticket 6)
src/app/shared/pipes/condition-label.pipe.ts                     (Ticket 2)
src/app/shared/pipes/condition-label.pipe.spec.ts                (Ticket 2)
e2e/inventory.spec.ts                                            (Ticket 8)
e2e/inventory-filters.spec.ts                                    (Ticket 8)
e2e/inventory-sell.spec.ts                                       (Ticket 8)
e2e/inventory-delete.spec.ts                                     (Ticket 8)
```

### Modified Files
```
src/app/features/shop/shop.routes.ts                             (Ticket 2 — add inventory route)
src/app/features/shop/shop-layout/shop-layout.component.html     (Ticket 2 — enable inventory link)
src/app/core/services/notification.service.ts                    (Ticket 7 — add showWithAction)
```

### No New Migrations Needed
The `inventory` table, `transactions` table, `mark_card_sold` RPC, and all relevant indexes already exist from Phase 2 migrations. No new database changes required for Phase 6.
