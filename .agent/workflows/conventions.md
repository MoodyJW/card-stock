---
description: Coding conventions and patterns for CardStock development
---

# CardStock Coding Conventions

## Core Principles

1. **Mobile-first** - Touch targets ≥44px, thumb-zone-friendly layouts
2. **RPC-first for sensitive ops** - Use SECURITY DEFINER RPCs, not direct table writes
3. **Reactive state** - Domain services react to store context via `effect()`

---

## Tech Stack

- **Angular 21** with Signals, standalone components (default), built-in control flow
- **Angular Material** for UI components
- **Supabase** for backend (PostgreSQL, Auth, RLS)
- **Vitest** for testing

---

## Component Patterns

### Modern Standalone Components

Angular 21 components are standalone by default. Use built-in control flow:

```typescript
import { Component, inject } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { DatePipe } from '@angular/common'; // Import individual utilities, not CommonModule

@Component({
  selector: 'app-card-list',
  imports: [MatTableModule, MatButtonModule, DatePipe],
  templateUrl: './card-list.component.html',
  styleUrl: './card-list.component.scss',
})
export class CardListComponent {
  private readonly inventory = inject(InventoryService);
  
  readonly items = this.inventory.items;
  readonly loading = this.inventory.loading;
}
```

### Template Control Flow

Use built-in control flow, NOT `*ngIf` / `*ngFor`:

```html
@if (loading()) {
  <mat-spinner />
} @else {
  @for (item of items(); track item.id) {
    <app-card-item [card]="item" />
  } @empty {
    <p>No cards found</p>
  }
}
```

### File Naming & Structure

```
src/app/features/inventory/
├── card-list/
│   ├── card-list.component.ts
│   ├── card-list.component.html
│   └── card-list.component.scss
├── card-form/
│   └── ...
└── inventory.routes.ts
```

---

## Dependency Injection

Use the `inject()` function, NOT constructor injection:

```typescript
// ✅ Modern pattern
export class CardListComponent {
  private readonly inventory = inject(InventoryService);
  private readonly storeContext = inject(StoreContextService);
}

// ❌ Legacy pattern
export class CardListComponent {
  constructor(private inventory: InventoryService) {}
}
```

---

## State Management with Signals

### StoreContextService Pattern

Domain services MUST react to store context changes via `effect()`:

```typescript
@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly storeContext = inject(StoreContextService);
  private readonly supabase = inject(SupabaseService);
  
  private readonly _items = signal<InventoryItem[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly items = this._items.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly count = computed(() => this._items().length);

  constructor() {
    // React to store context changes - clears stale data and reloads
    effect(() => {
      const orgId = this.storeContext.currentOrgId();
      if (orgId) {
        this._items.set([]);
        this.loadItems();
      }
    });
  }
}
```

### Optimistic Updates with Rollback

```typescript
async addCard(card: NewCard): Promise<void> {
  const optimistic = { ...card, id: crypto.randomUUID() };
  this._items.update(items => [optimistic, ...items]);
  
  try {
    const result = await this.supabase.client.rpc('add_inventory_item', card);
    this._items.update(items => 
      items.map(i => i.id === optimistic.id ? result : i)
    );
  } catch (e) {
    // Rollback on failure
    this._items.update(items => items.filter(i => i.id !== optimistic.id));
    throw e;
  }
}
```

---

## Supabase Patterns

### Use the existing SupabaseService

Located at `src/app/core/services/supabase.service.ts`. Never create a new client.

### RPC-First for Sensitive Operations

These operations MUST use RPCs, NOT direct table writes:

| Operation | RPC |
|-----------|-----|
| Create store | `create_organization` |
| Accept invite | `accept_invite` |
| Mark card sold | `mark_card_sold` |
| Delete store | `soft_delete_organization` |
| Leave store | `leave_organization` |

```typescript
async markCardSold(inventoryId: string, price: number): Promise<void> {
  const { error } = await this.supabase.client.rpc('mark_card_sold', {
    p_inventory_id: inventoryId,
    p_sold_price: price,
  });
  if (error) throw error;
}
```

---

## Error Handling

### Two-Layer Strategy

1. **Global ErrorHandler** (`core/error-handling/`) - Catches ALL unhandled errors including Supabase promise rejections
2. **Per-method try/catch** - For local error state and user feedback

```typescript
async loadItems(): Promise<void> {
  this._loading.set(true);
  this._error.set(null);
  try {
    const { data, error } = await this.supabase.client
      .from('inventory')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    this._items.set(data ?? []);
  } catch (e) {
    this._error.set(e instanceof Error ? e.message : 'Unknown error');
    // Error also caught by global ErrorHandler for logging/toasts
  } finally {
    this._loading.set(false);
  }
}
```

---

## Angular Material Usage

Import components individually. Use Material Icons. Theme is in `src/styles.scss`.

```typescript
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
```

---

## Mobile-First Design

- **Touch targets:** Minimum 44×44px
- **Thumb zones:** Primary actions at bottom of screen
- **Breakpoints:** Design for mobile first, enhance for desktop
- **Inputs:** Use appropriate input types (`inputmode`, `type`)

---

## Do NOT Use

- ❌ `standalone: true` (it's the default)
- ❌ `CommonModule` (use built-in control flow + individual imports)
- ❌ Constructor injection (use `inject()`)
- ❌ Direct table writes for sensitive ops (use RPCs)
- ❌ Tailwind CSS (use Angular Material + SCSS)
- ❌ NgRx or external state libraries
- ❌ Creating new Supabase clients
- ❌ HttpInterceptor for error handling
