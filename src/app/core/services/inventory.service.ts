import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { ShopContextService } from './shop-context.service';
import {
  InventoryItem,
  CreateInventoryItem,
  InventoryFilters,
  MarkSoldParams,
} from '../models/inventory.model';

@Injectable({
  providedIn: 'root',
})
export class InventoryService {
  private readonly supabase = inject(SupabaseService);
  private readonly shopContext = inject(ShopContextService);

  // State signals
  private readonly _items = signal<InventoryItem[]>([]);
  private readonly _loading = signal(false);
  private readonly _totalCount = signal(0);
  private readonly _filters = signal<InventoryFilters>({});
  private readonly _page = signal(0);
  private readonly _pageSize = signal(25);
  private readonly _sortColumn = signal<string>('created_at');
  private readonly _sortDirection = signal<'asc' | 'desc'>('desc');
  private readonly _distinctSetNames = signal<string[]>([]);

  // Public readonly signals
  readonly items = this._items.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly totalCount = this._totalCount.asReadonly();
  readonly filters = this._filters.asReadonly();
  readonly page = this._page.asReadonly();
  readonly pageSize = this._pageSize.asReadonly();
  readonly sortColumn = this._sortColumn.asReadonly();
  readonly sortDirection = this._sortDirection.asReadonly();
  readonly distinctSetNames = this._distinctSetNames.asReadonly();

  constructor() {
    effect(() => {
      const orgId = this.shopContext.currentShopId();
      if (orgId) {
        untracked(() => {
          this._items.set([]);
          this._page.set(0);
          this._filters.set({});
          this.loadInventory();
          this.getDistinctSetNames();
        });
      }
    });
  }

  async loadInventory(): Promise<void> {
    const orgId = this.shopContext.currentShopId();
    if (!orgId) return;

    this._loading.set(true);

    const filters = this._filters();
    const page = this._page();
    const pageSize = this._pageSize();
    const from = page * pageSize;

    let query = this.supabase.client
      .from('inventory')
      .select('*', { count: 'exact' })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order(this._sortColumn(), { ascending: this._sortDirection() === 'asc' });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.condition) query = query.eq('condition', filters.condition);
    if (filters.set_name) query = query.eq('set_name', filters.set_name);
    if (filters.search) {
      const escaped = filters.search.replace(/[%_]/g, '\\$&');
      query = query.ilike('card_name', `%${escaped}%`);
    }

    query = query.range(from, from + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Failed to load inventory:', error);
      this._loading.set(false);
      return;
    }

    this._items.set((data as InventoryItem[]) ?? []);
    this._totalCount.set(count ?? 0);
    this._loading.set(false);
  }

  async addCard(
    card: CreateInventoryItem,
  ): Promise<{ data: InventoryItem | null; error: unknown }> {
    const orgId = this.shopContext.currentShopId();
    const userId = this.supabase.user()?.id;
    if (!orgId) return { data: null, error: 'No shop selected' };

    // Create optimistic item
    const optimisticItem: InventoryItem = {
      id: crypto.randomUUID(),
      organization_id: orgId,
      card_name: card.card_name,
      set_name: card.set_name,
      set_code: card.set_code,
      card_number: card.card_number,
      rarity: card.rarity,
      language: card.language ?? 'English',
      is_foil: card.is_foil ?? false,
      condition: card.condition ?? 'near_mint',
      grading_company: card.grading_company,
      grade: card.grade,
      purchase_price: card.purchase_price,
      selling_price: card.selling_price,
      status: 'available',
      notes: card.notes,
      created_at: new Date().toISOString(),
      created_by: userId,
      updated_at: new Date().toISOString(),
    };

    // Optimistic prepend
    this._items.update(items => [optimisticItem, ...items]);
    this._totalCount.update(c => c + 1);

    const { data, error } = await this.supabase.client
      .from('inventory')
      .insert({
        ...card,
        organization_id: orgId,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      // Rollback
      this._items.update(items => items.filter(i => i.id !== optimisticItem.id));
      this._totalCount.update(c => c - 1);
      return { data: null, error };
    }

    // Replace optimistic item with real one
    this._items.update(items =>
      items.map(i => (i.id === optimisticItem.id ? (data as InventoryItem) : i)),
    );
    this.getDistinctSetNames();

    return { data: data as InventoryItem, error: null };
  }

  async updateCard(
    id: string,
    updates: Partial<CreateInventoryItem>,
  ): Promise<{ data: InventoryItem | null; error: unknown }> {
    const userId = this.supabase.user()?.id;
    const original = this._items().find(i => i.id === id);
    if (!original) return { data: null, error: 'Item not found' };

    // Optimistic update
    this._items.update(items =>
      items.map(i =>
        i.id === id ? { ...i, ...updates, updated_at: new Date().toISOString() } : i,
      ),
    );

    const { data, error } = await this.supabase.client
      .from('inventory')
      .update({ ...updates, updated_by: userId, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      // Rollback
      this._items.update(items => items.map(i => (i.id === id ? original : i)));
      return { data: null, error };
    }

    // Replace with server response
    this._items.update(items => items.map(i => (i.id === id ? (data as InventoryItem) : i)));
    if (updates.set_name !== undefined) {
      this.getDistinctSetNames();
    }
    return { data: data as InventoryItem, error: null };
  }

  async softDeleteCard(id: string): Promise<{ error: unknown }> {
    const original = this._items().find(i => i.id === id);
    if (!original) return { error: 'Item not found' };

    // Optimistic remove
    this._items.update(items => items.filter(i => i.id !== id));
    this._totalCount.update(c => c - 1);

    const { error } = await this.supabase.client
      .from('inventory')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      // Rollback
      this._items.update(items => [...items, original]);
      this._totalCount.update(c => c + 1);
      return { error };
    }

    return { error: null };
  }

  async markAsSold(params: MarkSoldParams): Promise<{ data: unknown; error: unknown }> {
    const { data, error } = await this.supabase.rpc('mark_card_sold', {
      p_inventory_id: params.inventory_id,
      p_sold_price: params.sold_price,
      p_buyer_email: params.buyer_email ?? null,
      p_buyer_notes: params.buyer_notes ?? null,
    });

    if (!error) {
      // Update item status in signal
      this._items.update(items =>
        items.map(i => (i.id === params.inventory_id ? { ...i, status: 'sold' as const } : i)),
      );
    }

    return { data, error };
  }

  setFilters(filters: InventoryFilters): void {
    this._filters.set(filters);
    this._page.set(0);
    this.loadInventory();
  }

  setPage(page: number): void {
    this._page.set(page);
    this.loadInventory();
  }

  setPagination(page: number, pageSize: number): void {
    this._page.set(page);
    this._pageSize.set(pageSize);
    this.loadInventory();
  }

  setSort(column: string, direction: 'asc' | 'desc'): void {
    this._sortColumn.set(column);
    this._sortDirection.set(direction);
    this.loadInventory();
  }

  async getDistinctSetNames(): Promise<void> {
    const orgId = this.shopContext.currentShopId();
    if (!orgId) return;

    const { data } = await this.supabase.client
      .from('inventory')
      .select('set_name')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .not('set_name', 'is', null)
      .order('set_name');

    const rows = Array.isArray(data) ? data : [];
    const names = rows.map((d: { set_name: string }) => d.set_name);
    this._distinctSetNames.set([...new Set(names)]);
  }
}
